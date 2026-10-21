
import fs from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import mime from "mime-types";

import { GDRIVE_BASE_ID } from "../../config/env.js";
import type { Bot, UploadFileResult } from "./types.js";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

interface DriveFolderMetadata {
  id?: string | null;
  mimeType?: string | null;
  parents?: string[] | null;
  trashed?: boolean | null;
}

/**
 * Checks whether a destination folder is the base folder
 * or a descendant of it.
 */
async function isWithinBaseFolder(
  bot: Bot,
  destinationFolderId: string,
): Promise<boolean> {
  const baseFolderId = GDRIVE_BASE_ID;

  if (!baseFolderId || !destinationFolderId) {
    return false;
  }

  let currentFolderId = destinationFolderId;
  const visited = new Set<string>();

  while (currentFolderId) {
    if (currentFolderId === baseFolderId) {
      return true;
    }

    // Protect against unexpected cycles or malformed metadata.
    if (visited.has(currentFolderId)) {
      return false;
    }

    visited.add(currentFolderId);

    const response = await bot.drive.files.get({
      fileId: currentFolderId,
      supportsAllDrives: true,
      fields: "id,mimeType,parents,trashed",
    });

    const folder = response.data as DriveFolderMetadata;

    if (
      folder.trashed ||
      folder.mimeType !== FOLDER_MIME_TYPE
    ) {
      return false;
    }

    const parents = folder.parents ?? [];

    // Drive folders have at most one parent.
    if (parents.length === 0) {
      return false;
    }

    currentFolderId = parents[0];
  }

  return false;
}

/**
 * Uploads a local file into a folder under GDRIVE_BASE_ID.
 *
 * @param filePath Local filesystem path to the file.
 * @param bot Bot with an authenticated Google Drive client.
 * @param fileId Destination Google Drive folder ID.
 */
export async function uploadFile(
  filePath: string,
  bot: Bot,
  fileId: string,
): Promise<UploadFileResult> {
  try {
    if (!filePath?.trim()) {
      return {
        state: "error",
        error: "filePath must not be empty.",
      };
    }

    if (!fileId?.trim()) {
      return {
        state: "error",
        error: "Destination folder ID must not be empty.",
      };
    }

    if (!GDRIVE_BASE_ID) {
      return {
        state: "error",
        error: "GDRIVE_BASE_ID is not configured.",
      };
    }

    const absolutePath = path.resolve(filePath);

    let fileStats: fs.Stats;

    try {
      fileStats = await fs.promises.stat(absolutePath);
    } catch {
      return {
        state: "error",
        error: `Local file does not exist or cannot be accessed: ${filePath}`,
      };
    }

    if (!fileStats.isFile()) {
      return {
        state: "error",
        error: `Path is not a regular file: ${filePath}`,
      };
    }

    // Ensure the destination folder is inside the configured base.
    const allowed = await isWithinBaseFolder(bot, fileId);

    if (!allowed) {
      return {
        state: "error",
        error:
          "Destination folder does not belong to GDRIVE_BASE_ID, " +
          "is not a valid folder, or is inaccessible.",
      };
    }

    const fileName = path.basename(absolutePath);
    const mimeType =
      mime.lookup(fileName) || "application/octet-stream";

    const response = await bot.drive.files.create({
      requestBody: {
        name: fileName,
        parents: [fileId],
      },
      media: {
        mimeType,
        body: fs.createReadStream(absolutePath),
      },
      supportsAllDrives: true,
      fields: "id,name,mimeType,webViewLink",
    });

    const uploaded = response.data;

    if (!uploaded.id) {
      return {
        state: "error",
        error: "Google Drive returned no ID for the uploaded file.",
      };
    }

    return {
      state: "success",
      fileId: uploaded.id,
      name: uploaded.name ?? fileName,
      mimeType: uploaded.mimeType ?? mimeType,
      webViewLink: uploaded.webViewLink,
    };
  } catch (error: unknown) {
    const apiError = error as {
      message?: string;
      code?: number;
      response?: { status?: number };
    };

    const code =
      apiError.response?.status ?? apiError.code;

    return {
      state: "error",
      error: apiError.message ?? "Failed to upload file to Google Drive.",
      ...(typeof code === "number" ? { code } : {}),
    };
  }
}

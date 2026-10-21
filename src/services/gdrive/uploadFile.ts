
import { Bot } from "grammy";
import { GoogleAuth } from "google-auth-library";
import { google, drive_v3 } from "googleapis";
import path from "node:path";
import { Readable } from "node:stream";

import { GDRIVE_BASE_ID } from "../../config/env.js";
import type { UploadFileResult } from "./types.js";

const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

let driveClient: drive_v3.Drive | undefined;

function getDriveClient(): drive_v3.Drive {
  if (!driveClient) {
    const auth = new GoogleAuth({
      scopes: [DRIVE_SCOPE],
    });

    driveClient = google.drive({
      version: "v3",
      auth,
    });
  }

  return driveClient;
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Finds an existing child folder, or creates it if it doesn't exist.
 */
async function getOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
): Promise<string> {
  const escapedName = escapeDriveQuery(name);

  const result = await drive.files.list({
    q:
      `name = '${escapedName}' and ` +
      `mimeType = '${FOLDER_MIME_TYPE}' and ` +
      `'${escapeDriveQuery(parentId)}' in parents and ` +
      "trashed = false",
    pageSize: 100,
    orderBy: "createdTime",
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingFolder = result.data.files?.[0];

  if (existingFolder?.id) {
    return existingFolder.id;
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: FOLDER_MIME_TYPE,
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  if (!created.data.id) {
    throw new Error(`Google Drive did not return an ID for folder "${name}".`);
  }

  return created.data.id;
}

/**
 * Resolves a relative directory path inside GDRIVE_BASE_ID.
 *
 * Example: "s5/se" creates or reuses:
 * GDRIVE_BASE_ID / s5 / se
 */
async function resolveFolderPath(
  drive: drive_v3.Drive,
  relativePath: string,
): Promise<string> {
  if (!GDRIVE_BASE_ID) {
    throw new Error("GDRIVE_BASE_ID is not configured.");
  }

  const normalizedPath = relativePath.replace(/\\/g, "/");

  if (
    normalizedPath.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalizedPath)
  ) {
    throw new Error("filePath must be a relative Google Drive folder path.");
  }

  const segments = normalizedPath
    .split("/")
    .filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("filePath cannot contain '.' or '..' path segments.");
  }

  let parentId = GDRIVE_BASE_ID;

  for (const segment of segments) {
    parentId = await getOrCreateFolder(drive, segment, parentId);
  }

  return parentId;
}

/**
 * Uploads a Telegram file into a relative folder inside GDRIVE_BASE_ID.
 *
 * @param filePath Relative Google Drive folder path, e.g. "s5/se".
 * @param bot grammY bot that can access the Telegram file.
 * @param fileId Telegram file_id (not file_unique_id).
 */
export async function uploadFile(
  filePath: string,
  bot: Bot,
  fileId: string,
): Promise<UploadFileResult> {
  try {
    if (!fileId?.trim()) {
      return {
        state: "error",
        error: "Telegram fileId must not be empty.",
      };
    }

    if (!filePath?.trim()) {
      return {
        state: "error",
        error: "filePath must not be empty.",
      };
    }

    if (!bot.token) {
      return {
        state: "error",
        error: "The grammY bot token is not available.",
      };
    }

    if (!GDRIVE_BASE_ID) {
      return {
        state: "error",
        error: "GDRIVE_BASE_ID is not configured.",
      };
    }

    const drive = getDriveClient();

    // 1. Resolve the Telegram file metadata.
    const telegramFile = await bot.api.getFile(fileId);

    if (!telegramFile.file_path) {
      throw new Error("Telegram did not return a downloadable file path.");
    }

    // 2. Download the file from Telegram.
    const telegramUrl =
      `https://api.telegram.org/file/bot${bot.token}/` +
      telegramFile.file_path;

    const response = await fetch(telegramUrl);

    if (!response.ok) {
      throw new Error(
        `Telegram file download failed with HTTP ${response.status}.`,
      );
    }

    if (!response.body) {
      throw new Error("Telegram returned an empty download response.");
    }

    // Telegram's standard Bot API currently supports downloads up to 20 MB.
    const contentLength = Number(response.headers.get("content-length") ?? 0);

    if (contentLength > 20 * 1024 * 1024) {
      throw new Error("Telegram file exceeds the standard 20 MB download limit.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length === 0) {
      throw new Error("The downloaded Telegram file is empty.");
    }

    if (buffer.length > 20 * 1024 * 1024) {
      throw new Error("Telegram file exceeds the standard 20 MB download limit.");
    }

    // 3. Create any missing folders under GDRIVE_BASE_ID.
    const destinationFolderId = await resolveFolderPath(
      drive,
      filePath,
    );

    // Telegram may not preserve the original filename.
    const fileName = path.posix.basename(telegramFile.file_path);
    const mimeType =
      response.headers.get("content-type")?.split(";")[0] ||
      "application/octet-stream";

    // 4. Upload the content into the resolved folder.
    const uploaded = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [destinationFolderId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id,name,webViewLink",
      supportsAllDrives: true,
    });

    if (!uploaded.data.id) {
      throw new Error("Google Drive did not return an uploaded file ID.");
    }

    return {
      state: "success",
      fileId: uploaded.data.id,
      name: uploaded.data.name ?? fileName,
      folderId: destinationFolderId,
      webViewLink: uploaded.data.webViewLink,
    };
  } catch (error: unknown) {
    const apiError = error as {
      message?: string;
      code?: number;
      response?: { status?: number };
    };

    const code = apiError.response?.status ?? apiError.code;

    return {
      state: "error",
      error: apiError.message ?? "Failed to upload Telegram file to Google Drive.",
      ...(typeof code === "number" ? { code } : {}),
    };
  }
}

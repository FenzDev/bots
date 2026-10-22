import type { Bot } from "grammy";
import {
  GOOGLE_APPS_SCRIPT_SECRET,
  GOOGLE_APPS_SCRIPT_URL,
  NODE_ENV,
} from "../../config/env.js";

type UploadFileResult =
  | {
      success: true;
      fileId: string;
      name: string;
      folderId: string;
      webViewLink: string;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

export async function uploadFile(
  filePath: string,
  bot: Bot,
  fileId: string,
): Promise<UploadFileResult> {
  try {
    const env = NODE_ENV;
    const appsScriptUrl = GOOGLE_APPS_SCRIPT_URL;
    const secret = GOOGLE_APPS_SCRIPT_SECRET;

    if (
      (env !== "development" && env !== "production") ||
      !appsScriptUrl ||
      !secret
    ) {
      return {
        success: false,
        error: "Google Drive upload configuration is missing or invalid",
        code: "CONFIG_ERROR",
      };
    }

    // filePath is the relative folder path, e.g. "s5/se".
    const folderPath = filePath.replace(/^\/+|\/+$/g, "");

    const telegramFile = await bot.api.getFile(fileId);

    if (!telegramFile.file_path) {
      return {
        success: false,
        error: "Telegram did not return a file path",
        code: "FILE_PATH_MISSING",
      };
    }

    const downloadUrl =
      `https://api.telegram.org/file/bot${bot.token}/` + telegramFile.file_path;

    const downloadResponse = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(180_000),
    });

    if (!downloadResponse.ok) {
      return {
        success: false,
        error: `Telegram file download failed: ${downloadResponse.status}`,
        code: "DOWNLOAD_FAILED",
      };
    }

    const contentLength = Number(
      downloadResponse.headers.get("content-length") || 0,
    );

    const maxBytes = 10 * 1024 * 1024;

    if (contentLength > maxBytes) {
      return {
        success: false,
        error: "File exceeds the 10 MB upload limit",
        code: "FILE_TOO_LARGE",
      };
    }

    const fileBuffer = Buffer.from(await downloadResponse.arrayBuffer());

    if (fileBuffer.length > maxBytes) {
      return {
        success: false,
        error: "File exceeds the 10 MB upload limit",
        code: "FILE_TOO_LARGE",
      };
    }

    const fileName = telegramFile.file_path.split("/").pop() || "telegram-file";

    const mimeType =
      downloadResponse.headers.get("content-type") ||
      "application/octet-stream";

    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        env,
        secret,
        fileName,
        folderPath,
        mimeType,
        base64: fileBuffer.toString("base64"),
      }),
      signal: AbortSignal.timeout(180_000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Apps Script request failed: HTTP ${response.status}`,
        code: "APPS_SCRIPT_HTTP_ERROR",
      };
    }

    const result = (await response.json()) as {
      ok: boolean;
      error?: string;
      fileId?: string;
      name?: string;
      folderId?: string;
      webViewLink?: string;
    };

    if (
      !result.ok ||
      !result.fileId ||
      !result.name ||
      !result.folderId ||
      !result.webViewLink
    ) {
      return {
        success: false,
        error: result.error || "Apps Script returned an invalid response",
        code: "DRIVE_UPLOAD_FAILED",
      };
    }

    return {
      success: true,
      fileId: result.fileId,
      name: result.name,
      folderId: result.folderId,
      webViewLink: result.webViewLink,
    };
  } catch (error) {
    console.error(
      "Google Drive upload failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown upload error",
      code: "UPLOAD_ERROR",
    };
  }
}


import type { drive_v3 } from "googleapis";

export interface Bot {
  drive: drive_v3.Drive;
}

export interface UploadFileSuccess {
  state: "success";
  fileId: string;
  name: string;
  mimeType: string;
  webViewLink?: string | null;
}

export interface UploadFileError {
  state: "error";
  error: string;
  code?: number;
}

export type UploadFileResult = UploadFileSuccess | UploadFileError;

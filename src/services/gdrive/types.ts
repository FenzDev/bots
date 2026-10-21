export interface UploadFileSuccess {
  state: "success";
  fileId: string;
  name: string;
  folderId: string;
  webViewLink?: string | null;
}

export interface UploadFileError {
  state: "error";
  error: string;
  code?: number;
}

export type UploadFileResult = UploadFileSuccess | UploadFileError;

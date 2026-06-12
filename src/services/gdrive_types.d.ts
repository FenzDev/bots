interface _GDriveFile {
  id : string,
  name : string,
  lastModify : string,
  mimeType : string
}

type _State = "OK" | "ERR_PARAM" | "ERR_SCRIPT";
type _ResultType = "folder" | "file"

export interface GDriveGetData {
  state : _State,
  location : Array<string>,
  resultType : _ResultType,
  message? : string,
  name? : string,
  id? : string,
  isMediaGroup? : Boolean,
  files? : Array<_GDriveFile>,
  folders? : Array<_GDriveFile>,
  shortcuts? : Array<_GDriveFile>,
  file? : _GDriveFile,
  fullError? : string,
}
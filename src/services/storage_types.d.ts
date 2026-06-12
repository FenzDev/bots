import { _GDriveFile } from "./gdrive_types";

interface _ConstantsGroup {
  id: number;
  docMods: Array<number>;
  grpMods: Array<number>;
}

interface _SectionsInt {
  l1: number;
  l1a: number;
  l1b: number;
  l2: number;
}

interface _SectionsStr {
  l1: string;
  l1a: string;
  l1b: string;
  l2: string;
}

interface _ConstantsGroups {
  l1: _ConstantsGroup;
  l2: _ConstantsGroup;
}

type DriveDisplayFolder = {
  basedOn?: string;
  folderName: string;
  publicCtrb?: boolean;
  delegateCtrb?: boolean;
  displayName?: string;
  subFolders?: Array<DriveDisplayFolder>;
};

type _Prefabs = {
  [key: string]: DriveDisplayFolder;
};

interface _Drive {
  S3: DriveDisplayFolder;
  S4: DriveDisplayFolder;
  prefabs: _Prefabs;
}

interface _Constants {
  owner: string;
  ownerId: number; // newly added so some parts of code uses `owner`
  botgroup: number;
  edtId: string;
  edtGids: _SectionsStr;
  l2Delegates: Array<number>;
  channels: _SectionsInt;
  groups: _ConstantsGroups;
  driveId: string;
  drive: _Drive;
  promptTexts: {[key:string]: string}
}

type _PDRFile = {
  name : string;
  fileId : string;
}

type _PendingDriveRequest = {
  userId: number;
  location: string[];
  date: string;
  docs: Array<_PDRFile>; 
  lastInputMsgId: number; 
  photos: Array<_PDRFile>; 
}

type _PendingDriveRequests = { [key:number]: _PendingDriveRequest };

interface _LTC {
  // Long-time-counters
  sheetHashes: _SectionsStr;
  // messsagesAfterBot: ;
  mutes: Array<number>;
  bans: Array<number>;
  pDRCounter : number;
  pendingDriveRequests : _PendingDriveRequests;
  driveHistory: { [key:string]: Array<number> }
  chatHistory: {[key:string]: Array<{userId:string,userDispName:string,hasPhoto:boolean|undefined, hasAttch:boolean|undefined, text:string, datetime:string}>}
}
interface _PreferencesLangs {
  en: Array<number>;
  ar: Array<number>;
}
interface _Preferences {
  lang: _PreferencesLangs;
}

interface _GDriveFolder extends _GDriveFile {
  cachedId?: string;
}

interface DriveCacheFolder {
  id: string;
  toBeDownloaded?: Boolean;
  parentId?: number;
  displayName?: string;
  isMediaGroup? : Boolean,
  name: string;
  shortcuts: Array<_GDriveFolder>;
  folders: Array<_GDriveFolder>;
  files: Array<_GDriveFile>;
}

type _DriveFolders = {
  [key: string]: DriveCacheFolder;
};

interface _DriveCache {
  foldersIdCounter: number;
  filesIndexCounter: number;
  // i should ve named it index not id thats the most fitting
  // but since everything is messy i'd have to leave it
  folderIds: { [key: string]: string };
  filesIndices: { [key: string]: string };
  folders: _DriveFolders;
}

export interface StorageType {
  constants: _Constants;
  documents:
    | { [key: string]: number }
    | { [key: string]: { [key: string]: number } };
  ltc: _LTC;
  preferences: _Preferences;
  cache: _DriveCache;
}

import { db } from "../lib/mongodb";

export interface ResourcesModule {
  name: string,
  semester: string,
  displayShort?: string,
  displayLong?: string,
  // coefficient?: number,
  resourcesInputChatId?: number,
  resourcesInputThreadId?: number|null,
  
}

const collection = db.collection<ResourcesModule>('modules');


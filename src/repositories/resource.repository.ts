import { ObjectId } from "mongodb";
import { db } from "../lib/mongodb";

export type ResourceType = "STUDY" | "TIMETABLE";

export interface Resource {
  _id: ObjectId;
  name: string;
  type: ResourceType;
  isMediaGroup: boolean;
  insertedAt: Date;
}

export interface ResourceFile {
  _id: ObjectId;
  resourceId: ObjectId;
  pendingId?: ObjectId;
  mediaGroupId?: string;
  fileId: string;
  fileName: string;
  telegramStoredMessageId?: number;
  insertedAt: Date;
}

export type ResourceInput = Omit<Resource, "_id" | "insertedAt">;
export type ResourceFileInput = Omit<ResourceFile, "_id" | "insertedAt">;

const resourcesCollection = db.collection<Resource>("resources");
const resourceFilesCollection =
  db.collection<ResourceFile>("resource_files");

/**
 * Create a resource.
 */
export async function createResource(
  input: ResourceInput
): Promise<Resource> {
  const resource: Resource = {
    _id: new ObjectId(),
    ...input,
    insertedAt: new Date(),
  };

  await resourcesCollection.insertOne(resource);

  return resource;
}

/**
 * Find a resource by its ID.
 */
export async function findResourceById(
  id: ObjectId
): Promise<Resource | null> {
  return resourcesCollection.findOne({ _id: id });
}

/**
 * Find a resource by name.
 */
export async function findResourceByName(
  name: string
): Promise<Resource | null> {
  return resourcesCollection.findOne({ name });
}

/**
 * Find all resources whose name starts with a prefix.
 *
 */
export async function findResourcesByNamePrefix(
  prefix: string
): Promise<Resource[]> {
  return resourcesCollection
    .find({
      name: {
        $regex: `^${escapeRegex(prefix)}`,
      },
    })
    .sort({ insertedAt: 1 })
    .toArray();
}

/**
 * Find resources by type.
 */
export async function findResourcesByType(
  type: ResourceType
): Promise<Resource[]> {
  return resourcesCollection
    .find({ type })
    .sort({ insertedAt: 1 })
    .toArray();
}

/**
 * Update a resource.
 */
export async function updateResource(
  id: ObjectId,
  update: Partial<Omit<Resource, "_id" | "insertedAt">>
): Promise<Resource | null> {
  const result = await resourcesCollection.findOneAndUpdate(
    { _id: id },
    { $set: update },
    { returnDocument: "after" }
  );

  return result;
}

/**
 * Delete a resource and all of its files.
 */
export async function deleteResource(
  id: ObjectId
): Promise<boolean> {
  const result = await resourcesCollection.deleteOne({
    _id: id,
  });

  if (result.deletedCount === 0) {
    return false;
  }

  await resourceFilesCollection.deleteMany({
    resourceId: id,
  });

  return true;
}

/**
 * Add a file to a resource.
 */
export async function addResourceFile(
  input: ResourceFileInput
): Promise<ResourceFile> {
  const file: ResourceFile = {
    _id: new ObjectId(),
    ...input,
    insertedAt: new Date(),
  };

  await resourceFilesCollection.insertOne(file);

  return file;
}

/**
 * Get all files belonging to a resource.
 */
export async function findResourceFiles(
  resourceId: ObjectId
): Promise<ResourceFile[]> {
  return resourceFilesCollection
    .find({ resourceId })
    .sort({ insertedAt: 1 })
    .toArray();
}

/**
 * Get all files belonging to a media group.
 */
export async function findMediaGroupFiles(
  mediaGroupId: string
): Promise<ResourceFile[]> {
  return resourceFilesCollection
    .find({ mediaGroupId })
    .sort({ insertedAt: 1 })
    .toArray();
}

/**
 * Find a specific file by its ID.
 */
export async function findResourceFileById(
  id: ObjectId
): Promise<ResourceFile | null> {
  return resourceFilesCollection.findOne({
    _id: id,
  });
}

/**
 * Find a stored file using its Telegram file ID.
 */
export async function findResourceFileByTelegramFileId(
  fileId: string
): Promise<ResourceFile | null> {
  return resourceFilesCollection.findOne({
    fileId,
  });
}

/**
 * Find a stored file using the Telegram message ID.
 */
export async function findResourceFileByTelegramMessageId(
  telegramStoredMessageId: number
): Promise<ResourceFile | null> {
  return resourceFilesCollection.findOne({
    telegramStoredMessageId,
  });
}

/**
 * Delete a resource file.
 */
export async function deleteResourceFile(
  id: ObjectId
): Promise<boolean> {
  const result = await resourceFilesCollection.deleteOne({
    _id: id,
  });

  return result.deletedCount === 1;
}

/**
 * Escape regex special characters so that a user-provided
 * prefix is treated literally.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
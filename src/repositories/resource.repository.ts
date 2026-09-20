import { ObjectId } from "mongodb";
import { db } from "../lib/mongodb.js";

import { z } from "zod";

export const resourceSchema = z.object({
  _id: z.instanceof(ObjectId),
  name: z.string(),
  displayName: z.string().optional(),
  isApproved: z.boolean(),
  type: z.enum(["UNDEFINED", "STUDY", "TIMETABLE"]),
  isMediaGroup: z.boolean(),
  telegramStoredChatId: z.coerce.number().optional(),
  telegramStoredThreadId: z
    .union([z.literal("null").transform(() => null), z.coerce.number().int()])
    .optional(),
  insertedAt: z.date(),
});

export type Resource = z.infer<typeof resourceSchema>;

export const resourceInputSchema = resourceSchema.omit({
  _id: true,
  insertedAt: true,
});

export type ResourceInput = z.infer<typeof resourceInputSchema>;

export const resourceFileSchema = z.object({
  _id: z.instanceof(ObjectId),
  resourceId: z.instanceof(ObjectId),
  mediaGroupId: z.string().optional(),
  fileId: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  telegramStoredMessageId: z.coerce.number().optional(),
  insertedAt: z.date(),
});

export type ResourceFile = z.infer<typeof resourceFileSchema>;

export const resourceFileInputSchema = resourceFileSchema.omit({
  _id: true,
  insertedAt: true,
});

export type ResourceFileInput = z.infer<typeof resourceFileInputSchema>;

const resourcesCollection = db.collection<Resource>("resources");
const resourceFilesCollection = db.collection<ResourceFile>("resource_files");

/**
 * Create a resource.
 */
async function createResource(input: ResourceInput): Promise<Resource> {
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
async function findResourceById(id: ObjectId): Promise<Resource | null> {
  return resourcesCollection.findOne({ _id: id });
}

/**
 * Find a resource by name.
 */
async function findResourceByName(name: string): Promise<Resource | null> {
  return resourcesCollection.findOne({ name });
}

/**
 * Find all resources whose name starts with a prefix.
 *
 */
async function findResourcesByNamePrefix(prefix: string): Promise<Resource[]> {
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
async function findResourcesByType(
  type: ResourceInput["type"],
): Promise<Resource[]> {
  return resourcesCollection.find({ type }).sort({ insertedAt: 1 }).toArray();
}

/**
 * Update a resource.
 */
async function updateResource(
  id: ObjectId,
  update: Partial<Omit<Resource, "_id" | "insertedAt">>,
): Promise<Resource | null> {
  const result = await resourcesCollection.findOneAndUpdate(
    { _id: id },
    { $set: update },
    { returnDocument: "after" },
  );

  return result;
}

/**
 * Delete a resource and all of its files.
 */
async function deleteResource(id: ObjectId): Promise<boolean> {
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
async function addResourceFile(
  input: ResourceFileInput,
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
async function findResourceFiles(
  resourceId: ObjectId,
): Promise<ResourceFile[]> {
  return resourceFilesCollection
    .find({ resourceId })
    .sort({ insertedAt: 1 })
    .toArray();
}

/**
 * Get all files belonging to a media group.
 */
async function findMediaGroupFiles(
  mediaGroupId: string,
): Promise<ResourceFile[]> {
  return resourceFilesCollection
    .find({ mediaGroupId })
    .sort({ insertedAt: 1 })
    .toArray();
}

/**
 * Find a specific file by its ID.
 */
async function findResourceFileById(
  id: ObjectId,
): Promise<ResourceFile | null> {
  return resourceFilesCollection.findOne({
    _id: id,
  });
}

/**
 * Find a stored file using its Telegram file ID.
 */
async function findResourceFileByTelegramFileId(
  fileId: string,
): Promise<ResourceFile | null> {
  return resourceFilesCollection.findOne({
    fileId,
  });
}

/**
 * Find a stored file using the Telegram message ID.
 */
async function findResourceFileByTelegramMessageId(
  telegramStoredMessageId: number,
): Promise<ResourceFile | null> {
  return resourceFilesCollection.findOne({
    telegramStoredMessageId,
  });
}

/**
 * Delete a resource file.
 */
async function deleteResourceFile(id: ObjectId): Promise<boolean> {
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

export const resourceFiles = {
  addResourceFile,
  findResourceFiles,
  findMediaGroupFiles,
  findResourceFileById,
  findResourceFileByTelegramFileId,
  findResourceFileByTelegramMessageId,
  deleteResourceFile,
};
export const resources = {
  createResource,
  findResourceById,
  findResourceByName,
  findResourcesByNamePrefix,
  findResourcesByType,
  updateResource,
  deleteResource,
};

import z from 'zod';
import { db } from '../lib/mongodb.js';
import { WithId } from 'mongodb';

export const resourcesModuleInputSchema = z
  .object({
    name: z.string().trim().min(1),
    semester: z.string().trim().min(1),

    displayShort: z.string().optional(),
    displayLong: z.string().optional(),

    icon: z.string().optional(),

    reviewerId: z.coerce.number().optional(),

    resourcesInputChatId: z.coerce.number().int().optional(),

    resourcesInputThreadId: z
      .union([z.literal('null').transform(() => null), z.coerce.number().int()])
      .optional(),
  })
  .strict();

export type ResourcesModuleInput = z.infer<typeof resourcesModuleInputSchema>;

export type ResourcesModule = ResourcesModuleInput & {
  insertedAt: Date;
};

const collection = db.collection<ResourcesModule>('modules');

async function findModuleFromName(name: string) {
  return collection.findOne({
    name,
  });
}
async function findModuleFromSemesterAndName(semester: string, name: string) {
  return collection.findOne({
    name,
    semester,
  });
}

async function findModuleFromInputChat(
  chatId: number,
  threadId: number | null,
) {
  return collection.findOne({
    resourcesInputChatId: chatId,
    resourcesInputThreadId: threadId,
  });
}

async function setModule(res: ResourcesModuleInput) {
  return await collection.updateOne(
    { name: res.name },
    {
      $set: {
        ...res,
      },

      // Only set this when creating the user
      $setOnInsert: {
        insertedAt: new Date(),
      },
    },
    { upsert: true },
  );
}

async function findModulesFromSemester(
  semester: string,
): Promise<WithId<ResourcesModule>[]> {
  return await collection
    .find({
      semester,
    })
    .toArray();
}

async function getExistingSemesters(): Promise<string[]> {
  return (await collection.distinct('semester')).sort();
}

export const resourcesModules = {
  findModuleFromName,
  findModuleFromSemesterAndName,
  findModuleFromInputChat,
  findModulesFromSemester,
  getExistingSemesters,
  setModule,
};

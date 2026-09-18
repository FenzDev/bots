import type { Collection } from "mongodb";

import { db } from "../lib/mongodb.js";
import logger from "../lib/logger.js";
import { z } from "zod";

export const studySectionInputSchema = z
  .object({
    name: z.string().trim().min(1),

    displayLong: z.string().optional(),
    displayShort: z.string().optional(),
    sectionLetter: z.string().optional(),

    timetableStoargeChatId: z.coerce.number().optional(),
    timetableStoargeThreadId: z
      .union([z.literal("null").transform(() => null), z.coerce.number().int()])
      .optional(),

    timetableBroadcastChatId: z.coerce.number().int().optional(),
    timetableBroadcastThreadId: z
      .union([z.literal("null").transform(() => null), z.coerce.number().int()])
      .optional(),

    timetableGID: z.string().optional(),
    timetableCurrentHash: z.string().optional(),
    timetableCurrentGridJSON: z.string().optional(),
    timetableLastStoredResourceName: z.string().optional(),

    telegramChatId: z.coerce.number().int().optional(),
  })
  .strict();

export type StudySectionInput = z.infer<typeof studySectionInputSchema>;

export type StudySection = StudySectionInput & {
  updatedAt: Date;
  insertedAt: Date;
};

const collection = db.collection<StudySection>("study_sections");

async function setStudySection(studySection: StudySectionInput) {
  const result = await collection.updateOne(
    { name: studySection.name },
    {
      $set: { ...studySection, updatedAt: new Date() },
      $setOnInsert: {
        insertedAt: new Date(),
      },
    },
    { upsert: true },
  );

  if (result.upsertedCount === 1) {
    logger.debug({ studySection }, "Study section was added to db");
  }
}

async function findStudySectionByName(name: string) {
  return await collection.findOne(
    { name },
    {
      projection: {
        timetable: 0,
      },
    },
  );
}

async function findStudySectionsByChat(chatId: number) {
  return await collection.find(
    { telegramChatId: chatId, },
    {
      projection: {
        timetableCurrentGridJSON: 0,
      },
    },
  ).toArray();
}

async function getAllStudySections() {
  return collection.find({},{projection: {
    timetableCurrentGridJSON: 0,
  }}).toArray();
}

export const studySections = {
  setStudySection,
  findStudySectionByName,
  findStudySectionsByChat,
  getAllStudySections,
};

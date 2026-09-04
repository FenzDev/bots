import type { Collection } from "mongodb";

import { db } from "../lib/mongodb.js";
import logger from "../lib/logger.js";

export type StudySection = {
  name: string;
  displayLong?: string;
  displayShort?: string;
  sectionLetter?: string;
  timetableBroadcastChatId?: number;
  timetableBroadcastThreadId?: number | null;
  timetableGID?: string;
  timetableCurrentHash?: string;
  timetableCurrentGridJSON?: string;

  updatedAt: Date;
  insertedAt: Date;
};

export type StudySectionInput = Omit<StudySection, "insertedAt" | "updatedAt">;

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
        timetableCurrentCSV: 0,
      },
    },
  );
}

async function getAllStudySections() {
  return collection.find().toArray();
}

export const studySections = {
  setStudySection,
  findStudySectionByName,
  getAllStudySections,
};

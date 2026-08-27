import {
  ObjectId,
  type Collection,
} from "mongodb";

import { db } from "../lib/mongodb.js";

export type MessageSummary = {
  _id: ObjectId;

  chatId: number;
  threadId: number | null;

  firstMessageId: number;
  lastMessageId: number;

  lastMessageAt: Date;
  messageCount: number;

  summary: string;

  createdAt: Date;
};

const collection = db.collection<MessageSummary>(
  "message_summaries",
);

async function ensureIndexes() {
  await collection.createIndex({
    chatId: 1,
    threadId: 1,
    lastMessageAt: -1,
  });
}

async function add(
  summary: Omit<MessageSummary, "_id" | "createdAt">,
) {
  const document: MessageSummary = {
    ...summary,
    _id: new ObjectId(),
    createdAt: new Date(),
  };

  await collection.insertOne(document);

  return document;
}

async function findById(id: ObjectId) {
  return collection.findOne({
    _id: id,
  });
}

async function findRecent(
  chatId: number,
  threadId: number | null,
  limit = 20,
) {
  return collection
    .find({
      chatId,
      threadId,
    })
    .sort({
      lastMessageAt: -1,
    })
    .limit(limit)
    .toArray();
}

async function removeById(id: ObjectId) {
  return collection.deleteOne({
    _id: id,
  });
}

export const messageSummaries = {
  add,
  findById,
  findRecent,
  removeById,
  ensureIndexes,
};
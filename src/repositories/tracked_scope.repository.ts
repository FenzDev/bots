import {
  ObjectId,
  type Collection,
} from "mongodb";

import { db } from "../lib/mongodb.js";

export type TrackedScope = {
  _id: ObjectId;

  chatId: number;
  threadId: number | null;

  trackedAt: Date;
};

export type Scope = Pick<TrackedScope, "chatId" | "threadId">;

const collection: Collection<TrackedScope> =
  db.collection<TrackedScope>("tracked_scopes");

async function ensureIndexes() {
  await collection.createIndex(
    {
      chatId: 1,
      threadId: 1,
    },
    {
      unique: true,
    },
  );
}

async function add(scope: Scope) {
  const document: TrackedScope = {
    _id: new ObjectId(),
    ...scope,
    trackedAt: new Date(),
  };

  const result = await collection.updateOne(
    {
      chatId: scope.chatId,
      threadId: scope.threadId,
    },
    {
      $setOnInsert: document,
    },
    {
      upsert: true,
    },
  );

  return {
    added: result.upsertedCount === 1,
  };
}

async function remove(scope: Scope) {
  return collection.deleteOne({
    chatId: scope.chatId,
    threadId: scope.threadId,
  });
}

async function exists(scope: Scope) {
  return (
    (await collection.countDocuments(scope, {
      limit: 1,
    })) > 0
  );
}

async function findAll() {
  return collection
    .find({})
    .sort({
      chatId: 1,
      threadId: 1,
    })
    .toArray();
}

export const trackedScopes = {
  add,
  remove,
  exists,
  findAll,
  ensureIndexes,
};
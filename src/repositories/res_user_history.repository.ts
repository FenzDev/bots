import type { Collection } from 'mongodb';

import { db } from '../lib/mongodb.js';
import logger from '../lib/logger.js';

const HISTORY_LIMIT = 3;

export type UserResHistory = {
  telegramId: number;
  path: string;
  displayName?: string;
  insertedAt: Date;
};

const collection: Collection<UserResHistory> =
  db.collection<UserResHistory>('user_res_history');

async function addUserHistory(input: Omit<UserResHistory, 'insertedAt'>) {
  const result = await collection.updateOne(
    {
      telegramId: input.telegramId,
      path: input.path,
    },
    {
      $set: {
        displayName: input.displayName,
      },
      $setOnInsert: {
        insertedAt: new Date(),
      },
    },
    { upsert: true },
  );

  if (
    (await collection.countDocuments({ telegramId: input.telegramId })) >
    HISTORY_LIMIT
  ) {
    await collection.findOneAndDelete(
      { telegramId: input.telegramId },
      { sort: { insertedAt: 1 } },
    );
  }
  return result.upsertedCount;
}

async function findUserHistoryById(telegramId: number) {
  return collection
    .find({ telegramId }, { sort: { insertedAt: -1 } })
    .toArray();
}

export const userResHistory = {
  addUserHistory,
  findUserHistoryById,
};

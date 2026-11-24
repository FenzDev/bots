import type { Collection } from 'mongodb';

import { db } from '../lib/mongodb.js';
import logger from '../lib/logger.js';

const HISTORY_LIMIT = 3;

export type UserResHistory = {
  telegramId: number;
  path: string;
  //   displayName?: string;
  insertedAt: Date;
};

const collection: Collection<UserResHistory> =
  db.collection<UserResHistory>('userResHistory');

async function addUserHistory(input: Omit<UserResHistory, 'insertedAt'>) {
  const result = await collection.insertOne({
    telegramId: input.telegramId,
    path: input.path,
    // displayName: user.displayName,

    insertedAt: new Date(),
  });

  if (
    (await collection.countDocuments({ telegramId: input.telegramId })) >
    HISTORY_LIMIT
  ) {
    await collection.findOneAndDelete(
      { telegramId: input.telegramId },
      { sort: { insertedAt: 1 } },
    );
  }
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

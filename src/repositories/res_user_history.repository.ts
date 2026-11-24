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
  db.collection<UserResHistory>('users');

async function addUserHistory(user: UserResHistory) {
  const result = await collection.insertOne(
    {
        telegramId: user.telegramId,
        path: user.path,
        // displayName: user.displayName,

        insertedAt: new Date(),
      },
  );
  
  if ((await collection.countDocuments({ telegramId: user.telegramId, })) > HISTORY_LIMIT) {
    await collection.findOneAndDelete(
      { telegramId: user.telegramId },
      { sort: { insertedAt: 1 } },
    );
  }
}

async function findUserHistoryById(telegramId: number) {
  return collection
    .find({ telegramId }, { sort: { insertedAt: -1 } })
    .toArray();
}

export const users = {
  addUserHistory,
  findUserHistoryById,
};

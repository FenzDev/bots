import type { Collection } from "mongodb";

import { db } from "../lib/mongodb.js";
import logger from "../lib/logger.js";

export type User = {
  telegramId: number;
  username?: string;
  insertedAt: Date;
  firstName: string;
  lastName?: string;
};

const collection: Collection<User> = db.collection<User>("users");

async function upsertUser(user: User) {
  const result = await collection.updateOne(
    { telegramId: user.telegramId },
    {
      $set: {
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },

      // Only set this when creating the user
      $setOnInsert: {
        insertedAt: new Date(),
      },
    },
    { upsert: true },
  );

  if (result.upsertedCount === 1) {
    logger.debug(
      { telegramId: user.telegramId },
      "User was added to db",
    );
  }
}

export const users = {
  upsertUser,
};
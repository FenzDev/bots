import type { Collection } from "mongodb";

import { db } from "../lib/mongodb.js";
import logger from "../lib/logger.js";
import { DB_MAX_HISTORY_MESSAGES } from "../config/env.js";

export type MessageScope = {
  chatId: number;
  threadId: number | null;
};

type BaseMessage = MessageScope & {
  messageId: number;
  senderId: number;
  replyTargetId?: number;
  sentAt: Date;
  storedAt: Date;
};

export type TextMessage = BaseMessage & {
  type: "text";
  text: string;
};

export type PollMessage = BaseMessage & {
  type: "poll";
  pollId: string;
  question: string;
  options: {
    text: string;
    voterCount?: number;
  }[];
};

export type FileMessage = BaseMessage & {
  type: "file";
  fileId: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  caption?: string;
};

export type PhotoMessage = BaseMessage & {
  type: "photo";
  fileId: string;
  width: number;
  height: number;
  caption?: string;
};

export type VoiceMessage = BaseMessage & {
  type: "voice";
  fileId: string;
  duration: number;
  mimeType?: string;
  fileSize?: number;
};

export type Message =
  | TextMessage
  | PollMessage
  | FileMessage
  | PhotoMessage
  | VoiceMessage;

const collection: Collection<Message> =
  db.collection<Message>("messages");

export async function ensureIndexes() {
  await collection.createIndex(
    {
      chatId: 1,
      threadId: 1,
      messageId: 1,
    },
    {
      unique: true,
    },
  );
}

async function enforceHistoryLimit(scope: MessageScope) {
  const oldestOverflow = await collection
    .find(scope)
    .sort({ messageId: -1 })
    .skip(DB_MAX_HISTORY_MESSAGES)
    .project({
      messageId: 1,
    })
    .limit(1)
    .next();

  if (!oldestOverflow) {
    return;
  }

  const result = await collection.deleteMany({
    ...scope,
    messageId: {
      $lte: oldestOverflow.messageId,
    },
  });

}

async function add(message: Message) {
  await collection.insertOne(message);

  await enforceHistoryLimit({
    chatId: message.chatId,
    threadId: message.threadId,
  });
}

async function findRecent(
  scope: MessageScope,
  limit = DB_MAX_HISTORY_MESSAGES,
) {
  return collection
    .find(scope)
    .sort({ messageId: -1 })
    .limit(limit)
    .toArray();
}

/**
 * Deletes one specific message.
 */
async function remove(
  scope: MessageScope,
  messageId: number,
) {
  return collection.deleteOne({
    ...scope,
    messageId,
  });
}

/**
 * Deletes many specific messages.
 */
async function removeMany(
  scope: MessageScope,
  messageIds: number[],
) {
  if (messageIds.length === 0) {
    return {
      acknowledged: true,
      deletedCount: 0,
    };
  }

  return collection.deleteMany({
    ...scope,
    messageId: {
      $in: messageIds,
    },
  });
}

/**
 * Deletes all messages in an inclusive range.
 *
 * Useful when a group of messages has been summarized.
 */
async function removeRange(
  scope: MessageScope,
  firstMessageId: number,
  lastMessageId: number,
) {
  return collection.deleteMany({
    ...scope,
    messageId: {
      $gte: firstMessageId,
      $lte: lastMessageId,
    },
  });
}

export const messages = {
  add,
  findRecent,
  remove,
  removeMany,
  removeRange,
  ensureIndexes,
};
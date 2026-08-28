import { Bot } from "grammy";
import type { Message } from "grammy/types";

import {
  type Scope,
  trackedScopes,
} from "../../repositories/tracked_scope.repository.js";
import { messages, type Message as DbMessage } from "../../repositories/message.repository.js";
import logger from "../../lib/logger.js";
import { dbMessageFromContext } from "../../helpers/db-msg-from-context.js";

async function trackMessage(message: DbMessage): Promise<boolean> {
  const scope: Scope = {
    chatId: message.chatId,
    threadId: message.threadId,
  };

  if (!(await trackedScopes.exists(scope))) {
    return false;
  }

  await messages.add(message);
  return true;
}

function scopeFromTelegramMessage(message: Message): Scope {
  return {
    chatId: message.chat.id,
    threadId: message.is_topic_message
      ? message.message_thread_id ?? null
      : null,
  };
}

function dbMessageFromTelegramMessage(
  message: Message,
  senderId: number,
): DbMessage | null {
  const scope = scopeFromTelegramMessage(message);

  if ("text" in message) {
    return {
      ...scope,
      messageId: message.message_id,
      senderId,
      type: "text",
      text: message.text ?? '',
      sentAt: new Date(message.date * 1000),
      storedAt: new Date(),
    };
  }

  return null;
}

export default async (bot: Bot) => {
  bot.api.config.use(async (prev, method, payload, signal) => {
    const res = await prev(method, payload, signal);

    if (!res.ok || method !== "sendMessage") {
      return res;
    }

    const telegramMessage = res.result as Message;

    const dbMessage = dbMessageFromTelegramMessage(
      telegramMessage,
      bot.botInfo.id,
    );

    if (dbMessage) {
      await trackMessage(dbMessage);
    }

    return res;
  });

  bot.on("message", async (ctx, next) => {
    if (ctx.chat.id === ctx.from?.id) {
      return next();
    }

    const dbMessage = dbMessageFromContext(ctx);

    if (dbMessage) {
      await trackMessage(dbMessage);
    }

    return next();
  });
};
import { Bot } from "grammy";
import type { Message, User } from "grammy/types";

import {
  type Scope,
  trackedScopes,
} from "../../repositories/tracked_scope.repository.js";
import {
  messages,
  type Message as DbMessage,
} from "../../repositories/message.repository.js";
import logger from "../../lib/logger.js";
import { users } from "../../repositories/user.repository.js";
import { dbMessageFromTelegramMessage } from "../../helpers/db-msg-from-telegram.js";

async function trackMessage(message: DbMessage, from: User): Promise<boolean> {
  const scope: Scope = {
    chatId: message.chatId,
    threadId: message.threadId,
  };

  if (!(await trackedScopes.exists(scope))) {
    return false;
  }

  await users.upsertUser({
    telegramId: from.id,
    firstName: from.first_name,
    lastName: from.last_name,
    username: from.username,
    isBot: from.is_bot || undefined,
    insertedAt: new Date(),
  });

  await messages.add(message);
  return true;
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
    );

    if (dbMessage) {
      const sender = (res.result as unknown as Message.TextMessage).from!;
      logger.debug({sender},`Upsert bot:`)
      await trackMessage(dbMessage, sender);
    }

    return res;
  });

  bot.on("message", async (ctx, next) => {
    if (ctx.chat.id === ctx.from?.id) {
      return next();
    }

    const dbMessage = dbMessageFromTelegramMessage(ctx.msg);

    if (dbMessage) {
      logger.debug({sender:ctx.from},`Upsert user:`);
      await trackMessage(dbMessage, ctx.from);
    }

    return next();
  });
};

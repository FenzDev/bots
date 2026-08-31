import { Bot, RawApi } from "grammy";
import { dbMessageFromTelegramMessage } from "../../helpers/db-msg-from-telegram";
import { ApiMethods, Message, User } from "grammy/types";
import {
  Scope,
  trackedScopes,
} from "../../repositories/tracked_scope.repository";
import {
  Message as DbMessage,
  messages,
} from "../../repositories/message.repository";
import { users } from "../../repositories/user.repository";

export async function trackMessage(
  message: DbMessage,
  from: User,
): Promise<boolean> {
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

    if (
      !res.ok ||
      ( method !== "sendMessage" &&
        method !== "sendPhoto" &&
        method !== "sendDocument" &&
        method !== "sendMediaGroup" &&
        method !== "sendAudio")
    ) {
      return res;
    }

    const telegramMessage = res.result as Message;

    if (telegramMessage.receiver_user) return res;

    const dbMessage = dbMessageFromTelegramMessage(telegramMessage);

    if (dbMessage) {
      const sender = (res.result as unknown as Message.TextMessage).from!;
      // logger.debug({sender},`Upsert bot:`)
      await trackMessage(dbMessage, sender);
    }

    return res;
  });
};

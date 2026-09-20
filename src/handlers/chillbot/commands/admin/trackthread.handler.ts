import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import logger from "../../../../lib/logger.js";
import { trackedScopes } from "../../../../repositories/tracked_scope.repository.js";

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("trackthread", async (ctx,next) => {
      const [chatIdText, threadIdText] = ctx.match.trim().split(/\s+/);

      const chatId = Number(chatIdText);
      const threadId = Number(threadIdText);

      if (!Number.isSafeInteger(chatId) || !Number.isSafeInteger(threadId)) {
        await ctx.reply("Usage: /trackthread <chatId> <threadId>");
        return next();
      }
      const { added } = await trackedScopes.add({
        chatId,
        threadId: threadId !== 0? threadId: null,
      });

      if (added)
        logger.info(`'${chatId}/${threadId}' was added to messages track list.`);

      await ctx.reply(
        added
          ? "Thread tracking enabled."
          : "This thread is already being tracked.",
      );

      return next();
    });
};

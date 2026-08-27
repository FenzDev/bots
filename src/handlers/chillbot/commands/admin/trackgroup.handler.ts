import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env";
import logger from "../../../../lib/logger";
import { trackedScopes } from "../../../../repositories/tracked_scope.repository";

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("trackgroup", async (ctx,next) => {
      
      const chatId = Number(ctx.match.trim());

      if (!Number.isSafeInteger(chatId)) {
        await ctx.reply("Invalid chat ID.");
        return next();
      }

      const { added } = await trackedScopes.add({
        chatId,
        threadId: null,
      });

      if (added) logger.info(`'${chatId}' group was added to messages track list.`)

      await ctx.reply(
        added
          ? "Group tracking enabled."
          : "This group is already being tracked.",
      );
      
      return next();
    });
};

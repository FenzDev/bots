import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env";
import logger from "../../../../lib/logger";

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("chatinfo", async (ctx, next) => {
      try {
        if (ctx.chat && ctx.message) {
          await ctx.api.deleteMessage(
            ctx.chat.id,
            ctx.message.message_id,
          );
        }
      } catch (error) {
        logger.warn(
          { err: error },
          "Failed to delete command message",
        );
      }

      const chatId = ctx.chat?.id;
      const threadId = ctx.message?.message_thread_id;

      await ctx.reply(
        [
          "📋 Chat information",
          "",
          `Chat ID: \`${chatId ?? "Unknown"}\``,
          `Thread ID: \`${threadId ?? "None"}\``,
        ].join("\n"),
        { parse_mode: "Markdown" },
      );

      return next();
    });
};
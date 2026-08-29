import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env";
import logger from "../../../../lib/logger";
import { GemmaProvider } from "../../../../services/ai/providers/google-ai-provider";
import { replyToMessage } from "../../../../helpers/reply-to-message";
import z from "zod";
import { chillbotAIApp, runAIApp } from "../../../../services/ai";
import { chillBot } from "../../../../lib/bots";
import { prompts } from "../../../../services/ai/prompts";
import { dbMessageFromTelegramMessage } from "../../../../helpers/db-msg-from-telegram";

export default async (bot: Bot) => {
  const ai = new GemmaProvider();

  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("dbg", async (ctx, next) => {
      logger.debug("Debug command was called.");

      return next();
    });

  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .on("message::mention", async (ctx, next) => {
      const botUsername = ctx.me.username;

      const mentionedBot = ctx.message?.entities?.some((entity) => {
        if (entity.type !== "mention") {
          return false;
        }

        const mention = ctx.message?.text?.slice(
          entity.offset,
          entity.offset + entity.length,
        );

        return mention?.toLowerCase() === `@${botUsername}`.toLowerCase();
      });

      if (!mentionedBot) {
        return next();
      }

      
      await runAIApp(
        chillbotAIApp,
        {
          botId: ctx.me.id,
          mentions: [dbMessageFromTelegramMessage(ctx.msg)],
          chatId: ctx.chat.id,
          threadId: ctx.message?.message_thread_id ?? null,
        },
        prompts["instructions/chillbot/replyToMentions"],
        async (res) => {
          if (typeof res === "string") {
            await replyToMessage(ctx, res);
            logger.debug({ res }, "Result in JSON:");
          } else {
            // res is TResult
            await replyToMessage(ctx, res.text);
          }
        },
      );

      return next();
    });
};

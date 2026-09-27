import { Bot, Context, NextFunction } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../config/env.js";
import { chillbotAIApp, runAIApp } from "../../services/ai/index.js";
import { prompts } from "../../services/ai/prompts/index.js";
import { dbMessageFromTelegramMessage } from "../../helpers/db-msg-from-telegram.js";
import { trackedScopes } from "../../repositories/tracked_scope.repository.js";
import { replyToMessage } from "../../helpers/reply-to-message.js";
import logger from "../../lib/logger.js";

export default async (bot: Bot) => {
  bot.on("message", async (ctx, next) => {
    const botId = ctx.me.id;


    if (
      !ctx.message.reply_to_message ||
      ctx.message.reply_to_message.from?.id !== botId ||
      !(await trackedScopes.exists({
        chatId: ctx.chatId,
        threadId: ctx.message.is_topic_message
          ? (ctx.message.message_thread_id ?? null)
          : null,
      }))
    )
      return next();


    replyAIToUser(ctx);

    return next();
  });

  bot.on("message::mention", async (ctx, next) => {
    logger.debug("mention boi");
    if (
      ctx.message.reply_to_message?.from?.id === ctx.me.id || // ignore reply
      !(await trackedScopes.exists({
        chatId: ctx.chatId,
        threadId: ctx.message.is_topic_message
          ? (ctx.message.message_thread_id ?? null)
          : null,
      }))
    )
      return next();

    logger.debug("yep mention boi");

    const mentionedBot = ctx.message?.entities?.some((entity) => {
      if (entity.type !== "mention") {
        return false;
      }

      const botUsername = ctx.me.username;

      const mention = ctx.message?.text?.slice(
        entity.offset,
        entity.offset + entity.length,
      );

      return mention?.toLowerCase() === `@${botUsername}`.toLowerCase();
    });

    if (!mentionedBot) {
      return next();
    }

    replyAIToUser(ctx);

    return next();
  });

  async function replyAIToUser(ctx: Context) {
    try {
      if (!ctx.chat || !ctx.message) return;

      logger.info(
        ctx.message,
        "Reply to ChillBot is detected AI response on the way:",
      );

      await runAIApp(
        chillbotAIApp,
        {
          botId: ctx.me.id,
          mentions: [dbMessageFromTelegramMessage(ctx.message)],
          chatId: ctx.chat!.id,
          threadId: ctx.message?.message_thread_id ?? null,
        },
        prompts["instructions/chillbot/replyToMentions"],
        async (res) => {
          if (typeof res === "string") {
            await replyToMessage(ctx, res);
          } else {
            for (const reply of res.replies) {
              await ctx.api.sendMessage(ctx.chat!.id, reply.text, {
                reply_parameters: { message_id: reply.replyTo },
                message_thread_id: ctx.message!.message_thread_id,
              });
            }
          }
        },
      );
      logger.info(ctx.message, "AI responded.");
    } catch (err) {
      logger.error(err);
    }
  }
};

import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../config/env.js";
import { chillbotAIApp, runAIApp } from "../../services/ai/index.js";
import { prompts } from "../../services/ai/prompts/index.js";
import { dbMessageFromTelegramMessage } from "../../helpers/db-msg-from-telegram.js";
import { trackedScopes } from "../../repositories/tracked_scope.repository.js";
import { replyToMessage } from "../../helpers/reply-to-message.js";

export default async (bot: Bot) => {

  bot
    .on("message::mention", async (ctx, next) => {
      const botUsername = ctx.me.username;
      // TODO : TEMP 
      return next(); 
      if (
        !(await trackedScopes.exists({
          chatId: ctx.chatId,
          threadId: ctx.message.message_thread_id ?? null,
        }))
      )
        return next();

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
          } else {
            for (const reply of res.replies) {
              await ctx.api.sendMessage(ctx.chatId, reply.text, {
                reply_parameters: { message_id: reply.replyTo },
                message_thread_id: ctx.message.message_thread_id,
              });
            }
          }
        },
      );

      return next();
    });
};

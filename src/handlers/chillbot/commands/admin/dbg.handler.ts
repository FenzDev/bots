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
import { trackedScopes } from "../../../../repositories/tracked_scope.repository";

export default async (bot: Bot) => {
  const ai = new GemmaProvider();

  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("dbg", async (ctx, next) => {
      logger.debug("Debug command was called.");

      return next();
    });
};

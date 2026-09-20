import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import { replyToMessage } from "../../../../helpers/reply-to-message.js";
import logger from "../../../../lib/logger.js";

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("ping", async (ctx, next) => {
      logger.info('/ping acknowledged');
      await replyToMessage(ctx, 'pong');
      logger.info('pong was sent back');

      return next();
    });
};

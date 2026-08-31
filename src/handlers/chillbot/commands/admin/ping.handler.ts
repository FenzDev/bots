import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env";
import { replyToMessage } from "../../../../helpers/reply-to-message";
import logger from "../../../../lib/logger";

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

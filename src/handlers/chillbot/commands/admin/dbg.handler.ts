import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env";
import logger from "../../../../lib/logger";

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("dbg", async (ctx, next) => {
      logger.debug('Debug command was called.');

      return next();
    });
};

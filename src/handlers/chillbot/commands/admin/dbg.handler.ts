import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import logger from "../../../../lib/logger.js";
import { GemmaProvider } from "../../../../services/ai/providers/google-ai-provider.js";

export let debugMode = false;

export default async (bot: Bot) => {
  const ai = new GemmaProvider();

  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("dbg", async (ctx, next) => {
      logger.debug("Debug command was called.");
      debugMode = !debugMode;
      logger.debug(`Debugging mode -> ${debugMode}`);


      return next();
    });
};

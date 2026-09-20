import { Bot, InputFile } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import logger from "../../../../lib/logger.js";
import { GemmaProvider } from "../../../../services/ai/providers/google-ai-provider.js";
import sharp from "sharp";
import { addTextToTimetableImage } from "../../../../utils/image/addTextToTimetableImage.js";
import { generateTimestampId } from "../../../../utils/genid.js";

export default async (bot: Bot) => {
  const ai = new GemmaProvider();

  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("test", async (ctx, next) => {
      logger.debug("Test command was called.");

      const filePath = await addTextToTimetableImage("L3 ISIL",'19Sep7h','l3isil');

      await ctx.replyWithDocument(new InputFile(filePath));

      return next();
    });
};

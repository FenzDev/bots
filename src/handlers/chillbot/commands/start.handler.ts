import { Bot, InputFile } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import logger from "../../../../lib/logger.js";
import { GemmaProvider } from "../../../../services/ai/providers/google-ai-provider.js";
import sharp from "sharp";
import { addTextToTimetableImage } from "../../../../services/image/addTextToTimetableImage.js";
import { generateTimestampId } from "../../../../utils/genid.js";

export default async (bot: Bot) => {

  bot
    .command("start", async (ctx, next) => {
      const startMsg = `
Welcome to Timetable bot.
By @moncef_fnn
You can download current timetable as pdf
through /edt .
`;
      await ctx.reply("");

      return next();
    });
};
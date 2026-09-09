import { Bot } from "grammy";
import { dbMessageFromTelegramMessage } from "../../helpers/db-msg-from-telegram.js";
import { trackMessage } from "../shared/message-auto-track.handler.js";
import logger from "../../lib/logger.js";

export default async (bot: Bot) => {
  bot.on("message", async (ctx, next) => {
    if (ctx.message.receiver_user) return next();

    const dbMessage = dbMessageFromTelegramMessage(ctx.msg);

    if (dbMessage) {
      // logger.debug({sender:ctx.from},`Upsert user:`);
      await trackMessage(dbMessage, ctx.from);
    }

    return next();
  });
};

import { Bot } from "grammy";
import { dbMessageFromTelegramMessage } from "../../helpers/db-msg-from-telegram.js";
import { trackMessage } from "../shared/message-auto-track.handler.js";

export default async (bot: Bot) => {
  bot.on("message", async (ctx, next) => {
    if (ctx.chat.id === ctx.from?.id) {
      return next();
    }

    const dbMessage = dbMessageFromTelegramMessage(ctx.msg);

    if (dbMessage) {
      // logger.debug({sender:ctx.from},`Upsert user:`);
      await trackMessage(dbMessage, ctx.from);
    }

    return next();
  });
};

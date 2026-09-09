import { Bot, Context } from "grammy";
import { Message, Update } from "grammy/types";
import logger from "../../lib/logger";
import { resourcesModule } from "../../repositories/module.repository";

export default async (bot: Bot) => {
  bot.on("message:document", async (ctx, next) => {
    await addFileAsRequest(ctx, ctx.message);
    return next();
  });

  bot.on("message:photo", async (ctx, next) => {
    await addFileAsRequest(ctx, ctx.message);
    return next();
  });

  async function addFileAsRequest(
    ctx: Context,
    msg:
      | (Message &
          Update.NonChannel &
          Record<"document" | "from", {}> &
          Partial<Record<never, undefined>>)
      | (Message &
          Update.NonChannel &
          Record<"photo" | "from", {}> &
          Partial<Record<never, undefined>>),
  ) { 
    if ((await resourcesModule.findModuleFromInputChat(msg.chat!.id, msg.message_thread_id ?? null))){
      logger.debug({doc:msg.document, photo:msg.photo}, 'got it')
    }
  }
};

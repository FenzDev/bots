import { Bot } from "grammy";
import {
  Scope,
  trackedScopes,
} from "../../repositories/tracked_scope.repository";
import logger from "../../lib/logger";

export default async (bot: Bot) => {
  bot.on("message", async (ctx, next) => {
    if (ctx.chat.id === ctx.from?.id) return next();
    
    logger.debug('message'); 
    
    const scope = {
      chatId: ctx.chat.id,
      threadId: ctx.message.is_topic_message
        ? ctx.message.message_thread_id
        : null,
    } as Scope;

    const isTracked = await trackedScopes.exists(scope);

    if (!isTracked) {
      logger.debug(
        { scope, msg: ctx.message.text },
        "This message wasnt tracked",
      );
      return next();
    }

    return next();
  });
};

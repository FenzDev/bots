import { Bot } from "grammy";
import logger from "../../lib/logger.js";
import { pendings } from "../../repositories/pending.repository.js";

export default async (bot: Bot) => {
  bot.callbackQuery(/^approve:(\w+)$/, async (ctx, next) => {
    ctx.answerCallbackQuery();

    await approveRequest(
      ctx.callbackQuery.message!.chat.id,
      ctx.callbackQuery.message!.message_id,
      ctx.match[1],
      ctx.match[2],
    );

    return next();
  });
  
  bot.command("approve", async (ctx, next) => {
    logger.debug(ctx.match);

    const [requestMsgId, resFolderName, ...resFileNameParts] =
      ctx.match.split(" ");
    const resFileName = resFileNameParts.join(" ");

    await approveRequest(
      ctx.chatId,
      Number.parseInt(requestMsgId),
      resFolderName,
      resFileName,
    );

    return next();
  });

  async function approveRequest(
    reviewerId: number,
    requestMsgId: number,
    resFolderName: string,
    resFileName?: string,
  ) {
    if (
      await pendings.findPendingRequestByTelegramMessage(
        reviewerId,
        requestMsgId,
      )
    ) {
      logger.debug("Found the pending request");
    }
  }
};

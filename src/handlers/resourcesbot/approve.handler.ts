import { Bot, InlineKeyboard } from "grammy";
import logger from "../../lib/logger.js";
import {
  PendingRequest,
  pendings,
} from "../../repositories/pending.repository.js";
import { WithId } from "mongodb";
import {
  resourceFiles,
  resources,
} from "../../repositories/resource.repository.js";

export default async (bot: Bot) => {
  bot.callbackQuery(/^approve:(.*)$/, async (ctx, next) => {
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
    resCustomFileName?: string,
  ) {
    const pendingRequest = await pendings.findPendingRequestByTelegramMessage(
      reviewerId,
      requestMsgId,
    );

    if (
      !pendingRequest ||
      !pendingRequest.resourceId ||
      pendingRequest.status === "APPROVED"
    )
      return;

    const resourceFilesAssociated = await resourceFiles.findResourceFiles(
      pendingRequest.resourceId,
    );

    if (resourceFilesAssociated.length < 0) return;

    const resFileName = encodeURIComponent(
      resCustomFileName ?? resourceFilesAssociated[0].fileName,
    );

    const resName = `res/${resFolderName}/${resFileName}`;
    resources.updateResource(pendingRequest.resourceId, {
      name: resName,
      displayName: decodeURIComponent(resFileName),
    });

    const success = await pendings.approvePendingRequest(
      pendingRequest._id,
      reviewerId,
      pendingRequest.resourceId,
    );

    if (success) {
      await updateInlineKeyboard(reviewerId, requestMsgId);
      bot.api.sendMessage(
        reviewerId,
        `Request was approved:
<code>
${resName}
</code>`,
        {
          reply_parameters: { message_id: requestMsgId },
          parse_mode: "HTML",
        },
      );
    } else {
    }
  }

  async function updateInlineKeyboard(
    reviewerId: number,
    requestMessageId: number,
  ) {
    bot.api.editMessageReplyMarkup(reviewerId, requestMessageId, {
      reply_markup: new InlineKeyboard().copyText(
        `Approved`,
        requestMessageId.toString(),
      ),
    });
  }
};

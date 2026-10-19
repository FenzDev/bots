import { Bot, InlineKeyboard } from "grammy";
import { resourcesModule } from "../../repositories/module.repository.js";
import { pendings } from "../../repositories/pending.repository.js";
import { TELEGRAM_SUPERADMIN_ID } from "../../config/env.js";
import { replyToMessage } from "../../helpers/reply-to-message.js";
import logger from "../../lib/logger.js";

export default async (bot: Bot) => {
  bot.callbackQuery(/^ignore:(.+)$/, async (ctx, next) => {
    ctx.answerCallbackQuery();

    if (!ctx.match[1]) return next();
    const [semester, moduleName] = ctx.match[1].split("/");
    // logger.debug('Resources/ignore: Found args');

    const module = await resourcesModule.findModuleFromSemesterAndName(
      semester,
      moduleName,
    );
    if (!module) return next();
    // logger.debug('Resources/ignore: Found module');

    const request = await pendings.findPendingRequestByTelegramMessage(
      module.reviewerId ?? TELEGRAM_SUPERADMIN_ID,
      ctx.callbackQuery.message!.message_id,
    );
    if (!request) return next();
    logger.debug("Resources/ignore: Found requset");

    const success = await pendings.rejectPendingRequest(
      request._id,
      ctx.callbackQuery.from.id,
    );

    await ctx.api.editMessageReplyMarkup(
      request.requestChatId,
      request.requestMessageId,
      {
        reply_markup: new InlineKeyboard().copyText(
          "Ignored",
          request._id.toString(),
        ),
      },
    );

    if (success) {
      await ctx.reply(`Request was ignored`, {
        reply_parameters: { message_id: ctx.callbackQuery.message?.message_id },
      });
    } else {
      await ctx.reply(`Request was not ignored`, {
        reply_parameters: { message_id: ctx.callbackQuery.message?.message_id },
      });
    }

    return next();
  });
};

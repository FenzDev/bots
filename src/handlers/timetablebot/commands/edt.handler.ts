import { Bot, Context, InlineKeyboard, NextFunction } from "grammy";
import { replyToMessage } from "../../../helpers/reply-to-message.js";
import {
  StudySection,
  studySections,
} from "../../../repositories/study_section.repository.js";
import {
  resourceFiles,
  resources,
} from "../../../repositories/resource.repository.js";
import logger from "../../../lib/logger.js";
import { InlineKeyboardButton } from "grammy/types";

export default async (bot: Bot) => {
  async function sendEdt(ctx: Context, section: StudySection) {
    if (!ctx.chat) return;

    logger.info({ ctx }, "Pre-Sending documents");

    const edtResourceName = section.timetableLastStoredResourceName;
    if (!edtResourceName) return false;

    const edtResource = await resources.findResourceByName(edtResourceName);
    if (!edtResource) return false;

    const pdfFile = (await resourceFiles.findResourceFiles(edtResource._id)).at(
      0,
    );
    if (!pdfFile) return false;

    logger.info({ edtResourceName, pdfFile }, "Sending documents");

    await ctx.api.sendDocument(ctx.chat?.id, pdfFile.fileId, {
      receiver_user_id: ctx.from?.id !== ctx.chatId ? ctx.from?.id : undefined,
      message_thread_id: ctx.message?.message_thread_id ?? undefined,
    });
    return true;
  }

  bot.command("edt", async (ctx, next) => {
    do {
      const match = ctx.match.trim();
      const matchSection = await studySections.findStudySectionByName(match);

      if (matchSection) {
        if (await sendEdt(ctx, matchSection)) {
          return next();
        }
      }
    } while (false);

    // TODO: know section from chat or show menu
    let sectionsOfChat = await studySections.findStudySectionsByChat(
      ctx.chat.id,
    );

    if (sectionsOfChat.length === 1) {
      await sendEdt(ctx, sectionsOfChat[0]);
      return next();
    }

    if (sectionsOfChat.length === 0) {
      sectionsOfChat = await studySections.getAllStudySections();
    }

    const buttons: InlineKeyboardButton[] = sectionsOfChat.map((section) => ({
      text: section.displayShort ?? `"${section.name}"`,
      callback_data: `edt_${section.name}`,
    }));

    const rows: InlineKeyboardButton[][] = [];

    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(buttons.slice(i, i + 2));
    }

    await ctx.reply("Choose section:", {
      receiver_user_id: ctx.from?.id !== ctx.chatId ? ctx.from?.id : undefined,
      reply_markup: {
        inline_keyboard: rows,
      },
    });

    return next();
  });

  bot.callbackQuery(/^edt(?:_(.+))?$/, async (ctx, next) => {
    const sectionName = ctx.match.at(1);
    if (!sectionName) return next();

    const section = await studySections.findStudySectionByName(sectionName);
    if (!section) return next();

    await ctx.answerCallbackQuery();

    const message = ctx.callbackQuery.message;
    if (!message) return next();

    try {
      if (message?.ephemeral_message_id !== undefined) {
        await ctx.api.deleteEphemeralMessage(
          message.chat.id,
          ctx.from.id,
          message.ephemeral_message_id,
        );
      } else {
        await ctx.api.deleteMessage(message.chat.id, message.message_id);
      }
    } catch (err) {
      logger.error(err);
    }

    await sendEdt(ctx, section);
  });
};

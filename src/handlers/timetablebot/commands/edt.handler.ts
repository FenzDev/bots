import { Bot, NextFunction } from "grammy";
import { replyToMessage } from "../../../helpers/reply-to-message";
import { studySections } from "../../../repositories/study_section.repository";
import {
  resourceFiles,
  resources,
} from "../../../repositories/resource.repository";
import logger from "../../../lib/logger";

export default async (bot: Bot) => {
  bot.command("edt", async (ctx, next) => {
    do {
      const match = ctx.match.trim();
      const matchSection = await studySections.findStudySectionByName(match);

      logger.debug({ match, matchSection });
      if (matchSection) {
        const edtResourceName = matchSection.timetableLastStoredResourceName;
        if (!edtResourceName) break;

        const edtResource = await resources.findResourceByName(edtResourceName);
        if (!edtResource) break;

        const pdfFile = (
          await resourceFiles.findResourceFiles(edtResource._id)
        ).at(0);
        if (!pdfFile) break;

        await ctx.api.sendDocument(
          ctx.chatId,
          pdfFile.fileId,
          {
            reply_parameters: {
              ephemeral_message_id: ctx.message?.message_id,   
            },
            receiver_user_id: ctx.from?.id,
            message_thread_id: ctx.message?.message_thread_id ?? undefined,
          },
        );

        break;
      }
    } while (false);

    // TODO: know section from chat or show menu

    return next();
  });
};

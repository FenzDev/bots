import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import {
  studySectionInputSchema,
  studySections,
} from "../../../../repositories/study_section.repository.js";
import { replyToMessage } from "../../../../helpers/reply-to-message.js";
import { parseKeyValueInput } from "../../../../utils/parse_key_value.js";

const SECTION_FIELDS_HELP = [
  "`name` — Required section name",
  "`displayLong` — Long display name",
  "`displayShort` — Short display name",
  "`timetableStoargeChatId` — Telegram chat ID to store pdf of changed table",
  "`timetableStoargeThreadId` — Telegram thread ID or `null`",
  "`timetableBroadcastChatId` — Telegram chat ID to broadcast changes",
  "`timetableBroadcastThreadId` — Telegram thread ID or `null`",
  "`timetableGID` — Timetable Google ID",
  "`timetableCurrentHash` — Current timetable hash",
  "`telegramChatId` — Telegram general chat ID",
].join("\n");

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("setsection", async (ctx, next) => {
      const { result, error } = parseKeyValueInput(ctx.match, studySectionInputSchema);

      if (!result) {
        await replyToMessage(ctx, `${error!}\n${SECTION_FIELDS_HELP}`, {parse_mode:'Markdown'});
        return next();
      }

      await studySections.setStudySection(result);

      await replyToMessage(ctx, `Study section was added to db!\n\`\`\`json\n${JSON.stringify(result)}\`\`\``, {parse_mode:'Markdown'})

      return next();
    });
};

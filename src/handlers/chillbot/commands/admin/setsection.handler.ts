import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env";
import {
  studySectionInputSchema,
  studySections,
} from "../../../../repositories/study_section.repository";
import { replyToMessage } from "../../../../helpers/reply-to-message";
import { parseKeyValueInput } from "../../../../utils/parse_key_value";

const SECTION_FIELDS_HELP = [
  "`name` — Required section name",
  "`displayLong` — Long display name",
  "`displayShort` — Short display name",
  "`timetableBroadcastChatId` — Telegram chat ID",
  "`timetableBroadcastThreadId` — Telegram thread ID or `null`",
  "`timetableGID` — Timetable Google ID",
  "`timetableCurrentHash` — Current timetable hash",
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

      studySections.setStudySection(result);

      await replyToMessage(ctx, `Study section was added to db!\n\`\`\`json\n${JSON.stringify(result)}\`\`\``, {parse_mode:'Markdown'})

      return next();
    });
};

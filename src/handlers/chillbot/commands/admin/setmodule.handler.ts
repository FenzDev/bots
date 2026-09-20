import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import { replyToMessage } from "../../../../helpers/reply-to-message.js";
import { parseKeyValueInput } from "../../../../utils/parse_key_value.js";
import { resourcesModule, resourcesModuleInputSchema } from "../../../../repositories/module.repository.js";

const RESOURCES_MODULE_FIELDS_HELP = [
"`name` — Required resource module name",
"`semester` — Required semester (s5,s2,...)",
"`displayLong` — Long display name",
"`displayShort` — Short display name",
"`resourcesInputChatId` — Telegram chat ID to be listened to",
"`resourcesInputThreadId` — Telegram thread ID or `null` to be listened to",
].join("\n");


export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("setmodule", async (ctx, next) => {
      const { result, error } = parseKeyValueInput(ctx.match, resourcesModuleInputSchema);

      if (!result) {
        await replyToMessage(ctx, `${error!}\n${RESOURCES_MODULE_FIELDS_HELP}`, {parse_mode:'Markdown'});
        return next();
      }

      resourcesModule.setModule(result);

      await replyToMessage(ctx, `Resources module was added to db!\n\`\`\`json\n${JSON.stringify(result)}\`\`\``, {parse_mode:'Markdown'})

      return next();
    });
};

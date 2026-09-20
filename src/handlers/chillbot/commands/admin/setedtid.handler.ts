import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import logger from "../../../../lib/logger.js";
import { runtimeConfig } from "../../../../repositories/runtime_config.repository.js";
import { replyToMessage } from "../../../../helpers/reply-to-message.js";

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("setedtid", async (ctx, next) => {
      const arg = ctx.match.trim();

      if (!arg) return next();

      runtimeConfig.update({ timetablesId: arg });

      await replyToMessage(
        ctx,
        `New timetables sheets id is set to:\n\`${arg}\``,
        { parse_mode: "Markdown" },
      );

      return next();
    });
};

import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env.js";
import logger from "../../../../lib/logger.js";
import { studySections } from "../../../../repositories/study_section.repository.js";
import { runtimeConfig } from "../../../../repositories/runtime_config.repository.js";
import { checkTimetables } from "../../../../schedules/timetable.schedule.js";

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("initedts", async (ctx, next) => {
      if (!(await runtimeConfig.get()).timetablesId) return next();

      logger.debug('hey :)');

      let numOfInitialized = 0;
      const sections = await studySections.getAllStudySections();
      for (const section of sections) {
        if (!section.timetableGID || section.timetableCurrentHash) {
          logger.debug('out');
          continue;
        }

        logger.debug('lets a go')
        await checkTimetables({
          specificSections: [section],
          forceSilentUpdate: true,
        });
        logger.debug('done')

        numOfInitialized++;
      }

      await ctx.reply(
        `Timetables of ${
          numOfInitialized
        } section${numOfInitialized > 1 ? "s were" : " was"} initialized`,
      );
      return next();
    });
};

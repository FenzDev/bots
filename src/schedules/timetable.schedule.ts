import cron from "node-cron";
import logger from "../lib/logger";
import { debugMode } from "../handlers/chillbot/commands/admin/dbg.handler";
import { chillBot } from "../lib/bots";
import {
  StudySection,
  studySections,
} from "../repositories/study_section.repository";
import { downloadText } from "../utils/downloadText";
import { runtimeConfig } from "../repositories/runtime_config.repository";
import { createHash } from "crypto";
import { TIMETABLE_CHECK_SCHEDULE } from "../config/env";
import { runAIApp, timetableAIApp } from "../services/ai";
import { prompts } from "../services/ai/prompts";
import { TimetableCheckAIResult } from "../services/ai/apps/timetablecheck";

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

cron.schedule(
  TIMETABLE_CHECK_SCHEDULE,
  async () => {
    try {
      const sections = await studySections.getAllStudySections();

      type Updates = {
        section: StudySection;
        aiResponse?: TimetableCheckAIResult;
        newHash: string;
        newCSV: string;
      };

      const updatedTimetables: Updates[] = [];

      if (debugMode) {
        for (const section of sections) {
          if (!section.timetableBroadcastChatId) continue;
          const { timetablesId } = await runtimeConfig.get();
          const downloadUrl = `https://docs.google.com/spreadsheets/d/${timetablesId}/export?gid=${section.timetableGID}&format=csv`;
          const downloadedTimetableCSV = await downloadText(downloadUrl);

          const newHash = hashText(downloadedTimetableCSV);

          if (newHash !== section.timetableCurrentHash) {    
            studySections.setStudySection({
              name: section.name,
              timetableCurrentHash: newHash,
              timetableCurrentCSV: downloadedTimetableCSV,
            });

            logger.debug('Different Timetable is detected, running ai comparer.');
            const aiResult = await runAIApp(
              timetableAIApp,
              {
                tableACSV: section.timetableCurrentCSV,
                tableBCSV: downloadedTimetableCSV,
              },
              prompts["instructions/timetablebot/compare"],
            );
            if (typeof aiResult !== typeof String) {
              const res = aiResult as TimetableCheckAIResult;
              logger.debug(res,'AI has responded.');
              updatedTimetables.push({
                section,
                newHash,
                newCSV: downloadedTimetableCSV,
                aiResponse: res,
              });
            } else {
              updatedTimetables.push({
                section,
                newHash,
                newCSV: downloadedTimetableCSV,
              });
            }
          } else {
          }
        }
        let update: Updates | undefined;
        while ((update = updatedTimetables.shift())) {
          logger.debug('Broadcasting the update');
          await chillBot.api.sendMessage(
            update.section.timetableBroadcastChatId!,
            `${update.aiResponse?.changesFromAtoB
              .map((change) => {
                return `🆕 ${change.groupsInvolved
                  .map(
                    (g) => `#${g === "ALL" ? update!.section.displayShort : g}`,
                  )
                  .join(" ")}\n${change.changeDetail}${
                  change.from ? `From: ${change.from}\nTo: ${change.to}` : ""
                }`;
              })
              .join("\n")}`,
            {
              message_thread_id:
                update.section.timetableBroadcastThreadId ?? undefined,
            },
          );

          // this is when we retry when not in change
          // studySections.setStudySection({
          //   name: update.section.name,
          //   timetableCurrentHash: update.newHash,
          //   timetableCurrentCSV: update.newCSV,
          // });
          
          logger.debug('Broadcasted and changed hash and csv for that');
        }
      }
    } catch (err) {
      logger.error(err, "Error while checking timetable updates.");
    }
  },
  { logger },
);

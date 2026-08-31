import cron from "node-cron";
import logger from "../lib/logger";
import { debugMode } from "../handlers/chillbot/commands/admin/dbg.handler";
import { chillBot } from "../lib/bots";
import { studySections } from "../repositories/study_section.repository";
import { downloadText } from "../utils/downloadText";
import { runtimeConfig } from "../repositories/runtime_config.repository";
import { createHash } from "crypto";

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

cron.schedule(
  "*/5 * * * * *",
  async () => {
    try {
      const sections = await studySections.getAllStudySections();
      for (const section of sections) {
        if (!section.timetableBroadcastChatId) continue;
        if (debugMode) {
          const { timetablesId } = await runtimeConfig.get();
          const downloadUrl = `https://docs.google.com/spreadsheets/d/${timetablesId}/export?gid=${section.timetableGID}&format=csv`;
          const downloadedTimetableCSV = await downloadText(
            downloadUrl,
          );

          const newHash = hashText(downloadedTimetableCSV);

          if (newHash !== section.timetableCurrentHash) {
            // replace stored hash
            await studySections.setStudySection({
              name: section.name,
              timetableCurrentHash: newHash,
              timetableCurrentCSV: downloadedTimetableCSV,
            });
            // broadcast new update
            await chillBot.api.sendMessage(
              section.timetableBroadcastChatId,
              "Update",
              {
                message_thread_id:
                  section.timetableBroadcastThreadId ?? undefined,
              },
            );
          }
        }
      }
    } catch (err) {
      logger.error(err, "Error while checking timetable updates.");
    }
  },
  { logger },
);

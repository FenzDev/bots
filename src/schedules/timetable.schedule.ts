import cron from "node-cron";
import logger from "../lib/logger";
import { debugMode } from "../handlers/chillbot/commands/admin/dbg.handler";
import { chillBot } from "../lib/bots";
import {
  StudySection,
  studySections,
} from "../repositories/study_section.repository";
import { downloadBuffer, downloadText } from "../utils/download";
import { runtimeConfig } from "../repositories/runtime_config.repository";
import { createHash } from "crypto";
import { TIMETABLE_CHECK_SCHEDULE } from "../config/env";
import { runAIApp, timetableAIApp } from "../services/ai";
import { prompts } from "../services/ai/prompts";
import { TimetableCheckAIResult } from "../services/ai/apps/timetablecheck";
import { unzipHtmlFiles, ZipHtmlFile } from "../utils/timetable/unzipHtml";
import { extractTables } from "../utils/timetable/extractTables";
import { cleanTable } from "../utils/timetable/cleanTable";
import { normalizeGrid } from "../utils/timetable/normalizeGrid";
import { parseTableGrid } from "../utils/timetable/parseTableGrid";

function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function parseTimetableZip(
  zip: Buffer,
  filterPrediction: (fileName: string) => Promise<boolean> | boolean,
) {
  const htmlFiles = await unzipHtmlFiles(zip);

  const result = [];

  for (const file of htmlFiles) {
    const normalizedName = file.name.toLowerCase().replace(/\s+/g, "");

    if (!(await filterPrediction(normalizedName))) {
      continue;
    }

    const tables = extractTables(file.html);

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];

      const cleanedHtml = cleanTable(table);

      const parsedGrid = parseTableGrid(cleanedHtml);

      const grid = normalizeGrid(parsedGrid);

      result.push({
        sourceFile: normalizedName,
        html: cleanedHtml,
        grid,
      });
    }
  }

  return result;
}

cron.schedule(
  TIMETABLE_CHECK_SCHEDULE,
  async () => {
    try {
      if (debugMode) {
        return;
      }

      const sections = await studySections.getAllStudySections();

      type SectionUpdate = {
        section: StudySection;
        newHash: string;
        newGridJSON?: string;
        aiResponse?: TimetableCheckAIResult;
      };

      const updatedTimetables: SectionUpdate[] = [];

      const { timetablesId } = await runtimeConfig.get();
      const baseDownloadUrl = `https://docs.google.com/spreadsheets/d/${timetablesId}/export`;

      // check for any update and push to updatedTimetables
      for (const section of sections) {
        if (!section.timetableBroadcastChatId) continue;
        const downloadUrl = `${baseDownloadUrl}?gid=${section.timetableGID}&format=csv`;
        const downloadedTimetableCSV = await downloadText(downloadUrl);

        const newHash = hashText(downloadedTimetableCSV);

        if (newHash !== section.timetableCurrentHash) {
          studySections.setStudySection({
            name: section.name,
            timetableCurrentHash: newHash,
          });

          logger.debug("Different Timetable is detected, running ai comparer.");

          updatedTimetables.push({
            section,
            newHash,
          });
        }
      }
      // for each update download the html and pass each to ai to tell diff
      if (updatedTimetables.length > 0) {
        const zipBuffer = await downloadBuffer(`${baseDownloadUrl}?format=zip`);
        const htmls = await parseTimetableZip(
          zipBuffer,
          (fileName) =>
            updatedTimetables.findIndex(
              (t) => `${t.section.name}.html` === fileName,
            ) >= 0,
        );

        for (const timetable of updatedTimetables) {
          const htmlFile = htmls.find(
            (h) => h.sourceFile === `${timetable.section.name}.html`,
          );
          if (!htmlFile) {
            throw new Error(
              "The section name is not equivalent to any html file",
            );
          }
          if (!htmlFile.grid) {
            throw new Error("The grid wasn't properly parsed.");
          }

          timetable.newGridJSON = JSON.stringify(htmlFile.grid);
          studySections.setStudySection({
            name: timetable.section.name,
            timetableCurrentGridJSON: timetable.newGridJSON,
          });

          if (!timetable.section.timetableCurrentGridJSON) {
            continue;
          }

          for (let step = 0; step < 3; step++) {
            const aiResult = await runAIApp(
              timetableAIApp,
              {
                tableAGridJSON: timetable.section.timetableCurrentGridJSON,
                tableBGridJSON: timetable.newGridJSON,
              },
              prompts["instructions/timetablebot/compare"],
            );
            if (typeof aiResult === "string") {
              logger.error(
                { aiResult },
                "AI returned an unexpected string response.",
              );
              continue;
            }
            logger.debug(aiResult, "AI has responded.");

            if (aiResult.changesFromAtoB.length === 0) {
              break;
            }

            timetable.aiResponse = aiResult;
            break;
          }
        }

        let update: SectionUpdate | undefined;
        while ((update = updatedTimetables.shift())) {
          if (!update.aiResponse) {
            continue;
          }

          logger.debug("Broadcasting the update");
          await chillBot.api.sendMessage(
            update.section.timetableBroadcastChatId!,
            `🚨 Timetable was updated! 📅 🚨\n${update.aiResponse?.changesFromAtoB
              .map((change) => {
                return `- ${change.groupsInvolved
                  .map((g) => `#${g === "ALL" ? "SECTION" : g}`)
                  .join(" ")}\n${
                  change.changeType === "REMOVAL"
                    ? "➖ "
                    : change.changeType === "ADDITION"
                      ? "➕ "
                      : "🔁 "
                } ${change.changeDetail}`;
              })
              .join("\n")}`,
            {
              parse_mode: "Markdown",
              message_thread_id:
                update.section.timetableBroadcastThreadId ?? undefined,
            },
          );

          logger.debug("Broadcasted and changed hash and grid for that");
        }
      }
    } catch (err) {
      logger.error(err, "Error while checking timetable updates.");
    }
  },
  { logger },
);

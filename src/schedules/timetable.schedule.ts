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
import {
  TELEGRAM_TIMETABLEBOT_USERNAME,
  TIMETABLE_CHECK_SCHEDULE,
} from "../config/env";
import { runAIApp, timetableAIApp } from "../services/ai";
import { prompts } from "../services/ai/prompts";
import {
  TimetableCheckAIResult,
  TimetableSession,
} from "../services/ai/apps/timetablecheck";
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

let timetableCheckRunning = false;

cron.schedule(
  TIMETABLE_CHECK_SCHEDULE,
  async () => {
    try {
      if (timetableCheckRunning) {
        logger.warn(
          "New timetable check schedule was interrupted because one is still running.",
        );
        return;
      }

      timetableCheckRunning = true;

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
      const baseUrl = `https://docs.google.com/spreadsheets/d/${timetablesId}`;
      const baseDownloadUrl = `${baseUrl}/export`;

      // Check for any update.
      for (const section of sections) {
        if (!section.timetableBroadcastChatId) continue;

        const downloadUrl = `${baseDownloadUrl}?gid=${section.timetableGID}&format=csv`;
        const downloadedTimetableCSV = await downloadText(downloadUrl);

        const newHash = hashText(downloadedTimetableCSV);

        if (newHash === section.timetableCurrentHash) {
          continue;
        }

        logger.debug(
          { section: section.name },
          "Different Timetable is detected, waiting for changes to settle.",
        );

        let stableHash = newHash;

        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 10_000));

          const latestCSV = await downloadText(downloadUrl);
          const latestHash = hashText(latestCSV);

          if (latestHash === stableHash) {
            logger.debug(
              {
                section: section.name,
                hash: stableHash,
              },
              "Timetable has stopped changing.",
            );

            break;
          }

          logger.debug(
            {
              section: section.name,
              previousHash: stableHash,
              newHash: latestHash,
            },
            "Timetable changed again while waiting, continuing debounce.",
          );

          stableHash = latestHash;
        }

        // IMPORTANT:
        // Mark this hash as seen immediately after it has stabilized.
        studySections.setStudySection({
          name: section.name,
          timetableCurrentHash: stableHash,
        });

        updatedTimetables.push({
          section,
          newHash: stableHash,
        });
      }

      // For each stable update, download the HTML and pass it to AI
      // to determine the actual differences.
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

          if (!timetable.section.timetableCurrentGridJSON) {
            // No previous grid to compare against.
            studySections.setStudySection({
              name: timetable.section.name,
              timetableCurrentHash: timetable.newHash,
              timetableCurrentGridJSON: timetable.newGridJSON,
            });

            continue;
          }

          for (let step = 0; step < 3; step++) {
            logger.debug("Running AI checker ™.");
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

          // Persist the stable hash/grid only after the debounce + comparison.
          studySections.setStudySection({
            name: timetable.section.name,
            timetableCurrentHash: timetable.newHash,
            timetableCurrentGridJSON: timetable.newGridJSON,
          });
        }

        let update: SectionUpdate | undefined;

        while ((update = updatedTimetables.shift())) {
          if (!update.aiResponse) {
            logger.debug("AI decided to discard change.");
            continue;
          }

          logger.debug("Broadcasting the update");

          const pdfUrl = `https://t.me/${TELEGRAM_TIMETABLEBOT_USERNAME}?start=${update.section.name}`;
          const sourceUrl = `${baseUrl}/edit?gid=${update.section.timetableGID}`;

          await chillBot.api.sendMessage(
            update.section.timetableBroadcastChatId!,
            `
🚨📅 لقد تم تحديث جدول توقيت ${update.section.displayShort} 🚨!
📅 Timetable of ${update.section.displayShort} was updated!

${aiResultToString(update.section, update.aiResponse)}

[📄pdf](${pdfUrl}) [🔗source](${sourceUrl})`.trim().replace(/([_~`#+\-=|{}.!\\])/g, '\\$1'),
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
    } finally {
      timetableCheckRunning = false;
    }
  },
  { logger },
);

function aiResultToString(
  section: StudySection,
  aiResponse: TimetableCheckAIResult,
) {
  return aiResponse.changesFromAtoB
    .map((change) => {
      const groups =
        change.groupsInvolved.includes("ALL") ||
        aiResponse.maxNumOfGroups === change.groupsInvolved.length
          ? `#section #${section.displayShort?.trim().toUpperCase().replaceAll(" ", "_")}`
          : change.groupsInvolved.map((g) => `#${g}`).join(" ");

      const sessionTitle = `#${change.sessionTitleInvolved.trim().toUpperCase()}`;

      let content;
      if (!change.from) {
      } else if (!change.to) {
      } else {
        const content =
          change.changeTarget === "TEACHER"
            ? `👨‍🏫 **${change.from.teacher} ➜ ${change.to.teacher}**`
            : change.changeTarget === "CLASSROOM"
              ? `📍 **${change.from.classroom} ➜ ${change.to.classroom}**`
              : change.changeTarget === "DAY+TIME"
                ? `🕑 **${change.from.day} ${change.from.startTime} ➜ ${change.to.day} ${change.to.startTime}**`
                : change.changeTarget === "TIME"
                  ? `🕑 **${change.from.startTime} ➜ ${change.to.startTime}**`
                  : "${}";
      }

      return `> 🔴 ${sessionTitle} ${groups}\n> ${content}`;
    })
    .join("\n");
}

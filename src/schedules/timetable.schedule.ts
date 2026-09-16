import cron from "node-cron";
import logger from "../lib/logger";
import { debugMode } from "../handlers/chillbot/commands/admin/dbg.handler";
import { chillBot, resourcesBot } from "../lib/bots";
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
  TIMETABLE_CHECK_SETTLEMENT_DELAY,
} from "../config/env";
import { unzipHtmlFiles } from "../utils/timetable/unzipHtml";
import { extractTables } from "../utils/timetable/extractTables";
import { cleanTable } from "../utils/timetable/cleanTable";
import { normalizeGrid } from "../utils/timetable/normalizeGrid";
import { parseTableGrid } from "../utils/timetable/parseTableGrid";
import { compareTables, GroupsDiff } from "../utils/timetable/compareTables";
import { parseTimetableObject } from "../utils/timetable/parseTimetableObject";
import { Resource, resourceFiles, resources } from "../repositories/resource.repository";
import { InputFile } from "grammy";
import { downloadDocumentAndStoreResource } from "../services/resources/download-store";

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
    if (timetableCheckRunning) {
      logger.warn(
        "New timetable check schedule was interrupted because one is still running.",
      );
      return;
    }
    try {
      timetableCheckRunning = true;

      if (debugMode) {
        return;
      }

      const sections = await studySections.getAllStudySections();

      type SectionUpdate = {
        section: StudySection;
        newHash: string;
        newGridJSON?: string;
        diffs?: GroupsDiff[];
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
          await new Promise((resolve) =>
            setTimeout(resolve, TIMETABLE_CHECK_SETTLEMENT_DELAY * 1000),
          );

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

      // For each stable update, download the HTML and analyse diffs
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

          // parse grids into objects
          const timetableA = parseTimetableObject(
            JSON.parse(timetable.section.timetableCurrentGridJSON),
          );
          const timetableB = parseTimetableObject(htmlFile.grid);

          if (!timetableA || !timetableB) {
            throw new Error(
              "Timetable grids are unparssable probally devs fault",
            );
          }

          // Get the diffs
          timetable.diffs = compareTables(timetableA, timetableB);

          // Persist the stable hash/grid only after the debounce + comparison.
          studySections.setStudySection({
            name: timetable.section.name,
            timetableCurrentHash: timetable.newHash,
            timetableCurrentGridJSON: timetable.newGridJSON,
          });
        }

        let update: SectionUpdate | undefined;

        while ((update = updatedTimetables.shift())) {
          if (!update.diffs?.length) {
            logger.debug("No realistic differences in any session.");
            continue;
          }

          logger.debug("Broadcasting the update");

          const pdfResource = await downloadAndStorePdf(
            update.section,
            baseDownloadUrl,
          );

          // const pdfUrl = `https://t.me/${TELEGRAM_TIMETABLEBOT_USERNAME}?start=${update.section.name}`;
          const sourceUrl = `${baseUrl}/edit?gid=${update.section.timetableGID}#gid=${update.section.timetableGID}`;

          const text = `
🚨📅 لقد تم تحديث جدول توقيت ${update.section.displayShort} 🚨!
📅 Timetable of ${update.section.displayShort} was updated!

${diffResultToText(update.section, update.diffs)}

[🔗source](${escapeCommonMD(sourceUrl)})`
              .trim()
              .replace(/([`#+\-=|{}.!])/g, "\\$1");

          if (pdfResource) {
            const pdfResFile = (await resourceFiles.findResourceFiles(pdfResource._id))[0];
            await chillBot.api.copyMessage(
              update.section.timetableBroadcastChatId!,
              pdfResource.telegramStoredChatId!,
              pdfResFile.telegramStoredMessageId!,
            {
              caption: text,
              show_caption_above_media: true,
              parse_mode: "MarkdownV2",
              message_thread_id:
                update.section.timetableBroadcastThreadId ?? undefined,
              },
            );
          } else {
            await chillBot.api.sendMessage(
              update.section.timetableBroadcastChatId!,
              text,
            {
              parse_mode: "MarkdownV2",
              message_thread_id:
                update.section.timetableBroadcastThreadId ?? undefined,
              },
            );
            
          }

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

function diffResultToText(section: StudySection, diffs: GroupsDiff[]) {
  logger.debug({ diffs, section }, "generating ai result string");
  return diffs
    .map((groupsDiff) => {
      const groups = groupsDiff.hasAllGroups
        ? `#${section.displayShort?.toLowerCase().replaceAll(" ", "\\_")} #section`
        : groupsDiff.groups
            .map((g) => `#${section.sectionLetter?.toLowerCase() ?? "g"}${g}`)
            .join(" ");

      const dayTime = `${groupsDiff.day} ${groupsDiff.startTime}`;

      const content = `${
        groupsDiff.isPureAdd ? "➕" : groupsDiff.isPureRemove ? "➖" : "✏"
      } ${groupsDiff.diff
        .map((d) => {
          const [prefix, postfix] =
            d.type === "add"
              ? ["*__", "__*"]
              : d.type === "remove"
                ? ["~", "~"]
                : ["", ""];
          return `${prefix}${escapeCommonMD(d.text)}${postfix}`.trim();
        })
        .join(" ")}`;

      return `> 🔴 ${groups}\n> ${dayTime}\n> ${content}`;
    })
    .join("\n\n");
}

function escapeCommonMD(text: string) {
  return text.replace(/([*~_\[\]\(\)\\])/g, "\\$1");
}

function formatAlgiersDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Algiers",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value])
  );

  return `${values.day}${values.month}${values.hour}h`;
}

async function downloadAndStorePdf(
  section: StudySection,
  baseDownloadUrl: string,
): Promise<Resource|undefined> {
  if (!section.timetableStoargeChatId) return;

  const fileName = `EDT_${formatAlgiersDate(new Date())}.pdf`;
  const timetableResource = await downloadDocumentAndStoreResource(
    `${baseDownloadUrl}?gid=${section.timetableGID}&format=pdf`,
    {
      chatId: section.timetableBroadcastChatId!,
      threadId: section.timetableStoargeThreadId ?? null,
      fileName,
    },
    {
      name: `res_${section.name}_${fileName.toLowerCase()}`,
      isApproved: true,
      isMediaGroup: false,
      type: 'TIMETABLE',
      displayName: fileName,
    },
  )

  return timetableResource;
}

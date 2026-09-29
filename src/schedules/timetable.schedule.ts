import cron from "node-cron";
import logger from "../lib/logger.js";
import { debugMode } from "../handlers/chillbot/commands/admin/dbg.handler.js";
import { chillBot, resourcesBot, timetableBot } from "../lib/bots/index.js";
import {
  StudySection,
  studySections,
} from "../repositories/study_section.repository.js";
import { downloadBuffer, downloadText } from "../utils/download.js";
import { runtimeConfig } from "../repositories/runtime_config.repository.js";
import { createHash } from "crypto";
import {
  TELEGRAM_TIMETABLEBOT_USERNAME,
  TIMETABLE_CHECK_SCHEDULE,
  TIMETABLE_CHECK_SETTLEMENT_DELAY,
} from "../config/env.js";
import { unzipHtmlFiles } from "../services/timetable/unzipHtml.js";
import { extractTables } from "../services/timetable/extractTables.js";
import { cleanTable } from "../services/timetable/cleanTable.js";
import { normalizeGrid } from "../services/timetable/normalizeGrid.js";
import { parseTableGrid } from "../services/timetable/parseTableGrid.js";
import {
  compareTables,
  GroupsDiff,
} from "../services/timetable/compareTables.js";
import { parseTimetableObject } from "../services/timetable/parseTimetableObject.js";
import {
  Resource,
  resourceFiles,
  resources,
} from "../repositories/resource.repository.js";
import { InputFile } from "grammy";
import { downloadDocumentAndStoreResource } from "../services/resources/download-store.js";
import { addTextToTimetableImage } from "../services/image/addTextToTimetableImage.js";
import { generateTimestampId } from "../utils/genid.js";
import { WithId } from "mongodb";

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
      await checkTimetables({});
    } catch (err) {
      logger.error(err, "Error while checking timetable updates.");
    } finally {
      timetableCheckRunning = false;
    }
  },
  { logger },
);

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

export async function checkTimetables({
  forceSilentUpdate,
  specificSections,
}: {
  forceSilentUpdate?: boolean;
  specificSections?: WithId<StudySection>[];
}) {
  if (debugMode) {
    return;
  }

  const sections = specificSections
    ? specificSections
    : await studySections.getAllStudySections();

  type SectionUpdate = {
    section: StudySection;
    newHash: string;
    newGridJSON?: string;
    diffs?: GroupsDiff[];
  };

  const updatedTimetables: SectionUpdate[] = [];

  const { timetablesId } = await runtimeConfig.get();

  if (!timetablesId) throw new Error('No timetable id was specified');

  const baseUrl = `https://docs.google.com/spreadsheets/d/${timetablesId}`;
  const baseDownloadUrl = `${baseUrl}/export`;

  // Check for any update.
  for (const section of sections) {
    if (!forceSilentUpdate && !section.timetableBroadcastChatId) continue;

    const downloadUrl = `${baseDownloadUrl}?gid=${section.timetableGID}&format=csv`;
    const downloadedTimetableCSV = await downloadText(downloadUrl);

    const newHash = hashText(downloadedTimetableCSV);

    let stableHash;
    if (
      !forceSilentUpdate &&
      !(stableHash = await checkCSV(section, downloadUrl, newHash))
    )
      continue;

    // IMPORTANT:
    // Mark this hash as seen immediately after it has stabilized.
    await studySections.setStudySection({
      name: section.name,
      timetableCurrentHash: stableHash ?? newHash,
    });

    updatedTimetables.push({
      section,
      newHash: stableHash ?? newHash,
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
          (t) =>
            `${t.section.timetableSheetName?.toLowerCase() ?? t.section.name}.html` ===
            fileName,
        ) >= 0,
    );

    for (const timetable of updatedTimetables) {
      // TODO : set other name field of section repo for html
      // incase section.name is not same as one in gsheets
      const htmlFile = htmls.find(
        (h) =>
          h.sourceFile ===
          `${timetable.section.timetableSheetName?.toLowerCase() ?? timetable.section.name}.html`,
      );

      if (!htmlFile) {
        throw new Error("The section name is not equivalent to any html file");
      }

      if (!htmlFile.grid) {
        throw new Error("The grid wasn't properly parsed.");
      }

      timetable.newGridJSON = JSON.stringify(htmlFile.grid);

      if (forceSilentUpdate || !timetable.section.timetableCurrentGridJSON) {
        // Silent update / No previous grid to compare against.
        await studySections.setStudySection({
          name: timetable.section.name,
          timetableCurrentHash: timetable.newHash,
          timetableCurrentGridJSON: timetable.newGridJSON,
          timetableLastStoredResourceName: await downloadAndStoreEdtPdf(
            timetable.section,
            baseDownloadUrl,
          ).then((res) => res?.name),
        });

        continue;
      }

      // parse grids into objects
      const timetableA = parseTimetableObject(
        JSON.parse(timetable.section.timetableCurrentGridJSON),
      );
      const timetableB = parseTimetableObject(htmlFile.grid);

      if (!timetableA || !timetableB) {
        throw new Error("Timetable grids are unparssable probally devs fault");
      }

      // Get the diffs
      timetable.diffs = compareTables(
        timetableA,
        timetableB,
        timetable.section.timetableSectionHeaderPatern?.toLowerCase() ??
          timetable.section.sectionLetter ??
          "Section",
        timetable.section.timetableGroupHeaderPatern?.toLowerCase() ??
          `${timetable.section.sectionLetter ?? "G"}$`,
        timetable.section.groupsCount ?? 1,
      );

      // Persist the stable hash/grid only after the debounce + comparison.
      await studySections.setStudySection({
        name: timetable.section.name,
        timetableCurrentHash: timetable.newHash,
        timetableCurrentGridJSON: timetable.newGridJSON,
      });
    }

    let update: SectionUpdate | undefined;

    while ((update = updatedTimetables.shift())) {
      if (!update.diffs?.length) {
        logger.info({section:update.section.name}, "No realistic differences in any session.");
        continue;
      }

      logger.info({section:update.section.name},"Broadcasting the update");

      const pdfResource = await downloadAndStoreEdtPdf(
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

      const broadcastWithoutFile = async (update:SectionUpdate) =>
        await timetableBot.api.sendMessage(
          update.section.timetableBroadcastChatId!,
          text,
          {
            parse_mode: "MarkdownV2",
            message_thread_id:
              update.section.timetableBroadcastThreadId ?? undefined,
          },
        );

      if (pdfResource) {
        const pdfResFile = (
          await resourceFiles.findResourceFiles(pdfResource._id)
        )[0];

        if (!pdfResFile) {
          await broadcastWithoutFile(update);
          return;
        }

        await timetableBot.api.sendDocument(
          update.section.timetableBroadcastChatId!,
          pdfResFile.fileId,
          {
            caption: text,
            parse_mode: "MarkdownV2",
            message_thread_id:
              update.section.timetableBroadcastThreadId ?? undefined,
          },
        );
      } else {
        await broadcastWithoutFile(update);
      }

      logger.info({section:update.section.name},"Broadcasted and changed hash and grid for that");
    }
  }
}

async function checkCSV(
  section: StudySection,
  downloadUrl: string,
  newHash: string,
) {
  if (newHash === section.timetableCurrentHash) {
    return null;
  }

  logger.info(
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
      logger.info(
        {
          section: section.name,
          hash: stableHash,
        },
        "Timetable has stopped changing.",
      );

      return latestHash;
    }

    logger.info(
      {
        section: section.name,
        previousHash: stableHash,
        newHash: latestHash,
      },
      "Timetable changed again while waiting, continuing debounce.",
    );

    return latestHash;
  }
}

function diffResultToText(section: StudySection, diffs: GroupsDiff[]) {
  // logger.debug({ diffs, section }, "generating diff result string");
  return diffs
    .map((groupsDiff) => {
      const groups = groupsDiff.hasAllGroups
        ? `#${section.displayShort?.toLowerCase().replaceAll(" ", "\\_")} #section`
        : groupsDiff.groups.map((g) => `#${g}`).join(" ");

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
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.day} ${values.month} ${values.hour}h`;
}

async function downloadAndStoreEdtPdf(
  section: StudySection,
  baseDownloadUrl: string,
): Promise<Resource | undefined> {

  const timestamp = formatAlgiersDate(new Date());
  const timestampNoSpaces = timestamp.replaceAll(" ", "");
  const fileName = `EDT_${section.timetableSheetName?.replaceAll(" ", "") ?? section.name} (${timestampNoSpaces}).pdf`;
  const resourceFileName = `edt_${timestampNoSpaces}_${generateTimestampId()}`;
  const previewImg = section.displayShort
    ? await addTextToTimetableImage(
        section.timetableSheetName ?? section.displayShort,
        timestamp,
        section.name,
      )
    : undefined;

  const timetableResource = await downloadDocumentAndStoreResource(
    `${baseDownloadUrl}?gid=${section.timetableGID}&format=pdf`,
    {
      chatId: section.timetableStoargeChatId ?? (await runtimeConfig.get()).defaultStorageChatId!,
      threadId: section.timetableStoargeThreadId ?? (await runtimeConfig.get()).defaultStorageThreadId ?? null,
      fileName,
      previewFile: previewImg ? new InputFile(previewImg) : undefined,
    },
    {
      name: `res_${section.timetableSheetName}_${resourceFileName.toLowerCase()}`,
      isApproved: true,
      isMediaGroup: false,
      type: "TIMETABLE",
      displayName: fileName,
    },
    timetableBot,
  );

  await studySections.setStudySection({
    name: section.name,
    timetableLastStoredResourceName: timetableResource.name,
  });

  if (section.timetableSheetName) {
    const sheetFamily = await studySections.findStudySectionBySheetName(section.timetableSheetName);
    for (const sameSheetSection of sheetFamily) {
      if (sameSheetSection.name===section.name) continue;

      await studySections.setStudySection({
        name: sameSheetSection.name,
        timetableLastStoredResourceName: timetableResource.name,
      });

    }
  }

  return timetableResource;
}

import { Bot } from "grammy";
import { TELEGRAM_SUPERADMIN_ID } from "../../../../config/env";
import logger from "../../../../lib/logger";
import { trackedScopes } from "../../../../repositories/tracked_scope.repository";
import {
  StudySectionInput,
  studySections,
} from "../../../../repositories/study_section.repository";
import { replyToMessage } from "../../../../helpers/reply-to-message";

const SECTION_FIELDS_HELP = [
  "`name` — Required section name",
  "`displayLong` — Long display name",
  "`displayShort` — Short display name",
  "`timetableBroadcastChatId` — Telegram chat ID",
  "`timetableBroadcastThreadId` — Telegram thread ID or `null`",
  "`timetableGID` — Timetable Google ID",
  "`timetableCurrentHash` — Current timetable hash",
].join("\n");

function parseSectionInfo(rawInput: string): {
  result?: StudySectionInput;
  error?: string;
} {
  const help = `Available fields:\n${SECTION_FIELDS_HELP}`;

  try {
    const input = rawInput.trim();

    if (!rawInput.trim()) {
      return {
        error: `No section information was provided.\n\n${help}`,
      };
    }

    const values: Record<string, string> = {};

    // Supports:
    // key=value
    // key='value with spaces'
    const pairRegex = /([a-zA-Z][a-zA-Z0-9]*)=(?:'([^']*)'|([^\s]+))/g;

    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = pairRegex.exec(input)) !== null) {
      const between = input.slice(lastIndex, match.index).trim();

      if (between) {
        return {
          error: `Invalid syntax near "${between}". Expected key=value.`,
        };
      }

      const [, key, quotedValue, unquotedValue] = match;
      const value = quotedValue ?? unquotedValue;

      if (key in values) {
        return { error: `Duplicate key "${key}".` };
      }

      values[key] = value;
      lastIndex = pairRegex.lastIndex;
    }

    const remaining = input.slice(lastIndex).trim();

    if (remaining) {
      return {
        error: `Invalid syntax near "${remaining}". Expected key=value.`,
      };
    }

    if (!Object.keys(values).length) {
      return { error: "No valid key=value pairs were provided." };
    }

    const allowedKeys = new Set([
      "name",
      "displayLong",
      "displayShort",
      "timetableBroadcastChatId",
      "timetableBroadcastThreadId",
      "timetableGID",
      "timetableCurrentHash",
    ]);

    for (const key of Object.keys(values)) {
      if (!allowedKeys.has(key)) {
        return { error: `Unknown field "${key}".` };
      }
    }

    if (!values.name?.trim()) {
      return { error: 'Missing required field "name".' };
    }

    const parseNumber = (
      key: "timetableBroadcastChatId" | "timetableBroadcastThreadId",
    ): number | undefined => {
      const value = values[key];

      if (value === undefined) {
        return undefined;
      }

      const number = Number(value);

      if (!Number.isSafeInteger(number)) {
        throw new Error(`"${key}" must be a valid integer.`);
      }

      return number;
    };

    const result: StudySectionInput = {
      name: values.name,

      ...(values.displayLong !== undefined && {
        displayLong: values.displayLong,
      }),

      ...(values.displayShort !== undefined && {
        displayShort: values.displayShort,
      }),

      ...(values.timetableBroadcastChatId !== undefined && {
        timetableBroadcastChatId: parseNumber("timetableBroadcastChatId"),
      }),

      ...(values.timetableBroadcastThreadId !== undefined && {
        timetableBroadcastThreadId:
          values.timetableBroadcastThreadId === "null"
            ? null
            : parseNumber("timetableBroadcastThreadId"),
      }),

      ...(values.timetableGID !== undefined && {
        timetableGID: values.timetableGID,
      }),

      ...(values.timetableCurrentHash !== undefined && {
        timetableCurrentHash: values.timetableCurrentHash,
      }),
    };

    return { result };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid section information.";

    return {
      error: `${message}\n\n${help}`,
    };
  }
}

export default async (bot: Bot) => {
  bot
    .filter((ctx) => ctx.from?.id === TELEGRAM_SUPERADMIN_ID)
    .command("setsection", async (ctx, next) => {
      const { result, error } = parseSectionInfo(ctx.match);

      if (!result) {
        await replyToMessage(ctx, error!, {parse_mode:'Markdown'});
        return next();
      }

      studySections.setStudySection(result);

      await replyToMessage(ctx, `Study section was added to db!\n\`\`\`json\n${JSON.stringify(result)}\`\`\``, {parse_mode:'Markdown'})

      return next();
    });
};

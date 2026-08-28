import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import logger from "./logger";

async function loadSchedules(schedulesDirectory: string): Promise<number> {
  const entries = await readdir(schedulesDirectory, {
    withFileTypes: true,
  });

  let num = 0;

  for (const entry of entries) {
    const fullPath = join(schedulesDirectory, entry.name);

    try {
      if (entry.isDirectory()) {
        num += await loadSchedules(fullPath);
        continue;
      }

      const isScheduleFile =
        entry.name.endsWith(".schedule.ts") ||
        entry.name.endsWith(".schedule.js");

      if (!isScheduleFile) {
        continue;
      }

      // Importing the module starts/registers the schedules.
      await import(pathToFileURL(fullPath).href);

      num++;
    } catch (err) {
      logger.error({ err }, `${entry.name} schedule was not loaded.`);
    }
  }

  return num;
}

export async function handleSchedules() {
  const schedulesDirectory = fileURLToPath(
    new URL("../schedules/", import.meta.url),
  );

  const num = await loadSchedules(schedulesDirectory);

  logger.info(`${num}/${num} schedules were loaded.`);
}

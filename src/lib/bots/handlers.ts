// lib/loadHandlers.ts

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import type { Bot } from "grammy";
import { z } from "zod";

import logger from "../logger.js";

type BotHandler = (bot: Bot) => void | Promise<void>;

const handlerModuleSchema = z.object({
  default: z.function(),
});

export async function loadHandlers(
  bot: Bot,
  handlersDirectory: string,
) {
  const entries = await readdir(handlersDirectory, {
    withFileTypes: true,
  });
  let num = 0;
  let maxNum = 0;
  for (const entry of entries) {
    const fullPath = join(handlersDirectory, entry.name);

    try {
      if (entry.isDirectory()) {
        const {num:addedNum, maxNum:addedMaxNum } = await loadHandlers(bot, fullPath);
        num += addedNum;
        maxNum += addedMaxNum;
        
        continue;
      }

      const isHandlerFile =
        entry.name.endsWith(".handler.ts") ||
        entry.name.endsWith(".handler.js");

      if (!isHandlerFile) {
        continue;
      }

      const module = await import(pathToFileURL(fullPath).href);

      const result = handlerModuleSchema.safeParse(module);

      if (!result.success) {
        logger.error(`Invalid handler ${fullPath}: ${result.error.message}`);
        continue;
      }

      const handler = result.data.default as BotHandler;

      await handler(bot);
      num++;
    } catch (err) {
      logger.error({ err }, `${entry.name} was not loaded`);
    }
    maxNum++;
  }
  return {num, maxNum};
}

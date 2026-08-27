import { loadHandlers } from "./handlers";

import { Bot } from "grammy";
import {
  TELEGRAM_CHILLBOT_TOKEN,
  TELEGRAM_GUARDBOT_TOKEN,
  TELEGRAM_RESOURCESBOT_TOKEN,
  TELEGRAM_TIMETABLEBOT_TOKEN,
} from "../../config/env";
import logger from "../logger";
import { fileURLToPath } from "url";

export const chillBot = new Bot(TELEGRAM_CHILLBOT_TOKEN);
export const timetableBot = new Bot(TELEGRAM_TIMETABLEBOT_TOKEN);
export const guardBot = new Bot(TELEGRAM_GUARDBOT_TOKEN);
export const resourcesBot = new Bot(TELEGRAM_RESOURCESBOT_TOKEN);

const botHandlers = [
  ["chillbot", chillBot],
  ["guardbot", guardBot],
  ["resourcesbot", resourcesBot],
  ["timetablebot", timetableBot],
] as const;

export async function handleBots() {
  for (const [name,bot] of botHandlers)
  {
    try {
      const handlersDirectory = fileURLToPath(
        new URL(`../../handlers/${name}/`, import.meta.url),
      );

      const num = await loadHandlers(bot, handlersDirectory);
      logger.info(`${num}/${num} ${name} handlers were loaded.`);
    } catch (err) {
      logger.error({ err }, `${name} handlers were not loaded.`);
    }
  };
}

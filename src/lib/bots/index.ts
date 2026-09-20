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
export const timetableBot =
  TELEGRAM_CHILLBOT_TOKEN === TELEGRAM_TIMETABLEBOT_TOKEN
    ? chillBot
    : new Bot(TELEGRAM_TIMETABLEBOT_TOKEN);
export const guardBot =
  TELEGRAM_CHILLBOT_TOKEN === TELEGRAM_GUARDBOT_TOKEN
    ? chillBot
    : new Bot(TELEGRAM_GUARDBOT_TOKEN);
export const resourcesBot =
  TELEGRAM_CHILLBOT_TOKEN === TELEGRAM_RESOURCESBOT_TOKEN
    ? chillBot
    : new Bot(TELEGRAM_RESOURCESBOT_TOKEN);

const botHandlers = [
  ["chillbot", chillBot],
  ["guardbot", guardBot],
  ["resourcesbot", resourcesBot],
  ["timetablebot", timetableBot],
] as const;

export async function handleBots(
  systemHandle: (bot: Bot) => Promise<void> | void,
) {
  try {
    for (const [name, bot] of botHandlers) {
      await systemHandle(bot);

      const handlersDirectory = fileURLToPath(
        new URL(`../../handlers/${name}/`, import.meta.url),
      );

      const { num, maxNum } = await loadHandlers(bot, handlersDirectory);

      logger.info(`${num}/${maxNum} ${name} handlers were loaded.`);
    }
    {
      const sharedHandlersDirectory = fileURLToPath(
        new URL(`../../handlers/shared/`, import.meta.url),
      );
      const uniqueBots = new Set<string>();
      let { num, maxNum } = { num: 0, maxNum: 0 };
      for (const [name, bot] of botHandlers) {
        if (uniqueBots.has(bot.token)) continue;

        ({ num, maxNum } = await loadHandlers(bot, sharedHandlersDirectory));

        if (num !== maxNum) break;

        uniqueBots.add(bot.token);
      }
      logger.info(`${num}/${maxNum} shared handlers were loaded.`);
    }
  } catch (err) {
    logger.error({ err }, `${name} handlers were not loaded.`);
  }
}

export async function forEachBot(
  hookFunc: (bot: Bot, botName: string, token: string) => void,
) {
  botHandlers.forEach(([botName, bot]) => {
    hookFunc(bot, botName, bot.token);
  });
}

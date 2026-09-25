import { Bot } from "grammy";
import logger from "../../lib/logger.js";

export default async (bot: Bot) => {
  bot.api.deleteMyCommands();
};

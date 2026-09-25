import { Bot } from "grammy";
import logger from "../../lib/logger.js";

export default async (bot: Bot) => {
  bot.api.deleteMyCommands({scope:{type:'all_group_chats'}});
  bot.api.deleteMyCommands({scope:{type:'all_private_chats'}});
};

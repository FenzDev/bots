import { Bot } from "grammy";
import logger from "../../lib/logger.js";

export default async (bot: Bot) => {
  const commands = 
    [
      {
        command: "edt",
        description: "Get latest timetable in pdf.",
        is_ephemeral: true,
      },
    ];

  await bot.api.setMyCommands(
    commands,
    { scope: { type: `all_group_chats` } },
  );
  await bot.api.setMyCommands(
    commands,
    { scope: { type: `all_private_chats` } },
  );

};

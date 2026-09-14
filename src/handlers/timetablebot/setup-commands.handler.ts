import { Bot } from "grammy";
import logger from "../../lib/logger";

export default async (bot: Bot) => {
  await await bot.api.setMyCommands(
    [
      {
        command: "edt",
        description: "Get latest timetable in pdf.",
        is_ephemeral: true,
      },
    ],
    { scope: { type: `all_group_chats` } },
  );

};

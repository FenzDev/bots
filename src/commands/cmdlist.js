const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");
const { replyToMessage } = require("../handlers/commands");

const commandName = "cmdlist";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
  const args = ctx.match.split(" ");

  await ctx.api.deleteMyCommands({ scope: { type: "all_group_chats" } });
  await ctx.api.deleteMyCommands({
    scope: { type: "all_chat_administrators" },
  });
  await ctx.api.deleteMyCommands({ scope: { type: "default" } });

  await ctx.api.setMyCommands(
    [
      {
        command: "edt",
        description: "[L1/L1A/L1B/L2] Shows current timetable.",
      },
    ],
    {
      scope: { type: "all_group_chats" },
    }
  );
  await ctx.api.setMyCommands(
    [
      {
        command: "edt",
        description: "[L1/L1A/L1B/L2] Shows current timetable.",
      },
      {
        command: "drive",
        description: "Allows you to browse through the drive containing teacher files and others.",
      }
    ],
    {
      scope: { type: "all_private_chats" },
    }
  );

  return (await replyToMessage(ctx, "added")).message_id;
}

module.exports = { commandName, command };

const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");
const { replyToMessage } = require("../handlers/commands");

const commandName = "getid";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
  if (ctx.message?.reply_to_message) {
    console.log(
      `/getid: target message:\n\tmessage_id = ${ctx.message.reply_to_message.message_id}\n\tchat_id = ${ctx.message.reply_to_message.chat.id}`
    );
    await ctx.deleteMessage();
  } else {
    ctx.reply(`Your id is: \`${ctx.from.id}\``, {
      parse_mode: "Markdown",
      reply_parameters: { message_id: ctx.msgId, chat_id: ctx.chatId },
    });
  }

}

module.exports = { commandName, command };

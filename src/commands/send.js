const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");

const commandName = "send";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
  /** @type {String[]} */
  const args = ctx.match.split(" ");

  try {
    // for example : /send https://t.me/c/2520116528/425 / sup everyone (no reply)
    //               /send https://t.me/c/2520116528/426 yes i am talking to you (with reply)
    const destUrl = args[0].split("/");
    const chatId = Number(`-100${destUrl[destUrl.length - 2]}`);
    const replyInfo =
      (args[1] !== "/")
        ? { message_id: Number(destUrl[destUrl.length - 1]), chat_id: chatId }
        : undefined;
    const content =
      (args[1] !== "/") ? args.slice(1).join(" ") : args.slice(2).join(" ");

    ctx.api.sendMessage(chatId, content, { reply_parameters: replyInfo });
  } catch (ex) {
    console.log(ex);
  }
}

module.exports = { commandName, command };

const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");
const { applyCommandFromPrompt } = require("./commands");
const throwError = require("../services/throwError");

// ui = inline keyboards

const callbacksMap = new Map(); // key: string -> value: func (object) => void
// this below used when we want to give ui message identification/info that is currently present
const uiMsgInfo = new Map(); // key is (chatId,messageId) : int -> value is any data

/**
 * @param {Bot} bot
 */
async function init(bot) {
  bot.on("callback_query:data", async (ctx) => {
    try {
      console.log("gg");
      const data = ctx.callbackQuery.data.split(";");
      console.log("gggg");
      ctx.cmd = true;
      ctx.cmdFromId = Number(data[0]);
      ctx.cmdMsgId = Number(data[1]);
      if (ctx.cmdFromId !== ctx.from.id) {
        await ctx.answerCallbackQuery({
          show_alert: true,
          text: "You are not the original invoker of the command!",
        });
      } else {
        await ctx.answerCallbackQuery();
        try {
          // if it starts with '*' its not a command but ui action (currently only deletion)
          if (!data[2].startsWith("*")) {
            // if it starts with '~' asks to modify the ui message without deleting it
            if (data[2].startsWith("~")) {
              ctx.modifyMsgMode = true;
              ctx.modifyMsgId = ctx.callbackQuery.message.message_id;
            }

            const args = data.slice(2).join(";");
            applyCommandFromPrompt(
              ctx,
              ctx.modifyMsgMode ? args.substring(1) : args
            ).then(async () => {
              if (!ctx.modifyMsgMode) {
                uiMsgInfo.delete(
                  `${ctx.chatId},${
                    ctx.modifyMsgMode ? ctx.modifyMsgId : ctx.msgId
                  }`
                );
                try {

                  await ctx.api.deleteMessage(
                    ctx.callbackQuery.message.chat.id,
                    ctx.callbackQuery.message.message_id
                  );
                } catch (ex) {
                  throwError(ex);
                }
              }
            });
          } else {
            await ctx.api.deleteMessage(
              ctx.callbackQuery.message.chat.id,
              ctx.callbackQuery.message.message_id
            );
          }
        } catch {
          await throwError(ex);
        }
      }
    } catch (ex) {
      await throwError(ex);
    }
  });
}

/**
 * @returns {String}
 * @param {Context} ctx */
function createHeader(ctx) {
  return ctx.cmd
    ? `${ctx.cmdFromId};${ctx.cmdMsgId}`
    : `${ctx.from.id};${ctx.msgId}`;
}

/**
 * @returns {number}
 * @param {Context} ctx */
function getUserId(ctx) {
  return ctx.cmd ? ctx.cmdFromId : ctx.from.id;
}

/**
 * @param {Context} ctx
 * @param {import("grammy/types").InlineKeyboardMarkup[][]} layout
 * @param {string} callback
 */
async function sendCmdUi(ctx, text, layout, askLangPreference = true) {
  return await ctx.api.sendMessage(ctx.chatId, text, {
    reply_markup: { inline_keyboard: layout },
  });
}

module.exports = { init, uiMsgInfo, sendCmdUi, createHeader, getUserId };

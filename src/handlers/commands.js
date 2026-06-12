const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");
const throwError = require("../services/throwError");

// commands

let ownerCmds = [];
let modsCmds = [];
let publicCmds = [];

let replyMap = new Map();

function addToBeDeleted(chatId, cmdMsg, botReplyMsg, cycle) {
  if (!botReplyMsg) return;
  replyMap.set({ id: cmdMsg, chatId: chatId }, [botReplyMsg, cycle]);
}

/** @param {Context} ctx  */
function isOwner(ctx) {
  return getStorage().constants.ownerId === ctx.from?.id ?? ctx.cmdFromId;
}
/** @param {Context} ctx  */
function isMod(ctx) {
  return false;
  //   isOwner(ctx) ||
  //   getStorage().constants.groups.l1.grpMods.includes(
  //     ctx.from?.id ?? ctx.cmdFromId
  //   ) ||
  //   getStorage().constants.groups.l2.grpMods.includes(
  //     ctx.from?.id ?? ctx.cmdFromId
  //   )
  // );
}

/**
 * @param {Context} ctx
 * @param {Function} cmd
 */
async function applyCommandDirect(ctx, cmd) {
  try {
    ctx.modifyMsgMode ??= false;
    const replyMsgId = await cmd(ctx);
    // console.log("bot reply id: ", replyMsgId);
    // if (ctx.cmd) addToBeDeleted(ctx.chatId, ctx.cmdMsgId, replyMsgId, 0);
    // else addToBeDeleted(ctx.chatId, ctx.msgId, replyMsgId, 0);
    return replyMsgId;
  } catch (ex) {
    await throwError(ex);
  }
}

/**
 * @param {Context} ctx
 * @param {String} cmdPrompt
 */
async function tryApplyCommandViaModule(ctx, cmdModule, cmdPrompt) {
  if (
    cmdPrompt.startsWith(cmdModule.commandName) ||
    cmdPrompt.startsWith(cmdModule.commandName, 1)
  ) {
    ctx.match = cmdPrompt.substring(cmdModule.commandName.length + 1);
    console.log("match: ", ctx.match);
    return await applyCommandDirect(ctx, cmdModule.command);
  }
  return -1;
}
/**
 * @param {Context} ctx
 * @param {String} cmdPrompt
 */
async function applyCommandFromPrompt(ctx, cmdPrompt) {
  try {
    for (let i = 0; i < publicCmds.length; i++) {
      if (
        (await tryApplyCommandViaModule(ctx, publicCmds[i], cmdPrompt)) !== -1
      )
        return;
    }

    if (!isMod(ctx)) return;
    for (let i = 0; i < modsCmds.length; i++)
      if ((await tryApplyCommandViaModule(ctx, modsCmds[i], cmdPrompt)) !== -1)
        return;

    if (!isOwner(ctx)) return;
    for (let i = 0; i < ownerCmds.length; i++)
      if ((await tryApplyCommandViaModule(ctx, ownerCmds[i], cmdPrompt)) !== -1)
        return;
  } catch (ex) {
    throwError(ex);
  }
}

/**
 * @returns {Promise<import("grammy/types").Message.TextMessage>}
 * @param {Context} ctx
 * @param {String} text
 * @param {import("grammy/types").ReplyKeyboardMarkup | import("grammy/types").InlineKeyboardMarkup} replyMarkup
 * @param {boolean} doReply
 */
async function replyToMessage(
  ctx,
  text = "",
  replyMarkup = {},
  doReply = true
) {
  return await ctx.reply(text, {
    reply_parameters: doReply
      ? { message_id: ctx.cmd ? ctx.cmdMsgId : ctx.msgId, chat_id: ctx.chatId }
      : undefined,
    reply_markup: replyMarkup,
  });
}

/**
 * @returns {Promise<Number>}
 * @param {Context} ctx
 * @param {Number} fromChat
 * @param {Number} fromMsg
 * @param {String} caption
 * @param {boolean} doReply
 */
async function copyReplyToMessage(
  ctx,
  fromChat,
  fromMsg,
  caption = undefined,
  doReply = true
) {
  return (
    await ctx.api.copyMessage(ctx.chatId, fromChat, fromMsg, {
      caption: caption,
      reply_parameters: doReply
        ? {
            message_id: ctx.cmd ? ctx.cmdMsgId : ctx.msgId,
            chat_id: ctx.chatId,
          }
        : undefined,
    })
  ).message_id;
}

/**
 * @returns {Promise<Number>}
 * @param {Context} ctx
 * @param {Number} fromChat
 * @param {Number[]} fromMsgs
 * @param {String} caption
 * @param {boolean} doReply
 */
async function copyMultiMsgReplyToMessage(
  ctx,
  fromChat,
  fromMsgs,
  caption = undefined,
  doReply = true
) {
  return await ctx.api.copyMessages(ctx.chatId, fromChat, fromMsgs);
}
/**
 *
 * @param {Context} ctx
 */
async function deleteUserMsg(ctx) {
  try {
    return await ctx.api.deleteMessage(
      ctx.chat.id,
      ctx.cmd ? ctx.cmdMsgId : ctx.msgId
    );
  } catch (ex) {
    console.log("Message was not deleted: ", ex);
  }
}

/**
 * @param {Bot} bot
 */
async function init(bot) {
  ownerCmds = [
    require("../commands/ping"),
    require("../commands/dbg"),
    require("../commands/fload"),
    require("../commands/fsave"),
    require("../commands/send"),
    require("../commands/cmdlist"),
    require("../commands/reject"),
    require("../commands/approve"),
  ];
  modsCmds = [];
  publicCmds = [
    require("../commands/getid"),
    require("../commands/start"),
    require("../commands/contribute"),
    require("../commands/drive"),
    require("../commands/calc"),
    require("../commands/edt"),
  ];

  //  -- Register commands --
  for (let i = 0; i < ownerCmds.length; i++)
    bot.command(ownerCmds[i].commandName, async (ctx) => {
      if (isOwner(ctx)) {
        applyCommandDirect(ctx, ownerCmds[i].command);
      }
    });
  for (let i = 0; i < modsCmds.length; i++)
    bot.command(modsCmds[i].commandName, async (ctx) => {
      if (isMod(ctx)) {
        applyCommandDirect(ctx, modsCmds[i].command);
      }
    });
  for (let i = 0; i < publicCmds.length; i++) {
    bot.command(publicCmds[i].commandName, async (ctx) => {
      applyCommandDirect(ctx, publicCmds[i].command);
    });
  }
}

module.exports = {
  init,
  applyCommandFromPrompt,
  applyCommandDirect,
  replyToMessage,
  copyReplyToMessage,
  copyMultiMsgReplyToMessage,
  deleteUserMsg,
  replyMap,
};

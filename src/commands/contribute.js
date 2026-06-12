const { Bot, Context, Api } = require("grammy");
const {
  getStorage,
  modifyStorage,
  saveStorage,
} = require("../services/storage");
const { replyToMessage, deleteUserMsg } = require("../handlers/commands");
const {
  contributionInput,
  initializeInput,
} = require("../handlers/contibution_collector");
const { uiContributeMenu } = require("../ui/contribute");
const { uiContributionSend } = require("../ui/contribute_dep_agnostic");
const { sendCmdUi, uiMsgInfo } = require("../handlers/ui");
const e = require("express");
const { uiContributeRequest } = require("../ui/request");

const commandName = "contribute";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
  /**
   * @type {string[]}
   */
  const args = ctx.match.split(" ");

  const userId = ctx.from?.id ?? ctx.cmdFromId;
  if (
    ctx.chat.id !== (ctx.from?.id ?? ctx.cmdFromId) &&
    contributionInput.has(ctx.from?.id ?? ctx.cmdFromId)
  ) {
    contributionInput.delete(ctx.from?.id ?? ctx.cmdFromId);
  }

  if (ctx.modifyMsgMode) {
    uiMsgInfo.delete(
      `${ctx.chatId},${ctx.modifyMsgMode ? ctx.modifyMsgId : ctx.message?.id}`
    );
  }

  let location = args.join("»");
  let locationText = `Contributing to : ${location}`;
  locationText = location === "" ? "Contribute: Select semester" : locationText;

  if (args[args.length - 1] === "?")
    locationText = locationText.substring(0, locationText.length - 1); // `...>>..>>?` becomes `...>>..>>`

  const presendText = `
${locationText}
بعد وضع الملفات/الصور التي تريد إرسالها سوف يظهر زر عليك ضغطه
After you put the documents/images you want to share a button will show up, you will have to click it

بعض القواعد التي من المستحسن/يجب اتباعها:
- اذا كانت الملفات موجودة على التيليقرام من قبل يمكنك استحضارها (forward)
- على الملفات أو الصور أن يكونوا في موضوع واحد
- ان كانوا صورًا عليهم ان يكونوا في الترتيب الصحيح
- تأكد من عدم وجود ملف أو موضوع مشابه بالفعل
- تأكد من عدم ظهور وجوه في الصور
`;

  if (args[args.length - 1] === "?") {
    let msgId = ctx.modifyMsgId;
    if (ctx.modifyMsgMode)
      await ctx.api.editMessageText(ctx.chatId, ctx.modifyMsgId, presendText, {
        reply_markup: { inline_keyboard: uiContributionSend(ctx) },
      });
    else {
      msgId = (
        await replyToMessage(
          ctx,
          presendText,
          { inline_keyboard: uiContributionSend(ctx) },
          true
        )
      ).message_id;
    }
    // await sendCmdUi(
    //   ctx,
    //   "Contribute",
    //   uiContributeMenu(ctx, ctx.match),
    //   true
    // );
    contributionInput.set(
      userId,
      initializeInput(userId, msgId, args.slice(0, -1))
    );
    return -1;
  }

  if (args[0] === "!!cancel") {
    contributionInput.delete(userId);
    if (ctx.modifyMsgMode)
      await ctx.api.deleteMessage(ctx.chatId, ctx.modifyMsgId);
    await deleteUserMsg(ctx);
    return -1;
  }

  if (args[0] === "!!send") {
    const input = contributionInput.get(userId);

    await sendToReviewer(ctx, userId, input);

    await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    if (userId !== getStorage().constants.ownerId) {
      await ctx.reply(
        "Thank you for your contribution, your request is under review!\nWe will send you back when there is a response!"
      );
    }

    return -1;
  }

  if (ctx.modifyMsgMode) {
    await ctx.api.editMessageText(ctx.chatId, ctx.modifyMsgId, locationText, {
      reply_markup: { inline_keyboard: uiContributeMenu(ctx, ctx.match) },
    });
  } else {
    await sendCmdUi(ctx, locationText, uiContributeMenu(ctx, ctx.match), true);
  }
}

function nowUTC1_YYYYMMDD() {
  const now = new Date();
  const utc1 = new Date(now.getTime() + 1 * 60 * 60 * 1000);

  const year = utc1.getUTCFullYear();
  const month = String(utc1.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc1.getUTCDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

/**
 *
 * @param {Context} ctx
 * @param {number} userId
 * @param {*} input
 */
async function sendToReviewer(ctx, userId, input) {
  const requestId = (
    await ctx.api.sendMessage(
      getStorage().constants.ownerId,
      `Drive upload request :\n from: ${
        ctx.cmd ? ctx.callbackQuery.from.first_name : ctx.from.first_name
      }/${userId}${
        getStorage().constants.l2Delegates.includes(userId)
          ? "\n Delegate"
          : getStorage().constants.ownerId === userId
          ? "\n Hey that's you!"
          : ""
      }\n into: ${input.location.join("»")}`
    )
  ).message_id;

  await ctx.api.editMessageReplyMarkup(
    getStorage().constants.ownerId,
    requestId,
    {
      reply_markup: {
        inline_keyboard: uiContributeRequest(ctx, requestId),
      },
    }
  );

  const msgs = [];
  const photos = [];
  const docs = [];
  const date = nowUTC1_YYYYMMDD();

  let img = 0;
  input.files.forEach((file) => {
    msgs.push(file.msgId);
    if (file.isPhoto) {
      photos.push({
        name: file.name,
        fileId: file.fileId,
      });
    } else {
      docs.push({
        name: file.name,
        fileId: file.fileId,
      });
    }
  });
  if (msgs.length > 0 && userId !== getStorage().constants.ownerId) {
    msgs.sort();
    await ctx.api.forwardMessages(getStorage().constants.ownerId, userId, msgs);
  }
  await modifyStorage((storage) => {
    storage.ltc.pendingDriveRequests ??= {};
    storage.ltc.pendingDriveRequests[requestId] = {
      lastInputMsgId: input.lastMsgId,
      location: input.location.join(" "),
      userId: userId,
      date: date,
      photos: photos,
      docs: docs,
    };
  });

  await saveStorage();
}

module.exports = { commandName, command };

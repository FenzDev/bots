const { Bot } = require("grammy");
const { getStorage, modifyStorage } = require("../services/storage");
const throwError = require("../services/throwError");

async function recordChatMessage(group, messageDetails, log = false) {
  if (!group) return;
  await modifyStorage(async (storage) => {
    try {
      storage.ltc = storage.ltc ?? {};
      storage.ltc.chatHistory = storage.ltc.chatHistory ?? {};
      storage.ltc.chatHistory[group] = storage.ltc.chatHistory[group] ?? [];
      storage.ltc.chatHistory[group].push({
        ...messageDetails,
      });
      if (storage.ltc.chatHistory[group].length > 25) {
        storage.ltc.chatHistory[group].shift();
      }
      if (log)
        console.log(
          storage.ltc.chatHistory[group][
            storage.ltc.chatHistory[group].length - 1
          ],
        );
    } catch (err) {
      await throwError(err);
    }
  });
}

/**
 * @param {Bot} bot
 */
async function init(bot) {
  bot.on("msg", async (ctx, next) => {
    const isPrvGroup =
      ctx.chat.id === Number(getStorage().constants.groups.boys);
    const isL2Group =
      ctx.chat.id === Number(getStorage().constants.groups.l2.id);
    if (!isPrvGroup && !isL2Group) {
      return next();
    }
    try {
      let userStrId = "" + ctx.from.id;
      userStrId = userStrId.substring(userStrId.length - 5);
      await recordChatMessage(isPrvGroup ? "boys" : "l2", {
        userId: userStrId,
        userDispName: ctx.from.first_name + " " + ctx.from.last_name ?? "",
        text: ctx.msg.text,
        datetime: new Date(ctx.msg.date * 1000).toLocaleString("en-GB", {
          timeZone: "Africa/Algiers",
          dateStyle: "full",
          timeStyle: "medium",
        }),
        isVoice: ctx.msg.voice == true ? true : undefined,
        hasAttch: ctx.msg.document ? true : undefined,
        hasPhoto: ctx.msg.photo ? true : undefined,
        msgId: ctx.msg.message_id,
        replyToMsg: ctx.msg.reply_to_message?.message_id ?? undefined,
      }, isL2Group);
    } catch (err) {
      await throwError(err);
    }
    try {
      await next();
    } catch (err) {
      throwError();
    }
  });
}

module.exports = { init, recordChatMessage };

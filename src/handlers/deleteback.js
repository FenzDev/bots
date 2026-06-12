const { Bot } = require("grammy");
const { getStorage } = require("../services/storage");
const { replyMap } = require("./commands");

// this handler will delete reply of commands if original was deleted
// for every 5s there is a check until 24 cycles pass

/**
 * @param {Bot} bot
 */
async function init(bot) {
  async function tick() {
    for (const [cmdMsg, [replyMsgId, counter]] of replyMap) {
      if (!replyMsgId || counter > 24) {
        replyMap.delete(cmdMsg);
        continue;
      }

      if (await checkMessage(cmdMsg.chatId, cmdMsg.id)) {
        replyMap.set(cmdMsg, [replyMsgId, counter + 1]);
      } else {
        replyMap.delete(cmdMsg);
        try {
          await bot.api.deleteMessage(cmdMsg.chatId, replyMsgId);
        } catch {}
      }
    }
    setTimeout(tick, 5_000); // schedule next run
  }

  tick(); // start

  async function checkMessage(chatId, msgId) {
    try {
      // console.log("check message ", msgId);
      // try forwarding the message
      const botgroup = getStorage().constants.botgroup;
      // console.log(`forwarding botgroup:${botgroup}, chatId:${chatId}, msgId:${msgId}`);
      const frwMsg = await bot.api.forwardMessage(botgroup, chatId, msgId);
      // console.log("forwarded");
      await bot.api.deleteMessage(botgroup, frwMsg.message_id);
      return true;
    } catch (err) {
      
      // console.log(err);
      // console.log(err);
      return false;
    }
  }
}

module.exports = { init };

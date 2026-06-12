const { Bot } = require("grammy");
const { getStorage } = require("../services/storage");

/**
 * @param {Bot} bot
 */
async function init(bot) {
  bot.on("message", async (ctx) => {

  });
}

module.exports = { init };

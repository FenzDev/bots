const { Bot, Context } = require("grammy");
const { getStorage, modifyStorage, loadStorage, saveStorage } = require("../services/storage");

const commandName = "fsave";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
    await saveStorage(true);
    return (await ctx.reply("saved")).message_id;
}

module.exports = { commandName, command };

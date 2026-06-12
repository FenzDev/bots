const { Bot, Context } = require("grammy");
const { getStorage, modifyStorage, loadStorage } = require("../services/storage");

const commandName = "fload";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
    let msg; 
    await modifyStorage(async (str) => {
        await loadStorage();
        msg = await ctx.reply("loaded");
    })
    return msg.message_id;
}

module.exports = { commandName, command };

const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");

const commandName = "ping"

/**
 * @returns {import("grammy/types").Message.TextMessage}
 * @param {Context} ctx
 */
async function command(ctx) {
    return (await ctx.reply("pong")).message_id;
};

module.exports = {commandName, command};
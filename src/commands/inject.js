const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");
const { replyToMessage } = require("../handlers/commands");

const commandName = "inject";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
    const args = ctx.match.split(" ");

    return (await replyToMessage(ctx, "")).message_id;
}

module.exports = { commandName, command };

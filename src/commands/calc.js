const { Bot, Context } = require("grammy");
const { getStorage } = require("../services/storage");
const { replyToMessage } = require("../handlers/commands");
const mjx = require('mathjs');

const commandName = "calc";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
    const result = mjx.evaluate(ctx.match);

    return (await replyToMessage(ctx, result)).message_id;
}

module.exports = { commandName, command };

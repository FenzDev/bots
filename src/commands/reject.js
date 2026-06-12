const { Bot, Context } = require("grammy");
const { getStorage, modifyStorage } = require("../services/storage");
const { replyToMessage } = require("../handlers/commands");

const commandName = "reject";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
  const args = ctx.match.split(" ");

  const requestId = args[0];

  const request = getStorage().ltc.pendingDriveRequests[requestId];

  if (!request) return -1;

  ctx.api.sendMessage(
    request.userId,
    `
Your contribution request to drive was refused\\.
تم رفض طلبك للمشاركة إلى الدرايف
Reason:
\`
${ctx.match.substring(args[0].length)}
\`
`,
    {
      reply_parameters: {
        chat_id: request.userId,
        message_id: request.lastInputMsgId,
      },
      parse_mode: "MarkdownV2",
    }
  );

  const msg = (await replyToMessage(ctx, "Refusal message was sent!"))
    .message_id;

  await ctx.api.editMessageReplyMarkup(ctx.chatId, requestId, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `Rejected`, copy_text: { text: requestId } }],
      ],
    },
  });

  await modifyStorage((storage) => {
    storage.ltc.pendingDriveRequests[requestId] = undefined;
  });

  return msg;
}

module.exports = { commandName, command };

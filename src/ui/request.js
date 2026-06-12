const { Context, InlineKeyboard } = require("grammy");
const { createHeader } = require("../handlers/ui");

/**
 * @returns {import("grammy/types").InlineKeyboardMarkup[][]}
 * @param {Context} ctx */
function uiContributeRequest(ctx, requestId) {
  const header = createHeader(ctx);
  let menu = new InlineKeyboard();
  menu.copyText("✅ Approve", `/approve ${requestId}`);
  menu.copyText("☑ Approve (But do nothing)", `/approve ${requestId} !`);
  menu.copyText("❌ Reject", `/reject ${requestId} `);
  menu = menu.toFlowed(1);
  return menu.inline_keyboard;
}


module.exports = { uiContributeRequest };
const { Context, InlineKeyboard } = require("grammy");
const { createHeader } = require("../handlers/ui");

/**
 * @returns {import("grammy/types").InlineKeyboardMarkup[][]}
 * @param {string} header 
 * @param {Context} ctx */
function uiEdtMenu(ctx) {
  const header = createHeader(ctx);
  return new InlineKeyboard()
    .text("L1 A", `${header};edt L1A`).row()
    .text("L1 B", `${header};edt L1B`).row()
    .text("L2",   `${header};edt L2`).inline_keyboard;
}

/**
 * @returns {import("grammy/types").InlineKeyboardMarkup[][]}
 * @param {string} header 
 * @param {Context} ctx */
function uiEdtL1Menu(ctx) {
  const header = createHeader(ctx);
  return new InlineKeyboard()
    .text("L1 A", `${header};edt L1A`).row()
    .text("L1 B", `${header};edt L1B`).inline_keyboard;
}

module.exports = { uiEdtMenu, uiEdtL1Menu };
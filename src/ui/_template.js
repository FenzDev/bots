const { Context, InlineKeyboard } = require("grammy");
const { createHeader } = require("../handlers/ui");

/**
 * @returns {import("grammy/types").InlineKeyboardMarkup[][]}
 * @param {string} header 
 * @param {Context} ctx */
function ui_Menu(ctx) {
  const header = createHeader(ctx);
  return [];
}



module.exports = { };
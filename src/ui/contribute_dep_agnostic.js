const { Context, InlineKeyboard } = require("grammy");
const { createHeader } = require("../handlers/ui");

/**
 * 
 * @param {Context} ctx 
 * @param {number} num
 * @param {Boolean} sendIsVisible 
 * @returns 
 */
function uiContributionSend(ctx, num = 0, sendIsVisible = false) {
  const header = createHeader(ctx);
  const inline = new InlineKeyboard();
  inline.text("❌ Cancel", `${header};~contribute !!cancel`);
  if (sendIsVisible)
    inline.text(`☑ Send${num > 1?` (${num})`: ''}`, `${header};~contribute !!send`)
  
  return inline.inline_keyboard;
}

module.exports = {uiContributionSend };

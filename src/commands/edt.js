const { Bot, Context, InlineKeyboard } = require("grammy");
const { getStorage, waitingToBeSaved, saveStorage } = require("../services/storage");
const { uiEdtMenu, uiEdtL1Menu } = require("../ui/edt");
const { sendCmdUi } = require("../handlers/ui");
const { checkEdt } = require("../handlers/routines/edt_watcher");
const { replyToMessage, copyReplyToMessage } = require("../handlers/commands");

const commandName = "edt";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
  // return;
  const section = ctx.match?.toLowerCase() ?? "";
  const hint =
    // ctx.chat.type === "private"
      /*?*/ undefined;
      // : "💡ملاحظة : يمكنك إستدعاء أي أمر في الخاص دون إزعاج أي عضو من المجموعة";
  
  if (section === 'fcheck' && ctx.chatId === getStorage().constants.ownerId){
    await checkEdt();
    if (waitingToBeSaved) {
      await saveStorage(true);
    }
    return replyToMessage(ctx, "EDT was force checked !");
  }
  
  switch (section) {
    case "l1a":
      return await copyReplyToMessage(
        ctx,
        getStorage().constants.botgroup,
        getStorage().documents.preEdt.l1a,
        hint
      );
    case "l1b":
      return await copyReplyToMessage(
        ctx,
        getStorage().constants.botgroup,
        getStorage().documents.preEdt.l1b,
        hint
      );
    case "l2":
      return await copyReplyToMessage(
        ctx,
        getStorage().constants.botgroup,
        getStorage().documents.preEdt.l2,
        hint
      );
  }

  if (section === "l1" || ctx.chat.id === getStorage().constants.groups.l1.id)
    return (await sendCmdUi(ctx, "Timetable", uiEdtL1Menu(ctx), false))
      .message_id;

  if (ctx.chat.id === getStorage().constants.groups.l2.id)
    return await copyReplyToMessage(
      ctx,
      getStorage().constants.botgroup,
      getStorage().documents.preEdt.l2,
      hint
    );

  // Show buttons

  return (await sendCmdUi(ctx, "Timetable", uiEdtMenu(ctx), false)).message_id;
}

module.exports = { commandName, command };

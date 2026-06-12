const { Context, InlineKeyboard } = require("grammy");
const { createHeader } = require("../handlers/ui");
const { docsTree } = require("../handlers/contibution_collector");
const { getStorage } = require("../services/storage");

/**
 * @returns {import("grammy/types").InlineKeyboardMarkup[][]}
 * @param {string} location
 * @param {Context} ctx */
function uiContributeMenu(ctx, location) {
  const directories = location.split(" ");
  /** @type {import("../services/storage_types").DriveFolder} */
  let folder = docsTree;
  for (let d = 0; d < directories.length; d++) {
    folder =
      folder.subFolders.find(
        (sF) => sF.folderName?.toLowerCase() === directories[d].toLowerCase()
      ) ?? folder;
  }
  const subFolders = folder.subFolders;
  if (!subFolders) {
    console.log("Error: ui/contribute: no drive folder was found unfortunatly");
    return;
  }

  const header = createHeader(ctx);
  let inline = new InlineKeyboard();
  for (let sF = 0; sF < subFolders.length; sF++) {
    if (!subFolders[sF]?.displayName) continue;
    inline.text(
      subFolders[sF].displayName,
      location == ""
        ? `${header};~contribute ${subFolders[sF].folderName}`
        : `${header};~contribute ${location} ${subFolders[sF].folderName}`
    );
    inline.row();
  }

  if (location && location !== "")
    inline.text(
      `🔙`,
      `${header};~contribute ${directories.slice(0, -1).join(" ")}`
    );
  if (
    folder.publicCtrb ||
    (folder.delegateCtrb &&
      getStorage().constants.l2Delegates.includes(
        ctx.cmd ? ctx.cmdFromId : ctx.from.id
      ))
  )
    inline.text("📥 Send here", `${header};~contribute ${location} ?`);
  // inline.text("❌ Cancel", `${header};*exit*`);
  console.log(inline.inline_keyboard);
  return inline.inline_keyboard;
}

module.exports = { uiContributeMenu };

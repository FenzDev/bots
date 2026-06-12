const { Context, InlineKeyboard } = require("grammy");
const { createHeader, getUserId } = require("../handlers/ui");
const { docsTree } = require("../handlers/contibution_collector");
const { getStorage } = require("../services/storage");
const { isUndefined } = require("mathjs");
const e = require("express");
const { areNamesEqual } = require("../services/gdrive");
/**
 * @param {import("../services/storage_types").StorageType} storage
 * @param {string} startFolderIndex
 */
function getLocationChain(storage, startFolderIndex) {
  let location = [];

  let currentFolder = storage.cache.folders[startFolderIndex];
  while (!isUndefined(currentFolder) && !isUndefined(currentFolder.parentId)) {
    location.unshift(currentFolder.name);
    currentFolder = storage.cache.folders[currentFolder.parentId];
  }

  return location;
}

function getDocsTreeFolder(location) {
  try {
    // console.log("location: ", location);
    let targetFolder = docsTree;
    for (let l = 0; l < location.length; l++) {
      targetFolder = targetFolder.subFolders.find((sF) =>
        areNamesEqual(location[l], sF.folderName)
      );
      if (!targetFolder) {
        return undefined;
      }
    }
    return targetFolder;
  } catch (err) {
    console.log(err);
    return undefined;
  }
}
function canContribute(userId, location) {
  try {
    // console.log("location: ", location);
    let targetFolder = docsTree;
    for (let l = 0; l < location.length; l++) {
      targetFolder = targetFolder.subFolders.find((sF) =>
        areNamesEqual(location[l], sF.folderName)
      );
      if (!targetFolder) {
        return false;
      }
      if (
        targetFolder.publicCtrb ||
        (targetFolder.delegateCtrb &&
          getStorage().constants.l2Delegates.includes(userId))
      ) {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.log(err);
    return false;
  }
}

/**
 * @returns {import("grammy/types").InlineKeyboardMarkup[][]}
 * @param {Context} ctx
 * @param {import("../services/gdrive_types").GDriveGetData} content
 * @param {string} locationStr
 * */
function uiDriveList(ctx, content, location, locationStr) {
  const header = createHeader(ctx);
  let list = new InlineKeyboard();

  const userId = ctx.cmd ? ctx.cmdFromId : ctx.from.id;

  function getName(id) {
    const folder = getStorage().cache.folders[getStorage().cache.folderIds[id]];
    return folder.displayName || folder.name;
  }

  function isMediaGroup(id) {
    const folder = getStorage().cache.folders[getStorage().cache.folderIds[id]];
    return folder.isMediaGroup;
  }

  const currentIndex = getStorage().cache.folderIds[content.id];

  const locationChain = getLocationChain(
    getStorage(),
    location[0].substring(1)
  );
  const locationChainJoined = locationChain.join(" ");

  getDocsTreeFolder(locationChain)?.subFolders.forEach((sF) => {
    if (
      !(
        sF.publicCtrb ||
        (sF.delegateCtrb && getStorage().constants.l2Delegates.includes(userId))
      ) ||
      content.folders.findIndex((fd) => {
        console.log(
          "yooo fd.name: %s, sF.folderName: %s",
          fd.name,
          sF.folderName
        );
        return areNamesEqual(fd.name, sF.folderName);
      }) !== -1
    ) {
      console.log("sybau ln")
      return;
    }
    list.text(
      `📁📨${sF.displayName || sF.folderName}`,
      `${header};contribute ${locationChainJoined} ${sF.folderName} ?`
    );
  });
  content.shortcuts.forEach((sh) => {
    list.text(
      `📁🔗${getName(sh.id)}🔗`,
      `${header};~drive #${
        getStorage().cache.folderIds[sh.id]
      } #${currentIndex}`
    );
  });
  content.folders.forEach((fd) => {
    list.text(
      `📁${isMediaGroup(fd.id) ? "🖼" : ""}${getName(fd.id)}`,
      `${header};~drive #${
        getStorage().cache.folderIds[fd.id]
      } #${currentIndex}`
    );
  });
  list = list.toFlowed(2);
  list.row();
  content.files.forEach((f) => {
    list
      .text(
        `${f.mimeType.startsWith("image") ? "🖼" : "📄"}${f.name}`,
        `${header};drive $${
          getStorage().cache.filesIndices[f.id]
        } #${currentIndex}`
      )
      .row();
  });

  if (location.length > 0 && location[0].startsWith("#")) {
    const parentId = getStorage().cache.folders[currentIndex].parentId;
    if (
      !isUndefined(parentId) &&
      !isUndefined(getStorage().cache.folders[parentId].parentId)
    ) {
      list.text(
        `🔙`, // (${content.location[content.location.length - 2]})
        `${header};~drive #${parentId}`
      );
    }
  } else if (location.length > 1) {
    list.text(
      `🔙`, // (${content.location[content.location.length - 2]})
      `${header};~drive ${content.location.slice(0, -1).join(" ")}`
    );
  }

  // contribute
  // console.log(content.location);
  if (canContribute(userId, locationChain)) {
    list.text("📨 Contribute", `${header};contribute ${locationChainJoined} ?`);
  }

  if (location.length > 0 && location[0] != "") {
    list.text(`🏠`, `${header};~drive`);
  } else {
    // - HOME -
    const userHistory = getStorage().ltc.driveHistory[getUserId(ctx)];
    for (let uH = 0; uH < userHistory?.length; uH++) {
      const histoDisplayChain = getLocationChain(getStorage(), userHistory[uH]);
      list.text(
        `🕑 ${histoDisplayChain.length > 3 ? "..»" : ""}${histoDisplayChain
          .slice(-3)
          .join("»")}`,
        `${header};~drive #${userHistory[uH]}`
      );
      list.row();
    }

    // list.text("📨 Contribute", `${header};contribute`);
    list.url(
      "🌐 Link\nto drive",
      `https://drive.google.com/drive/folders/${
        getStorage().constants.driveId
      }?usp=drive_link`
    );

    list.row();
  }

  // if (content.files && content.files.length > 0) {
  //   list.text(`🗂 All files`, `${header};~drive ${locationStr} !files`);
  // }
  // list.text(`❌ Leave`, `${header};*exit*`);

  console.log("inline keyboard:");
  for (let gg = 0; gg < list.inline_keyboard.length; gg++)
    console.log(list.inline_keyboard[gg]);
  return list.inline_keyboard;
}

module.exports = { uiDriveList, getLocationChain };

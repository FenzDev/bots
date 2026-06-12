const { Bot, Context } = require("grammy");
const {
  getStorage,
  modifyStorage,
  saveStorage,
} = require("../services/storage");
const {
  replyToMessage,
  copyReplyToMessage,
  copyMultiMsgReplyToMessage,
} = require("../handlers/commands");
const { getDriveContent, areNamesEqual } = require("../services/gdrive");
const { sendCmdUi, uiMsgInfo, getUserId } = require("../handlers/ui");
const { uiDriveList, getLocationChain } = require("../ui/drive");
const { isUndefined, number } = require("mathjs");
const throwError = require("../services/throwError");

const commandName = "drive";

/**
 *
 * @param {Context} ctx
 * @param {AbortSignal} signal
 */
async function cacheIsDownloaded(newData, ctx) {
  const currentId = uiMsgInfo.get(
    `${ctx.chatId},${ctx.modifyMsgMode ? ctx.modifyMsgId : ctx.message?.id}`
  );
  // console.log("cache ", currentId);
  if (!newData || currentId !== newData.id) {
    return;
  }
  try {
    const args = ctx.match.split(" ");
    const message = await ctx.api.editMessageText(
      ctx.chatId,
      ctx.modifyMsgMode ? ctx.modifyMsgId : ctx.msgId,
      ctx.locationDisplayPath,
      {
        reply_markup: {
          inline_keyboard: uiDriveList(ctx, newData, args, ctx.match),
        },
      }
    );

    await saveStorage();

    return message.message_id;
  } catch (e) {
    // throwError(e);
  }
}

/**
 * @returns {Array<string>}
 * @param {Context} ctx
 */
function redirectLocation(ctx) {
  const args = ctx.match.split(" ");
  const storageCache = getStorage().cache;

  if (ctx.match === "" || args[0].startsWith("#") || args[0].startsWith("$")) {
    return args;
  }
  let targetCachedFolder =
    storageCache.folders[
      storageCache.folderIds[getStorage().constants.driveId]
    ];
  for (let l = 0; l < args.length; l++) {
    targetCachedFolder =
      targetCachedFolder.folders.find((fd) =>
        areNamesEqual(fd.name, args[l])
      ) ||
      targetCachedFolder.shortcuts.find((sh) => {
        areNamesEqual(sh.name, args[l]);
      });

    if (!targetCachedFolder) {
      return [];
    }
  }

  const index = storageCache.folderIds[targetCachedFolder.id];
  if (isUndefined(index)) {
    return [];
  }
  ctx.match = `#${index}`;
  return [ctx.match];
}

/**
 * @param {Context} ctx
 * @param {Array<string>} args
 */
async function recordIntoHistory(ctx, args) {
  if (args.length == 1) {
    args.push(`#${getStorage().cache.folders[args[0].substring(1)].parentId}`);
  }

  if (args.length < 2) {
    return;
  }

  await modifyStorage((storage) => {
    if (!storage.ltc.driveHistory[getUserId(ctx)]) {
      storage.ltc.driveHistory[getUserId(ctx)] = [];
    }

    const historyArr = storage.ltc.driveHistory[getUserId(ctx)];
    const id = number(args[1].substring(1));
    const existingIdIndex = historyArr.findIndex((h) => h == id);
    if (existingIdIndex !== -1) {
      historyArr.splice(existingIdIndex, 1);
    }
    historyArr.unshift(id);
    if (historyArr.length > 3) {
      historyArr.pop();
    }
  });
  await saveStorage();
}

/** @param {string} index */
function getFullDisplayName(index) {
  let currentFolder = getStorage().cache.folders[index];
  let path = [];
  while (!isUndefined(currentFolder.parentId)) {
    path.push(currentFolder.displayName || currentFolder.name);
    currentFolder = getStorage().cache.folders[currentFolder.parentId];
  }
  path.reverse();
  return path.join("»");
}

/**
 * @param {Context} ctx
 */
async function command(ctx) {
  if (ctx.chat.type !== "private") {
    await ctx.deleteMessage();
    return -1;
  }

  /** @type {Array<string>} */
  const args = redirectLocation(ctx);
  console.log("args: ", args);
  if (args && args.length > 0) {
    if (args[0].startsWith("$")) {
      uiMsgInfo.delete(
        `${ctx.chatId},${ctx.modifyMsgMode ? ctx.modifyMsgId : ctx.message?.id}`
      );
      recordIntoHistory(ctx, args);
      return await copyReplyToMessage(
        ctx,
        getStorage().constants.botgroup,
        getStorage().documents.drive[args[0].substring(1)],
        getLocationChain( getStorage(), args[1].substring(1)).join("»")
      );
    }
  }

  console.log(`Downloading drive data (${ctx.match})`);

  const data = await getDriveContent(args, ctx.api, cacheIsDownloaded, ctx);
  if (!data) {
    return -1;
  }

  let loadingIcon = args[0] != "" && !data.isFreshlyCached;

  console.log("Downloaded\n");

  uiMsgInfo.set(
    `${ctx.chatId},${ctx.modifyMsgMode ? ctx.modifyMsgId : ctx.message.id}`,
    data.id
  );

  if (
    data.isMediaGroup &&
    data.folders?.length <= 0 &&
    data.shortcuts?.length <= 0 &&
    args.length > 1
  ) {
    recordIntoHistory(ctx, args);
    uiMsgInfo.delete(
      `${ctx.chatId},${ctx.modifyMsgMode ? ctx.modifyMsgId : ctx.message.id}`
    );

    try {
      await ctx.api.deleteMessage(
        ctx.chatId,
        ctx.modifyMsgMode ? ctx.modifyMsgId : ctx.message.id
      );
    } catch {}

    const mediaGroupIndex =
      getStorage().cache.filesIndices[
        getStorage().cache.folders[args[0].substring(1)].id
      ];
    const mediaGroup = getStorage().documents.drive[mediaGroupIndex];
    return (
      await copyMultiMsgReplyToMessage(
        ctx,
        getStorage().constants.botgroup,
        mediaGroup,
        getLocationChain( getStorage(), args[1].substring(1)).join("»")
      )
    )[0].message_id;
  }

  ctx.locationDisplayPath =
    ctx.match == ""
      ? "Drive menu:"
      : ctx.match.startsWith("#")
      ? getFullDisplayName(args[0].substring(1))
      : ctx.match.replaceAll(" ", "»").replaceAll("~", " ");

  const caption = `${ctx.locationDisplayPath /*.padEnd(100, "")*/}  ${
    loadingIcon ? `⏳` : ""
  }`;
  if (ctx.modifyMsgMode) {
    let msg = -1;

    try {
      msg = (
        await ctx.api.editMessageText(ctx.chatId, ctx.modifyMsgId, caption, {
          reply_markup: {
            inline_keyboard: uiDriveList(ctx, data, args, ctx.match),
          },
        })
      ).message_id;
    } catch (ex) {console.log(`whats going on? \n ${ex}`);}

    return msg;
  }

  return (
    await sendCmdUi(ctx, caption, uiDriveList(ctx, data, args, ctx.match), true)
  ).message_id;
}

module.exports = { commandName, command };

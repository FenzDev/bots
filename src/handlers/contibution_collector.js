const { Bot, Api, Context } = require("grammy");
const { getStorage } = require("../services/storage");
const { uiContributionSend } = require("../ui/contribute_dep_agnostic");
/** @type {import("../services/storage_types").DriveDisplayFolder} */
let docsTree = {};                   //  <key>  :  <value>
const contributionInput = new Map(); // user_id : pending input object (pio)
// pio :  { location:[], userId:number, responseMsgId:number, files:[], photos:[] }

function initializeInput(userId, responseMsgId, location) {
 return {userId: userId, responseMsgId: responseMsgId, location: location}; 
}

/**
 *
 * @param {import("../services/storage_types").DriveFolder} outputNode
 * @param {import("../services/storage_types").DriveFolder} folder
 */
function addSubFolders(outputNode, folder) {
  if (!folder) return;
  if (folder.basedOn) addBaseFolders(outputNode, folder);
  if (!folder.subFolders) return;
  for (let f = 0; f < folder.subFolders.length; f++)
    outputNode.subFolders.push(buildTree(folder.subFolders[f]));
}

/**
 *
 * @param {import("../services/storage_types").DriveFolder} outputNode
 * @param {import("../services/storage_types").DriveFolder} folder
 */
function addBaseFolders(outputNode, folder) {
  /** @type {import("../services/storage_types").DriveFolder} */
  const base = getStorage().constants.drive.prefabs[folder.basedOn];
  addSubFolders(outputNode, base);
}

/**
 *
 * @param {import("../services/storage_types").DriveFolder} folder
 */
function buildTree(folder) {
  /** @type {import("../services/storage_types").DriveFolder} */
  let outputNode = { ...folder, subFolders: [], basedOn: undefined };
  addSubFolders(outputNode, folder);
  return outputNode;
}

function initDocsTree() {
  docsTree.subFolders = [
    buildTree(getStorage().constants.drive.S3),
    buildTree(getStorage().constants.drive.S4),
  ];
}

/**
 * @param {Context} ctx 
 */
function showSendButton(ctx, pio){
  ctx.api.editMessageReplyMarkup(pio.userId, pio.responseMsgId, {
    reply_markup: { inline_keyboard: uiContributionSend(ctx, pio.files.length, true) },
  });
}

function randomString(length) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * @param {Bot} bot
 */
async function init(bot) {
  initDocsTree();

  bot.on("message:photo", async (ctx, next) => {
    if (!contributionInput.has(ctx.from.id)) return next();
    console.log("photo detected");
    
    const input = contributionInput.get(ctx.from.id);
    if (!input.files) input.files = [];
    if (input.photoNum === undefined) input.photoNum = 0;
    input.files.push({
      name: `Photo_${String(input.photoNum++).padStart(2, '0')}_${randomString(8)}.jpg`,
      isPhoto: true,
      msgId: ctx.message.message_id,
      fileId: ctx.message.photo[ctx.message.photo.length - 1].file_id,
    });
    input.lastMsgId = ctx.msgId;
    showSendButton(ctx, input);

    await next();
    // contributionInput.set(ctx.from.id, input);
  });
  bot.on("message:document", async (ctx,next) => {
    if (!contributionInput.has(ctx.from.id)) return next();
    
    console.log("document detected");
    const input = contributionInput.get(ctx.from.id);
    if (!input.files) input.files = [];
    input.files.push({
      name: ctx.message.document.file_name,
      isPhoto: false,
      msgId: ctx.message.message_id,
      fileId: ctx.message.document.file_id
    });
    input.lastMsgId = ctx.msgId;
    showSendButton(ctx, input);
    await next();
  });
}

module.exports = { init, contributionInput, initializeInput, docsTree };

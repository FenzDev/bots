const { Bot, Context, Api, InlineKeyboard } = require("grammy");
const { getStorage, modifyStorage, saveStorage } = require("../services/storage");
const { replyToMessage } = require("../handlers/commands");
const { default: axios } = require("axios");
const { fetchCache } = require("../services/gdrive");

const commandName = "approve";

/**
 * @param {Context} ctx
 */
async function command(ctx) {
  const args = ctx.match.split(" ");
  let requestId = "-1";
  if (ctx.message && ctx.message.reply_to_message) {
    requestId = String(ctx.message.reply_to_message.message_id);
  } else {
    requestId = args[0];
  }

  /** @type {import("../services/storage_types")._PendingDriveRequest} */
  const request = getStorage().ltc.pendingDriveRequests[requestId];
  if (request) {
    await modifyStorage(async (storage) => {
      let ok = true;
      if (args.length < 2 || args[1] !== "!") {
        try {
          const response = await sendToDrive(
            ctx.api,
            request,
            args.length > 1 ? args.slice(1).join(' ') : undefined
          );
          ok = response.status === 200 && response.data.state === "OK";
          if (ok) {
            // background update
            // if (args.length <= 1) {
            //   fetchCache(ctx.api, response.data.parentFolderId, [])
            //   .then((cache) => saveStorage(true));
            // }
          } else {
            console.log(response.data);
          }
        } catch (err) {
          ok = false;
        }
      }
      if (ok) {
        await ctx.api.sendMessage(
          request.userId,
          `Your contribution request was approved !\n جزاك الله خيرًا`,
          { reply_parameters: {chat_id: request.userId, message_id: request.lastInputMsgId}}
        );
        await ctx.api.editMessageReplyMarkup(ctx.chatId, requestId, {
          reply_markup: {
            inline_keyboard: [[{ text: `Approved`, copy_text: {text:requestId }}]],
          },
        });
        storage.ltc.pendingDriveRequests[requestId] = undefined;
      }
    });
  }

  // return (await replyToMessage(ctx, "")).message_id;
}
/**
 * @param {Api} api
 * @param {import("../services/storage_types")._PendingDriveRequest} request
 */
async function sendToDrive(api, request, subName) {
  const files = []; // new Array(request.docs.length + request.photos.length);

  const downloadBaseUrl = `https://api.telegram.org/file/bot${
    process.env.IS_TEST.toLowerCase() === "true" ? process.env.TEST_API_TOKEN : process.env.API_TOKEN
  }/`;

  for (let d = 0; d < request.docs.length; d++) {
    const file = await api.getFile(request.docs[d].fileId);
    files.push({ name: request.docs[d].name, path: file.file_path });
  }

  for (let p = 0; p < request.photos.length; p++) {
    const file = await api.getFile(request.photos[p].fileId);
    files.push({ name: request.photos[p].name, path: file.file_path });
  }

  const subNameParam =
    subName && subName != "" ? `&subName=${encodeURIComponent(subName)}` : "";

  const url = `${process.env.SCRIPT_URL}?into=drive&startFolder=${
    getStorage().constants.driveId
  }&location=${encodeURIComponent(request.location)}${subNameParam}`;
  console.log("files to be sent: ", files);
  return await axios.post(url, { baseUrl: downloadBaseUrl, files: files });
}

module.exports = { commandName, command };

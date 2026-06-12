const { Bot, InputFile } = require("grammy");
const {
  getStorage,
  modifyStorage,
  saveStorage,
  waitingToBeSaved,
} = require("../../services/storage");
const throwError = require("../../services/throwError")
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const {
  checkSheets,
  downloadSheetPDF,
  pdfToPng,
  pdfToPixelatedPng,
} = require("../../services/gsheets_utils");
const { env } = require("process");
const { response } = require("express");

/**
 *
 * @param {Bot} bot
 * @param {string} sheetId
 */
async function updateLocalEdt(bot, sectionName) {
  const now = new Date();
  const currentTime = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  const sheetId = getStorage().constants.edtGids[sectionName];
  const outputPdf = await downloadSheetPDF(sheetId, currentTime);
  // const outputPng = path.resolve(`.local/cache/temp.png`);
  // await pdfToPng(outputPdf, outputPng);
  const msgId = (
    await bot.api.sendDocument(
      getStorage().constants.botgroup,
      new InputFile(
        fs.createReadStream(outputPdf),
        `EDT_${sectionName.toUpperCase()} (${currentTime}).pdf`
      ),
      {
        thumbnail: new InputFile(
          fs.createReadStream(`./media/timetable-${sectionName}.jpg`)
        ),
      }
    )
  ).message_id;
  console.log("pdf was created msgId=", msgId);
  await modifyStorage((storage) => {
    storage.documents.preEdt[sectionName] = msgId;
  });
  return msgId;
}
/**
 *
 * @param {Bot} bot
 * @param {string} sectionName
 * @param {number} broadcastChatId
 */
async function updateAndBroadcast(bot, sectionName, broadcastChatId) {
  const fileMsgId = await updateLocalEdt(bot, sectionName);
  const gsheetLink = `https://docs.google.com/spreadsheets/d/${
    getStorage().constants.edtId
  }/edit?gid=${getStorage().constants.edtGids[sectionName]}`;
  await bot.api.copyMessage(
    broadcastChatId,
    getStorage().constants.botgroup,
    fileMsgId,
    {
      caption: `<b>
🚨📅 لقد تم تحديث جدول توقيت  ${sectionName.toUpperCase()} 🚨!
- المصدر : <a href="${gsheetLink}">🔗docs.google.com</a> </b>
    `,
      parse_mode: "HTML",
      show_caption_above_media: true,
      link_preview_options: { prefer_small_media: true, is_disabled: true },
    }
  );
}

async function checkEdt(bot) {
  try {
    console.log("checking edt..");
    const updates = await checkSheets();

    if (updates.has("l1a")) {
      console.log("l1a was updated");
      await updateAndBroadcast(bot, "l1a", getStorage().constants.channels.l1a);
    }
    if (updates.has("l1b")) {
      console.log("l1b was updated");
      await updateAndBroadcast(bot, "l1b", getStorage().constants.channels.l1b);
    }
    if (updates.has("l2")) {
      console.log("l2 was updated");
      await updateAndBroadcast(bot, "l2", getStorage().constants.channels.l2);
    }

    if (updates.size > 0) {
      console.log("Saving the new edt update..");
      await saveStorage(true);
      console.log("Saved");
    } else console.log("No updates");
  } catch (er) {
    console.log(er);
    bot.api.sendMessage(
      getStorage().constants.ownerId,
      "There was an error while dealing with posting new timetable update!\nyou might wanna see about"
    );
  }
}

/** @param {Bot} bot */
async function checkAdhahi(bot) {
  const url = "https://adhahi.dz/api/v1/public/wilaya-quotas";
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    /** @type {{wilayaCode:number,available:boolean}[]} */
    const data = await res.json();
    const wilaya = data.find(v=>v.wilayaCode==9);
    if (wilaya.available) {
      await bot.api.sendMessage(getStorage().constants.ownerId, "Baaaa3")
    }

  } catch (err) {
    await throwError(err);
  }
}

/**
 * @param {Bot} bot
 */
async function init(bot) {
  if (!process.env.IS_TEST || process.env.IS_TEST.toLowerCase() != "true") {
    cron.schedule("0 0 * * * *", async () => {
      
      await checkAdhahi(bot);
      await checkEdt(bot);
      if (waitingToBeSaved) {
        await saveStorage(true);
      }
    });
  }
}

module.exports = { init, checkEdt };

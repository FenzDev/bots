const { Bot, Context, InlineKeyboard } = require("grammy");
const { getStorage } = require("../services/storage");
const {
  checkSheets,
  downloadSheetPDF,
  pdfToPng,
} = require("../services/gsheets_utils");
const { replyToMessage } = require("../handlers/commands");
const axios = require("axios");

const commandName = "dbg";

/**
 * @param {Context} ctx
 */
async function command(ctx) {


  //  const msg = ctx.message.reply_to_message;
  // if (!msg) return ctx.reply("Reply to a file or photo first!");

  // let fileId, fileName;

  // // Case 1: Document (PDF, DOCX, TXT, etc.)
  // if (msg.document) {
  //   fileId = msg.document.file_id;
  //   fileName = msg.document.file_name;
  // }

  // // Case 2: Photo (Telegram stores multiple sizes, pick the largest)
  // else if (msg.photo) {
  //   const photo = msg.photo[msg.photo.length - 1];
  //   fileId = photo.file_id;
  //   fileName = `photo_${photo.file_unique_id}.jpg`;
  // }

  // if (!fileId) return ctx.reply("That’s not a file or photo!");

  // // Get Telegram download URL
  // const file = await ctx.api.getFile(fileId);
  // const fileUrl = `https://api.telegram.org/file/bot${process.env.TEST_API_TOKEN}/${file.file_path}`;

  // // Send URL to Apps Script
  // try {
  //   const response = await axios.post(
  //     process.env.SCRIPT_URL,
  //     {
  //       url: fileUrl,
  //       name: fileName,
  //       folderId: "1VB5fduw2ASmLCp3xp6s8jQIakp-458Go", // your Drive folder
  //     },
  //     { headers: { "Content-Type": "application/json" } }
  //   );

  //   await ctx.reply(response.data);
  // } catch (err) {
  //   console.error(err.response?.data || err.message);
  //   await ctx.reply("Upload failed: " + err.message);
  // }



  // ctx.reply("approved", {
  //   reply_markup: {
  //     inline_keyboard: [
  //       [
  //         { text: "i am a big fan", copy_text: {text: "gg"} },
  //         { text: "exo 1", copy_text: {text: "gg"}},
  //         { text: "exo 1", copy_text: {text: "gg"} },
  //         { text: "exo 2", copy_text: {text: "gg"} },
  //         { text: "exo 3", copy_text: {text: "gg"} },
  //       ],
  //       [
  //         { text: "i am a big fan", swi, copy_text: {text: "gg"} },
  //         { text: "exo 1", copy_text: {text: "gg"}},
  //         { text: "exo 1", copy_text: {text: "gg"} },
  //         { text: "exo 2", copy_text: {text: "gg"} },
  //         { text: "exo 3", copy_text: {text: "gg"} },
  //       ],
  //       [
  //         { text: "i am a big fan", copy_text: {text: "gg"} },
  //         { text: "exo 1", copy_text: {text: "gg"}},
  //         { text: "exo 1", copy_text: {text: "gg"} },
  //         { text: "exo 2", copy_text: {text: "gg"} },
  //         { text: "exo 3", copy_text: {text: "gg"} },
  //       ],
  //     ],
  //   },
  //   parse_mode: "HTML",
  // });
}

module.exports = { commandName, command };

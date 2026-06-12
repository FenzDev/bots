// const fetch = require("node-fetch");
const fs = require("fs");
const { getStorage, modifyStorage } = require("./storage");
const { createHash } = require("crypto");
const { get } = require("http");
// const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
const path = require("path");

async function downloadAndGetHash(sheetId) {
  const spreadsheetId = getStorage().constants.edtId;
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${sheetId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch CSV");
  const csv = await res.text();
  return createHash("sha256").update(csv).digest("hex");
}

async function checkSheet(sectionName) {
  const newHash = await downloadAndGetHash(
    getStorage().constants.edtGids[sectionName]
  );
  const update = newHash !== getStorage().ltc.sheetHashes[sectionName];
  // console.log("downhash: ", newHash);
  if (update) {
    await modifyStorage((storage) => {
      storage.ltc.sheetHashes[sectionName] = newHash;
    });
    return true;
  }
  return false;
}

/** @returns {Promise<Set>} */
async function checkSheets() {
  let set = new Set();
  if (await checkSheet("l1a")) set.add("l1a");
  if (await checkSheet("l1b")) set.add("l1b");
  if (await checkSheet("l2")) set.add("l2");
  return set;
}
async function downloadSheetPDF(sheetId, name) {
  const spreadsheetId = getStorage().constants.edtId;
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=pdf&gid=${sheetId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch PDF");

  const output = `.local/temp/edt-${sheetId}.pdf`;
  await fs.promises.mkdir(path.dirname(output), { recursive: true });

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(output, buffer);

  console.log("PDF written successfully:", output);
  return output;
}

// async function pdfToPng(pdfPath, outputPath) {
//   const data = new Uint8Array(fs.readFileSync(pdfPath));
//   const pdfDoc = await pdfjsLib.getDocument({ data }).promise;

//   const page = await pdfDoc.getPage(1);

//   const scale = 2.5;
//   const viewport = page.getViewport({ scale });

//   // Crop to top half
//   const cropHeight = viewport.height / 2;
//   const canvas = createCanvas(viewport.width, cropHeight);
//   const context = canvas.getContext("2d");

//   // Translate context so we only draw top half
//   context.translate(0, 0);

//   // Offset the drawing up by 50px
//   const offsetY = -50; // negative = move up, positive = move down
//   context.translate(0, offsetY);

//   await page.render({
//     canvasContext: context,
//     viewport: viewport,
//     // offset: top-left in PDF points
//     // Using transform to crop:
//     transform: [1, 0, 0, 1, 0, 0], // identity, we adjust via canvas size
//   }).promise;

//   const buffer = canvas.toBuffer("image/png");
//   fs.writeFileSync(outputPath, buffer);
// }

module.exports = { checkSheets, downloadSheetPDF };

import sharp from "sharp";

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function addTextToTimetableImage(
  title: string,
  subtitle: string,
  fileNameSuffix?: string
) {
  const inputPath = "media/timetable.jpeg";

  if (!fileNameSuffix) {
    fileNameSuffix = title.toLowerCase().replaceAll(" ", "_");
  }

  const outputPath = `media/timetable-${fileNameSuffix}.png`;

  const metadata = await sharp(inputPath).metadata();

  const width = metadata.width!;
  const height = metadata.height!;

  // -------------------------
  // SUBTITLE — top of image
  // -------------------------

  const topPadding = 4;

  let subtitleFontSize = 32;

  while (
    subtitle.length * subtitleFontSize * 0.55 > width - 30 &&
    subtitleFontSize > 12
  ) {
    subtitleFontSize -= 1;
  }

  // -------------------------
  // TITLE — bottom box
  // -------------------------

  const boxX = 10;
  const boxY = height - 90;
  const boxWidth = width - 20;
  const boxHeight = 80;

  let titleFontSize = 64;

  while (
    title.length * titleFontSize * 0.55 > boxWidth &&
    titleFontSize > 12
  ) {
    titleFontSize -= 1;
  }

  const escapedTitle = escapeXml(title);
  const escapedSubtitle = escapeXml(subtitle);

  const overlay = `
    <svg width="${width}" height="${height}">

      <!-- Subtitle at top -->
      <text
        x="${width / 2}"
        y="${topPadding + subtitleFontSize}"
        text-anchor="middle"
        font-family="Liberation Mono"
        font-size="${subtitleFontSize}px"
        font-weight="bold"
        fill="black"
      >
        ${escapedSubtitle}
      </text>

      <!-- Title background -->
      <rect
        x="${boxX}"
        y="${boxY}"
        width="${boxWidth}"
        height="${boxHeight}"
        rx="10"
        fill="#52a7d8"
        stroke="black"
        stroke-width="6"
      />

      <!-- Title -->
      <text
        x="${width / 2}"
        y="${boxY + boxHeight / 2 + titleFontSize / 3}"
        text-anchor="middle"
        font-family="DejaVu Sans"
        font-size="${titleFontSize}px"
        font-weight="bold"
        fill="black"
      >
        ${escapedTitle}
      </text>

    </svg>
  `;

  await sharp(inputPath)
    .composite([
      {
        input: Buffer.from(overlay),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toFile(outputPath);

  return outputPath;
}
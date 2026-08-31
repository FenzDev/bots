import * as unzipper from 'unzipper';

export type ZipHtmlFile = {
  name: string;
  html: string;
};

export async function unzipHtmlFiles(
  zip: Buffer,
): Promise<ZipHtmlFile[]> {
  const directory = await unzipper.Open.buffer(zip);

  const htmlFiles: ZipHtmlFile[] = [];

  for (const file of directory.files) {
    if (file.type !== "File") continue;

    const name = file.path;

    if (!/\.(html?|xhtml)$/i.test(name)) {
      continue;
    }

    const buffer = await file.buffer();

    htmlFiles.push({
      name,
      html: buffer.toString("utf8"),
    });
  }

  return htmlFiles;
}
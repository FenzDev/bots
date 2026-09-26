import * as cheerio from "cheerio";

export function extractTables(html: string): string[] {
  const $ = cheerio.load(html);

  return $("table")
    .map((_, table) => $.html(table))
    .get();
}
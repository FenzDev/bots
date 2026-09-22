import type { Element } from "domhandler";
import type { CheerioAPI } from "cheerio";

export function getCellText(
  $: CheerioAPI,
  element: Element,
): string {
  const $cell = $(element);

  $cell.find("br").replaceWith("\n");

  return $cell
    .text()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}
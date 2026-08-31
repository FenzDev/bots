import * as cheerio from "cheerio";
import type { Element } from "domhandler";

export function cleanTable(tableHtml: string): string {
  const $ = cheerio.load(tableHtml, null, false);

  $("*").each((_, element) => {
    const el = element as Element;
    const $element = $(el);

    const rowspan = $element.attr("rowspan");
    const colspan = $element.attr("colspan");

    // Remove all attributes.
    for (const attribute of Object.keys(el.attribs)) {
      $element.removeAttr(attribute);
    }

    // Keep only structural attributes.
    if (rowspan !== undefined) {
      $element.attr("rowspan", rowspan);
    }

    if (colspan !== undefined) {
      $element.attr("colspan", colspan);
    }
  });

  return $("table").first().toString();
}
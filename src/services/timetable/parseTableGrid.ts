import * as cheerio from "cheerio";
import { getCellText } from "./cellText.js";


export type TableGrid = string[][];

type PendingCell = {
  value: string;
  remainingRows: number;
};

export function parseTableGrid(tableHtml: string): TableGrid {
  const $ = cheerio.load(tableHtml, null, false);

  const grid: string[][] = [];

  // Maps column index -> cell occupying that position
  const occupied = new Map<number, PendingCell>();

  $("tr").each((rowIndex, row) => {
    const outputRow: string[] = [];
    let column = 0;

    const cells = $(row).children("td, th").toArray();

    for (const cell of cells) {
      // Skip columns occupied by rowspan from previous rows.
      while (occupied.has(column)) {
        const pending = occupied.get(column)!;

        outputRow[column] = pending.value;

        pending.remainingRows--;

        if (pending.remainingRows <= 0) {
          occupied.delete(column);
        }

        column++;
      }

      const value = getCellText($, cell);

      const rowspan = Math.max(
        1,
        Number($(cell).attr("rowspan") ?? "1"),
      );

      const colspan = Math.max(
        1,
        Number($(cell).attr("colspan") ?? "1"),
      );

      // Fill colspan.
      for (let offset = 0; offset < colspan; offset++) {
        const currentColumn = column + offset;

        outputRow[currentColumn] = value;

        // If the cell continues into later rows,
        // reserve this column.
        if (rowspan > 1) {
          occupied.set(currentColumn, {
            value,
            remainingRows: rowspan - 1,
          });
        }
      }

      column += colspan;
    }

    // Fill any remaining rowspan cells.
    while (occupied.has(column)) {
      const pending = occupied.get(column)!;

      outputRow[column] = pending.value;

      pending.remainingRows--;

      if (pending.remainingRows <= 0) {
        occupied.delete(column);
      }

      column++;
    }

    grid[rowIndex] = outputRow;
  });

  return grid;
}
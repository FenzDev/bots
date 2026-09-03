import { string } from "zod";
import { normalizeTimeString, tryNormalizeDayString } from "./normalizeStrings";
import { TableGrid } from "./parseTableGrid";

export type Timetable = Record<string, string[]>;

export function parseTimetableObject(grid: TableGrid): Timetable | null {
  // identify the times row and remember each column to its time
  let columnTime: Record<number, string> | null = null;
  let timesRow = 1;
  for (let row = 1; row < grid.length; row++) {
    for (let col = 1; col < grid[row].length; col++) {
      let normalizedTimeStr = normalizeTimeString(grid[row][col]);
      if (!/^\d{2}:\d{2}$/.test(normalizedTimeStr)) continue;
      columnTime = columnTime ?? {};
      columnTime[col] = normalizedTimeStr;
    }
    if (columnTime) {
      timesRow = row;
      break;
    }
  }
  if (!columnTime) return null;

  // search cells
  const timetable: Timetable = {};
  let colStart = 1;
  let colLimit = 3;
  for (let row = timesRow + 1; row < grid.length; row++) {
    for (
      let col = colStart;
      col < Math.min(grid[row].length, colLimit);
      col++
    ) {
      const dayCell = tryNormalizeDayString(grid[row][col]);
      if (!dayCell) continue;

      for (; col < grid[row].length; col += 1) {
        const time = columnTime[col];
        if (!time) continue;

        const id = `${dayCell}/${time}`;
        timetable[id] = timetable[id] ?? [];

        timetable[id].push(grid[row][col].trim().replace(/\s+/g, " "));
      }
    }
  }

  return timetable;
}

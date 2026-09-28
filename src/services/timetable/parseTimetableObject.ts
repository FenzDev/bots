import { string } from "zod";
import {
  normalizeGroup,
  normalizeTimeString,
  tryNormalizeDayString,
} from "./normalizeStrings.js";
import { TableGrid } from "./parseTableGrid.js";

export type Timetable = Record<string, Record<string,string>>;

export function parseTimetableObject(grid: TableGrid): Timetable | null {
  // identify the times row and remember each column to its time
  let columnTime: Record<number, string> | null = null;
  let timesRow = 1; // 1 because first row has sheet letters
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

      const group = !columnTime[++col] ? normalizeGroup(grid[row][col]) : "";

      for (col += 1; col < grid[row].length; col++) {
        const time = columnTime[col];
        if (!time) continue;

        const id = `${dayCell}/${time}`;

        const session = grid[row][col].trim().replace(/\s+/g, " ");
        
        timetable[id] = timetable[id] ?? {};
        if (!timetable[id][group]){
          timetable[id][group] = ''
        } else if (session !== '') {
          timetable[id][group] = '\n'
        }

        timetable[id][group] += session;
      }
    }
  }

  return timetable;
}

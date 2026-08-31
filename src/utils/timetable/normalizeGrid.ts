import type { TableGrid } from "./parseTableGrid.js";

export function normalizeGrid(grid: TableGrid): TableGrid {
  const width = Math.max(
    0,
    ...grid.map((row) => row.length),
  );

  return grid.map((row) =>
    Array.from(
      { length: width },
      (_, index) => row[index] ?? "",
    ),
  );
}
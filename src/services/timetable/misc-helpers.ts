export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeNullableText(
  value: string | null | undefined,
): string | null {
  const normalized = normalizeText(value);

  return normalized === "" ? null : normalized;
}

export function sameGroups(a: string[], b: string[]): boolean {
  const normalizeGroups = (groups: string[]) =>
    [...groups]
      .map((g) => normalizeText(g))
      .sort();

  return (
    JSON.stringify(normalizeGroups(a)) ===
    JSON.stringify(normalizeGroups(b))
  );
}

// type GroupsInvolved = [
//   "G1",
//   "G2",
//   "G3",
//   "G4",
//   "G5",
//   "G6",
//   "G7",
//   "G8",
//   "G9",
//   "G10",
//   "G11",
//   "G12",
// ]

// export function mergeGroups(a: GroupsInvolved, b: GroupsInvolved): GroupsInvolved {
//   return [...new Set([...a, ...b])];
// }
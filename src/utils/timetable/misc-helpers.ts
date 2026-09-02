import { TimetableCheckAIResult } from "../../services/ai/apps/timetablecheck";

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

type GroupsInvolved = TimetableCheckAIResult['changesFromAtoB']['0']['groupsInvolved'];

export function mergeGroups(a: GroupsInvolved, b: GroupsInvolved): GroupsInvolved {
  return [...new Set([...a, ...b])];
}
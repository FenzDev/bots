import { TimetableCheckAIResult } from "../../services/ai/apps/timetablecheck";
import { mergeGroups, normalizeNullableText, normalizeText, sameGroups } from "./misc-helpers";

function sameSessionIdentity(
  a: TimetableCheckAIResult['changesFromAtoB']['0'],
  b: TimetableCheckAIResult['changesFromAtoB']['0'],
): boolean {
  if (!a.from || !b.to) return false;

  return (
    normalizeText(a.subjectTitle) === normalizeText(b.subjectTitle) &&
    a.sessionType === b.sessionType &&
    sameGroups(a.groupsInvolved, b.groupsInvolved) &&
    normalizeNullableText(a.from.teacher) ===
      normalizeNullableText(b.to.teacher) &&
    normalizeNullableText(a.from.classroom) ===
      normalizeNullableText(b.to.classroom)
  );
}

export function resolveTimetableChanges(
  result: TimetableCheckAIResult,
): TimetableCheckAIResult {
  const removals = result.changesFromAtoB.filter(
    (change) => change.from && !change.to,
  );

  const additions = result.changesFromAtoB.filter(
    (change) => !change.from && change.to,
  );

  const resolved = result.changesFromAtoB.filter(
    (change) => change.from && change.to,
  );

  const usedAdditions = new Set<number>();

  for (const removal of removals) {
    if (!removal.from) continue;

    const candidates = additions
      .map((addition, index) => ({ addition, index }))
      .filter(({ addition, index }) => {
        if (usedAdditions.has(index) || !addition.to) {
          return false;
        }

        return sameSessionIdentity(removal, addition);
      });

    if (candidates.length === 1) {
      const { addition, index } = candidates[0];

      usedAdditions.add(index);

      resolved.push({
        groupsInvolved: mergeGroups(
          removal.groupsInvolved,
          addition.groupsInvolved,
        ),
        subjectTitle: removal.subjectTitle,
        sessionType: removal.sessionType,
        from: removal.from,
        to: addition.to,
      });
    } else {
      // No unambiguous match.
      // Keep the removal as a real removal.
      resolved.push(removal);
    }
  }

  // Anything that wasn't consumed by a removal
  // remains a genuine addition.
  for (const [index, addition] of additions.entries()) {
    if (!usedAdditions.has(index)) {
      resolved.push(addition);
    }
  }

  return {
    ...result,
    changesFromAtoB: resolved,
  };
}
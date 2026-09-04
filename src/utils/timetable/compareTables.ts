import logger from "../../lib/logger";
import { DiffPart, diffWords } from "./diffwords";
import { Timetable } from "./parseTimetableObject";

export type GroupsDiff = {
  groups: number[];
  day: string;
  startTime: string;
  hasAllGroups: boolean;
  diff: DiffPart[];
};

function areTimetableDiffsEqual(diffA: DiffPart[], diffB: DiffPart[]) {
  if (diffA.length !== diffB.length) {
    return false;
  }
  for (let d = 0; d < diffA.length; d++) {
    if (diffA[d].type !== diffB[d].type || diffA[d].text !== diffB[d].text)
      return false;
  }
  return true;
}

export function compareTables(timetableA: Timetable, timetableB: Timetable) {
  const diffs: GroupsDiff[] = [];

  logger.debug({ timetableA, timetableB });

  for (const [dayTime, aSession] of Object.entries(timetableA)) {
    const [day, startTime] = dayTime.split("/");

    const bSession = timetableB[dayTime];

    const skipped = new Set<number>();

    const maxGroupsNumber = Math.min(aSession.length, bSession.length);

    for (let g = 0; g < maxGroupsNumber; g++) {
      if (aSession[g] === bSession[g]) continue;
      if (skipped.has(g)) continue;

      const diff = diffWords(aSession[g], bSession[g]);
      const groupsDiff: GroupsDiff = {
        groups: [g + 1],
        day,
        startTime,
        diff,
        hasAllGroups: false,
      };

      // merge equivalent groups
      for (
        let otherG = g + 1;
        otherG < Math.min(aSession.length, bSession.length);
        otherG++
      ) {
        const otherDiff = diffWords(aSession[otherG], bSession[otherG]);
        if (areTimetableDiffsEqual(diff, otherDiff)) {
          groupsDiff.groups.push(otherG + 1);
          skipped.add(otherG);
        }
      }

      if (groupsDiff.groups.length === maxGroupsNumber) {
        groupsDiff.hasAllGroups = true;
      }

      diffs.push(groupsDiff);
    }
  }

  // sort diffs pure-removes -> pure-aditions -> mix
  const sortEval = (gDiff: GroupsDiff) =>
    gDiff.diff.every((d) => d.type === "remove")
      ? -1
      : gDiff.diff.every((d) => d.type === "add")
        ? 1
        : 2;
  diffs.sort((a, b) => sortEval(a) - sortEval(b));

  return diffs;
}

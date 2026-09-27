import logger from "../../lib/logger.js";
import { DiffPart, diffWords } from "./diffwords.js";
import { Timetable } from "./parseTimetableObject.js";

export type GroupsDiff = {
  groups: number[];
  day: string;
  startTime: string;
  hasAllGroups: boolean;
  isPureAdd: boolean;
  isPureRemove: boolean;
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

export function compareTables( timetableA: Timetable, timetableB: Timetable, sectionRowsIndex?:number, maxSectionsNumber?:number, groupsCount?:number,) {
  const diffs: GroupsDiff[] = [];

  logger.debug({ timetableA, timetableB });

  // for each day/time combination there are rows of groups
  for (const [dayTime, aSessions] of Object.entries(timetableA)) {
    const [day, startTime] = dayTime.split("/");

    const bSessions = timetableB[dayTime];

    const skipped = new Set<number>();

    const existingSessionsCount = Math.min(aSessions.length, bSessions.length);

    const targetSessionsCount = groupsCount? 
      existingSessionsCount <= (maxSectionsNumber ?? groupsCount)?
      1: // if sessions count is so small (assuming sections are less than num of groups)
      groupsCount: // if groupsCount is defined we use it
      existingSessionsCount; // if no groupsCount specified just use existing number
    const targetSessionsStart = targetSessionsCount === 1?
      sectionRowsIndex ?? 0:
      (sectionRowsIndex ?? 0)*(groupsCount ?? 0);

    for (let g = 0; g < targetSessionsCount; g++) {
      if (aSessions[targetSessionsStart+g] === bSessions[targetSessionsStart+g]) continue;
      if (skipped.has(g)) continue;

      const diff = diffWords(aSessions[targetSessionsStart+g], bSessions[targetSessionsStart+g]);
      const groupsDiff: GroupsDiff = {
        groups: [g + 1],
        day,
        startTime,
        diff,
        hasAllGroups: false,
        isPureAdd: false,
        isPureRemove: false,
      };

      // merge equivalent groups
      for (
        let otherG = g + 1;
        otherG < targetSessionsCount;
        otherG++
      ) {
        const otherDiff = diffWords(aSessions[targetSessionsStart+otherG], bSessions[targetSessionsStart+otherG]);
        if (areTimetableDiffsEqual(diff, otherDiff)) {
          groupsDiff.groups.push(otherG + 1);
          skipped.add(otherG);
        }
      }

      if (groupsDiff.groups.length === targetSessionsCount) {
        groupsDiff.hasAllGroups = true;
      }

      diffs.push(groupsDiff);
    }
  }

  // sort diffs pure-removes -> pure-aditions -> mix
  const sortEval = (gDiff: GroupsDiff) =>
    (gDiff.isPureRemove = gDiff.diff.every((d) => d.type === "remove"))
      ? 0
      : (gDiff.isPureAdd = gDiff.diff.every((d) => d.type === "add"))
        ? 2
        : 1;
  diffs.sort((a, b) => sortEval(a) - sortEval(b));

  return diffs;
}

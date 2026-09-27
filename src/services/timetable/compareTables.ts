import logger from "../../lib/logger.js";
import { matchPattern } from "../../utils/matchPatern.js";
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

export function compareTables(
  timetableA: Timetable,
  timetableB: Timetable,
  sectionHeaderPatern: string,
  groupsHeaderPatern: string,
  groupsCount: number,
) {
  const diffs: GroupsDiff[] = [];

  logger.debug({ timetableA, timetableB });

  // for each day/time combination there are rows of groups
  for (const [dayTime, groupsSessions] of Object.entries(timetableA)) {
    const [day, startTime] = dayTime.split("/");

    const skipped = new Set<number>();

    const groupsSessionsPairs = Object.entries(groupsSessions);

    for (let g = 0; g < groupsSessionsPairs.length; g++) {
      const [group,aCells] = groupsSessionsPairs[g];

      if (matchPattern(group,sectionHeaderPatern)) continue;

      const bCells = timetableB[dayTime][group];

      const minSessionsCount = Math.min(aCells.length, bCells.length);

      if (minSessionsCount <= 0) continue;

      // for (let g = 0; g < minSessionsCount; g++) {
      if (aCells[0] === bCells[0]) continue;

      const diff = diffWords(aCells[0], bCells[0]);
      

      const groupsDiff: GroupsDiff = {
        groups: [0],
        day,
        startTime,
        diff,
        hasAllGroups: false,
        isPureAdd: false,
        isPureRemove: false,
      };
    }

    // // merge equivalent groups
    // for (let otherG = g + 1; otherG < targetSessionsCount; otherG++) {
    //   const otherDiff = diffWords(
    //     aSessions[targetSessionsStart + otherG],
    //     bSessions[targetSessionsStart + otherG],
    //   );
    //   if (areTimetableDiffsEqual(diff, otherDiff)) {
    //     groupsDiff.groups.push(otherG + 1);
    //     skipped.add(otherG);
    //   }

    if (groupsDiff.groups.length) {
      groupsDiff.hasAllGroups = true;
    }

    diffs.push(groupsDiff);
  }
  // }

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

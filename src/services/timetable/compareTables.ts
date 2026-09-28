import logger from "../../lib/logger.js";
import { matchPattern } from "../../utils/matchPatern.js";
import { DiffPart, diffWords } from "./diffwords.js";
import { Timetable } from "./parseTimetableObject.js";

export type GroupsDiff = {
  groups: string[];
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
      const [group,aGroupCells] = groupsSessionsPairs[g];

      let match;
      if (!(match = matchPattern(group,sectionHeaderPatern))) continue;

      const bGroupCells = timetableB[dayTime][group];

      const minSessionsCount = Math.min(aGroupCells.length, bGroupCells.length);

      if (minSessionsCount <= 0) continue;

      // for (let g = 0; g < minSessionsCount; g++) {
      if (aGroupCells[0] === bGroupCells[0]) continue;
      
      const diff = diffWords(aGroupCells[0], bGroupCells[0]);
      
      skipped.add(g);
      
      const groupsDiff: GroupsDiff = {
        groups: [group],
        day,
        startTime,
        diff,
        hasAllGroups: false,
        isPureAdd: false,
        isPureRemove: false,
      };

      for (let gOther = g+1; gOther < groupsSessionsPairs.length; gOther++) {
        if (skipped.has(gOther)) continue;
        if (!(match = matchPattern(group,sectionHeaderPatern))) continue;
        
        const otherDiff = diffWords(
          groupsSessionsPairs[g][0],
          groupsSessionsPairs[gOther][0], 
          // TODO: Sounds not right that we use old table to compare
        );

        if (areTimetableDiffsEqual(diff, otherDiff)) {
          groupsDiff.groups.push(groupsSessionsPairs[gOther][0]);
          skipped.add(gOther);
        }

        skipped.add(gOther);
      }


      skipped.clear();
    // // merge equivalent groups
    // for (let otherG = g + 1; otherG < targetSessionsCount; otherG++) {
    //   

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

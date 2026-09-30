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
  oldSessionTitle?: string;
  newSessionTitle: string;
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

  for (const [dayTime, groupsSessionsB] of Object.entries(timetableB)) {
    const groupsSessionsA = timetableA[dayTime];
    if (!groupsSessionsA) continue;

    const [day, startTime] = dayTime.split("/");

    const skipped = new Set();

    const groupsSessionsBEntries = Object.entries(groupsSessionsB);
    for (let g = 0; g < groupsSessionsBEntries.length; g++) {
      const [tableGroup, sessionB] = groupsSessionsBEntries[g];

      if (skipped.has(g)) continue;

      const matchSection = matchPattern(tableGroup, sectionHeaderPatern);
      const matchGroup = matchPattern(tableGroup, groupsHeaderPatern);

      if (!matchSection && !matchGroup) continue;

      const sessionA = groupsSessionsA[tableGroup];

      if (sessionA === undefined) continue;

      const diff = diffWords(sessionA, sessionB);

      if (
        diff.length === 0 ||
        diff.every((diffPart) => diffPart.type === "equal")
      )
        continue;

      const groups = [tableGroup];

      for (
        let gOther = g + 1;
        gOther < groupsSessionsBEntries.length;
        gOther++
      ) {
        if (skipped.has(gOther)) continue;

        const [otherTableGroup, otherSessionB] = groupsSessionsBEntries[gOther];
        const otherSessionA = groupsSessionsA[otherTableGroup];

        const matchOtherGroup = matchPattern(tableGroup, groupsHeaderPatern);
        if (!matchOtherGroup) continue;

        const otherDiff = diffWords(otherSessionA, otherSessionB);

        if (areTimetableDiffsEqual(diff, otherDiff)) {
          groups.push(otherTableGroup);
          skipped.add(gOther);
        }
      }

      diffs.push({
        day,
        startTime,
        diff,
        groups,
        hasAllGroups:
          matchSection != undefined || groups.length === groupsCount,
        isPureAdd: diff.every((d) => d.type === "add"),
        isPureRemove: diff.every((d) => d.type === "remove"),
        oldSessionTitle: sessionA,
        newSessionTitle: sessionB,
      });
    }
  }

  // sort diffs pure-removes -> pure-aditions -> mix
  // const sortEval = (gDiff: GroupsDiff) =>
  //   (gDiff.isPureRemove = gDiff.diff.every((d) => d.type === "remove"))
  //     ? 0
  //     : (gDiff.isPureAdd = gDiff.diff.every((d) => d.type === "add"))
  //       ? 2
  //       : 1;
  // diffs.sort((a, b) => sortEval(a) - sortEval(b));

  const addPurifyDiff = (diff: GroupsDiff) => {
    diff.diff = diff.diff
      .filter((d) => d.type !== "remove")
      .map((d) => ({ ...d, type: "add" }));
    diff.isPureAdd = diff.diff.length > 0;
    diff.isPureRemove = false;
    return diff;
  };
  const removePurifyDiff = (diff: GroupsDiff) => {
    diff.diff = diff.diff
      .filter((d) => d.type !== "add")
      .map((d) => ({ ...d, type: "remove" }));
    diff.isPureRemove = diff.diff.length > 0;
    diff.isPureAdd = false;
    return diff;
  };

  // We optimize the diffs (by checking if all groups have something added)
  for (let d = 0; d < diffs.length; d++) {
    let anyMerges = false;
    for (let dOther = d + 1; dOther < diffs.length; dOther++) {
      if (
        diffs[dOther].day !== diffs[d].day ||
        diffs[dOther].startTime !== diffs[d].startTime
      )
        continue;
      if (diffs[dOther].newSessionTitle !== diffs[dOther].newSessionTitle)
        continue;

      if (!anyMerges) {
        if (!diffs[d].isPureAdd && !diffs[d].isPureRemove) {
          diffs.push(
            diffs[d].isPureAdd
              ? addPurifyDiff({
                  ...diffs[d],
                })
              : removePurifyDiff({ ...diffs[d] }),
          );
          diffs[d]
        }
        anyMerges = true;
      }

      diffs[d].groups = [...diffs[d].groups, ...diffs[dOther].groups];
      if (diffs[dOther].isPureAdd || diffs[dOther].isPureRemove) {
        diffs.splice(dOther, 1);
      } else {
        diffs[d].newSessionTitle !== ""
          ? addPurifyDiff(diffs[dOther])
          : removePurifyDiff(diffs[dOther]);
      }
    }
  }

  return diffs;
}

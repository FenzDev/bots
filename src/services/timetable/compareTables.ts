import logger from "../../lib/logger.js";
import { matchPattern } from "../../utils/matchPatern.js";
import { DiffPart, diffWords } from "./diffwords.js";
import { Timetable } from "./parseTimetableObject.js";

interface DayTime {
  day: string;
  startTime: string;
}

type GroupsUpdates = Record<string,SessionUpdate[]>;

export type SessionUpdate = {
  group: string;
  isWholeSection: boolean;
} & DayTime &
  (
    | {
        type: "modify";

        isPureAdd: boolean;
        isAdd: boolean;
        isPureRemove: boolean;
        isRemove: boolean;
        diff: DiffPart[];
        oldSessionTitle: string;
        newSessionTitle: string;
      }
    | {
        type: "transfer";
        from: DayTime;
        to: DayTime;
        sessionTitle: string;
      }
  );

type SessionModification = SessionUpdate & { type: "modify" };

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
) : SessionUpdate[] {
  /// STEP 1 : Get any session that got modified
  // session is the intersection of day, time and group
  const dayTimeModifications: Record<string, SessionModification[]> = {};
  for (const [dayTime, groupsSessionsB] of Object.entries(timetableB)) {
    const groupsSessionsA = timetableA[dayTime];
    if (!groupsSessionsA) continue;

    const [day, startTime] = dayTime.split("/");

    const groupsSessionsBEntries = Object.entries(groupsSessionsB);
    for (let g = 0; g < groupsSessionsBEntries.length; g++) {
      const [tableGroup, sessionB] = groupsSessionsBEntries[g];

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

      dayTimeModifications[dayTime] = dayTimeModifications[dayTime] ?? [];

      dayTimeModifications[dayTime].push({
        type: "modify",
        day,
        startTime,
        group: tableGroup,
        isWholeSection: matchSection != undefined,
        diff,

        isPureAdd: diff.every((d) => d.type === "add"),
        isAdd:
          diff.some((d) => d.type === "add") &&
          !diff.some((d) => d.type === "remove"),
        isPureRemove: diff.every((d) => d.type === "remove"),
        isRemove:
          diff.some((d) => d.type === "remove") &&
          !diff.some((d) => d.type === "add"),

        oldSessionTitle: sessionA,
        newSessionTitle: sessionB,
      });
    }
  }

  const dayTimeModificationsEntries = Object.entries(dayTimeModifications);
  if (dayTimeModificationsEntries.length === 0) {
    return [] as SessionUpdate[];
  }

  /// STEP 2 : We look for equality in old/new session title
  // on each groups if we find that all of the groups of section
  // are involved, we merge them into one chunk,
  // then we split groups that are abnominal as a new 'modify' update.
  // Example: section has g1,g2,g3
  // g1+g2+g3: 'Lecture B' -> 'Lecture D'
  // > make them one modification for section from Lec..B to Lec..D
  // g1: 'Lab B' -> 'Lecture D'; g2,g3: '' -> 'Lecture D'
  // > make one modification for section from '' to Lec..D
  // > make one modification for g1 from Lab B to ''
  // g2: 'Lecture C' -> 'Lab C'; g1,g3: 'Lecture C' -> ''
  // > make one modification for g2 from '' to Lab C
  // > make one modification for section from Lecture C to ''

  const expandedModifications: SessionModification[] = [];

  for (const [_, modifications] of dayTimeModificationsEntries) {
    const firstModification = modifications[0];

    if (firstModification.isWholeSection) {
      continue;
    }

    const modificationsQueue: SessionModification[] = [];

    // non empty that is shared across groups -> empty/non empty
    let wholeSectionChangedFromSame = modifications.length === groupsCount;
    for (let m = 0; m < modifications.length; m++) {
      if (
        modifications[m].oldSessionTitle === "" ||
        firstModification.oldSessionTitle !== modifications[m].oldSessionTitle
      ) {
        wholeSectionChangedFromSame = false;
        break;
      }

      if (modifications[m].newSessionTitle === "") continue;

      modificationsQueue.push({
        ...modifications[m],
        oldSessionTitle: "",
        diff: diffWords("", modifications[m].newSessionTitle),
        isAdd: true,
        isPureAdd: true,
        isRemove: false,
        isPureRemove: false,
      });
    }

    if (wholeSectionChangedFromSame) {
      expandedModifications.push({
        ...firstModification,
        group: sectionHeaderPatern,
        isWholeSection: true,
        newSessionTitle: "",
        diff: diffWords(firstModification.oldSessionTitle, ""),
        isRemove: true,
        isPureRemove: true,
        isAdd: false,
        isPureAdd: false,
      });
      expandedModifications.push(...modificationsQueue);
    }
    modificationsQueue.splice(0, modificationsQueue.length);

    // empty/non empty -> non empty that is shared across groups
    let wholeSectionChangedToSame = modifications.length === groupsCount;
    for (let m = 0; m < modifications.length; m++) {
      if (
        modifications[m].newSessionTitle === "" ||
        firstModification.newSessionTitle !== modifications[m].newSessionTitle
      ) {
        wholeSectionChangedToSame = false;
        break;
      }

      if (modifications[m].oldSessionTitle === "") continue;

      modificationsQueue.push({
        ...modifications[m],
        newSessionTitle: "",
        diff: diffWords(modifications[m].oldSessionTitle, ""),
        isAdd: false,
        isPureAdd: false,
        isRemove: true,
        isPureRemove: true,
      });
    }

    if (wholeSectionChangedToSame) {
      expandedModifications.push({
        ...firstModification,
        group: sectionHeaderPatern,
        isWholeSection: true,
        oldSessionTitle: "",
        diff: diffWords("", firstModification.newSessionTitle),
        isRemove: false,
        isPureRemove: false,
        isAdd: true,
        isPureAdd: true,
      });
      expandedModifications.push(...modificationsQueue);
    }
    modificationsQueue.splice(0, modificationsQueue.length);
  }

  /// STEP 3 : We analyse the modification and we detect transformation
  // while detecting we create the final updates for each groups
  const groupsUpdates:GroupsUpdates = {}

  for (let m = 0; m < expandedModifications.length; m++) {
    
    for (let mOther=m+1; mOther < expandedModifications.length; mOther++) {
      // TODO: transformation detection
    }
  }

  // sort diffs pure-removes -> pure-aditions -> mix
  // const sortEval = (gDiff: GroupsDiff) =>
  //   gDiff.isRemove ? 0 : gDiff.isAdd ? 2 : 1;
  // diffs.sort((a, b) => sortEval(a) - sortEval(b));

  return expandedModifications;
}

// import logger from "../../lib/logger.js";
// import { matchPattern } from "../../utils/matchPatern.js";
// import { DiffPart, diffWords } from "./diffwords.js";
// import { Timetable } from "./parseTimetableObject.js";

// export type GroupsDiff = {
//   groups: string[];
//   day: string;
//   startTime: string;
//   hasAllGroups: boolean;
//   isPureAdd: boolean;
//   isPureRemove: boolean;
//   diff: DiffPart[];
//   oldSessionTitle?: string;
//   newSessionTitle: string;
// };

// function areTimetableDiffsEqual(diffA: DiffPart[], diffB: DiffPart[]) {
//   if (diffA.length !== diffB.length) {
//     return false;
//   }
//   for (let d = 0; d < diffA.length; d++) {
//     if (diffA[d].type !== diffB[d].type || diffA[d].text !== diffB[d].text)
//       return false;
//   }
//   return true;
// }

// export function compareTables(
//   timetableA: Timetable,
//   timetableB: Timetable,
//   sectionHeaderPatern: string,
//   groupsHeaderPatern: string,
//   groupsCount: number,
// ) {
//   const diffs: GroupsDiff[] = [];

//   logger.debug({ timetableA, timetableB });

//   for (const [dayTime, groupsSessionsB] of Object.entries(timetableB)) {
//     const groupsSessionsA = timetableA[dayTime];
//     if (!groupsSessionsA) continue;

//     const [day, startTime] = dayTime.split("/");

//     const skipped = new Set();

//     const groupsSessionsBEntries = Object.entries(groupsSessionsB);
//     for (let g = 0; g < groupsSessionsBEntries.length; g++) {
//       const [tableGroup, sessionB] = groupsSessionsBEntries[g];

//       if (skipped.has(g)) continue;

//       const matchSection = matchPattern(tableGroup, sectionHeaderPatern);
//       const matchGroup = matchPattern(tableGroup, groupsHeaderPatern);

//       if (!matchSection && !matchGroup) continue;

//       const sessionA = groupsSessionsA[tableGroup];

//       if (sessionA === undefined) continue;

//       const diff = diffWords(sessionA, sessionB);

//       if (
//         diff.length === 0 ||
//         diff.every((diffPart) => diffPart.type === "equal")
//       )
//         continue;

//       const groups = [tableGroup];

//       for (
//         let gOther = g + 1;
//         gOther < groupsSessionsBEntries.length;
//         gOther++
//       ) {
//         if (skipped.has(gOther)) continue;

//         const [otherTableGroup, otherSessionB] = groupsSessionsBEntries[gOther];
//         const otherSessionA = groupsSessionsA[otherTableGroup];

//         const matchOtherGroup = matchPattern(tableGroup, groupsHeaderPatern);
//         if (!matchOtherGroup) continue;

//         const otherDiff = diffWords(otherSessionA, otherSessionB);

//         if (areTimetableDiffsEqual(diff, otherDiff)) {
//           groups.push(otherTableGroup);
//           skipped.add(gOther);
//         }
//       }

//       diffs.push({
//         day,
//         startTime,
//         diff,
//         groups,
//         hasAllGroups:
//           matchSection != undefined || groups.length === groupsCount,
//         isPureAdd: diff.every((d) => d.type === "add"),
//         isPureRemove: diff.every((d) => d.type === "remove"),
//         oldSessionTitle: sessionA,
//         newSessionTitle: sessionB,
//       });
//     }
//   }

//   // sort diffs pure-removes -> pure-aditions -> mix
//   // const sortEval = (gDiff: GroupsDiff) =>
//   //   (gDiff.isPureRemove = gDiff.diff.every((d) => d.type === "remove"))
//   //     ? 0
//   //     : (gDiff.isPureAdd = gDiff.diff.every((d) => d.type === "add"))
//   //       ? 2
//   //       : 1;
//   // diffs.sort((a, b) => sortEval(a) - sortEval(b));

//   const addPurifyDiff = (diff: GroupsDiff) => {
//     diff.diff = diff.diff
//       .filter((d) => d.type !== "remove")
//       .map((d) => ({ ...d, type: "add" }));
//     diff.isPureAdd = diff.diff.length > 0;
//     diff.isPureRemove = false;
//     return diff;
//   };
//   const removePurifyDiff = (diff: GroupsDiff) => {
//     diff.diff = diff.diff
//       .filter((d) => d.type !== "add")
//       .map((d) => ({ ...d, type: "remove" }));
//     diff.isPureRemove = diff.diff.length > 0;
//     diff.isPureAdd = false;
//     return diff;
//   };

//   // We optimize the diffs (by checking if all groups have something added)
//   for (let d = 0; d < diffs.length; d++) {
//     let anyMerges = false;
//     for (let dOther = d + 1; dOther < diffs.length; dOther++) {
//       if (
//         diffs[dOther].day !== diffs[d].day ||
//         diffs[dOther].startTime !== diffs[d].startTime
//       )
//         continue;
//       if (diffs[dOther].newSessionTitle !== diffs[dOther].newSessionTitle)
//         continue;

//       if (!anyMerges) {
//         if (!diffs[d].isPureAdd && !diffs[d].isPureRemove) {
//           diffs.push(
//             diffs[d].isPureAdd
//               ? addPurifyDiff({
//                   ...diffs[d],
//                 })
//               : removePurifyDiff({ ...diffs[d] }),
//           );
//           diffs[d]
//         }
//         anyMerges = true;
//       }

//       diffs[d].groups = [...diffs[d].groups, ...diffs[dOther].groups];
//       if (diffs[dOther].isPureAdd || diffs[dOther].isPureRemove) {
//         diffs.splice(dOther, 1);
//       } else {
//         diffs[d].newSessionTitle !== ""
//           ? addPurifyDiff(diffs[dOther])
//           : removePurifyDiff(diffs[dOther]);
//       }
//     }
//   }

//   return diffs;
// }

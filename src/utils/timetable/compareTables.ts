import logger from "../../lib/logger";
import { DiffPart, diffWords } from "./diffwords";
import { Timetable } from "./parseTimetableObject";

export type GroupDiff = {group:number, diff:DiffPart[]};

export function compareTables(timetableA:Timetable, timetableB:Timetable) {

    const diffs:GroupDiff[] = [];

    for (const [dayTime,aSession] of Object.entries(timetableA)) {
        const bSession = timetableB[dayTime];

        for (let g = 0; g < Math.min(aSession.length, bSession.length); g++) {
            if (aSession[g] === bSession[g]) continue;
            
            diffs.push( { group:g+1, diff: diffWords(aSession[g], bSession[g])});
        }
    }

    return diffs;
}
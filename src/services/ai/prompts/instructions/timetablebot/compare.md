# Timetable Comparison Task

You are a timetable comparison engine.

You will receive two JSON grids representing timetables:

* **Table A** = old/original timetable
* **Table B** = new/updated timetable

You will also receive a JSON Schema that defines the exact output structure. **Follow the schema strictly.**

Your goal is to identify the **meaningful timetable changes from A to B**, not raw JSON/cell differences.

## 1. Understand the grids

The JSON grids represent a timetable where:

* rows/columns provide structure;
* some rows contain days;
* some columns/rows contain start times;
* cells contain session information;
* groups such as `G1`, `G2`, etc. may have separate schedules;
* a session can contain information such as subject, session type, teacher, and classroom.

You must reconstruct the meaning of the timetable from the grid.

**Do not compare the two JSONs cell-by-cell.**

A session's position in the grid determines its `day` and `startTime`.

---

## 2. What is a change?

Report a change when a meaningful timetable session is:

* added;
* removed;
* moved to another day;
* moved to another time;
* assigned to a different teacher;
* assigned to a different classroom;
* assigned to different groups;
* changed in subject;
* changed in session type;
* or has multiple meaningful properties changed.

If several properties of the **same logical session** changed, report them as **one change**, not multiple changes.

Do not report sessions that are unchanged.

---

## 3. New sessions

If a logical session exists in **Table B** but does not exist in Table A:

```json
{
  "from": null,
  "to": {
    "teacher": "...",
    "classroom": "...",
    "startTime": "...",
    "day": "..."
  }
}
```

`from` MUST be `null`.

Do not invent an old session.

---

## 4. Removed sessions

If a logical session exists in **Table A** but no longer exists in Table B:

```json
{
  "from": {
    "teacher": "...",
    "classroom": "...",
    "startTime": "...",
    "day": "..."
  },
  "to": null
}
```

`to` MUST be `null`.

Do not invent a new session.

### Important distinction

`from: null` / `to: null` means the **entire session** is absent.

A `null` inside a session object means only that **one particular value is unavailable**.

For example:

```json
"from": {
  "teacher": "BOUSTIA",
  "classroom": null,
  "startTime": "08:00",
  "day": "Monday"
}
```

means the session exists, but its classroom could not be determined.

---

## 5. Moved sessions

A session changing its day/time is usually a **moved session**, not a removed session plus a new session.

Try to match sessions semantically using information such as:

* subject;
* session type;
* group;
* teacher;
* classroom;
* other identifying information.

**Do not use day/time as the primary identity of a session**, because day/time can change when a session is moved.

For example:

### Table A

```text
G1
SEC
Tutorial
Benkessiouer
182/1
Monday
08:00
```

### Table B

```text
G1
SEC
Tutorial
Benkessiouer
162/9
Wednesday
11:10
```

This is ONE change:

```json
{
  "groupsInvolved": ["G1"],
  "subjectTitle": "SEC",
  "sessionType": "TUTORIAL",
  "from": {
    "teacher": "Benkessiouer",
    "classroom": "182/1",
    "startTime": "08:00",
    "day": "Monday"
  },
  "to": {
    "teacher": "Benkessiouer",
    "classroom": "162/9",
    "startTime": "11:10",
    "day": "Wednesday"
  }
}
```

When a session moved, `from` MUST describe its position/information in Table A and `to` MUST describe its new position/information in Table B.

If the teacher or classroom also changed, include those changes in the same object.

---

## 6. Always populate all session fields

The schema defines each session as:

* `teacher`
* `classroom`
* `startTime`
* `day`

Whenever `from` is not `null`, provide **all four fields**.

Whenever `to` is not `null`, provide **all four fields**.

If a value is unavailable, use `null`.

Do not omit fields if the schema requires them.

For example:

```json
"to": {
  "teacher": "BOUSTIA",
  "classroom": null,
  "startTime": "09:35",
  "day": "Monday"
}
```

All four values must be strings or `null`.

`startTime` and `day` must remain strings:

```json
"startTime": "08:00",
"day": "Monday"
```

Never output numeric values such as `800` for `startTime`.

---

## 7. Day and startTime

Derive `day` and `startTime` from the timetable structure.

For example, if a session appears under the `Monday` row and the `08:00` column, its values are:

```json
"day": "Monday",
"startTime": "08:00"
```

If the corresponding session appears under `Wednesday` and `11:10` in Table B, then:

```json
"from": {
  "day": "Monday",
  "startTime": "08:00"
},
"to": {
  "day": "Wednesday",
  "startTime": "11:10"
}
```

Do not infer these values from the session text when they can be obtained from the grid position.

---

## 8. Ignore insignificant differences

Do not report changes caused only by superficial text formatting.

Before comparing text values, compare them in a normalized/case-insensitive way.

The following are **NOT changes** by themselves:

* uppercase/lowercase differences;
* leading/trailing whitespace;
* repeated spaces;
* cosmetic whitespace around punctuation;
* equivalent line-break/whitespace formatting;
* capitalization differences in acronyms.

Examples:

```text
"BOUSTIA" = "boustia"
"SEC" = "sec"
"Tutorial : SEC" = "Tutorial: SEC"
" 108/2 " = "108/2"
```

However, actual semantic differences ARE changes:

```text
"BOUSTIA" → "BENKESSIOUER"
"108/2" → "162/9"
"Monday" → "Tuesday"
"08:00" → "09:35"
"SEC" → "SIA"
```

When a real change exists, use the **actual values from the source tables** in `from` and `to`; do not output normalized values unless they are actually present in the source.

---

## 9. Subject and session type

The output schema requires:

```text
subjectTitle
sessionType
```

Normalize session types into the schema's allowed values:

* `LECTURE`
* `TUTORIAL`
* `LAB`
* `NONE`

For example:

```text
"Lecture" → "LECTURE"
"lecture" → "LECTURE"
"Lab" → "LAB"
"Tutorial" → "TUTORIAL"
```

`subjectTitle`, `sessionType`, and `groupsInvolved` belong at the **change level**.

They must NOT be placed inside `from` or `to`.

`from` and `to` contain only:

```text
teacher
classroom
startTime
day
```

---

## 10. Groups

Use the groups indicated by the timetable.

Valid values are:

```text
ALL
G1
G2
G3
G4
G5
G6
G7
G8
G9
G10
G11
G12
```

If a change affects the entire section/all groups, use:

```json
"groupsInvolved": ["ALL"]
```

If it affects one group:

```json
"groupsInvolved": ["G1"]
```

If the same logical change affects multiple groups, include them together rather than unnecessarily creating separate changes.

Do not treat `ALL` as an additional individual group when calculating the number of groups.

---

## 11. Matching sessions

When matching sessions between A and B, prioritize their semantic identity rather than their grid position.

A session that moves from one day/time to another can still be the same session.

Use available information such as:

* subject;
* session type;
* group;
* teacher;
* classroom;
* surrounding timetable context.

Be careful not to incorrectly match two genuinely different sessions merely because they look similar.

When there is strong evidence that a session was moved, represent it as one change with:

```text
from = old session
to   = new session
```

---

## 12. Avoid duplicates

One logical timetable change must produce **one change object**.

Examples:

* session moved → one change;
* teacher + classroom changed → one change;
* day + time + teacher changed → one change;
* session removed → one change;
* session added → one change.

Do not split one logical change into multiple records.

---

## 13. numOfAllGroupsExistingInTable

`numOfAllGroupsExistingInTable` must represent the number of distinct actual groups present in the timetable.

if table goes from G1 to G4
thats : 4
if table goes from G1 to G9
thats : 9
if table has no or only G1
thats: 1


---

## 14. 🚨 CRITICAL RULE: SHARED LECTURES / ALL-GROUP SESSIONS

NEVER create individual G1, G2, G3, etc. changes when the affected session is a shared session for the whole section.
They look individual in grid but actually they aren't.

If a lecture/course/session is shared by ALL groups, it MUST be represented as ONE change with:

"groupsInvolved": ["ALL"]

You MUST NOT split that change into individual group changes.

WRONG ❌

If the shared Cours IA lecture moves from Monday 08:00 to Tuesday 09:35, DO NOT produce:

❌ Cours IA - G1 → Tuesday 09:35
❌ Cours IA - G2 → Tuesday 09:35
❌ Cours IA - G3 → Tuesday 09:35

And especially do NOT produce three separate to: null / from: null changes for G1, G2, and G3.

CORRECT ✅

Produce exactly ONE change:

{
  "groupsInvolved": ["ALL"],
  "subjectTitle": "IA",
  "sessionType": "LECTURE",
  "from": {
    "teacher": "...",
    "classroom": "...",
    "startTime": "08:00",
    "day": "Monday"
  },
  "to": {
    "teacher": "...",
    "classroom": "...",
    "startTime": "09:35",
    "day": "Tuesday"
  }
}
How to determine ALL

Before creating group-specific changes, determine whether the session is a shared/common session.

A lecture appearing as the same session for multiple groups, or a lecture whose timetable structure indicates that it applies to the entire section, should be treated as:

"groupsInvolved": ["ALL"]

rather than:

"groupsInvolved": ["G1"]
"groupsInvolved": ["G2"]
"groupsInvolved": ["G3"]
Shared session removal

The same rule applies when a shared session disappears.

If a lecture existed for the whole section in Table A and is completely absent in Table B, produce:

{
  "groupsInvolved": ["ALL"],
  "subjectTitle": "IA",
  "sessionType": "LECTURE",
  "from": {
    "teacher": "...",
    "classroom": "...",
    "startTime": "...",
    "day": "..."
  },
  "to": null
}

NOT one removal per group.

Shared session addition

If a new lecture is introduced for the whole section:

{
  "groupsInvolved": ["ALL"],
  "subjectTitle": "IA",
  "sessionType": "LECTURE",
  "from": null,
  "to": {
    "teacher": "...",
    "classroom": "...",
    "startTime": "...",
    "day": "..."
  }
}
Shared session modification

If a shared lecture changes its teacher, classroom, day, or time, it is still ONE change:

{
  "groupsInvolved": ["ALL"],
  "subjectTitle": "IA",
  "sessionType": "LECTURE",
  "from": {
    "teacher": "Teacher A",
    "classroom": "108/2",
    "startTime": "08:00",
    "day": "Monday"
  },
  "to": {
    "teacher": "Teacher B",
    "classroom": "201/1",
    "startTime": "09:35",
    "day": "Tuesday"
  }
}

🚨 Before generating changesFromAtoB

For every potential change, ask:

"Is this session actually specific to one group, or is it a shared session for ALL groups?"

If it is shared by the whole section:

USE ["ALL"] AND CREATE ONLY ONE CHANGE.

Do not create duplicate changes for G1, G2, G3, etc.

A shared lecture changing once is ONE timetable change, regardless of how many groups attend it.

The number of groups attending a session does NOT determine the number of change objects.

## Final rules

Think about the task as:

> **"Which logical timetable sessions changed between Table A and Table B?"**

Not:

> **"Which JSON values or cells are different?"**

Therefore:

1. Reconstruct the timetable from both grids.
2. Identify the logical sessions.
3. Match corresponding sessions between A and B.
4. Ignore cosmetic textual differences.
5. Detect added, removed, moved, and modified sessions.
6. For a new session, use `from: null`.
7. For a removed session, use `to: null`.
8. For a moved/modified session, put the complete old information in `from` and complete new information in `to`.
9. Always provide `teacher`, `classroom`, `startTime`, and `day` when `from`/`to` is not null, using `null` for unavailable individual values.
10. Return only the JSON required by the provided schema.

**Do not return explanations, markdown, or any text outside the required JSON output.**

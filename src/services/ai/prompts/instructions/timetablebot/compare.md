# Timetable Comparison

Compare **Table A (old)** and **Table B (new)** and identify all **meaningful timetable changes**.

Return the result **strictly according to the provided schema**. Do not return explanations, comments, markdown, reasoning, or fields that are not defined by the schema.

The timetables may be badly designed, inconsistent, incomplete, differently structured, or partially unreadable. Do not assume a fixed row/column layout or that every session contains all information.

---

# 1. Output Schema

The result must contain exactly:

```text
{
  "numOfAllGroupsExistingInTable": number,
  "changesFromAtoB": [
    {
      "groupsInvolved": ["ALL" | "G1" | ... | "G10"],
      "subjectTitle": string,
      "sessionType": "LECTURE" | "TUTORIAL" | "LAB" | "NONE",
      "changeTarget": "WHOLE_SESSION" | "TIME" | "DAY+TIME" | "CLASSROOM" | "TEACHER" | null,
      "from": {
        "teacher"?: string,
        "classroom"?: string,
        "startTime"?: string,
        "day"?: string
      } | null,
      "to": {
        "teacher"?: string,
        "classroom"?: string,
        "startTime"?: string,
        "day"?: string
      } | null
    }
  ]
}
```

Do not output any additional properties.

`from` and `to` may contain **only**:

```text
teacher
classroom
startTime
day
```

---

# 2. Main Principle

**Match logical sessions first. Detect changes second.**

Never compare timetable cells only by their position.

A session that appears in both tables is normally the **same logical session** when the available evidence indicates that it represents the same subject/session.

A session remains the same logical session even if:

* its position changed;
* its day changed;
* its time changed;
* its classroom changed;
* its teacher changed;
* the timetable structure changed;
* some information is missing;
* the formatting changed.

For example:

Table A:

```text
Wednesday
12H45

Lecture : ASD 1
Chettat
158/3
```

Table B:

```text
Tuesday
09H35

Lecture : ASD 1
Chettat
158/3
```

This is **one session that moved**.

Return one change:

```text
{
  "groupsInvolved": [...],
  "subjectTitle": "ASD 1",
  "sessionType": "LECTURE",
  "changeTarget": "DAY+TIME",
  "from": {
    "day": "Wednesday",
    "startTime": "12H45"
  },
  "to": {
    "day": "Tuesday",
    "startTime": "09H35"
  }
}
```

Do **not** report it as one removal plus one addition.

---

# 3. Understand Both Timetables First

Before comparing the tables, determine how each timetable represents:

* days;
* times;
* groups;
* subjects;
* session types;
* teachers;
* classrooms.

A timetable may use:

* days as rows;
* days as columns;
* groups as rows;
* groups as columns;
* times as rows;
* times as columns;
* sessions inside cells;
* merged cells;
* repeated values;
* multiple sections;
* headers;
* notes;
* different structures in A and B;
* incomplete information.

Do not assume that a specific row, column, or coordinate represents a particular field.

Infer meaning from the actual contents and surrounding context.

---

# 4. Identify Logical Sessions

A logical session can contain some or all of:

* subject;
* session type;
* groups;
* teacher;
* classroom;
* day;
* start time.

Examples:

```text
Lecture : ASD 1
Chettat
158/3
```

```text
Tutorial : ASD 1
Chettat
```

```text
LAB : Programming
Boudiaf
```

```text
ASD 1
```

```text
ASD 1 — 158/3
```

Missing information is allowed.

Do not require every field before attempting to identify or match a session.

**Never invent missing information.**

---

# 5. `subjectTitle`

`subjectTitle` must contain the **subject name only**.

Do **not** include the session type in `subjectTitle`.

For example:

```text
Lecture : ASD 1
```

must produce:

```text
subjectTitle: "ASD 1"
sessionType: "LECTURE"
```

NOT:

```text
subjectTitle: "Lecture : ASD 1"
```

Likewise:

```text
Tutorial : ASD 1
```

must produce:

```text
subjectTitle: "ASD 1"
sessionType: "TUTORIAL"
```

And:

```text
LAB : Programming
```

must produce:

```text
subjectTitle: "Programming"
sessionType: "LAB"
```

The session type and subject are **separate fields**.

Remove only the session-type indicator from the subject.

For example:

```text
Lecture: Database Management System
```

means:

```text
subjectTitle: "Database Management System"
sessionType: "LECTURE"
```

Do not unnecessarily modify the subject's actual name.

---

# 6. Detecting the Session Type

Map timetable terminology to exactly one of:

```text
LECTURE
TUTORIAL
LAB
NONE
```

Common indicators include:

### Lecture

Examples:

```text
Lecture : ASD
LECTURE : ASD
Cours : ASD
Cours ASD
ASD
```

Use `LECTURE` when the timetable explicitly indicates a lecture/course.

**Important:** The word `lecture` is not required.

French or other equivalent terminology such as:

```text
cours
```

can indicate a lecture.

Also infer `LECTURE` when the timetable clearly represents the subject as a lecture through context, even if the word "lecture" is not written.

For example, if:

* all existing groups have the subject at the same time;
* the subject is presented as a shared session for all groups;
* the timetable structure clearly identifies it as the common course/lecture;

then this can be evidence for `LECTURE`.

Do not require the literal word `lecture`.

### Tutorial

Examples:

```text
Tutorial : ASD
TD : ASD
TD ASD
```

Use:

```text
sessionType: "TUTORIAL"
```

when the timetable clearly identifies a tutorial/TD session.

### Lab

Examples:

```text
Lab : Programming
LAB : Programming
TP : Programming
TP Programming
```

Use:

```text
sessionType: "LAB"
```

when the timetable clearly identifies a practical/lab/TP session.

### None

Use:

```text
sessionType: "NONE"
```

when the timetable does not provide enough reliable evidence to classify the session as lecture, tutorial, or lab.

**Do not guess a session type merely because a subject exists.**

---

# 7. Session Type Is Important for Matching

Use session type as an important matching signal.

For example:

```text
Lecture : ASD
```

and:

```text
Tutorial : ASD
```

are normally **different logical sessions**.

Do not match them merely because the subject is the same.

However, superficial textual differences do not necessarily indicate a different session.

For example:

```text
Lecture : ASD
```

and:

```text
Cours : ASD
```

may represent the same lecture.

Likewise:

```text
TP : Programming
```

and:

```text
Lab : Programming
```

may represent the same lab when the context confirms this.

---

# 8. Match Sessions Using All Available Evidence

When matching a session from Table A to Table B, consider the combination of:

* subject;
* session type;
* groups;
* teacher;
* classroom;
* day;
* start time;
* surrounding sessions;
* relative timetable structure;
* repeated patterns;
* other contextual information.

Do not rely on only one field when the evidence is ambiguous.

Strong evidence includes:

* same subject;
* same session type;
* same groups;
* same surrounding timetable context;
* same teacher/classroom;
* same position relative to other sessions.

A changed day, time, teacher, or classroom does **not** automatically mean the session is new.

---

# 9. Subject Name Variations

Subject names may appear as:

* abbreviations;
* acronyms;
* full names;
* minor spelling variations;
* different punctuation;
* different capitalization.

Treat obvious equivalents as the same subject when context confirms it.

Examples:

```text
Artificial Intelligence
AI
```

may be the same subject.

```text
Database Management System
DBMS
```

may be the same subject.

```text
Algorithm 1
Algo1
```

may be the same subject.

Do not assume unrelated names are equivalent.

When matching is uncertain, use the strongest available evidence and do not invent a relationship.

---

# 10. Ignore Superficial Differences

Do not report changes caused only by:

* capitalization;
* whitespace;
* line breaks;
* punctuation;
* commas;
* HTML formatting;
* Markdown formatting;
* quotation marks;
* minor spelling mistakes;
* equivalent abbreviations;
* equivalent session-type wording;
* other purely formatting differences.

For example:

```text
Lecture : ASD
```

and:

```text
LECTURE: ASD
```

are normally the same session.

Likewise:

```text
Cours : ASD
```

and:

```text
Lecture : ASD
```

may be the same lecture when the context confirms it.

---

# 11. Groups

Determine which groups are affected by each logical change.

Allowed values are only:

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
```

If the same logical session is shared by several groups and the same change affects all of them, return **one change** containing all groups.

Example:

```text
groupsInvolved: ["G1", "G2", "G3"]
```

Do not return three separate changes.

If every relevant timetable group is affected, use:

```text
groupsInvolved: ["ALL"]
```

Do not use `ALL` together with individual groups.

For example, do not return:

```text
["ALL", "G1"]
```

If the affected group cannot be determined reliably, do not invent a group.

---

# 12. Detecting `ALL`

Use:

```text
groupsInvolved: ["ALL"]
```

when the evidence shows that the logical session affects all relevant timetable groups.

Do not interpret `ALL` as literally one group.

For example, if the timetable contains:

```text
G1
G2
G3
G4
G5
G6
```

and the session is shared by all of them:

```text
groupsInvolved: ["ALL"]
```

represents 6 groups.

---

# 13. Merged Cells and Repeated Sessions

A session may appear multiple times because of:

* merged cells;
* shared groups;
* repeated labels;
* visual formatting;
* duplicated timetable information.

Do not treat repeated representations as separate logical sessions when the context indicates that they are the same session.

For example, if one lecture applies to G1, G2, and G3 and is visually repeated across their timetable cells, return:

```text
groupsInvolved: ["G1", "G2", "G3"]
```

not three separate changes.

---

# 14. Determine the Smallest Meaningful Change

Allowed `changeTarget` values are:

```text
WHOLE_SESSION
TIME
DAY+TIME
CLASSROOM
TEACHER
```

or `null`.

Use the most specific target possible.

### `TIME`

Use when **only the start time changed**.

Example:

```text
from: {
  "startTime": "12H45"
}
to: {
  "startTime": "09H35"
}
```

### `DAY+TIME`

Use whenever the **day changed**.

This includes:

* day only;
* day + time.

Day only:

```text
from: {
  "day": "Wednesday"
}
to: {
  "day": "Tuesday"
}
```

Day + time:

```text
from: {
  "day": "Wednesday",
  "startTime": "12H45"
}
to: {
  "day": "Tuesday",
  "startTime": "09H35"
}
```

There is no standalone `DAY` target.

### `CLASSROOM`

Use when only the classroom changed.

```text
from: {
  "classroom": "158/3"
}
to: {
  "classroom": "204"
}
```

### `TEACHER`

Use when only the teacher changed.

```text
from: {
  "teacher": "Chettat"
}
to: {
  "teacher": "Boudiaf"
}
```

### `WHOLE_SESSION`

Use when:

* a session was added;
* a session was removed;
* a session was replaced;
* the session identity itself changed;
* multiple changed properties cannot be represented by one specific target.

Do **not** use `WHOLE_SESSION` merely because a session has multiple changes.

---

# 15. Multiple Properties Changed

Each logical session should normally produce **one change object**.

Do not create multiple changes for the same session.

For example, if the teacher and classroom both changed:

```text
from: {
  "teacher": "Chettat",
  "classroom": "158/3"
}
to: {
  "teacher": "Boudiaf",
  "classroom": "204"
}
```

use:

```text
changeTarget: "WHOLE_SESSION"
```

Do not create separate `TEACHER` and `CLASSROOM` changes.

Similarly, if several properties changed and no single specific target represents the complete change, use `WHOLE_SESSION`.

---

# 16. `from` and `to`

`from` and `to` may contain only:

```text
teacher
classroom
startTime
day
```

For a modification, include **only fields that actually changed**.

If the teacher did not change, do not include `teacher`.

If the classroom did not change, do not include `classroom`.

If the day did not change, do not include `day`.

If the start time did not change, do not include `startTime`.

Example:

```text
from: {
  "day": "Wednesday",
  "startTime": "12H45"
}
to: {
  "day": "Tuesday",
  "startTime": "09H35"
}
```

Do not include unchanged teacher/classroom information.

---

# 17. Additions

A session is an addition only when there is **no credible matching logical session in Table A**.

For an addition:

```text
from: null
```

and:

```text
to: {
  ...
}
```

Include the available information about the new session:

```text
from: null
to: {
  "teacher": "Chettat",
  "classroom": "158/3",
  "startTime": "09H35",
  "day": "Tuesday"
}
```

Only include information actually present.

Do not invent missing fields.

A session that existed in A but moved, changed teacher, changed classroom, changed time, or changed day is **not an addition**.

---

# 18. Removals

A session is a removal only when there is **no credible matching logical session in Table B**.

For a removal:

```text
from: {
  ...
}
to: null
```

Include only available information.

Example:

```text
from: {
  "teacher": "Chettat",
  "classroom": "158/3",
  "startTime": "12H45",
  "day": "Wednesday"
}
to: null
```

Do not report a removal if the session was simply:

* moved;
* rescheduled;
* changed teacher;
* changed classroom;
* represented differently;
* renamed slightly;
* reformatted.

---

# 19. Never Turn a Move Into an Addition + Removal

This is a critical rule.

If the same logical session can reasonably be matched between A and B, it is **one session**, even when its location in the timetable changed completely.

Example:

Table A:

```text
Wednesday
12H45
Lecture : ASD 1
Chettat
158/3
```

Table B:

```text
Tuesday
09H35
Lecture : ASD 1
Chettat
158/3
```

Correct:

```text
changeTarget: "DAY+TIME"
```

Incorrect:

```text
Removal
+
Addition
```

Always attempt logical session matching before classifying additions or removals.

---

# 20. Slight Session Name Changes

Do not automatically classify a session as added/removed because its textual representation changed.

For example:

```text
Lecture : Artificial Intelligence
```

and:

```text
Lecture : AI
```

may be the same session.

Likewise:

```text
Lecture : ASD 1
```

and:

```text
Cours : ASD 1
```

may be the same session.

Likewise:

```text
TP : Programming
```

and:

```text
Lab : Programming
```

may be the same session.

Use contextual evidence to decide.

If the logical session is clearly the same, report only its meaningful timetable changes.

---

# 21. Subject Title Must Not Contain Session Type

This rule is especially important.

Always separate the session type from the subject.

Examples:

```text
Lecture : ASD 1
```

→

```text
subjectTitle: "ASD 1"
sessionType: "LECTURE"
```

```text
Cours : ASD 1
```

→

```text
subjectTitle: "ASD 1"
sessionType: "LECTURE"
```

```text
TD : ASD 1
```

→

```text
subjectTitle: "ASD 1"
sessionType: "TUTORIAL"
```

```text
TP : ASD 1
```

→

```text
subjectTitle: "ASD 1"
sessionType: "LAB"
```

Never produce:

```text
subjectTitle: "Lecture : ASD 1"
```

or:

```text
subjectTitle: "TD : ASD 1"
```

The type belongs exclusively in `sessionType`.

---

# 22. Session Type May Be Implicit

Do not depend exclusively on explicit words such as:

```text
lecture
cours
tutorial
TD
lab
TP
```

The timetable may communicate the type indirectly.

Use contextual evidence when available.

For example, if:

* all relevant groups share the subject at exactly the same time;
* the timetable's organization clearly identifies shared courses;
* surrounding headers or labels indicate that the session is a course/lecture;

then infer:

```text
sessionType: "LECTURE"
```

when this is strongly supported.

Do not over-infer.

If the evidence is insufficient, use:

```text
sessionType: "NONE"
```

---

# 23. `numOfAllGroupsExistingInTable`

`numOfAllGroupsExistingInTable` is the **largest number of groups actual timetable**.

If the timetable contains G1 through G6:

```text
["ALL"]
```

means:

```text
numOfAllGroupsExistingInTable: 6
```

If the timetable contains G1 through G10:

```text
["ALL"]
```

means:

```text
numOfAllGroupsExistingInTable: 10
```

If there are no meaningful changes:

```text
numOfAllGroupsExistingInTable: ..
changesFromAtoB: []
```

---

# 24. Avoid Duplicate Changes

Each logical session change must appear **only once**.

Do not duplicate changes because:

* the session appears in multiple cells;
* the session affects multiple groups;
* merged cells repeat the session;
* the same information appears in multiple locations;
* the same change can be observed from several cells.

Merge equivalent occurrences.

Example:

If one `LECTURE` for G1, G2, and G3 moved from Wednesday to Tuesday, return one change:

```text
groupsInvolved: ["G1", "G2", "G3"]
```

not three changes.

---

# 25. No Meaningful Change

If Table A and Table B contain the same logical timetable and there are no meaningful changes:

```text
{
  "numOfAllGroupsExistingInTable": ..,
  "changesFromAtoB": []
}
```

Do not report:

* formatting changes;
* capitalization changes;
* whitespace changes;
* punctuation changes;
* equivalent abbreviations;
* equivalent session-type wording;
* harmless spelling differences.

---

# 26. Efficiency and Reasoning

Use a **compact, structured analysis process**.

Internally follow this plan:

1. Identify timetable structure.
2. Extract logical sessions from A.
3. Extract logical sessions from B.
4. Determine subject, session type, groups, day, time, teacher, and classroom.
5. Match A sessions to B sessions.
6. Detect additions and removals only after matching.
7. Compare matched sessions.
8. Create the smallest meaningful change.
9. Merge duplicate/group-equivalent changes.
10. Calculate `numOfAllGroupsExistingInTable`.
11. Validate the final object against the schema.

Do not spend excessive reasoning on obvious cases.

Prefer the **shortest reliable reasoning path**.

Do not repeatedly reconsider a session once the available evidence clearly establishes its identity.

---

# 27. Final Verification

Before returning the result, quickly verify:

1. Both timetable structures were understood.
2. Logical sessions were identified.
3. Subject titles contain **only the subject**, not the session type.
4. Session types are one of:

   * `LECTURE`
   * `TUTORIAL`
   * `LAB`
   * `NONE`
5. Session type was inferred from equivalent terminology such as `cours` when appropriate.
6. Implicit lecture/course evidence was considered when reliable.
7. Sessions were matched before additions/removals were determined.
8. Moved sessions were not turned into additions/removals.
9. Subject acronyms/full names were matched when context supports equivalence.
10. Superficial formatting differences were ignored.
11. Different session types were distinguished when appropriate.
12. Duplicate representations were merged.
13. Changes affecting multiple groups were merged.
14. Each logical session appears at most once.
15. `changeTarget` is valid.
16. `from` and `to` contain only allowed fields.
17. Modified sessions contain only fields that actually changed.
18. Additions use `from: null`.
19. Removals use `to: null`.
20. `numOfAllGroupsExistingInTable` is correct.
21. No information was invented.

---

# 28. Final Output Rules

Return **only** the structured result.

Do not return:

* explanations;
* reasoning;
* comments;
* markdown;
* code fences;
* analysis;
* confidence scores;
* extra properties;
* session identifiers not defined by the schema.

The only top-level properties are:

```text
numOfAllGroupsExistingInTable
changesFromAtoB
```

Each change contains exactly:

```text
groupsInvolved
subjectTitle
sessionType
changeTarget
from
to
```

The final result must conform exactly to the provided Zod schema.

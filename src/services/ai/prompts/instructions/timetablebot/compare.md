# Timetable Comparison

Compare **Table A (old)** and **Table B (new)** and identify all **meaningful changes** between them.

Return the result **strictly according to the provided schema**. Do not return explanations, comments, markdown, or any fields that are not defined by the schema.

Timetables may be **badly designed, inconsistent, incomplete, or completely different in structure**. Do not assume a standard timetable layout, row/column arrangement, cell format, or that every session contains all information.

---

## Core Principle

**Do not compare cells directly. Match logical sessions first, then determine what changed.**

A session that appears in both tables should be treated as the **same logical session** whenever the available evidence strongly indicates that it is the same session, even if:

* Its position changed
* Its day changed
* Its time changed
* Its classroom changed
* Its teacher changed
* The table structure changed
* The session is represented differently between the two tables

A change in one of these properties does **not automatically mean that the old session was removed and a new session was added**.

For example:

```text
Table A:

Wednesday / G1,G2,G3 / 12H45

Lecture : IA
Chettat
158/3
```

```text
Table B:

Tuesday / G1,G2,G3 / 09H35

Lecture : IA
Chettat
158/3
```

This is **one logical session that moved**, not an addition and a removal.

The correct result is one change:

```text
groupsInvolved: ["G1", "G2", "G3"]

sessionTitleInvolved: "Lecture : IA"

changeTarget: "DAY+TIME"

from: {
  day: "Wednesday",
  startTime: "12H45"
}

to: {
  day: "Tuesday",
  startTime: "09H35"
}
```

---

# 1. Understand the Timetable First

Before comparing Table A and Table B, determine the logical meaning of each timetable from its actual contents.

A timetable may have:

* Days as rows
* Days as columns
* Groups as rows
* Groups as columns
* Times as rows
* Times as columns
* Sessions represented inside cells
* Sessions spanning multiple cells
* Merged cells
* Repeated values caused by merged cells
* Extra headers
* Titles
* Notes
* Multiple sections
* Different structures between A and B
* Missing information
* Inconsistent formatting
* Empty cells
* Partial session information

**Never assume that a particular row, column, or position represents a particular field.**

Infer the meaning from the actual timetable contents and surrounding context.

Do not compare the tables purely by their coordinates.

---

# 2. Identify Logical Sessions

A logical session may contain some or all of:

* Session type/title
* Subject
* Groups
* Teacher
* Classroom
* Day
* Start time

A cell may contain information such as:

```text
Lecture : IA
Chettat
158/3
```

or:

```text
Tutorial : IA
Chettat
```

or simply:

```text
IA
```

or:

```text
IA — 158/3
```

Do not require every field to exist.

The absence of a field does not mean that the session is a different session.

---

# 3. `sessionTitleInvolved`

`sessionTitleInvolved` identifies the **full session title/label**, not merely the subject name.

In most timetable cells, the **first line is the primary session title/identifier**.

For example, if a cell contains:

```text
Lecture : IA
Chettat
158/3
```

then:

```text
sessionTitleInvolved: "Lecture : IA"
```

**Do not reduce this to `"IA"`**.

Likewise:

```text
Tutorial : IA
Chettat
158/3
```

must use:

```text
sessionTitleInvolved: "Tutorial : IA"
```

The session type is part of the session identity.

Therefore:

```text
Lecture : IA
```

and:

```text
Tutorial : IA
```

should normally be treated as **different logical sessions**, even though both contain the subject `IA`.

Other examples:

```text
Lecture : Database Management System
```

```text
Tutorial : DBMS
```

```text
TP : Algorithm 1
```

The complete first-line label should be preserved.

If the timetable uses a different structure, identify the first line or equivalent text that most clearly identifies the logical session.

Do not unnecessarily shorten or reconstruct it.

---

# 4. Match Sessions Before Detecting Changes

Try to match sessions between Table A and Table B using **all available evidence**.

Useful evidence includes:

* Full session title
* Session type
* Subject
* Groups
* Teacher
* Classroom
* Day
* Start time
* Relative position
* Surrounding sessions
* Repeated timetable patterns
* Other contextual information

Use the **combination of evidence**, not a single field.

### Important rules

A change of day/time does **not** mean the session is new.

A change of classroom does **not** mean the session is new.

A change of teacher does **not** mean the session is new.

A change of position in the table does **not** mean the session is new.

If enough identifying information matches, treat the sessions as the same logical session and report only the changed fields.

For example:

```text
Table A:

Lecture : IA
Chettat
158/3
```

```text
Table B:

Lecture : IA
Boudiaf
158/3
```

This is a teacher change, not a removal and addition.

Similarly:

```text
Table A:

Lecture : IA
Chettat
158/3
```

```text
Table B:

Lecture : IA
Chettat
204
```

is a classroom change.

---

# 5. Session Matching and Subject Names

Subject names may be represented differently.

Treat obvious full-name/acronym equivalents as the same subject when the surrounding context clearly confirms that they refer to the same session.

Examples:

```text
Artificial Intelligence
```

and:

```text
AI
```

may represent the same subject.

Likewise:

```text
Database Management System
```

and:

```text
DBMS
```

may represent the same subject.

And:

```text
Algorithm 1
```

and:

```text
Algo1
```

may represent the same subject.

However, **do not ignore the session type**.

For example:

```text
Lecture : IA
```

and:

```text
Tutorial : IA
```

should not be considered the same merely because both contain `IA`.

The complete session title, especially the first-line label, is an important matching signal.

---

# 6. Handle Incomplete Sessions

Incomplete sessions are valid.

Examples:

```text
IA
```

```text
IA
Chettat
```

```text
IA
158/3
```

```text
Lecture : IA
Chettat
```

Do not require every session to have:

* Teacher
* Classroom
* Day
* Time
* Groups

before attempting to match it.

Use whatever information is available.

**Never invent missing information.**

If a field is absent, leave it absent.

---

# 7. Ignore Superficial Differences

Do not report a change when the difference is only superficial.

Ignore differences caused only by:

* Case
* Whitespace
* Line breaks
* Punctuation
* Commas
* HTML formatting
* Markdown formatting
* Quoting
* Minor spelling mistakes
* Equivalent formatting
* Other meaningless textual differences

For example:

```text
Lecture : IA
```

and:

```text
LECTURE : IA
```

should normally be considered the same session.

Likewise:

```text
Lecture : IA
```

and:

```text
Lecture: IA
```

should normally be considered the same session.

Do not report formatting differences as timetable changes.

---

# 8. Groups

Determine which timetable groups are logically affected by each session.

If the same logical session applies to multiple groups and the same change affects all of them, create **one change** containing all affected groups.

For example:

```text
groupsInvolved: ["G1", "G2", "G3"]
```

Do not create:

```text
G1 → change
G2 → change
G3 → change
```

when these are actually one shared logical session.

Instead create one change:

```text
groupsInvolved: ["G1", "G2", "G3"]
```

Do not duplicate changes merely because the same session appears in multiple cells due to merged cells or timetable layout.

If every relevant timetable group is affected, use:

```text
groupsInvolved: ["ALL"]
```

Only these group values are allowed:

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

Never invent other group names.

If the group cannot be determined reliably, do not invent one.

---

# 9. Merged Cells and Repeated Information

A timetable may visually repeat the same session because of:

* Merged cells
* Shared sessions
* Group spans
* Formatting
* Repeated labels

Do not interpret repeated representations as multiple logical sessions when the context indicates that they are the same session.

For example, if one session spans G1, G2, and G3 and appears in multiple cells, treat it as one logical session affecting:

```text
["G1", "G2", "G3"]
```

Do not report three separate changes.

---

# 10. Determine the Smallest Meaningful Change

Once a session has been matched between Table A and Table B, identify **only the fields that actually changed**.

Use only these `changeTarget` values:

```text
WHOLE_SESSION
TIME
DAY+TIME
CLASSROOM
TEACHER
```

Do not use any other value.

### `TIME`

Use `TIME` when **only the start time changed**.

Example:

```text
from: {
  startTime: "12H45"
}

to: {
  startTime: "09H35"
}
```

### `DAY+TIME`

Use `DAY+TIME` whenever the **day changes**, whether or not the time also changes.

This includes a day-only change because the schema has no standalone `DAY` target.

Day-only example:

```text
from: {
  day: "Wednesday"
}

to: {
  day: "Tuesday"
}
```

Day and time change:

```text
from: {
  day: "Wednesday",
  startTime: "12H45"
}

to: {
  day: "Tuesday",
  startTime: "09H35"
}
```

### `CLASSROOM`

Use `CLASSROOM` when only the classroom changed.

```text
from: {
  classroom: "158/3"
}

to: {
  classroom: "204"
}
```

### `TEACHER`

Use `TEACHER` when only the teacher changed.

```text
from: {
  teacher: "Chettat"
}

to: {
  teacher: "Boudiaf"
}
```

### `WHOLE_SESSION`

Use `WHOLE_SESSION` only when:

* A session was added
* A session was removed
* A session was replaced
* The change cannot reasonably be represented using `TIME`, `DAY+TIME`, `CLASSROOM`, or `TEACHER`

**Do not use `WHOLE_SESSION` merely because a session has multiple changed properties.**

For example, if teacher and classroom both changed but the logical session is clearly the same, use `WHOLE_SESSION` only if the schema cannot represent that combination more specifically.

---

# 11. Multiple Fields Changed

The schema provides individual targets for:

* `TIME`
* `DAY+TIME`
* `CLASSROOM`
* `TEACHER`
* `WHOLE_SESSION`

When a matched session has changes that cannot be represented by a single specific target, use `WHOLE_SESSION`.

Do not create multiple changes for the same logical session merely because multiple fields changed.

For example, if a session changes both teacher and classroom, do not create:

```text
TEACHER
```

and:

```text
CLASSROOM
```

as two separate changes.

Create one change for that logical session and use:

```text
changeTarget: "WHOLE_SESSION"
```

with only the changed fields in `from` and `to`.

Example:

```text
from: {
  teacher: "Chettat",
  classroom: "158/3"
}

to: {
  teacher: "Boudiaf",
  classroom: "204"
}
```

The same principle applies whenever multiple changed properties cannot be represented by one of the specific targets.

---

# 12. `from` and `to`

`from` and `to` may only contain these fields:

```text
teacher
classroom
startTime
day
```

Do not put `sessionTitleInvolved` inside `from` or `to`.

Do not put `groupsInvolved` inside `from` or `to`.

Do not put any other fields inside `from` or `to`.

### For modifications

**Only include fields that actually changed.**

If the teacher stayed the same, do not include `teacher`.

If the classroom stayed the same, do not include `classroom`.

If the day stayed the same, do not include `day`.

If the time stayed the same, do not include `startTime`.

Example:

```text
from: {
  day: "Wednesday",
  startTime: "12H45"
}

to: {
  day: "Tuesday",
  startTime: "09H35"
}
```

Do not add the unchanged teacher or classroom.

---

# 13. Additions

A session is an addition **only when there is no credible matching logical session in Table A**.

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

The `to` object should contain the available information about the newly added session:

```text
from: null

to: {
  teacher: "Chettat",
  classroom: "158/3",
  startTime: "09H35",
  day: "Tuesday"
}
```

Do not invent fields that are not present.

An addition should not be reported if the session already existed in Table A but merely moved or changed some properties.

---

# 14. Removals

A session is a removal **only when there is no credible matching logical session in Table B**.

For a removal:

```text
from: {
  ...
}

to: null
```

Example:

```text
from: {
  teacher: "Chettat",
  classroom: "158/3",
  startTime: "12H45",
  day: "Wednesday"
}

to: null
```

Do not report a removal if the session was simply moved, renamed slightly, or changed teacher/classroom/time/day.

---

# 15. Do Not Turn Moves Into Additions + Removals

This is one of the most important rules.

If a session can reasonably be matched between A and B, it is the **same logical session**.

For example:

```text
Table A:

Wednesday
12H45
Lecture : IA
Chettat
158/3
```

```text
Table B:

Tuesday
09H35
Lecture : IA
Chettat
158/3
```

Do **not** return:

```text
Removal of Lecture : IA
+
Addition of Lecture : IA
```

Return one change:

```text
changeTarget: "DAY+TIME"
```

with:

```text
from: {
  day: "Wednesday",
  startTime: "12H45"
}

to: {
  day: "Tuesday",
  startTime: "09H35"
}
```

---

# 16. Ambiguous Matching

Do not invent relationships between sessions.

Use the strongest combination of evidence available.

Strong evidence can include:

* Same complete session title
* Same session type
* Same subject
* Same groups
* Same teacher
* Same classroom
* Same surrounding sessions
* Same timetable pattern

Weak evidence includes only one common attribute.

For example, two sessions both named:

```text
IA
```

are not necessarily the same if one is:

```text
Lecture : IA
```

and the other is:

```text
Tutorial : IA
```

Likewise, two sessions having the same teacher alone does not establish that they are the same session.

When matching is uncertain, do not invent a match.

Only match sessions when the combined evidence provides a credible relationship.

---

# 17. Session Titles That Change Slightly

Do not report a session as added/removed merely because its textual representation changed slightly.

For example:

```text
Lecture : Artificial Intelligence
```

and:

```text
Lecture : AI
```

may be the same logical session if the context confirms it.

Similarly:

```text
Lecture: IA
```

and:

```text
Lecture : IA
```

are the same session.

However, preserve the appropriate full session title in `sessionTitleInvolved`.

The session title should generally be the **first-line session label**, including the session type.

Do not reduce:

```text
Lecture : IA
```

to:

```text
IA
```

---

# 18. Changes to Session Titles

A session title may itself change.

Do not automatically interpret every title difference as a new session.

First determine whether the title difference is:

* Formatting only
* Case only
* Punctuation only
* Whitespace only
* Acronym/full-name equivalent
* Minor spelling variation
* Or an actual different session

If the evidence strongly indicates that the logical session is the same, match it and report only the meaningful changed fields.

If the actual session identity changed and cannot be represented by the available specific targets, use:

```text
changeTarget: "WHOLE_SESSION"
```

Never invent a new `changeTarget` for title changes.

---

# 19. `maxNumOfGroups`

`maxNumOfGroups` must represent the **largest number of timetable groups affected by any single logical change**.

Examples:

```text
groupsInvolved: ["G1", "G2", "G3"]
```

means:

```text
maxNumOfGroups: 3
```

If the largest change affects:

```text
["G1", "G2", "G3", "G4"]
```

then:

```text
maxNumOfGroups: 4
```

If a change uses:

```text
["ALL"]
```

do **not** count `ALL` as one group.

Instead, determine how many actual timetable groups `ALL` represents from the timetable.

For example, if the timetable contains G1 through G6:

```text
groupsInvolved: ["ALL"]
```

means:

```text
maxNumOfGroups: 6
```

If the timetable contains G1 through G10:

```text
groupsInvolved: ["ALL"]
```

means:

```text
maxNumOfGroups: 10
```

If there are no meaningful changes:

```text
maxNumOfGroups: 0
```

and:

```text
changesFromAtoB: []
```

---

# 20. Avoid Duplicate Changes

Each logical session change must appear **only once**.

Do not duplicate a change because:

* The session appears in multiple cells
* The session affects multiple groups
* The timetable contains merged cells
* The same information is repeated
* The same change can be observed from multiple positions

Merge all equivalent occurrences into one logical change.

For example, if the same `Lecture : IA` session moves for G1, G2, and G3, return:

```text
groupsInvolved: ["G1", "G2", "G3"]
```

not three separate changes.

---

# 21. Final Verification

Before producing the final result, perform a complete verification.

Check the entire timetable and:

1. Understand the structure of both tables.
2. Identify logical sessions.
3. Identify the full first-line session title for each session where available.
4. Match sessions across A and B using all available evidence.
5. Re-check sessions that moved position.
6. Re-check sessions whose day changed.
7. Re-check sessions whose time changed.
8. Re-check sessions whose classroom changed.
9. Re-check sessions whose teacher changed.
10. Check for genuine additions.
11. Check for genuine removals.
12. Do not turn moved sessions into additions/removals.
13. Ignore superficial formatting differences.
14. Treat obvious acronym/full-name equivalents as the same when context confirms them.
15. Distinguish different session types such as `Lecture`, `Tutorial`, `TP`, `TD`, etc.
16. Merge duplicate representations caused by merged cells.
17. Merge changes affecting multiple groups into one change.
18. Ensure every logical session change appears only once.
19. Ensure `sessionTitleInvolved` identifies the full logical session title, preferably the first line of the cell.
20. Ensure `changeTarget` is one of the allowed enum values.
21. Ensure `from` and `to` contain only allowed fields.
22. Ensure modified sessions include **only fields that actually changed** in `from` and `to`.
23. Ensure additions use `from: null`.
24. Ensure removals use `to: null`.
25. Calculate `maxNumOfGroups` correctly.
26. If there are no meaningful changes, return an empty `changesFromAtoB` array and `maxNumOfGroups: 0`.

---

# 22. Output Requirements

The output must conform **exactly** to the provided schema.

Allowed top-level fields:

```text
maxNumOfGroups
changesFromAtoB
```

Each change must contain:

```text
groupsInvolved
sessionTitleInvolved
changeTarget
from
to
```

`groupsInvolved` may contain only:

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

`changeTarget` may contain only:

```text
WHOLE_SESSION
TIME
DAY+TIME
CLASSROOM
TEACHER
```

or `null` when appropriate.

`from` and `to` may contain only:

```text
teacher
classroom
startTime
day
```

or be `null`.

Do not output any additional properties.

Do not output explanations.

Do not output markdown.

Do not output comments.

Do not output reasoning.

Return only the structured result expected by the schema.

---

# Important Rule

**Always match the same logical session across Table A and Table B before deciding whether it was added, removed, or modified.**

A session changing its **day, time, classroom, or teacher is still the same logical session** when the available evidence indicates that it is the same session.

**The first line of a timetable session is normally its full session title/identifier. Preserve that complete title in `sessionTitleInvolved`, including the session type.**

For example:

```text
Lecture : IA
```

should be identified as:

```text
sessionTitleInvolved: "Lecture : IA"
```

**not**:

```text
sessionTitleInvolved: "IA"
```

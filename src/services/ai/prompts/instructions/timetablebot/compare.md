## Timetable Comparison

Compare **Table A (old)** and **Table B (new)** and identify all meaningful changes. Return the result using the provided schema.

Timetables may be **badly designed, inconsistent, incomplete, or completely different in structure**. Do not assume any standard layout, row/column arrangement, or that every session has all information.

### Core principle

**Do not compare cells directly. Match logical sessions first, then determine what changed.**

A session that appears in both tables should be treated as the **same session** whenever the available evidence strongly indicates that it is the same, even if its position changed.

For example:

```text
Table A:
Wednesday / G1,G2,G3 / 12H45 = IA — Chettat — 158/3

Table B:
Tuesday / G1,G2,G3 / 09H35 = IA — Chettat — 158/3
```

This is **one session that moved**, not an addition and a removal.

The result should therefore describe only the changed information:

```text
subjectInvolved: "IA"
groupsInvolved: ["G1", "G2", "G3"]
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

### 1. Understand the timetable

Before comparing, determine the logical meaning of the tables from their actual contents.

A timetable can have:

* Arbitrary row/column layouts
* Different dimensions between A and B
* Reordered days or groups
* Merged cells
* Repeated values caused by merged cells
* Extra headers or titles
* Missing information
* Inconsistent formatting
* Multiple different timetable designs

Never assume that a particular row or column represents a specific field.

### 2. Match sessions before detecting changes

Try to match sessions between A and B using **all available evidence**, such as:

* Subject
* Groups
* Teacher
* Classroom
* Day
* Time
* Surrounding timetable context

**A change of day/time does NOT mean the session is new.**

**A change of classroom does NOT mean the session is new.**

**A change of teacher does NOT mean the session is new.**

If enough identifying information matches, assume it is the same logical session and report the changed field(s).

Only treat something as an addition/removal when there is no credible matching session in the other timetable.

### 3. Determine the smallest meaningful change

Once a session has been matched, identify exactly which fields changed.

Do not use `WHOLE_SESSION` merely because a session has changed.

Use:

* `DAY+TIME` when day and/or start time changed.
* `CLASSROOM` when only the classroom changed.
* `CLASSROOM+DAY+TIME` when classroom and day/time changed.
* `TEACHER` when only the teacher changed.
* `WHOLE_SESSION` only when the actual session was added, removed, or replaced in a way that cannot be represented by the other targets.

### 4. `from` and `to`

**Only include fields that actually changed.**

Never repeat unchanged fields.

Example:

```text
from: {
  startTime: "12H45",
  day: "Wednesday"
}

to: {
  startTime: "09H35",
  day: "Tuesday"
}
```

Do NOT include teacher or classroom if they stayed the same.

For an addition:

```text
from: null
to: {
  teacher: "Chettat",
  classroom: "158/3",
  startTime: "09H35",
  day: "Tuesday"
}
```

For a removal:

```text
from: {
  teacher: "Chettat",
  classroom: "158/3",
  startTime: "12H45",
  day: "Wednesday"
}
to: null
```

### 5. Incomplete sessions are valid

A timetable may contain:

```text
IA
```

or:

```text
IA — Chettat
```

or:

```text
IA — 158/3
```

or any other incomplete representation.

Do not require every field to exist before matching sessions.

Never invent missing information.

### 6. Ignore superficial differences

Do not report changes caused only by:

* Case differences
* Whitespace
* Line breaks
* Added/removed commas
* Punctuation
* HTML/formatting
* Quoting
* Minor spelling mistakes
* Other meaningless textual differences

Also consider an obvious **subject full name ↔ acronym** to be the same subject.

Examples:

```text
Artificial Intelligence ↔ AI
Database Management System ↔ DBMS
Algorithm 1 ↔ Algo1
```

Do not report such differences as session changes when the context clearly indicates they refer to the same subject.

### 7. Groups

Determine the groups logically affected by the session.

If the same change applies to several groups, create **one change** containing all those groups.

If every group is affected, use:

```text
["ALL"]
```

Do not create separate changes for each cell of a merged or shared session.

### 8. Additions and removals

A session is an **addition** only when no credible matching session exists in Table A.

A session is a **removal** only when no credible matching session exists in Table B.

Do not represent a moved session as an addition + removal.

### 9. Ambiguity

Do not invent relationships between sessions.

When matching is uncertain, use the strongest evidence available from subject, groups, teacher, classroom, day, time, and surrounding context.

Do not assume two sessions are identical just because they share one weak attribute.


### 10. Final verification

After the initial comparison:

1. Check the entire timetable.
2. Match moved sessions again.
3. Check for additions.
4. Check for removals.
5. Check teacher changes.
6. Check classroom changes.
7. Check day/time changes.
8. Remove superficial differences.
9. Merge duplicate changes.
10. Make sure each logical session change appears only once.
11. Make sure `from` and `to` contain **only changed fields**.
12. Must fill maxNumOfGroups with how many timetable Groups it mentions.

If there are no meaningful changes, return an empty `changesFromAtoB` array.

**Most important rule: Match the same logical session across A and B before deciding whether it was added, removed, or modified. A session changing its day/time/classroom/teacher is still the same session unless the evidence shows otherwise.**

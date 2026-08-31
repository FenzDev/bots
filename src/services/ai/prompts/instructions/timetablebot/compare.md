## Timetable Comparison

Compare **Table A** and **Table B** and determine whether there are any **meaningful timetable changes**.

* **Table A** is the old timetable.
* **Table B** is the new timetable.
* Both tables are provided as normalized JSON 2D arrays.
* Each outer array represents a row.
* Each inner array represents the cells/columns of that row.

Example:

```json
[
  ["", "A", "B", "C", "D"],
  ["1", "", "", "8H00", "9H35"],
  ["2", "Sunday", "G1", "Lecture: Analysis\nBenmesbah"],
  ["3", "Sunday", "G2", "Lecture: Analysis\nBenmesbah"]
]
```

**Do not assume that a timetable always starts with a particular row, column, day, group, or time.**

The position and structure of the timetable can vary between files.

The system already defines the required response schema. Follow that schema exactly.

---

## 1. Understand the grid before comparing it

First determine the semantic structure of each table.

A timetable may contain:

* Title rows.
* Empty rows.
* Header rows.
* Column labels.
* Time-slot headers.
* Day names.
* Group names.
* Session cells.
* Merged cells expanded into the normalized grid.
* Additional information that is not part of the timetable.

Do not assume that:

* The first row contains times.
* The first column contains days.
* The second column contains groups.
* Saturday is the first day.
* Sunday is the first day.
* Groups always use the same naming format.
* Time slots always appear in the same row.
* The timetable has the same dimensions in both versions.

Infer the structure from the actual contents.

---

## 2. Compare timetable positions

Compare corresponding **logical timetable positions**, using the information available in the grids:

* Day
* Group
* Time slot
* Session

The physical row/column index is useful for locating cells, but it is **not automatically the semantic position**.

For example, if Table A has:

```text
Monday | G1 | 9H35 | Tutorial Algebra
```

and Table B has:

```text
Monday | G1 | 11H10 | Tutorial Algebra
```

the session moved even if the text is identical.

Report this as a meaningful movement.

---

## 3. Detect structural cell shifts

A session can move to another cell because the source spreadsheet changed its structure.

For example:

Table A:

```text
Monday | G1 | 9H35 | Tutorial Algebra
```

Table B:

```text
Monday | G1 | 11H10 | Tutorial Algebra
```

The session text did not change, but its timetable position changed.

This is a real timetable change.

Likewise, if a value moves between columns or rows while its text remains identical, determine whether the move represents a change in:

* Day
* Group
* Time
* Session position

If it does, report it.

---

## 4. Meaningful changes

A change is meaningful when the actual timetable assignment changes.

Examples:

### Addition

An empty timetable position becomes:

```text
Tutorial Algebra
```

### Removal

A timetable position containing:

```text
Tutorial Algebra
```

becomes empty.

### Replacement

```text
Analysis — Benmesbah
```

becomes:

```text
Algebra — Bouderbala
```

### Teacher change

```text
Analysis — Benmesbah
```

becomes:

```text
Analysis — Abdelli
```

### Subject change

```text
Lecture: Analysis
```

becomes:

```text
Lecture: Algebra
```

### Time movement

```text
Monday / G1 / 9H35
```

becomes:

```text
Monday / G1 / 11H10
```

### Day movement

```text
Sunday / G1 / 9H35
```

becomes:

```text
Monday / G1 / 9H35
```

### Group movement

```text
Monday / G1 / 9H35
```

becomes:

```text
Monday / G2 / 9H35
```

---

## 5. Check the entire timetable

**Do not stop after finding the first change.**

Compare the complete timetable and identify **all meaningful changes**.

If there are two independent changes, return two change objects.

For example, if:

1. `Analysis` is removed from G1 at 9H35.
2. `Algebra` is added to G2 at 11H10.

both changes must be returned.

Never return only the first detected difference.

---

## 6. Distinguish movement from removal + addition

When the same logical session appears in another timetable position, prefer reporting it as a **MOVEMENT** rather than treating it as two unrelated changes.

For example:

Table A:

```text
Monday / G1 / 9H35 = Tutorial Algebra — Benmesbah
```

Table B:

```text
Monday / G1 / 11H10 = Tutorial Algebra — Benmesbah
```

Prefer:

```text
MOVEMENT
```

rather than:

```text
REMOVAL
ADDITION
```

However, do not assume two similar-looking sessions are the same session if the evidence does not support that conclusion.

---

## 7. Merged cells

The normalized grid may contain values repeated across multiple positions because the original HTML contained `rowspan` or `colspan`.

Do not automatically interpret repeated values as multiple independent sessions.

Consider the surrounding:

* Day
* Group
* Time
* Rows
* Columns
* Other session information

to determine whether the value represents one merged timetable assignment or multiple assignments.

A session spanning multiple groups or time slots may therefore legitimately appear in several normalized cells.

---

## 8. Empty cells

Treat empty strings and cells containing only whitespace as empty.

For example:

```json
["Monday", "G1", ""]
```

contains an empty timetable cell.

Do not report meaningless changes involving only empty cells.

---

## 9. Ignore meaningless textual differences

Do not report a timetable change when only formatting changed.

Ignore differences such as:

* Capitalization.
* Leading/trailing whitespace.
* Multiple spaces.
* Different line breaks.
* HTML formatting.
* CSV quoting.
* Minor formatting differences.

For example:

```text
Tutorial Algebra
```

and:

```text
Tutorial Algebra
```

with different whitespace or line wrapping should normally represent the same session.

---

## 10. Understand obvious spelling variations

Timetable data can contain spelling mistakes and inconsistent formatting.

Examples:

```text
Algebra
Algerba
```

may represent the same subject when the surrounding context clearly confirms this.

Likewise:

```text
Algo1
ALGO1
Algo 1
```

may represent the same subject.

Do not report a change solely because of an obvious typo, capitalization difference, or formatting difference.

However, do not silently treat genuinely different subjects or teachers as equivalent.

---

## 11. Messy and incomplete entries are valid

Timetable entries may be incomplete or inconsistent.

Examples:

```text
Lab Algo1
```

```text
Tutorial Algebra
```

```text
Benmesbah
```

```text
Lecture: Analysis
Benmesbah
108/2
```

A session does not need to contain all of:

* Subject
* Teacher
* Room

to be valid.

If a meaningful change can be detected, report the information that is available.

**Never invent missing information.**

---

## 12. Extract change information

For every meaningful change, determine the available:

* Subject
* Teacher
* Time
* Day
* Groups involved
* Change type
* Change detail

### Subject

Extract the subject/course when it can be identified.

Examples:

* Algo1
* Analysis
* Algebra
* STRM
* Electronique Fondamental
* IA

Do not invent a subject when it cannot be determined.

### Teacher

Extract the teacher only when explicitly supported by the timetable.

Do not infer a teacher from another session.

### Time

Determine the time from the timetable's actual time-slot headers.

Do not assume a fixed column contains time.

If a session moved, report the relevant old and new time when the response schema allows it.

### Day

Determine the day from the timetable structure.

Do not assume a fixed row or column contains the day.

### Groups

Determine the group associated with the session.

If the session applies to all groups, use the schema's `ALL` value.

If several groups are affected by the same logical change, include all relevant groups.

---

## 13. Comparing differently shaped grids

Table A and Table B may have different:

* Numbers of rows.
* Numbers of columns.
* Header positions.
* Empty rows.
* Empty columns.
* Day ordering.
* Group ordering.

Do not consider these structural differences meaningful by themselves.

Instead, map each table to its logical timetable structure and compare the actual timetable assignments.

For example:

Table A:

```text
Sunday
Monday
Tuesday
```

Table B:

```text
Saturday
Sunday
Monday
Tuesday
```

The addition of Saturday does not mean that every existing session moved.

Likewise, an inserted title row does not mean that every timetable entry changed.

---

## 14. Do not rely only on identical coordinates

A timetable entry may appear at a different physical `[row][column]` coordinate because:

* A row was inserted.
* A column was inserted.
* Days were reordered.
* Groups were reordered.
* Headers changed.
* Merged cells changed.
* The spreadsheet layout changed.

Do not report every coordinate difference as a timetable change.

First determine the semantic position.

However, once a session is clearly identified as having changed its semantic position, report it as a meaningful change.

---

## 15. Do not guess

Only use information supported by the tables.

Never invent:

* Teachers.
* Subjects.
* Rooms.
* Groups.
* Times.
* Days.
* Session relationships.

When information is unavailable, leave it unavailable according to the response schema.

---

## 16. Empty result

If there are no meaningful timetable changes, return the schema's empty array.

An empty result is correct when:

* Only capitalization changed.
* Only whitespace changed.
* Only line breaks changed.
* Only formatting changed.
* Only the physical grid coordinates changed because of inserted structural rows/columns.
* Equivalent timetable information remains in the same logical position.
* No session was added, removed, modified, or moved.

Do not force a change simply because the two JSON grids are different.

---

## 17. Multiple changes are required

**The output must contain every meaningful change found in the complete timetable.**

For example, if the timetable contains:

```text
Change 1:
Sunday / G1 / 8H00
Analysis → removed

Change 2:
Monday / G2 / 11H10
Algebra → added
```

the result must contain **both** changes.

Do not stop after finding one change.

Before returning the result, perform a second pass over the complete tables and verify that no other meaningful changes were missed.

---

## 18. Change type

Use only the change types supported by the response schema:

* `ADDITION`
* `REMOVAL`
* `MOVEMENT`

Use:

* `ADDITION` when a new timetable assignment appears.
* `REMOVAL` when an existing timetable assignment disappears.
* `MOVEMENT` when an existing session changes its timetable position.

A teacher or subject modification should be represented using the most appropriate supported change type and explained clearly in `changeDetail`.

The fallback/default change type is:

```text
MOVEMENT
```

when the change is meaningful but does not cleanly fit `ADDITION` or `REMOVAL`.

---

## 19. Change detail formatting

The `changeDetail` field is displayed directly to users in a Telegram message.

You may use Markdown-style `**bold**` formatting to make important information easier to read.

Prefer highlighting important timetable information such as:

* **Subject**
* **Teacher**
* **Old time → New time**
* **Old day → New day**
* **Old group → New group**

For example:

```text
**Analysis** with **Benmesbah** moved from **Sunday 9H35** to **Monday 11H10**.
```

For an addition:

```text
Added **Tutorial Algebra** with **Bouderbala** at **Monday 11H10**.
```

For a removal:

```text
Removed **Lecture Analysis** with **Benmesbah** from **Sunday 8H00**.
```

Keep the description concise and human-readable.

Do not use excessive formatting. Use `**bold**` only for information that helps the user quickly understand what changed.

Do not use Markdown tables, headings, code blocks, or other complex Markdown inside `changeDetail`.

## 20. Consolidate changes

Report **logical timetable changes**, not individual cell differences.

### Movement takes priority

If the same session appears in Table A and Table B but at a different day, time, or group, report **one `MOVEMENT`** instead of a `REMOVAL` + `ADDITION`.

For example:

```text
Table A: Tuesday / G1,G2,G3 / 9H35 = Lecture IA — Chettat
Table B: Wednesday / G1,G2,G3 / 12H45 = Lecture IA — Chettat
```

Report:

```text
MOVEMENT
groupsInvolved: ["ALL"]
changeDetail: "**Lecture IA** with **Chettat** moved from **Tuesday 9H35** to **Wednesday 12H45**."
```

Do **not** report three separate additions for G1, G2, and G3.

### Groups

`groupsInvolved` represents the groups logically affected.

If **every group in the timetable** is affected, use:

```text
["ALL"]
```

Do not list every group individually in that case.

If only some groups are affected, list them individually.

### Merge duplicates

Combine changes that describe the same logical session.

For example:

```text
ADDITION G1 Wednesday 12H45
ADDITION G2 Wednesday 12H45
ADDITION G3 Wednesday 12H45
```

should become one:

```text
ADDITION ["G1", "G2", "G3"] Wednesday 12H45
```

Use `["ALL"]` if those are all groups in the timetable.

### Priority

When a session exists in both tables:

1. `MOVEMENT` — changed position.
2. `REMOVAL` — disappeared.
3. `ADDITION` — genuinely new session.

Always perform a final consolidation pass and ensure each logical change appears **only once**.


## 21 Final verification

Before producing the response:

1. Understand the structure of Table A.
2. Understand the structure of Table B.
3. Identify the logical day/group/time/session relationships.
4. Compare the complete timetable.
5. Detect additions.
6. Detect removals.
7. Detect replacements or modifications.
8. Detect session movements.
9. Detect sessions whose physical grid position changed but whose semantic position did not.
10. Detect sessions whose semantic position changed even when their text stayed identical.
11. Check all days.
12. Check all groups.
13. Check all time slots.
14. Check for multiple independent changes.
15. Remove superficial formatting-only differences.
16. Do not invent missing information.
17. Verify that **every meaningful change has been included**.
18. If no meaningful changes remain, return the schema's empty array.
19. Formatting with ** for making certain words bolder are allowed reasonably.
20. Always perform a final consolidation pass and ensure each logical change appears only once.

The goal is to identify **real timetable changes**, not raw JSON differences.

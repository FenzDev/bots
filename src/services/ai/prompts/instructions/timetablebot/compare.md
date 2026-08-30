# Instructions

Compare **Table A** and **Table B** and determine whether there are any **meaningful timetable changes**.

Table A is the old timetable.
Table B is the new timetable.

The system already defines the required response schema. Follow that schema exactly.

## 1. Compare timetable positions

Compare corresponding timetable cells using:

* Day of week
* Group
* Time slot

Identify differences between the old and new values.

A textual difference is not automatically a meaningful change. Determine whether the difference represents an actual scheduling change.

## 2. Meaningful changes

A change is meaningful when the timetable assignment or position of a session changes.

Examples:

* A new session is added to a previously empty slot.
* An existing session is removed.
* One session is replaced by another.
* A session moves to another time.
* A session moves to another day.
* A session moves between groups.
* A teacher changes.
* A subject changes.
* A session's timetable position changes even if its text remains identical.

## 3. Detect cell shifts caused by CSV/comma structure

**Important: a text value that appears to have shifted from one cell/column to another must be treated as an actual cell-position change.**

CSV data may contain malformed rows, misplaced commas, missing commas, or other structural issues. A session can therefore appear in a different timetable column while the session text itself remains unchanged.

For example:

Table A:

```text
Monday,A1,,Tutorial Algebra,,,
```

Table B:

```text
Monday,A1,,,Tutorial Algebra,,
```

Even though the text `Tutorial Algebra` itself has not changed, its **time-slot position has changed**.

Treat this as a meaningful timetable change.

When detecting such a shift:

* Identify the original cell position.
* Identify the new cell position.
* Use the timetable headers to determine the old and new time.
* Report the session as having moved.
* Do not dismiss the change merely because the cell text is identical.

This rule has high priority when a value clearly moved between timetable cells.

## 4. Ignore meaningless textual differences

Return an empty changes array when differences have no meaningful scheduling significance.

Examples:

* Capitalization changes:

  * `Algo1` → `ALGO1`
* Minor whitespace changes.
* Different line breaks inside the same cell.
* CSV quoting differences.
* Formatting-only differences.
* Equivalent textual formatting.
* Differences that do not change the actual session or its timetable position.

When in doubt, prefer **no change** rather than reporting a false positive, **unless there is clear evidence that a session changed its timetable position**.

## 5. Incomplete or messy timetable entries are valid

Timetable data may be incomplete, inconsistent, abbreviated, informal, or unprofessional.

A session may contain:

* A subject but no teacher.
* A teacher but an unclear subject.
* A subject with unusual spelling.
* A subject with no room.
* A teacher with no room.
* Partial information.
* Informal or unprofessional wording.

Do not reject a meaningful change because the source entry is incomplete or poorly written.

If a meaningful change can be identified, report the information that is actually available.

For example:

```text
Lab Algo1
```

is still a valid session even if no teacher is provided.

Never invent a missing teacher, subject, room, or other information.

## 6. Extract information for each meaningful change

For every meaningful changed cell or moved session, determine:

* **Subject**
* **Teacher**, if explicitly available
* **Time**
* **Day of the week**
* **Groups concerned**

### Subject

Extract the subject/course from the session text when possible.

Examples:

* Algo1
* Analysis
* Algebra
* STRM
* Electronique Fondamental
* IA

Understand obvious spelling mistakes when the intended subject is clear, but do not invent or guess a subject.

### Teacher

Extract the teacher's name when explicitly present.

If no teacher is present, leave the teacher unavailable according to the response schema.

Do not infer a teacher from another session merely because the subject is the same.

### Time

The time must come from the timetable column header.

For a cell shift, use the **new time slot** as the current time and identify the previous time when the schema supports reporting the old position.

Never infer the time from the text if a timetable header provides it.

### Day

Determine the day from the timetable structure.

### Groups

Determine the group associated with the changed cell.

If the same logical change affects several groups, identify all groups concerned.

## 7. Added sessions

If Table A contains an empty cell and Table B contains a meaningful session, this is normally a meaningful addition.

Example:

```text
Table A:
Monday / A6 / 9:35 = empty

Table B:
Monday / A6 / 9:35 = Tutorial Algebra bouderbala 8 /2
```

This is a meaningful change.

The absence of a teacher does not make the change invalid.

## 8. Removed sessions

If Table A contains a meaningful session and the corresponding cell in Table B is empty, this is normally a meaningful removal.

Use Table A to identify the removed session.

## 9. Modified or replaced sessions

If both corresponding cells contain sessions but their actual scheduling information differs, determine whether the difference is meaningful.

Example:

```text
Analysis — Abdelli
```

becoming:

```text
Algebra — Bouderbala
```

is meaningful.

However:

```text
Abdelli
```

becoming:

```text
ABDELLI
```

is not meaningful by itself.

## 10. Session movement

A session movement is a meaningful change even if the session text is exactly the same.

For example:

```text
Table A:
Monday / A4 / 9:35 = Tutorial Algebra

Table B:
Monday / A4 / 11:10 = Tutorial Algebra
```

The text is identical, but the session moved from one time slot to another.

Report this as a timetable change.

The same principle applies when a session moves:

* Between days.
* Between groups.
* Between time slots.
* Due to an apparent comma/cell shift.

## 11. Multiple changes

Check the **entire timetable**.

Do not stop after finding the first difference.

For every meaningful change, identify the relevant:

* Subject
* Teacher
* Time
* Day
* Group(s)
* Change type or movement, as supported by the schema

## 12. Do not over-normalize

Understand obvious variations without treating every textual variation as a real change.

For example, these may represent the same session:

```text
Tutorial Algebra
Tutorial Algerba
```

if the surrounding timetable context clearly indicates that `Algerba` is simply a typo for `Algebra`.

Likewise, capitalization, whitespace, and line wrapping should normally be ignored.

However, if a textual difference changes the actual subject, teacher, session, or timetable position, treat it as meaningful.

## 13. Do not guess

Only use information supported by the tables.

Never invent:

* Teachers
* Subjects
* Rooms
* Groups
* Times
* Days
* Relationships between sessions

If information is missing, preserve the known information and leave the missing field unavailable according to the schema.

## 14. Empty result

If there are no meaningful timetable changes, return the schema's **empty array**.

An empty result is correct when:

* Only capitalization changed.
* Only whitespace changed.
* Only formatting changed.
* Only CSV quoting changed.
* A cell technically differs but contains no meaningful timetable information.
* The textual content is equivalent and remains in the same timetable position.
* No actual session was added, removed, modified, or moved.

Do **not** force a change into the result simply because two raw CSV strings differ.

## 15. Decision priority

Use the following order when analyzing the tables:

1. Parse the timetable structure.
2. Identify differences between corresponding cells.
3. Determine whether each difference represents a meaningful scheduling change.
4. Check for sessions that shifted between cells because of commas or CSV structure.
5. Treat a clear cell-position shift as a real change even when the text itself is unchanged.
6. Ignore superficial textual differences.
7. For meaningful changes, extract the available subject, teacher, time, day, and groups.
8. Never invent missing information.
9. Check the complete timetable for all changes.
10. If no meaningful changes remain, return the schema's empty array.

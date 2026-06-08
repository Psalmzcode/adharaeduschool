# Module Scoring & Retakes (CBT + Practical)

This document summarizes the **module scoring, advancement, retake, and anti-cheat controls** added to the project.

## Core rules (current behavior)

### 1) Class progression (class-based learning)
- The **entire class advances together** when the tutor clicks **Advance Class Module**.
- Students who fail **do not** hold the class back; they move forward with everyone.

### 2) Module completion rule (per student)
For a **STANDARD module** (not a term exam):

- A student is **COMPLETED** only if:
  - **Module CBT quiz ≥ 50%**, **AND**
  - **Module Practical ≥ 50%**
- Otherwise, the student is marked **FAILED** for that module.

> **Termly assessments** (`TERM_EXAM`) are optional per school term and are **not** required for certificates.  
> **Track Completion Exam** (`TRACK_COMPLETION_EXAM`) is required for certificate eligibility (best attempt ≥ 50%) after all standard modules are complete.  
> Neither exam type clears individual standard module failures.

### 3) Mark Result (module score stored for reporting)
The system stores a single module score in `ModuleProgress.score` as a composite for reporting:

\[
\text{ModuleScore}=\mathrm{round}\left(\frac{\text{bestModuleCBT}+\text{bestModulePractical}}{2}\right)
\]

**Tutor “Mark Results” suggested column** (prefill only): if only one side exists yet, the suggestion uses that score so the row is not blank; when both exist, the average above is used. **Advance / retake “both ≥ 50%”** rules are unchanged.

This composite is used for:
- auto-fill suggestions on tutor “Mark Results”
- stored module score when advancing a class
- stored module score when clearing a failed module (retake)

## Tutor workflow (what tutors do)

### A) Practical grading
Tutors grade practicals from:
- **Tutor dashboard → Practical Assessments (🧪) → Submissions & Grading**

### B) Module results / advancement
Tutors use:
- **Tutor dashboard → Mark Results**
  - Scores are auto-filled from CBT+Practical composite (tutor can override)
  - Tutor clicks **Advance Class Module** to move everyone forward

### C) Retake clearing (FAILED → COMPLETED)
Tutors use:
- **Tutor dashboard → Mark Results → “Module retake (CBT + Practical)” panel**
  - Select student
  - Select failed module
  - **Check retake** (shows best CBT + best practical)
  - **Clear failed module** (only enabled when both ≥ 50%)

### D) Optional scenario data (outside `seed.ts`)
For **end-to-end testing** of Mark Results, **Advance Class Module**, and **module retake** without hand-crafting 20 students:

- **Script**: `backend/backend/scripts/scenario-module-retake-advance.ts`
- **What it does**: Ensures Crown Heights (`CHR`) exists from seed, then creates **class `SS3B`** (full name in the DB), tutor assignment, **20 scenario students** named **Scenario Student1 … Student20** (Track 3 · module 1), graded **CBT attempts**, **practical submissions**, homework rows, and mixed scores so **four students fail** the CBT+practical rule after advance (others pass).
- **Prerequisites**: `pnpm prisma migrate deploy` and a normal **`pnpm prisma:seed`** (modules + school + demo tutor).
- **Run** (from `backend/backend`):

```bash
pnpm exec ts-node scripts/scenario-module-retake-advance.ts
```

- **Tutor**: `tutor@adharaedu.com` — in the dashboard choose class **`SS3B`**, then **Mark Results** and the retake panel.
- **Scenario students**: usernames `chr.ss3b.01` … `chr.ss3b.20`, password and registration numbers are documented in the **header comment** of that script.

This script is **not** part of `prisma/seed.ts`; run it only when you want the SS3B scenario on top of the default seed.

## Student workflow (what students do)

### Practical retakes
Students can **re-submit the same practical task** (multiple attempts are now supported). The system uses the **best** graded practical score for module calculations.

### CBT retakes
CBT scoring is automatic; attempt limits are enforced for **scheduled** exams (see anti-cheat section).

## What changed in the system (implementation)

## 1) Practical retake attempts (multiple submissions)

### Database
`PracticalSubmission` now supports multiple attempts per student per task:
- Added `attempt Int @default(1)`
- Unique constraint changed from:
  - `@@unique([taskId, studentId])`
  - to `@@unique([taskId, studentId, attempt])`

Migration:
- `backend/backend/prisma/migrations/20260420123000_practical_multiple_submissions/migration.sql`

### Backend behavior
`POST /practicals/tasks/:id/submit`
- Now **creates a new PracticalSubmission** each time, incrementing `attempt`.

Student tasks listing:
- Student view uses latest submission as the displayed `submission`.

Files:
- `backend/backend/prisma/schema.prisma`
- `backend/backend/src/practicals/practicals.service.ts`

### Frontend UI
Tutor practical submissions table now displays **Attempt #** in:
- **Tutor dashboard → Practical Assessments → Submissions & Grading**

File:
- `frontend/src/app/dashboard/tutor/page.tsx`

## 2) Retake rule enforcement + endpoints (CBT + Practical)

### Backend endpoints (Modules)
- **Retake status**:
  - `GET /modules/retake-status?studentId=...&moduleId=...&passMark=50`
- **Apply retake (clear FAILED)**:
  - `PATCH /modules/retake/:studentId/:moduleId` (optional body `{ passMark: 50 }`)

Behavior:
- Applies only to **standard modules** (rejects term exams).
- Tutor authorization:
  - Tutor must be **actively assigned** to the student’s class (or Super Admin).

Files:
- `backend/backend/src/modules/modules.service.ts`
- `backend/backend/src/modules/modules.controller.ts`

### Frontend API helpers
- `modulesApi.retakeStatus(studentId, moduleId, passMark?)`
- `modulesApi.applyRetake(studentId, moduleId, passMark?)`

File:
- `frontend/src/lib/api.ts`

## 3) Auto-fill “Mark Results” from CBT + Practical composite

### Backend endpoint
- **Suggested scores**:
  - `GET /modules/class-progress/suggested-scores?schoolId=...&className=...&moduleId=...&passMark=50`

Returns per-student:
- best CBT score + pass/fail
- best practical score + pass/fail
- compositeScore
- ready (both passed)

Files:
- `backend/backend/src/modules/modules.service.ts`
- `backend/backend/src/modules/modules.controller.ts`

### Frontend behavior (Tutor “Mark Results”)
- When viewing the current module:
  - The app fetches suggested composites and fills empty score inputs.
  - Existing/manual entries are preserved.

#### How the number gets into the field (end-to-end)

1. **Data in the DB (per student, per module)**  
   - **CBT**: `ExamAttempt` rows with `status = COMPLETED`, numeric `score`, linked to a `CBTExam` whose `moduleId` is that module. The backend only counts attempts for exams whose **module** is `ModuleType.STANDARD`.  
   - **Practical**: `PracticalSubmission` rows with `totalScore` set, linked to a `PracticalTask` whose `moduleId` is that module.  
   - **Saved mark** (optional): `ModuleProgress.score` for that `studentId` + `moduleId` — if the tutor already saved, this wins over suggestions.

2. **Backend** (`ModulesService.getClassSuggestedModuleScores` → `bestModuleQuizAndPracticalByStudent`)  
   - Loads **best** completed CBT score per student for that module (highest score if multiple attempts).  
   - Loads **best** graded practical `totalScore` per student for that module.  
   - Builds **`compositeScore`** for the API response: average when both exist; otherwise the single available score (CBT-only or practical-only).

3. **HTTP**  
   - `GET /modules/class-progress/suggested-scores?schoolId=…&className=…&moduleId=…&passMark=50`

4. **Frontend** (`TutorResults` in `tutor/page.tsx`)  
   - After class + current module are known, one effect: copy **saved** `moduleProgress.score` into local state, then for any student still empty, set the input from **`compositeScore`** from that GET. Nothing is written to `ModuleProgress` until the tutor clicks **Save All Scores**.

#### Scenario script (`scenario-module-retake-advance.ts`)

- For **each** of the 20 students it upserts an **`ExamAttempt`** (`status: COMPLETED`, `score: p.cbt` from the profile, `submittedAt` set) tied to the shared **`CBTExam`** for Track 3 **module 1** (`modT3First.id`), so the “taken CBT” signal is present for suggested scores.  
- It also upserts a **`PracticalSubmission`** with `totalScore: p.prac` for the scenario practical task on the same module.

Files:
- `frontend/src/lib/api.ts` (`modulesApi.suggestedScores`)
- `frontend/src/app/dashboard/tutor/page.tsx`

## 4) Advance Class Module uses CBT+Practical “AND” rule

Backend change in `advanceClassModule`:
- Marks each student:
  - COMPLETED if both CBT ≥ passMark and Practical ≥ passMark
  - else FAILED
- Still advances the class to the next module for everyone.

File:
- `backend/backend/src/modules/modules.service.ts`

## Anti-cheat controls added to CBT

### 1) Limit attempts for scheduled CBT exams (1–3)
`ExamSchedule` now has:
- `maxAttempts Int @default(1)` (clamped to 1–3 at creation)

Enforcement:
- **Unscheduled CBT**: one completion only (no retakes)
- **Scheduled CBT** (login-schedule): up to `schedule.maxAttempts` COMPLETED attempts per student

Files:
- `backend/backend/prisma/schema.prisma`
- `backend/backend/prisma/migrations/20260420124500_exam_schedule_attempt_limits_and_shuffle/migration.sql`
- `backend/backend/src/exam-schedules/exam-schedules.service.ts`
- `backend/backend/src/cbt/cbt.service.ts`

### 2) Randomize question order + option order (per attempt)
Each `ExamAttempt` now stores:
- `variant Json?` (question order + option order mapping)

Behavior:
- On attempt creation, a `variant` is generated and saved.
- On CBT login, the returned exam questions are shuffled accordingly.
- On submit/result, the system translates the selected option index back to the original option index for correct grading.

Files:
- `backend/backend/prisma/schema.prisma`
- `backend/backend/src/cbt/cbt.service.ts`

## Notes / intended direction
- Students can see they need retake when a module is marked **FAILED** after the tutor advances the class.
- Practical retakes no longer require creating a new “retake task”; students can submit a new attempt.
- Scheduled CBT retakes can be controlled by tutors via exam schedules + access code, with a hard cap on attempts per schedule.


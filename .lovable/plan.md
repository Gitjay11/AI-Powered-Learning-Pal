# Personalized Progress & Intervention System

Builds on the existing auth, roles, RLS, tracks, lessons, AI tutor, flags, and teacher dashboard. No rewrites — additive schema + UI.

## 1. Product rationale

The MVP can teach and flag, but it can't yet answer the three questions that decide whether a learner stays:
- **Student:** "Where am I? How am I doing? What should I do next?"
- **Teacher:** "Who needs me right now, why, and what did we already try?"

Today flags are binary and recommendations are implicit (next lesson in order). This milestone converts raw signals (`student_progress`, `chat_messages`, `flags`) into an **explainable risk score**, a **clear next action**, and a **closed-loop intervention workflow**. It's the highest-leverage step before adding new content types or a sandbox, because every future feature (mentor analytics, placement readiness) reads from the same scoring + intervention spine.

## 2. User stories

**Student**
- As a student, I see a dashboard with my track, % complete, recent quiz trend, weak concepts, and one clear "Do this next" CTA.
- As a struggling student, I see when a teacher has reviewed my work and left a note.
- As a consistent learner, I see a streak so I keep showing up.

**Teacher**
- As a teacher, I see students sorted by risk with the reason for each flag.
- As a teacher, I can mark reviewed, assign a revision lesson, send a note, or clear a flag in one click — and see the full intervention history.
- As a teacher, I can filter by track and risk level and see class-level metrics (flagged count, avg completion, top weak topics).

## 3. Feature scope

**Must-have**
- Student dashboard (track, completion %, quiz trend, weak concepts, next action, streak).
- Risk scoring engine with stored, human-readable reasons.
- Teacher list sorted by risk + filters (track, risk level, unresolved).
- Intervention actions: mark reviewed, send note, assign revision, clear flag — all logged.
- Recommendation engine returning a typed next action.
- RLS for all new tables.

**Should-have**
- Teacher metrics strip (flagged count, by risk, avg completion, top weak topics, top intervention types).
- Event logging for analytics (dashboard open, recommendation served, intervention taken, flag resolved).
- "Recommended by your teacher" card on the student dashboard.

**Stretch**
- Email/in-app digest for teachers ("3 new at-risk students this week").
- Cohort comparison ("you're ahead of 60% on this track").
- Auto-recompute risk on a schedule via pg_cron.

## 4. Database design

New tables (all in `public`, with GRANTs + RLS + `auth.uid()`-scoped policies; teacher access via `has_role(auth.uid(),'teacher')`).

- **`topic_mastery`** — rolling mastery per student × concept.
  Columns: `id, student_id, concept, track_id, attempts, correct, mastery_score numeric(4,3), last_seen_at`.
  Unique `(student_id, concept)`. Drives weak-topic cards and recommendations.

- **`risk_scores`** — current explainable score per student (one row per student, upserted).
  Columns: `id, student_id UNIQUE, score int (0-100), level text ('healthy'|'attention'|'at_risk'), reasons jsonb, signals jsonb, computed_at`.
  `reasons` = array of `{code, label, weight, detail}` so UI can render them verbatim.

- **`intervention_logs`** — every teacher action on a student.
  Columns: `id, teacher_id, student_id, kind text ('reviewed'|'note'|'assigned_revision'|'recommend_tutor'|'cleared_flag'|'scheduled'), payload jsonb (e.g. `{lesson_id, body, flag_id}`), related_flag_id nullable, created_at`.

- **`recommendation_history`** — what we recommended, what the student did.
  Columns: `id, student_id, action text ('continue'|'revise_topic'|'retry_quiz'|'practice'|'open_tutor'|'escalate'), context jsonb (e.g. `{lesson_id, concept}`), source text ('engine'|'teacher'), served_at, followed_at nullable`.

- **`analytics_events`** — thin event log.
  Columns: `id, actor_id, actor_role, event text, props jsonb, created_at`.
  Index on `(event, created_at)`.

**Reuse / extend**
- `flags` — add `resolved_by uuid`, `resolved_at timestamptz`, `resolution text` (so we don't lose why it closed).
- `student_progress` — already has attempts/score/status; no schema change required.
- `profiles` — add `last_active_at timestamptz` (touched on dashboard load / lesson view) for inactivity signal.

**RLS notes**
- Students: `SELECT` own rows on `topic_mastery`, `risk_scores`, `recommendation_history`, `intervention_logs` (read-only on their own logs so they can see teacher notes), `analytics_events` insert own.
- Teachers (`has_role(auth.uid(),'teacher')`): `SELECT` all rows in those four tables; `INSERT/UPDATE` on `intervention_logs`, `flags`, `recommendation_history`.
- Service role: full access (used by risk recompute server fn).
- Every `CREATE TABLE` ships with GRANTs in the same migration.

## 5. Backend / API plan (TanStack `createServerFn`)

All authed via `requireSupabaseAuth`. Files extend the existing `learning.functions.ts`, `teacher.functions.ts`, plus a new `risk.functions.ts` and `analytics.functions.ts`.

Student-facing
- `getStudentDashboard()` → `{ track, completionPct, quizTrend[], weakConcepts[], tutorUsage, streakDays, risk, nextAction, teacherNotes[] }`. Single round trip.
- `getRecommendation()` → `{ action, context, reason }`. Persists to `recommendation_history`.
- `markRecommendationFollowed({recommendationId})`.
- `touchActivity()` — updates `profiles.last_active_at` on dashboard mount.

Risk + scoring
- `recomputeRiskForStudent({studentId})` — pure function over signals, upserts `risk_scores`, returns score+reasons. Called after `recordAttempt`, after tutor "help" thresholds, and on demand from teacher dashboard.
- `recomputeRiskForAllStudents()` — teacher-only batch (used by metrics refresh, later by cron).

Teacher-facing
- `getTeacherDashboardV2({filters})` → students sorted by risk desc, joined with latest flag reasons + open intervention count + last activity. Supports `{trackId?, level?, unresolvedOnly?}`.
- `getStudentDetailV2({studentId})` → existing detail + `risk`, `topicMastery`, `interventionLogs`, `recommendationHistory`.
- `logIntervention({studentId, kind, payload, flagId?})` — single entry point; on `cleared_flag` also updates `flags`.
- `getTeacherMetrics()` → `{ flaggedCount, byLevel, avgCompletion, topWeakConcepts, topInterventionKinds }`.

Analytics
- `logEvent({event, props})` — fire-and-forget insert into `analytics_events`.

No new edge functions; everything stays in TanStack server fns.

## 6. Frontend plan

**Routes**
- `/learn` (today) — keep as the lesson list.
- `/dashboard` *(new)* — student progress dashboard; becomes the default landing after login for students.
- `/teacher` — upgraded list view with filters + risk-sorted rows.
- `/teacher/$studentId` — upgraded detail with risk panel + intervention composer + history.

**Student dashboard components**
- `TrackHeader` (track name, % complete, streak chip).
- `QuizTrendSparkline` (last 10 attempts).
- `WeakConceptsList` (top 3 by lowest mastery, each with "Revise" CTA).
- `TutorUsageCard` (messages this week, top concept asked).
- `NextActionCard` — large CTA from the recommendation engine, with one-line reason.
- `TeacherNotesFeed` — read-only stream of `intervention_logs` of kind `note`/`assigned_revision`.

**Teacher dashboard upgrades**
- `MetricsStrip` across the top.
- `FilterBar` (track, risk level, unresolved toggle, search).
- `StudentRow` shows: name, track, risk chip (color by level), top 1-2 reasons, last active, open-flag count.
- Detail page: `RiskPanel` (score + reasons + recompute button), `InterventionComposer` (kind picker + payload), `InterventionTimeline`, existing chats/progress preserved.

**Design**
- Reuse existing minimal/professional tokens. Risk chip palette: healthy = muted green, attention = amber, at_risk = destructive. Use existing `Progress`, `Badge`, `Card`, `Tabs`. No new chart lib — sparkline as inline SVG.

## 7. Risk scoring logic

Pure, deterministic, explainable. Computed on demand from these signals over the last 30 days unless noted.

```
signals = {
  avg_quiz_score:        mean(student_progress.score / max(attempts,1))
  failed_attempt_ratio:  sum(attempts - score) / sum(attempts)
  completion_rate:       completed_lessons / total_lessons_in_track
  inactivity_days:       days_since(profiles.last_active_at)
  repeated_topic_fail:   count(concepts where mastery_score < 0.4 AND attempts >= 3)
  tutor_overuse:         tutor_msgs_per_lesson > 15 ? true : false
}

score = 0
reasons = []

if avg_quiz_score < 0.5:       score += 25; push("low_quiz_avg",   25, "Average quiz score {pct}%")
if failed_attempt_ratio > 0.5: score += 20; push("high_fail_rate", 20, "{pct}% of attempts failed")
if completion_rate < 0.2 and days_since_track_select > 7:
                               score += 15; push("slow_progress",  15, "Only {pct}% of track complete")
if inactivity_days >= 7:       score += 20; push("inactive",       20, "Inactive {n} days")
if repeated_topic_fail >= 2:   score += 15; push("topic_blockers", 15, "{n} concepts not yet mastered")
if tutor_overuse:              score += 5;  push("tutor_overuse",   5, "High tutor reliance")

level = score >= 50 ? 'at_risk'
      : score >= 25 ? 'attention'
      : 'healthy'

upsert risk_scores { student_id, score, level, reasons, signals, computed_at: now() }
```

Reasons are stored verbatim and rendered as-is in the UI — no black box.

## 8. Recommendation logic

Runs after risk compute; returns one action.

```
if open_unresolved_flag and severity == 'high':
    return { action: 'escalate', reason: 'Teacher review requested' }

if risk.level == 'at_risk' and inactivity_days >= 7:
    return { action: 'open_tutor', context: { concept: weakest }, reason: 'Re-engage with a guided concept' }

weakest = topic_mastery row with lowest mastery_score where attempts >= 2
if weakest and weakest.mastery_score < 0.5:
    return { action: 'revise_topic', context: { concept: weakest.concept }, reason: 'Mastery {pct}%' }

last_quiz = most recent attempt
if last_quiz and not last_quiz.correct:
    return { action: 'retry_quiz', context: { lesson_id }, reason: 'Last attempt was incorrect' }

if completion_rate >= 0.2 and no blockers:
    return { action: 'continue', context: { lesson_id: next_lesson }, reason: 'You are on track' }

return { action: 'practice', context: { concept: weakest?.concept }, reason: 'Build reps before moving on' }
```

Every served recommendation is written to `recommendation_history`; `markRecommendationFollowed` closes the loop and feeds future analytics.

## 9. Implementation plan

**Phase 1 — Schema + scoring spine** (foundation)
1. Migration: new tables + GRANTs + RLS + `flags`/`profiles` additions.
2. `risk.functions.ts` with `recomputeRiskForStudent` + signal helpers.
3. Hook `recomputeRiskForStudent` into existing `recordAttempt` and `sendTutorMessage` help-trigger.

**Phase 2 — Student dashboard**
4. `getStudentDashboard` + `getRecommendation` + `touchActivity` server fns.
5. `/dashboard` route + components (TrackHeader, Sparkline, WeakConcepts, TutorUsage, NextAction, TeacherNotes).
6. Redirect students to `/dashboard` post-login; keep `/learn` reachable.

**Phase 3 — Teacher intervention workflow**
7. `getTeacherDashboardV2`, `getTeacherMetrics`, `logIntervention`, `getStudentDetailV2`.
8. Upgrade `/teacher` (MetricsStrip, FilterBar, risk-sorted rows).
9. Upgrade `/teacher/$studentId` (RiskPanel, InterventionComposer, InterventionTimeline).

**Phase 4 — Analytics + polish**
10. `analytics_events` + `logEvent`; wire the 6 required events.
11. Empty states, loading skeletons, error boundaries for each new route.

## 10. QA checklist

- Student A cannot read Student B's `risk_scores`, `topic_mastery`, `intervention_logs`, or `recommendation_history`.
- Teacher can read all of the above; non-teacher cannot call teacher-only fns (server-side `ensureTeacher` still passes).
- Risk score recomputes after a wrong attempt and after a flag is created.
- Recommendation never returns `continue` when there's an unresolved high-severity flag.
- Clearing a flag writes both `flags.resolved=true` and an `intervention_logs` row.
- Empty states: new student (no attempts), no flags, no recommendations yet.
- Inactivity edge: a student who just signed up isn't immediately "at_risk".
- Filters combine correctly (track + level + unresolved).
- Existing flows still pass: signup, onboarding, lesson view, tutor chat, manual flag resolution.
- RLS migration: every new public table has explicit GRANTs and policies; linter clean.

## 11. Definition of done

- All Phase 1-3 tasks shipped; Phase 4 events firing.
- A new student sees a populated dashboard within one lesson + one quiz attempt.
- A teacher logging in sees students sorted by risk, can take any intervention action in ≤2 clicks, and the action appears in the timeline immediately.
- Risk score on any student is reproducible from stored `signals` + the documented rules.
- RLS verified: cross-student reads blocked; teacher reads allowed; service role used only inside server fns.
- No regressions in existing auth, onboarding, lesson, tutor, or flag flows.

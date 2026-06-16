import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type Reason = { code: string; label: string; weight: number; detail: string };
export type RiskLevel = "healthy" | "attention" | "at_risk";

/** Compute a transparent risk score from raw signals. */
export async function computeRiskFor(sb: any, studentId: string) {
  const [{ data: profile }, { data: progress }, { data: mastery }, { data: chats }, { data: openFlags }] =
    await Promise.all([
      sb.from("profiles").select("selected_track_id, last_active_at, created_at").eq("id", studentId).maybeSingle(),
      sb.from("student_progress").select("attempts, score, status, lesson_id, last_attempted_at").eq("student_id", studentId),
      sb.from("topic_mastery").select("concept, attempts, mastery_score").eq("student_id", studentId),
      sb.from("chat_messages").select("id, lesson_id, created_at, role").eq("student_id", studentId).eq("role", "user"),
      sb.from("flags").select("id, severity").eq("student_id", studentId).eq("resolved", false),
    ]);

  // Lesson totals for this track
  let totalLessons = 0;
  if (profile?.selected_track_id) {
    const { count } = await sb.from("lessons").select("id", { count: "exact", head: true })
      .eq("track_id", profile.selected_track_id);
    totalLessons = count ?? 0;
  }

  const totalAttempts = (progress ?? []).reduce((a: number, p: any) => a + (p.attempts ?? 0), 0);
  const totalScore = (progress ?? []).reduce((a: number, p: any) => a + (p.score ?? 0), 0);
  const completed = (progress ?? []).filter((p: any) => p.status === "completed").length;

  const avg_quiz_score = totalAttempts > 0 ? totalScore / totalAttempts : null;
  const failed_attempt_ratio = totalAttempts > 0 ? (totalAttempts - totalScore) / totalAttempts : 0;
  const completion_rate = totalLessons > 0 ? completed / totalLessons : 0;
  const lastActive = profile?.last_active_at ? new Date(profile.last_active_at) : null;
  const inactivity_days = lastActive ? Math.floor((Date.now() - lastActive.getTime()) / 86400000) : 0;
  const days_since_signup = profile?.created_at
    ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) : 0;
  const repeated_topic_fail = (mastery ?? []).filter((m: any) => Number(m.mastery_score) < 0.4 && m.attempts >= 3).length;
  const distinctLessonsChatted = new Set((chats ?? []).map((c: any) => c.lesson_id)).size || 1;
  const tutor_msgs_per_lesson = (chats ?? []).length / distinctLessonsChatted;
  const tutor_overuse = tutor_msgs_per_lesson > 15;

  const reasons: Reason[] = [];
  let score = 0;

  if (avg_quiz_score !== null && avg_quiz_score < 0.5) {
    score += 25;
    reasons.push({ code: "low_quiz_avg", label: "Low quiz average", weight: 25,
      detail: `Average quiz score ${Math.round((avg_quiz_score ?? 0) * 100)}%` });
  }
  if (totalAttempts >= 3 && failed_attempt_ratio > 0.5) {
    score += 20;
    reasons.push({ code: "high_fail_rate", label: "High failure rate", weight: 20,
      detail: `${Math.round(failed_attempt_ratio * 100)}% of attempts failed` });
  }
  if (totalLessons > 0 && completion_rate < 0.2 && days_since_signup > 7) {
    score += 15;
    reasons.push({ code: "slow_progress", label: "Slow progress", weight: 15,
      detail: `Only ${Math.round(completion_rate * 100)}% of track complete` });
  }
  if (inactivity_days >= 7 && days_since_signup > 7) {
    score += 20;
    reasons.push({ code: "inactive", label: "Inactive", weight: 20,
      detail: `Inactive for ${inactivity_days} days` });
  }
  if (repeated_topic_fail >= 2) {
    score += 15;
    reasons.push({ code: "topic_blockers", label: "Concept blockers", weight: 15,
      detail: `${repeated_topic_fail} concepts not yet mastered` });
  }
  if (tutor_overuse) {
    score += 5;
    reasons.push({ code: "tutor_overuse", label: "High tutor reliance", weight: 5,
      detail: `~${Math.round(tutor_msgs_per_lesson)} tutor messages per lesson` });
  }
  if ((openFlags ?? []).some((f: any) => f.severity === "high")) {
    score += 10;
    reasons.push({ code: "open_high_flag", label: "Open high-severity flag", weight: 10,
      detail: "An unresolved high-severity flag is open" });
  }

  if (score > 100) score = 100;
  const level: RiskLevel = score >= 50 ? "at_risk" : score >= 25 ? "attention" : "healthy";

  const signals = {
    avg_quiz_score, failed_attempt_ratio, completion_rate, inactivity_days,
    days_since_signup, repeated_topic_fail, tutor_msgs_per_lesson, tutor_overuse,
    total_attempts: totalAttempts, completed_lessons: completed, total_lessons: totalLessons,
  };

  return { score, level, reasons, signals };
}

/** Recompute and upsert risk_scores for a student. Returns the row data. */
export async function persistRisk(sb: any, studentId: string) {
  const r = await computeRiskFor(sb, studentId);
  const { error } = await sb.from("risk_scores").upsert({
    student_id: studentId,
    score: r.score,
    level: r.level,
    reasons: r.reasons,
    signals: r.signals,
    computed_at: new Date().toISOString(),
  }, { onConflict: "student_id" });
  if (error) throw error;
  return r;
}

/** Update topic_mastery after a quiz attempt. */
export async function bumpMastery(sb: any, studentId: string, trackId: string | null, concept: string, correct: boolean) {
  const { data: existing } = await sb.from("topic_mastery").select("*")
    .eq("student_id", studentId).eq("concept", concept).maybeSingle();
  const attempts = (existing?.attempts ?? 0) + 1;
  const correctCount = (existing?.correct ?? 0) + (correct ? 1 : 0);
  const mastery_score = Math.min(1, correctCount / Math.max(attempts, 1));
  if (existing) {
    await sb.from("topic_mastery").update({
      attempts, correct: correctCount, mastery_score,
      track_id: trackId ?? existing.track_id,
      last_seen_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await sb.from("topic_mastery").insert({
      student_id: studentId, concept, track_id: trackId,
      attempts, correct: correctCount, mastery_score,
    });
  }
}

export const recomputeRiskForStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const target = data.studentId ?? context.userId;
    return persistRisk(context.supabase, target);
  });

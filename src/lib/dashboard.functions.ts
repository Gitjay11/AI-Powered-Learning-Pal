import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { persistRisk } from "./risk.functions";

type RecAction = "continue" | "revise_topic" | "retry_quiz" | "practice" | "open_tutor" | "escalate";

async function deriveRecommendation(sb: any, studentId: string) {
  const [{ data: profile }, { data: openFlags }, { data: mastery }, { data: progress }] = await Promise.all([
    sb.from("profiles").select("selected_track_id").eq("id", studentId).maybeSingle(),
    sb.from("flags").select("id, severity, lesson_id, concept").eq("student_id", studentId).eq("resolved", false),
    sb.from("topic_mastery").select("concept, mastery_score, attempts").eq("student_id", studentId)
      .order("mastery_score", { ascending: true }),
    sb.from("student_progress").select("lesson_id, status, score, attempts, last_attempted_at")
      .eq("student_id", studentId).order("last_attempted_at", { ascending: false }),
  ]);

  const trackId = profile?.selected_track_id;
  const { data: lessons } = trackId
    ? await sb.from("lessons").select("id, title, order_index, concept_tags")
        .eq("track_id", trackId).order("order_index")
    : { data: [] };

  const { data: risk } = await sb.from("risk_scores").select("level").eq("student_id", studentId).maybeSingle();
  const highFlag = (openFlags ?? []).find((f: any) => f.severity === "high");
  if (highFlag) {
    return { action: "escalate" as RecAction, context: { flag_id: highFlag.id, concept: highFlag.concept },
      reason: "A teacher review is recommended for this topic." };
  }

  const weakest = (mastery ?? []).find((m: any) => Number(m.mastery_score) < 0.5 && m.attempts >= 2);
  if (risk?.level === "at_risk" && weakest) {
    return { action: "open_tutor" as RecAction, context: { concept: weakest.concept },
      reason: "Get unblocked with a guided tutor session." };
  }
  if (weakest) {
    return { action: "revise_topic" as RecAction, context: { concept: weakest.concept },
      reason: `Mastery on ${weakest.concept} is ${Math.round(Number(weakest.mastery_score) * 100)}%.` };
  }

  const lastProgress = progress?.[0];
  if (lastProgress && lastProgress.status === "in_progress" && lastProgress.attempts > lastProgress.score) {
    return { action: "retry_quiz" as RecAction, context: { lesson_id: lastProgress.lesson_id },
      reason: "Your last attempt wasn't quite there. Try again." };
  }

  const completedIds = new Set((progress ?? []).filter((p: any) => p.status === "completed").map((p: any) => p.lesson_id));
  const nextLesson = (lessons ?? []).find((l: any) => !completedIds.has(l.id));
  if (nextLesson) {
    return { action: "continue" as RecAction, context: { lesson_id: nextLesson.id, title: nextLesson.title },
      reason: "You're on track. Move on to the next lesson." };
  }
  return { action: "practice" as RecAction, context: {}, reason: "Keep practicing to lock in what you've learned." };
}

export const getStudentDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const uid = context.userId;

    // touch activity
    await sb.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", uid);

    const { data: profile } = await sb.from("profiles")
      .select("selected_track_id, full_name, last_active_at, tracks:selected_track_id(id, title, slug, category)")
      .eq("id", uid).maybeSingle();

    if (!profile?.selected_track_id) {
      return { needsOnboarding: true as const };
    }

    // Recompute risk on dashboard load so it's always fresh
    await persistRisk(sb, uid).catch(() => null);

    const [{ data: lessons }, { data: progress }, { data: mastery }, { data: risk }, { data: chats }, { data: notes }, { data: lastRec }] =
      await Promise.all([
        sb.from("lessons").select("id, title, order_index").eq("track_id", profile.selected_track_id).order("order_index"),
        sb.from("student_progress").select("lesson_id, status, score, attempts, last_attempted_at")
          .eq("student_id", uid).order("last_attempted_at", { ascending: false }),
        sb.from("topic_mastery").select("concept, attempts, correct, mastery_score, last_seen_at")
          .eq("student_id", uid).order("mastery_score", { ascending: true }).limit(5),
        sb.from("risk_scores").select("score, level, reasons, computed_at").eq("student_id", uid).maybeSingle(),
        sb.from("chat_messages").select("created_at, lesson_id, role").eq("student_id", uid).eq("role", "user")
          .order("created_at", { ascending: false }).limit(100),
        sb.from("intervention_logs").select("id, kind, payload, created_at")
          .eq("student_id", uid).in("kind", ["note", "assigned_revision", "recommend_tutor"])
          .order("created_at", { ascending: false }).limit(10),
        sb.from("recommendation_history").select("served_at").eq("student_id", uid)
          .order("served_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

    const total = lessons?.length ?? 0;
    const completed = (progress ?? []).filter((p: any) => p.status === "completed").length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Quiz trend = last 10 attempts in chronological order, success rate per row
    const trend = (progress ?? [])
      .slice(0, 10).reverse()
      .map((p: any) => p.attempts > 0 ? Math.round((p.score / p.attempts) * 100) : 0);

    // Streak: count consecutive days with any user chat or attempt
    const dayKeys = new Set<string>();
    for (const c of chats ?? []) dayKeys.add(new Date(c.created_at).toISOString().slice(0, 10));
    for (const p of progress ?? []) if (p.last_attempted_at) dayKeys.add(new Date(p.last_attempted_at).toISOString().slice(0, 10));
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
      if (dayKeys.has(d)) streak++;
      else if (i > 0) break;
    }

    const weekAgo = Date.now() - 7 * 86400000;
    const tutorWeek = (chats ?? []).filter((c: any) => new Date(c.created_at).getTime() > weekAgo).length;

    const nextAction = await deriveRecommendation(sb, uid);

    return {
      needsOnboarding: false as const,
      profile,
      track: profile.tracks,
      completionPct,
      completed,
      totalLessons: total,
      quizTrend: trend,
      weakConcepts: mastery ?? [],
      tutorUsage: { week: tutorWeek, total: chats?.length ?? 0 },
      streakDays: streak,
      risk: risk ?? { score: 0, level: "healthy", reasons: [], computed_at: null },
      nextAction,
      teacherNotes: notes ?? [],
      lastRecommendationAt: lastRec?.served_at ?? null,
    };
  });

export const servePersonalizedRecommendation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rec = await deriveRecommendation(context.supabase, context.userId);
    const { data, error } = await context.supabase.from("recommendation_history").insert({
      student_id: context.userId,
      action: rec.action,
      context: rec.context,
      reason: rec.reason,
      source: "engine",
    }).select("id").single();
    if (error) throw error;
    return { ...rec, id: data.id };
  });

export const markRecommendationFollowed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ recommendationId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("recommendation_history")
      .update({ followed_at: new Date().toISOString() })
      .eq("id", data.recommendationId).eq("student_id", context.userId);
    return { ok: true };
  });

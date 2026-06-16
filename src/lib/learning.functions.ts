import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { bumpMastery, persistRisk } from "./risk.functions";


export const getTracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tracks")
      .select("*")
      .order("title");
    if (error) throw error;
    return data;
  });

export const selectTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { trackId: string }) => z.object({ trackId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // Upsert so it also works if the profile row was never created
    const { error } = await context.supabase
      .from("profiles")
      .upsert({
        id: context.userId,
        selected_track_id: data.trackId,
        email: context.claims?.email ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    if (error) throw error;
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return {
      profile,
      role: roles?.some((r) => r.role === "teacher") ? "teacher" : "student",
    };
  });

export const getLearnHome = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("selected_track_id")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.selected_track_id) return { needsOnboarding: true as const };

    const { data: track } = await context.supabase
      .from("tracks")
      .select("*")
      .eq("id", profile.selected_track_id)
      .single();

    const { data: lessons } = await context.supabase
      .from("lessons")
      .select("*")
      .eq("track_id", profile.selected_track_id)
      .order("order_index");

    const { data: progress } = await context.supabase
      .from("student_progress")
      .select("lesson_id, status, score")
      .eq("student_id", context.userId);

    const progressMap = new Map((progress ?? []).map((p) => [p.lesson_id, p]));
    const enriched = (lessons ?? []).map((l) => ({
      ...l,
      progress: progressMap.get(l.id) ?? null,
    }));

    return { needsOnboarding: false as const, track, lessons: enriched };
  });

export const getLesson = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { lessonId: string }) => z.object({ lessonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lesson, error } = await context.supabase
      .from("lessons")
      .select("*, tracks(title, slug, category)")
      .eq("id", data.lessonId)
      .single();
    if (error) throw error;

    const { data: progress } = await context.supabase
      .from("student_progress")
      .select("*")
      .eq("student_id", context.userId)
      .eq("lesson_id", data.lessonId)
      .maybeSingle();

    const { data: messages } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("student_id", context.userId)
      .eq("lesson_id", data.lessonId)
      .order("created_at");

    return { lesson, progress, messages: messages ?? [] };
  });

export const recordAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      lessonId: z.string().uuid(),
      correct: z.boolean(),
      concept: z.string().min(1).max(100),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const uid = context.userId;

    const { data: lessonRow } = await sb.from("lessons").select("track_id").eq("id", data.lessonId).maybeSingle();
    const trackId = lessonRow?.track_id ?? null;

    const { data: existing } = await sb
      .from("student_progress")
      .select("*")
      .eq("student_id", uid)
      .eq("lesson_id", data.lessonId)
      .maybeSingle();

    const attempts = (existing?.attempts ?? 0) + 1;
    const score = (existing?.score ?? 0) + (data.correct ? 1 : 0);
    const status = data.correct && score >= 3 ? "completed" : "in_progress";

    if (existing) {
      await sb.from("student_progress").update({
        attempts, score, status,
        last_attempted_at: new Date().toISOString(),
      }).eq("id", existing.id);
    } else {
      await sb.from("student_progress").insert({
        student_id: uid, lesson_id: data.lessonId,
        attempts, score, status,
      });
    }

    // Track concept mastery
    await bumpMastery(sb, uid, trackId, data.concept, data.correct);

    // Touch activity
    await sb.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", uid);

    // Auto-flag: 3+ wrong attempts on same concept in this lesson
    if (!data.correct) {
      const wrongCount = attempts - score;
      if (wrongCount >= 3) {
        const { data: existingFlag } = await sb
          .from("flags")
          .select("id")
          .eq("student_id", uid)
          .eq("lesson_id", data.lessonId)
          .eq("concept", data.concept)
          .eq("resolved", false)
          .maybeSingle();
        if (!existingFlag) {
          await sb.from("flags").insert({
            student_id: uid,
            lesson_id: data.lessonId,
            concept: data.concept,
            reason: `Student has ${wrongCount} incorrect attempts on "${data.concept}".`,
            severity: wrongCount >= 5 ? "high" : "medium",
          });
          await sb.from("student_progress").update({ status: "struggling" })
            .eq("student_id", uid).eq("lesson_id", data.lessonId);
        }
      }
    }

    // Recompute risk after every attempt
    await persistRisk(sb, uid).catch(() => null);

    return { ok: true, attempts, score, status };
  });

export const getProgressOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: progress } = await context.supabase
      .from("student_progress")
      .select("status, score, attempts, lessons(title, concept_tags, tracks(title))")
      .eq("student_id", context.userId);
    const { data: flags } = await context.supabase
      .from("flags")
      .select("concept, reason, severity, resolved, created_at")
      .eq("student_id", context.userId)
      .order("created_at", { ascending: false });
    return { progress: progress ?? [], flags: flags ?? [] };
  });

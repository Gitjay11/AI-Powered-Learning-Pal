import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { persistRisk } from "./risk.functions";

async function ensureTeacher(sb: any, uid: string) {
  const { data } = await sb.from("user_roles").select("role")
    .eq("user_id", uid).eq("role", "teacher").maybeSingle();
  if (!data) throw new Error("Teacher access required");
}

export const getTeacherDashboardV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      trackId: z.string().uuid().optional().nullable(),
      level: z.enum(["healthy", "attention", "at_risk"]).optional().nullable(),
      unresolvedOnly: z.boolean().optional(),
      search: z.string().optional(),
    }).partial().parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await ensureTeacher(context.supabase, context.userId);
    const sb = context.supabase;

    const [{ data: students }, { data: risks }, { data: openFlags }, { data: progress }, { data: lessons }] =
      await Promise.all([
        sb.from("profiles").select("id, full_name, email, selected_track_id, last_active_at, tracks:selected_track_id(id, title)"),
        sb.from("risk_scores").select("student_id, score, level, reasons, computed_at"),
        sb.from("flags").select("id, student_id, severity, concept, reason").eq("resolved", false),
        sb.from("student_progress").select("student_id, status, lesson_id"),
        sb.from("lessons").select("id, track_id"),
      ]);

    const riskMap = new Map((risks ?? []).map((r: any) => [r.student_id, r]));
    const flagMap = new Map<string, any[]>();
    for (const f of openFlags ?? []) {
      const arr = flagMap.get(f.student_id) ?? [];
      arr.push(f);
      flagMap.set(f.student_id, arr);
    }
    const lessonTrackMap = new Map((lessons ?? []).map((l: any) => [l.id, l.track_id]));
    const progressByStudent = new Map<string, { completed: number; total: number }>();
    for (const p of progress ?? []) {
      const prev = progressByStudent.get(p.student_id) ?? { completed: 0, total: 0 };
      prev.total += 1;
      if (p.status === "completed") prev.completed += 1;
      progressByStudent.set(p.student_id, prev);
    }

    let rows = (students ?? []).map((s: any) => {
      const r = riskMap.get(s.id) ?? { score: 0, level: "healthy", reasons: [], computed_at: null };
      const flags = flagMap.get(s.id) ?? [];
      const prog = progressByStudent.get(s.id) ?? { completed: 0, total: 0 };
      return { ...s, risk: r, openFlags: flags, progress: prog };
    });

    if (data.trackId) rows = rows.filter((r) => r.selected_track_id === data.trackId);
    if (data.level) rows = rows.filter((r) => r.risk.level === data.level);
    if (data.unresolvedOnly) rows = rows.filter((r) => r.openFlags.length > 0);
    if (data.search) {
      const q = data.search.toLowerCase();
      rows = rows.filter((r) => (r.full_name ?? "").toLowerCase().includes(q) || (r.email ?? "").toLowerCase().includes(q));
    }

    rows.sort((a, b) => b.risk.score - a.risk.score);

    const tracks = Array.from(new Map((students ?? [])
      .filter((s: any) => s.tracks).map((s: any) => [s.tracks.id, s.tracks])).values());

    return { rows, tracks };
  });

export const getTeacherMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureTeacher(context.supabase, context.userId);
    const sb = context.supabase;
    const [{ data: risks }, { data: openFlags }, { data: progress }, { data: lessons }, { data: mastery }, { data: interventions }] =
      await Promise.all([
        sb.from("risk_scores").select("level"),
        sb.from("flags").select("id, concept").eq("resolved", false),
        sb.from("student_progress").select("status, student_id"),
        sb.from("lessons").select("id"),
        sb.from("topic_mastery").select("concept, mastery_score, attempts"),
        sb.from("intervention_logs").select("kind"),
      ]);

    const byLevel: Record<string, number> = { healthy: 0, attention: 0, at_risk: 0 };
    for (const r of risks ?? []) byLevel[r.level] = (byLevel[r.level] ?? 0) + 1;

    const studentLessons = new Map<string, { c: number; t: number }>();
    for (const p of progress ?? []) {
      const prev = studentLessons.get(p.student_id) ?? { c: 0, t: 0 };
      prev.t += 1;
      if (p.status === "completed") prev.c += 1;
      studentLessons.set(p.student_id, prev);
    }
    const rates = Array.from(studentLessons.values()).map((v) => v.t > 0 ? v.c / v.t : 0);
    const avgCompletion = rates.length > 0 ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : 0;

    const weakCounts = new Map<string, number>();
    for (const m of mastery ?? []) {
      if (Number(m.mastery_score) < 0.5 && m.attempts >= 2) {
        weakCounts.set(m.concept, (weakCounts.get(m.concept) ?? 0) + 1);
      }
    }
    const topWeakConcepts = Array.from(weakCounts.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([concept, count]) => ({ concept, count }));

    const ivCounts = new Map<string, number>();
    for (const iv of interventions ?? []) ivCounts.set(iv.kind, (ivCounts.get(iv.kind) ?? 0) + 1);
    const topInterventionKinds = Array.from(ivCounts.entries())
      .sort((a, b) => b[1] - a[1]).map(([kind, count]) => ({ kind, count }));

    return {
      flaggedCount: openFlags?.length ?? 0,
      byLevel,
      avgCompletion,
      totalLessons: lessons?.length ?? 0,
      topWeakConcepts,
      topInterventionKinds,
    };
  });

export const getStudentDetailV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeacher(context.supabase, context.userId);
    const sb = context.supabase;

    // Recompute risk on demand
    await persistRisk(sb, data.studentId).catch(() => null);

    const [
      { data: profile },
      { data: progress },
      { data: flags },
      { data: interventions },
      { data: chats },
      { data: risk },
      { data: mastery },
      { data: recs },
    ] = await Promise.all([
      sb.from("profiles").select("*, tracks:selected_track_id(id, title)").eq("id", data.studentId).maybeSingle(),
      sb.from("student_progress").select("*, lessons(title)").eq("student_id", data.studentId),
      sb.from("flags").select("*, lessons(title)").eq("student_id", data.studentId).order("created_at", { ascending: false }),
      sb.from("intervention_logs").select("*").eq("student_id", data.studentId).order("created_at", { ascending: false }),
      sb.from("chat_messages").select("role, content, created_at, lessons(title)").eq("student_id", data.studentId)
        .order("created_at", { ascending: false }).limit(30),
      sb.from("risk_scores").select("*").eq("student_id", data.studentId).maybeSingle(),
      sb.from("topic_mastery").select("concept, attempts, correct, mastery_score").eq("student_id", data.studentId)
        .order("mastery_score", { ascending: true }),
      sb.from("recommendation_history").select("*").eq("student_id", data.studentId)
        .order("served_at", { ascending: false }).limit(10),
    ]);

    return {
      profile,
      progress: progress ?? [],
      flags: flags ?? [],
      interventions: interventions ?? [],
      chats: chats ?? [],
      risk,
      mastery: mastery ?? [],
      recommendations: recs ?? [],
    };
  });

export const logIntervention = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      studentId: z.string().uuid(),
      kind: z.enum(["reviewed", "note", "assigned_revision", "recommend_tutor", "cleared_flag", "scheduled"]),
      payload: z.record(z.string(), z.any()).optional(),
      flagId: z.string().uuid().optional(),
      resolution: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureTeacher(context.supabase, context.userId);
    const sb = context.supabase;

    const { error } = await sb.from("intervention_logs").insert({
      teacher_id: context.userId,
      student_id: data.studentId,
      kind: data.kind,
      payload: data.payload ?? {},
      related_flag_id: data.flagId ?? null,
    });
    if (error) throw error;

    if (data.kind === "cleared_flag" && data.flagId) {
      await sb.from("flags").update({
        resolved: true,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
        resolution: data.resolution ?? null,
      }).eq("id", data.flagId);
    }

    if (data.kind === "recommend_tutor" || data.kind === "assigned_revision") {
      await sb.from("recommendation_history").insert({
        student_id: data.studentId,
        action: data.kind === "recommend_tutor" ? "open_tutor" : "revise_topic",
        context: data.payload ?? {},
        reason: "Recommended by your teacher",
        source: "teacher",
      });
    }

    await persistRisk(sb, data.studentId).catch(() => null);
    return { ok: true };
  });

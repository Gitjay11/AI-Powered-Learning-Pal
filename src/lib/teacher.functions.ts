import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureTeacher(sb: any, uid: string) {
  const { data } = await sb.from("user_roles").select("role").eq("user_id", uid).eq("role", "teacher").maybeSingle();
  if (!data) throw new Error("Teacher access required");
}

export const getTeacherDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureTeacher(context.supabase, context.userId);
    const sb = context.supabase;

    const { data: students } = await sb
      .from("profiles")
      .select("id, full_name, email, selected_track_id, tracks:selected_track_id(title)");

    const { data: openFlags } = await sb
      .from("flags")
      .select("student_id, severity")
      .eq("resolved", false);

    const flagMap = new Map<string, { count: number; severity: string }>();
    for (const f of openFlags ?? []) {
      const prev = flagMap.get(f.student_id) ?? { count: 0, severity: "low" };
      flagMap.set(f.student_id, {
        count: prev.count + 1,
        severity: f.severity === "high" ? "high" : prev.severity,
      });
    }

    const { data: progress } = await sb
      .from("student_progress")
      .select("student_id, status");

    const progressMap = new Map<string, { completed: number; total: number }>();
    for (const p of progress ?? []) {
      const prev = progressMap.get(p.student_id) ?? { completed: 0, total: 0 };
      prev.total += 1;
      if (p.status === "completed") prev.completed += 1;
      progressMap.set(p.student_id, prev);
    }

    return (students ?? []).map((s: any) => ({
      ...s,
      flags: flagMap.get(s.id) ?? { count: 0, severity: "low" },
      progress: progressMap.get(s.id) ?? { completed: 0, total: 0 },
    }));
  });

export const getStudentDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ studentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeacher(context.supabase, context.userId);
    const sb = context.supabase;

    const [{ data: profile }, { data: progress }, { data: flags }, { data: notes }, { data: chats }] = await Promise.all([
      sb.from("profiles").select("*, tracks:selected_track_id(title)").eq("id", data.studentId).maybeSingle(),
      sb.from("student_progress").select("*, lessons(title)").eq("student_id", data.studentId),
      sb.from("flags").select("*, lessons(title)").eq("student_id", data.studentId).order("created_at", { ascending: false }),
      sb.from("teacher_notes").select("*").eq("student_id", data.studentId).order("created_at", { ascending: false }),
      sb.from("chat_messages").select("role, content, created_at, lessons(title)").eq("student_id", data.studentId).order("created_at", { ascending: false }).limit(30),
    ]);

    return { profile, progress: progress ?? [], flags: flags ?? [], notes: notes ?? [], chats: chats ?? [] };
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    studentId: z.string().uuid(),
    body: z.string().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeacher(context.supabase, context.userId);
    const { error } = await context.supabase.from("teacher_notes").insert({
      teacher_id: context.userId,
      student_id: data.studentId,
      body: data.body,
    });
    if (error) throw error;
    return { ok: true };
  });

export const resolveFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ flagId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureTeacher(context.supabase, context.userId);
    const { error } = await context.supabase.from("flags").update({ resolved: true }).eq("id", data.flagId);
    if (error) throw error;
    return { ok: true };
  });

export const becomeTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ accessCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // Demo access code; in production, replace with real invite flow
    if (data.accessCode !== "TEACH2024") throw new Error("Invalid access code");
    const { error } = await context.supabase.from("user_roles").insert({
      user_id: context.userId,
      role: "teacher",
    });
    if (error && !error.message.includes("duplicate")) throw error;
    return { ok: true };
  });

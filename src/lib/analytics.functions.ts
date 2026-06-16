import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const logEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      event: z.string().min(1).max(64),
      props: z.record(z.string(), z.any()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const isTeacher = roles?.some((r: any) => r.role === "teacher");
    await context.supabase.from("analytics_events").insert({
      actor_id: context.userId,
      actor_role: isTeacher ? "teacher" : "student",
      event: data.event,
      props: data.props ?? {},
    });
    return { ok: true };
  });

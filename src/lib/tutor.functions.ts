import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429) throw new Error("Rate limit reached. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits in workspace settings.");
    throw new Error(`AI gateway error: ${res.status} ${txt}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export const sendTutorMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      lessonId: z.string().uuid(),
      message: z.string().min(1).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const uid = context.userId;

    const { data: lesson } = await sb
      .from("lessons")
      .select("title, content, concept_tags, tracks(title, category)")
      .eq("id", data.lessonId)
      .single();

    const { data: history } = await sb
      .from("chat_messages")
      .select("role, content")
      .eq("student_id", uid)
      .eq("lesson_id", data.lessonId)
      .order("created_at")
      .limit(20);

    const track = lesson?.tracks as { title?: string; category?: string } | null;
    const systemPrompt = `You are a patient, supportive 1-on-1 tutor for a student learning "${track?.title ?? ""}" (${track?.category ?? ""}).
Current lesson: "${lesson?.title ?? ""}".
Lesson content: ${lesson?.content ?? ""}
Concepts: ${(lesson?.concept_tags ?? []).join(", ")}.
Be concise, encouraging, and Socratic. Give short examples. Never reveal full answers — guide with hints.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: data.message },
    ];

    await sb.from("chat_messages").insert({
      student_id: uid, lesson_id: data.lessonId, role: "user", content: data.message,
    });

    const reply = await callAI(messages);

    await sb.from("chat_messages").insert({
      student_id: uid, lesson_id: data.lessonId, role: "assistant", content: reply,
    });

    // Help-request signal: if user asks for help repeatedly on this concept
    const helpWords = /(stuck|don'?t (get|understand)|confused|help)/i;
    if (helpWords.test(data.message)) {
      const { data: recent } = await sb
        .from("chat_messages")
        .select("content")
        .eq("student_id", uid)
        .eq("lesson_id", data.lessonId)
        .eq("role", "user");
      const helpCount = (recent ?? []).filter((m) => helpWords.test(m.content)).length;
      if (helpCount >= 3) {
        const concept = (lesson?.concept_tags?.[0]) ?? "general";
        const { data: existingFlag } = await sb
          .from("flags").select("id")
          .eq("student_id", uid).eq("lesson_id", data.lessonId)
          .eq("concept", concept).eq("resolved", false).maybeSingle();
        if (!existingFlag) {
          await sb.from("flags").insert({
            student_id: uid,
            lesson_id: data.lessonId,
            concept,
            reason: `Student has asked the tutor for help ${helpCount} times on this lesson.`,
            severity: "medium",
          });
        }
      }
    }

    return { reply };
  });

export const generatePractice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lessonId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lesson } = await context.supabase
      .from("lessons")
      .select("title, content, concept_tags, tracks(title, category)")
      .eq("id", data.lessonId)
      .single();

    const track = lesson?.tracks as { title?: string; category?: string } | null;
    const sys = `Generate ONE short practice question for the lesson below. Return strict JSON: {"question":"...","options":["a","b","c","d"],"correctIndex":0,"concept":"..."}. Pick concept from lesson tags. Keep question under 200 chars. No prose outside JSON.`;
    const usr = `Track: ${track?.title}\nLesson: ${lesson?.title}\nContent: ${lesson?.content}\nConcepts: ${(lesson?.concept_tags ?? []).join(", ")}`;

    const raw = await callAI([
      { role: "system", content: sys },
      { role: "user", content: usr },
    ]);

    // strip code fences if model added them
    const cleaned = raw.replace(/```json|```/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned);
      return parsed as {
        question: string; options: string[]; correctIndex: number; concept: string;
      };
    } catch {
      return {
        question: `What is a key concept in "${lesson?.title}"?`,
        options: lesson?.concept_tags?.slice(0, 4) ?? ["a", "b", "c", "d"],
        correctIndex: 0,
        concept: lesson?.concept_tags?.[0] ?? "general",
      };
    }
  });

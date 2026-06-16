import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLesson, recordAttempt } from "@/lib/learning.functions";
import { sendTutorMessage, generatePractice } from "@/lib/tutor.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Send, Sparkles, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/lesson/$lessonId")({
  component: LessonPage,
});

type Practice = { question: string; options: string[]; correctIndex: number; concept: string };

function LessonPage() {
  const { lessonId } = Route.useParams();
  const fetchLesson = useServerFn(getLesson);
  const sendMsg = useServerFn(sendTutorMessage);
  const genPractice = useServerFn(generatePractice);
  const attempt = useServerFn(recordAttempt);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["lesson", lessonId],
    queryFn: () => fetchLesson({ data: { lessonId } }),
  });

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [data?.messages, sending]);

  const send = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    const msg = input;
    setInput("");
    try {
      await sendMsg({ data: { lessonId, message: msg } });
      qc.invalidateQueries({ queryKey: ["lesson", lessonId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const newPractice = async () => {
    setPracticeLoading(true);
    setSelected(null);
    setRevealed(false);
    try {
      const p = await genPractice({ data: { lessonId } });
      setPractice(p);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPracticeLoading(false);
    }
  };

  const submitAnswer = async () => {
    if (selected === null || !practice) return;
    const correct = selected === practice.correctIndex;
    setRevealed(true);
    try {
      await attempt({ data: { lessonId, correct, concept: practice.concept } });
      qc.invalidateQueries({ queryKey: ["lesson", lessonId] });
      qc.invalidateQueries({ queryKey: ["learn-home"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      toast[correct ? "success" : "info"](correct ? "Correct!" : "Not quite — try another.");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading || !data) return <div className="text-muted-foreground">Loading lesson...</div>;

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-8">
      <div>
        <Link to="/learn" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{data.lesson.title}</h1>
        <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">
          {(data.lesson.tracks as any)?.title}
        </p>
        <div className="mt-6 prose prose-sm max-w-none">
          <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">{data.lesson.content}</p>
        </div>

        <div className="mt-8 rounded-lg border p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium flex items-center gap-2"><Sparkles className="size-4 text-primary" /> Practice</h2>
            <Button size="sm" variant="outline" onClick={newPractice} disabled={practiceLoading}>
              {practiceLoading ? "Generating..." : practice ? "New question" : "Start practice"}
            </Button>
          </div>
          {practice && (
            <div className="mt-4 space-y-3">
              <p className="font-medium">{practice.question}</p>
              <div className="space-y-2">
                {practice.options.map((opt, i) => {
                  const isCorrect = revealed && i === practice.correctIndex;
                  const isWrong = revealed && i === selected && i !== practice.correctIndex;
                  return (
                    <button
                      key={i}
                      onClick={() => !revealed && setSelected(i)}
                      disabled={revealed}
                      className={`w-full text-left rounded-md border p-3 text-sm transition-colors ${
                        isCorrect ? "border-primary bg-primary/5"
                          : isWrong ? "border-destructive bg-destructive/5"
                          : selected === i ? "border-foreground"
                          : "hover:border-muted-foreground"
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {!revealed && (
                <Button onClick={submitAnswer} disabled={selected === null} size="sm">Submit</Button>
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 self-start rounded-lg border flex flex-col h-[600px]">
        <div className="border-b px-4 py-3">
          <h3 className="font-medium text-sm">AI Tutor</h3>
          <p className="text-xs text-muted-foreground">Ask questions, get hints.</p>
        </div>
        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {data.messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Start by asking anything about this lesson — "explain like I'm new" works too.
            </p>
          )}
          {data.messages.map((m: any) => (
            <div key={m.id} className={m.role === "user" ? "text-right" : ""}>
              <div className={`inline-block rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
              }`}>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            </div>
          ))}
          {sending && <div className="text-xs text-muted-foreground">Tutor is thinking...</div>}
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="border-t p-3 flex gap-2"
        >
          <Input
            placeholder="Ask the tutor..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </aside>
    </div>
  );
}

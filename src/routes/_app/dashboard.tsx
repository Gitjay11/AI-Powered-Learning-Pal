import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getStudentDashboard } from "@/lib/dashboard.functions";
import { logEvent } from "@/lib/analytics.functions";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, BookOpen, Brain, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: StudentDashboard,
});

const levelStyles: Record<string, string> = {
  healthy: "bg-emerald-100 text-emerald-900 border-emerald-200",
  attention: "bg-amber-100 text-amber-900 border-amber-200",
  at_risk: "bg-destructive/10 text-destructive border-destructive/30",
};
const levelLabel: Record<string, string> = {
  healthy: "On track", attention: "Needs attention", at_risk: "At risk",
};

const actionLabel: Record<string, string> = {
  continue: "Continue learning",
  revise_topic: "Revise a weak topic",
  retry_quiz: "Retry the last quiz",
  practice: "Practice more",
  open_tutor: "Ask the AI tutor",
  escalate: "Wait for teacher review",
};

function Sparkline({ values }: { values: number[] }) {
  if (values.length === 0) return <div className="h-8 text-xs text-muted-foreground">No quiz data yet.</div>;
  const w = 200, h = 36, max = 100;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const points = values.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" />
      {values.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * h} r="1.6" className="fill-primary" />
      ))}
    </svg>
  );
}

function StudentDashboard() {
  const nav = useNavigate();
  const fn = useServerFn(getStudentDashboard);
  const logFn = useServerFn(logEvent);
  const { data, isLoading, error } = useQuery({
    queryKey: ["student-dashboard"],
    queryFn: () => fn(),
  });

  useEffect(() => {
    logFn({ data: { event: "dashboard_opened" } }).catch(() => {});
  }, [logFn]);

  if (isLoading) return <div className="text-muted-foreground">Loading your dashboard...</div>;
  if (error) return <div className="text-destructive text-sm">{(error as Error).message}</div>;
  if (!data) return null;

  if ("needsOnboarding" in data && data.needsOnboarding) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold">Pick a learning track</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a track to unlock your personalized dashboard.</p>
        <Button className="mt-4" onClick={() => nav({ to: "/onboarding" })}>Choose track</Button>
      </div>
    );
  }

  const d = data as Exclude<typeof data, { needsOnboarding: true }>;
  const handleNextAction = () => {
    logFn({ data: { event: "recommendation_followed", props: { action: d.nextAction.action } } }).catch(() => {});
    const ctx = d.nextAction.context as any;
    if (ctx?.lesson_id) nav({ to: "/lesson/$lessonId", params: { lessonId: ctx.lesson_id } });
    else nav({ to: "/learn" });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Your track</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{(d.track as any)?.title ?? "—"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{(d.track as any)?.category}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="flex items-center gap-1">
            <Flame className="size-3" /> {d.streakDays}-day streak
          </Badge>
          <span className={`text-xs px-2 py-1 rounded-full border ${levelStyles[d.risk.level]}`}>
            {levelLabel[d.risk.level]}
          </span>
        </div>
      </div>

      {/* Next action — hero */}
      <Card className="p-6 border-primary/20">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Do this next</p>
            <h2 className="mt-1 text-xl font-semibold">{actionLabel[d.nextAction.action]}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{d.nextAction.reason}</p>
          </div>
          <Button size="lg" onClick={handleNextAction}>
            Start <ArrowRight className="size-4 ml-1" />
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Track completion</p>
            <BookOpen className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{d.completionPct}%</p>
          <p className="text-xs text-muted-foreground">{d.completed} / {d.totalLessons} lessons</p>
          <Progress value={d.completionPct} className="mt-3 h-1.5" />
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Quiz trend</p>
            <span className="text-xs text-muted-foreground">last {d.quizTrend.length}</span>
          </div>
          <div className="mt-2"><Sparkline values={d.quizTrend} /></div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">AI tutor</p>
            <Brain className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{d.tutorUsage.week}</p>
          <p className="text-xs text-muted-foreground">messages this week · {d.tutorUsage.total} all-time</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Weak concepts</p>
          {d.weakConcepts.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Take a few quizzes to see your weak spots.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.weakConcepts.map((c) => (
                <li key={c.concept} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{c.concept.replace(/_/g, " ")}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.round(Number(c.mastery_score) * 100)}% · {c.correct}/{c.attempts}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Why this status?</p>
          {(((d.risk.reasons as any[]) ?? []).length === 0) ? (
            <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" /> No issues detected. Keep going.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(d.risk.reasons as any[]).map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="size-4 mt-0.5 text-amber-500 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{r.label}</div>
                    <div className="text-xs text-muted-foreground">{r.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {d.teacherNotes.length > 0 && (
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">From your teacher</p>
          <ul className="mt-3 space-y-3">
            {d.teacherNotes.map((n: any) => (
              <li key={n.id} className="border-l-2 border-primary pl-3">
                <div className="text-xs text-muted-foreground capitalize">
                  {n.kind.replace(/_/g, " ")} · {new Date(n.created_at).toLocaleString()}
                </div>
                <p className="mt-1 text-sm whitespace-pre-wrap">{n.payload?.body ?? n.payload?.note ?? ""}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="text-center text-xs text-muted-foreground">
        <Link to="/learn" className="hover:text-foreground">Browse all lessons →</Link>
      </div>
    </div>
  );
}

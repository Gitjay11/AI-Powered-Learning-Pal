import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getStudentDetailV2, logIntervention } from "@/lib/intervention.functions";
import { logEvent } from "@/lib/analytics.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, CheckCircle2, MessageSquare, BookOpen, Eye } from "lucide-react";

export const Route = createFileRoute("/_app/teacher/$studentId")({
  component: StudentDetail,
});

const levelStyles: Record<string, string> = {
  healthy: "bg-emerald-100 text-emerald-900 border-emerald-200",
  attention: "bg-amber-100 text-amber-900 border-amber-200",
  at_risk: "bg-destructive/10 text-destructive border-destructive/30",
};
const levelLabel: Record<string, string> = {
  healthy: "On track", attention: "Needs attention", at_risk: "At risk",
};

const kindIcon: Record<string, any> = {
  reviewed: Eye, note: MessageSquare, assigned_revision: BookOpen,
  recommend_tutor: MessageSquare, cleared_flag: CheckCircle2, scheduled: Eye,
};

function StudentDetail() {
  const { studentId } = Route.useParams();
  const fetchDetail = useServerFn(getStudentDetailV2);
  const intervene = useServerFn(logIntervention);
  const log = useServerFn(logEvent);
  const qc = useQueryClient();
  const [noteBody, setNoteBody] = useState("");
  const [assignLessonId, setAssignLessonId] = useState("");
  const [resolution, setResolution] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["student-detail-v2", studentId],
    queryFn: () => fetchDetail({ data: { studentId } }),
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading...</div>;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["student-detail-v2", studentId] });
    qc.invalidateQueries({ queryKey: ["teacher-dashboard-v2"] });
    qc.invalidateQueries({ queryKey: ["teacher-metrics"] });
  };

  const doIntervene = async (
    kind: "reviewed" | "note" | "assigned_revision" | "recommend_tutor" | "cleared_flag" | "scheduled",
    extras: any = {},
  ) => {
    try {
      await intervene({ data: { studentId, kind, ...extras } });
      log({ data: { event: "intervention_taken", props: { kind } } }).catch(() => {});
      refresh();
      toast.success("Logged");
    } catch (e: any) { toast.error(e.message); }
  };

  const submitNote = async () => {
    if (!noteBody.trim()) return;
    await doIntervene("note", { payload: { body: noteBody } });
    setNoteBody("");
  };

  const assignRevision = async () => {
    if (!assignLessonId) return;
    const lesson: any = data.progress.find((p: any) => p.lesson_id === assignLessonId);
    await doIntervene("assigned_revision", { payload: { lesson_id: assignLessonId, title: lesson?.lessons?.title } });
    setAssignLessonId("");
  };

  const resolveFlag = async (flagId: string) => {
    await doIntervene("cleared_flag", { flagId, resolution: resolution || "Resolved" });
    log({ data: { event: "flag_resolved", props: { flagId } } }).catch(() => {});
    setResolution("");
  };

  const risk = data.risk ?? { score: 0, level: "healthy", reasons: [] };

  return (
    <div className="space-y-8">
      <div>
        <Link to="/teacher" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All students
        </Link>
        <div className="mt-4 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {data.profile?.full_name || data.profile?.email}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.profile?.email} · {(data.profile as any)?.tracks?.title ?? "No track"}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border ${levelStyles[risk.level]}`}>
            {levelLabel[risk.level]} · risk {risk.score}
          </span>
        </div>
      </div>

      {/* Risk panel */}
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Why this risk level</p>
        {(((risk.reasons as any[]) ?? []).length === 0) ? (
          <p className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-600" /> No risk signals detected.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(risk.reasons as any[]).map((r: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="size-4 mt-0.5 text-amber-500 flex-shrink-0" />
                <div>
                  <div className="font-medium">{r.label} <span className="text-xs text-muted-foreground">+{r.weight}</span></div>
                  <div className="text-xs text-muted-foreground">{r.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Quick actions */}
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Take action</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => doIntervene("reviewed", { payload: {} })}>
            <Eye className="size-4 mr-1" /> Mark reviewed
          </Button>
          <Button size="sm" variant="outline" onClick={() => doIntervene("recommend_tutor", { payload: {} })}>
            <MessageSquare className="size-4 mr-1" /> Recommend tutor chat
          </Button>
          <Button size="sm" variant="outline" onClick={() => doIntervene("scheduled", { payload: { when: "soon" } })}>
            Schedule attention
          </Button>
        </div>

        <div className="mt-5">
          <p className="text-xs text-muted-foreground mb-2">Assign a revision lesson</p>
          <div className="flex gap-2">
            <select
              value={assignLessonId}
              onChange={(e) => setAssignLessonId(e.target.value)}
              className="h-9 flex-1 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">Pick a lesson...</option>
              {data.progress.map((p: any) => (
                <option key={p.lesson_id} value={p.lesson_id}>{p.lessons?.title}</option>
              ))}
            </select>
            <Button size="sm" onClick={assignRevision} disabled={!assignLessonId}>
              <BookOpen className="size-4 mr-1" /> Assign
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs text-muted-foreground mb-2">Send a note</p>
          <Textarea
            placeholder="Encouragement, hint, or feedback..."
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            rows={3}
          />
          <Button className="mt-2" size="sm" onClick={submitNote} disabled={!noteBody.trim()}>
            Send note
          </Button>
        </div>
      </Card>

      {/* Flags */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" /> Flags
        </h2>
        <div className="mt-3 space-y-2">
          {data.flags.length === 0 && <p className="text-sm text-muted-foreground">No flags.</p>}
          {data.flags.map((f: any) => (
            <div key={f.id} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{f.concept}</div>
                  <div className="text-xs text-muted-foreground">{f.lessons?.title}</div>
                  <p className="mt-2 text-sm">{f.reason}</p>
                </div>
                {f.resolved ? (
                  <span className="text-xs flex items-center gap-1 text-muted-foreground whitespace-nowrap">
                    <CheckCircle2 className="size-3" /> Resolved
                  </span>
                ) : (
                  <div className="flex gap-2 items-center">
                    <Input
                      placeholder="Resolution note..."
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      className="h-8 w-40 text-xs"
                    />
                    <Button size="sm" variant="outline" onClick={() => resolveFlag(f.id)}>Resolve</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mastery */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Topic mastery</h2>
        <div className="mt-3 space-y-2">
          {data.mastery.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
          {data.mastery.map((m: any) => (
            <div key={m.concept} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span className="capitalize">{m.concept.replace(/_/g, " ")}</span>
              <span className="text-muted-foreground tabular-nums">
                {Math.round(Number(m.mastery_score) * 100)}% · {m.correct}/{m.attempts}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Intervention timeline */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Intervention history</h2>
        <div className="mt-3 space-y-2">
          {data.interventions.length === 0 && <p className="text-sm text-muted-foreground">No interventions yet.</p>}
          {data.interventions.map((iv: any) => {
            const Icon = kindIcon[iv.kind] ?? Eye;
            return (
              <div key={iv.id} className="flex items-start gap-3 rounded-md border p-3">
                <Icon className="size-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium capitalize">{iv.kind.replace(/_/g, " ")}</div>
                  <div className="text-xs text-muted-foreground">{new Date(iv.created_at).toLocaleString()}</div>
                  {iv.payload?.body && <p className="mt-1 text-sm whitespace-pre-wrap">{iv.payload.body}</p>}
                  {iv.payload?.title && <p className="mt-1 text-xs">Lesson: {iv.payload.title}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Progress */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Lesson progress</h2>
        <div className="mt-3 space-y-2">
          {data.progress.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          {data.progress.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>{p.lessons?.title}</span>
              <span className="text-muted-foreground tabular-nums">
                {p.score}/{p.attempts} · {p.status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Recent chats */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recent tutor chat</h2>
        <div className="mt-3 space-y-2 max-h-80 overflow-y-auto rounded-md border p-3">
          {data.chats.length === 0 && <p className="text-sm text-muted-foreground">No conversations yet.</p>}
          {data.chats.slice().reverse().map((m: any, i: number) => (
            <div key={i} className="text-sm">
              <span className="text-xs text-muted-foreground">{m.role} · {m.lessons?.title}</span>
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

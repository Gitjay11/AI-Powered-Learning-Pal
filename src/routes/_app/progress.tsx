import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProgressOverview } from "@/lib/learning.functions";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/progress")({
  component: ProgressPage,
});

function ProgressPage() {
  const fn = useServerFn(getProgressOverview);
  const { data } = useQuery({ queryKey: ["progress"], queryFn: () => fn() });
  useQueryClient();

  if (!data) return <div className="text-muted-foreground">Loading...</div>;

  const completed = data.progress.filter((p: any) => p.status === "completed").length;
  const struggling = data.progress.filter((p: any) => p.status === "struggling").length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your progress</h1>
        <div className="mt-6 grid sm:grid-cols-3 gap-4">
          <Stat label="Lessons completed" value={completed} />
          <Stat label="In progress" value={data.progress.length - completed - struggling} />
          <Stat label="Open flags" value={data.flags.filter((f: any) => !f.resolved).length} />
        </div>
      </div>

      <div>
        <h2 className="font-medium">Lesson activity</h2>
        <div className="mt-3 space-y-2">
          {data.progress.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          {data.progress.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between rounded-md border p-3 text-sm">
              <div className="flex items-center gap-3">
                {p.status === "completed" ? <CheckCircle2 className="size-4 text-primary" />
                  : p.status === "struggling" ? <AlertTriangle className="size-4 text-amber-500" />
                  : <span className="size-2 rounded-full bg-muted-foreground" />}
                <span>{p.lessons?.title}</span>
                <span className="text-muted-foreground text-xs">{p.lessons?.tracks?.title}</span>
              </div>
              <span className="text-muted-foreground tabular-nums">{p.score}/{p.attempts}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="font-medium">Flags</h2>
        <div className="mt-3 space-y-2">
          {data.flags.length === 0 && <p className="text-sm text-muted-foreground">No flags. Keep going!</p>}
          {data.flags.map((f: any, i: number) => (
            <div key={i} className="rounded-md border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.concept}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  f.resolved ? "bg-secondary text-muted-foreground" : "bg-amber-100 text-amber-900"
                }`}>{f.resolved ? "resolved" : f.severity}</span>
              </div>
              <p className="mt-1 text-muted-foreground">{f.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

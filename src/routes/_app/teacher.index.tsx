import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTeacherDashboardV2, getTeacherMetrics } from "@/lib/intervention.functions";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users, TrendingUp, Filter } from "lucide-react";

export const Route = createFileRoute("/_app/teacher/")({
  component: TeacherDashboard,
});

const levelStyles: Record<string, string> = {
  healthy: "bg-emerald-100 text-emerald-900 border-emerald-200",
  attention: "bg-amber-100 text-amber-900 border-amber-200",
  at_risk: "bg-destructive/10 text-destructive border-destructive/30",
};
const levelLabel: Record<string, string> = {
  healthy: "On track", attention: "Attention", at_risk: "At risk",
};

function TeacherDashboard() {
  const { role, loading } = useAuth();
  const dashFn = useServerFn(getTeacherDashboardV2);
  const metricsFn = useServerFn(getTeacherMetrics);

  const [trackId, setTrackId] = useState<string | null>(null);
  const [level, setLevel] = useState<"healthy" | "attention" | "at_risk" | null>(null);
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const { data: dash, isLoading, error } = useQuery({
    queryKey: ["teacher-dashboard-v2", trackId, level, unresolvedOnly, search],
    queryFn: () => dashFn({ data: { trackId, level, unresolvedOnly, search } }),
    enabled: role === "teacher",
  });
  const { data: metrics } = useQuery({
    queryKey: ["teacher-metrics"],
    queryFn: () => metricsFn(),
    enabled: role === "teacher",
  });

  if (loading) return <div className="text-muted-foreground">Loading...</div>;
  if (role !== "teacher") {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold">Teacher access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need a teacher role.{" "}
          <Link to="/onboarding" className="underline text-foreground">Enter access code</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dash?.rows.length ?? 0} matching · {metrics?.flaggedCount ?? 0} open flags
        </p>
      </div>

      {/* Metrics strip */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Open flags</p>
              <AlertTriangle className="size-4 text-amber-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{metrics.flaggedCount}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">By risk</p>
            <div className="mt-2 flex gap-2 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">{metrics.byLevel.healthy ?? 0}</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">{metrics.byLevel.attention ?? 0}</span>
              <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{metrics.byLevel.at_risk ?? 0}</span>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Avg completion</p>
              <TrendingUp className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{metrics.avgCompletion}%</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Top weak topics</p>
            <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {metrics.topWeakConcepts.slice(0, 3).map((c) => (
                <div key={c.concept} className="truncate">{c.concept} <span className="tabular-nums">({c.count})</span></div>
              ))}
              {metrics.topWeakConcepts.length === 0 && <span>—</span>}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-3 flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground ml-1" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-8"
        />
        <select
          value={trackId ?? ""}
          onChange={(e) => setTrackId(e.target.value || null)}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All tracks</option>
          {dash?.tracks.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <select
          value={level ?? ""}
          onChange={(e) => setLevel((e.target.value || null) as any)}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All risk levels</option>
          <option value="at_risk">At risk</option>
          <option value="attention">Needs attention</option>
          <option value="healthy">On track</option>
        </select>
        <Button
          variant={unresolvedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setUnresolvedOnly((v) => !v)}
        >
          Unresolved only
        </Button>
      </Card>

      {isLoading && <div className="text-sm text-muted-foreground">Loading students...</div>}
      {error && <div className="text-destructive text-sm">{(error as Error).message}</div>}

      {dash && dash.rows.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Users className="size-6 text-muted-foreground mx-auto mb-2" />
          <h2 className="font-medium">No students match</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Share the sign-up link to invite students. They'll appear here automatically.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {dash?.rows.map((s: any) => (
          <Link
            key={s.id}
            to="/teacher/$studentId"
            params={{ studentId: s.id }}
            className="flex items-center justify-between rounded-md border p-4 hover:border-primary transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{s.full_name || s.email}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${levelStyles[s.risk.level]}`}>
                  {levelLabel[s.risk.level]}
                </span>
                {s.openFlags.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                    {s.openFlags.length} flag{s.openFlags.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {s.tracks?.title ?? "No track"} · {s.progress.completed}/{s.progress.total} lessons
                {s.risk.reasons?.[0] && <> · {s.risk.reasons[0].label}</>}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground tabular-nums ml-3">
              risk {s.risk.score}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

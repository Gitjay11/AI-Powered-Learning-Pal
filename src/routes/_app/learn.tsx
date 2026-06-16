import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getLearnHome } from "@/lib/learning.functions";
import { useEffect } from "react";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/learn")({
  component: Learn,
});

function Learn() {
  const fn = useServerFn(getLearnHome);
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["learn-home"], queryFn: () => fn() });

  useEffect(() => {
    if (data?.needsOnboarding) nav({ to: "/onboarding" });
  }, [data, nav]);

  if (isLoading || !data || data.needsOnboarding) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{data.track?.category}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{data.track?.title}</h1>
        </div>
        <Link to="/onboarding" className="text-sm text-muted-foreground hover:text-foreground">Change track</Link>
      </div>

      <div className="mt-8 space-y-3">
        {data.lessons?.map((l, i) => {
          const status = l.progress?.status ?? "not_started";
          const icon = status === "completed" ? <CheckCircle2 className="size-5 text-primary" />
            : status === "struggling" ? <AlertTriangle className="size-5 text-amber-500" />
            : <Circle className="size-5 text-muted-foreground" />;
          return (
            <Link
              key={l.id}
              to="/lesson/$lessonId"
              params={{ lessonId: l.id }}
              className="flex items-center gap-4 rounded-lg border p-4 hover:border-primary transition-colors"
            >
              {icon}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">Lesson {i + 1}</span>
                </div>
                <h3 className="mt-0.5 font-medium">{l.title}</h3>
              </div>
              <div className="text-xs text-muted-foreground">
                {l.progress ? `${l.progress.score} pts` : "Start"}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

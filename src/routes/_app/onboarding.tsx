import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getTracks, selectTrack } from "@/lib/learning.functions";
import { becomeTeacher } from "@/lib/teacher.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { Code, Languages } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/onboarding")({
  component: Onboarding,
});

function Onboarding() {
  const fetchTracks = useServerFn(getTracks);
  const pick = useServerFn(selectTrack);
  const teacher = useServerFn(becomeTeacher);
  const nav = useNavigate();
  const { refreshRole } = useAuth();
  const [code, setCode] = useState("");
  const { data: tracks } = useQuery({ queryKey: ["tracks"], queryFn: () => fetchTracks() });

  const [picking, setPicking] = useState<string | null>(null);
  const choose = async (id: string) => {
    if (picking) return;
    setPicking(id);
    try {
      await pick({ data: { trackId: id } });
      toast.success("Track selected");
      nav({ to: "/learn" });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not select track");
      setPicking(null);
    }
  };

  const becomeT = async () => {
    try {
      await teacher({ data: { accessCode: code } });
      await refreshRole();
      toast.success("Teacher access granted");
      nav({ to: "/teacher" });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-semibold tracking-tight">Pick your track</h1>
      <p className="mt-2 text-muted-foreground">Choose what you want to learn first. You can switch later.</p>
      <div className="mt-8 grid sm:grid-cols-2 gap-4">
        {tracks?.map((t) => (
          <button
            key={t.id}
            onClick={() => choose(t.id)}
            disabled={picking !== null}
            className="text-left rounded-lg border p-5 hover:border-primary transition-colors disabled:opacity-60"
          >
            <div className="flex items-center gap-2 text-primary">
              {t.category === "coding" ? <Code className="size-4" /> : <Languages className="size-4" />}
              <span className="text-xs uppercase tracking-wider">{t.category}</span>
            </div>
            <h3 className="mt-2 font-medium text-lg">{t.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
            {picking === t.id && <p className="mt-2 text-xs text-muted-foreground">Setting up…</p>}
          </button>
        ))}
      </div>

    </div>
  );
}

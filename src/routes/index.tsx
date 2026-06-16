import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { Brain, GraduationCap, UserRound } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, role } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Brain className="size-4" />
          </div>
          <span className="font-semibold tracking-tight">Lumen</span>
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link to={role === "teacher" ? "/teacher" : "/learn"}>Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/login">Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/signup">Get started</Link></Button>
            </>
          )}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" />
          AI tutor + human teacher in the loop
        </div>
        <h1 className="mt-6 text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Personalized learning,<br />
          <span className="text-muted-foreground">built around you.</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl">
          Adaptive lessons in coding and languages. An AI tutor that adapts to how you learn,
          and a real teacher watching your progress.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/signup">Start learning</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/login">I have an account</Link></Button>
        </div>

        <div className="mt-24 grid sm:grid-cols-3 gap-6">
          {[
            { icon: Brain, title: "AI Tutor", body: "Conversational guidance that adapts to your pace and style." },
            { icon: GraduationCap, title: "Adaptive Lessons", body: "Practice that gets harder as you improve, easier when you struggle." },
            { icon: UserRound, title: "Human in the Loop", body: "When you're stuck, a real teacher steps in." },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border p-5">
              <f.icon className="size-5 text-primary" />
              <h3 className="mt-3 font-medium">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

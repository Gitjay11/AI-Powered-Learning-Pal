import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Brain, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const navItems = role === "teacher"
    ? [
        { to: "/teacher", label: "Students" },
        { to: "/learn", label: "Lessons" },
      ]
    : [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/learn", label: "Lessons" },
        { to: "/progress", label: "Progress" },
      ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="size-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <Brain className="size-4" />
              </div>
              <span className="font-semibold tracking-tight text-sm">Lumen</span>
            </Link>
            <nav className="flex gap-1">
              {navItems.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    path.startsWith(n.to) ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {user?.email} · <span className="capitalize">{role ?? "..."}</span>
            </span>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); nav({ to: "/" }); }}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}

import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardList, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/companies", label: "Company pool" },
  { to: "/admin/assignments", label: "Assignments" },
  { to: "/admin/interns", label: "Interns" },
  { to: "/admin/onboarded", label: "Onboarded" },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ClipboardList className="h-4 w-4" />
            </span>
            <span className="font-display text-sm font-bold">My dashboard</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/admin" }}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary data-[status=active]:bg-secondary data-[status=active]:text-secondary-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 pb-16">
        <Outlet />
      </main>
    </div>
  );
}

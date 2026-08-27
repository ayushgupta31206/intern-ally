import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardList, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intern Company Tracker — Sign in" },
      {
        name: "description",
        content:
          "Interns sign in with Google to see the companies assigned to them for today's outreach.",
      },
      { property: "og:title", content: "Intern Company Tracker — Sign in" },
      {
        property: "og:description",
        content: "Interns sign in with Google to see their assigned companies.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/my", replace: true });
    });
  }, [navigate]);

  async function signIn() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/my", replace: true });
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ClipboardList className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-bold">Intern Company Tracker</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with the Google account your manager added to see the companies assigned to you.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <Button className="w-full" size="lg" onClick={signIn} disabled={loading}>
            {loading ? "Opening Google…" : "Continue with Google"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Interns land on their own list. Everyone else gets their own manager dashboard.
          </p>
        </div>
      </div>
    </main>
  );
}

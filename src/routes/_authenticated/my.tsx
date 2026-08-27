import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getMyIntern } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/my")({
  head: () => ({
    meta: [
      { title: "My companies — Intern Company Tracker" },
      {
        name: "description",
        content: "Your assigned companies for today's outreach, newest batch first.",
      },
      { property: "og:title", content: "My companies — Intern Company Tracker" },
      { property: "og:description", content: "Your assigned companies for today's outreach." },
    ],
  }),
  component: MyCompanies,
});

type Outcome = "interested" | "not_interested" | "didnt_pick" | "onboard_request" | "survey_completed";

type Company = {
  id: string;
  name: string;
  date_assigned: string | null;
  outcome: string | null;
};

const OUTCOMES: { value: Outcome; label: string; toast: string }[] = [
  { value: "interested", label: "Interested", toast: "Marked interested" },
  { value: "not_interested", label: "Not interested", toast: "Marked not interested" },
  { value: "didnt_pick", label: "Didn't pick", toast: "Marked didn't pick — it stays on your list" },
  { value: "onboard_request", label: "Onboarded", toast: "Sent to your manager to confirm" },
  { value: "survey_completed", label: "Survey Completed", toast: "Marked survey completed" },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function MyCompanies() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchMe = useServerFn(getMyIntern);

  const internQuery = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  const companiesQuery = useQuery({
    queryKey: ["my-companies"],
    enabled: !!internQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, date_assigned, outcome")
        .eq("status", "assigned")
        .order("date_assigned", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const setOutcome = useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome: Outcome | null }) => {
      const { error } = await supabase
        .from("companies")
        .update({ outcome, outcome_at: outcome ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["my-companies"] });
      const option = OUTCOMES.find((item) => item.value === variables.outcome);
      toast.success(option ? option.toast : "Cleared");
    },
    onError: () => toast.error("Couldn't update that company"),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (internQuery.isLoading) {
    return <CenteredNote text="Loading your list…" />;
  }

  if (!internQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold">You're not on an intern list</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This Google account isn't listed as an intern. You can manage your own interns and
            company pool from your manager dashboard instead.
          </p>
          <Button className="mt-5 w-full" onClick={() => navigate({ to: "/admin" })}>
            Open my dashboard
          </Button>
          <Button variant="outline" className="mt-2 w-full" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </main>
    );
  }

  const companies = companiesQuery.data ?? [];
  const groups = new Map<string, Company[]>();
  for (const company of companies) {
    const key = company.date_assigned ?? "No date";
    groups.set(key, [...(groups.get(key) ?? []), company]);
  }
  const dates = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));
  const today = todayISO();

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 pb-16 pt-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Signed in as
          </p>
          <h1 className="text-xl font-bold">{internQuery.data.name}</h1>
          <p className="text-sm text-muted-foreground">
            {companies.length} open {companies.length === 1 ? "company" : "companies"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
          <Button variant="link" size="sm" onClick={() => navigate({ to: "/admin" })}>
            Manager dashboard
          </Button>
        </div>
      </header>

      {companiesQuery.isLoading ? (
        <CenteredNote text="Loading companies…" />
      ) : dates.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="font-display font-semibold">Nothing assigned yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your list will appear here once your manager assigns today's batch.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <section key={date}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold">{date === today ? "Today" : date}</h2>
                {date === today ? (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                    {groups.get(date)!.length} to contact
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {groups.get(date)!.length} open
                  </span>
                )}
              </div>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {groups.get(date)!.map((company) => (
                  <li key={company.id} className="flex flex-col gap-2 p-3">
                    <span className="text-sm font-medium">{company.name}</span>
                    <div className="flex flex-wrap gap-2">
                      {OUTCOMES.map((option) => {
                        const active = company.outcome === option.value;
                        return (
                          <Button
                            key={option.value}
                            variant={active ? "default" : "outline"}
                            size="sm"
                            disabled={setOutcome.isPending}
                            onClick={() =>
                              setOutcome.mutate({
                                id: company.id,
                                outcome: active ? null : option.value,
                              })
                            }
                          >
                            {option.label}
                          </Button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

function CenteredNote({ text }: { text: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

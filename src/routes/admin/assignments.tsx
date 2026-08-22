import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, Flag } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAssignments, markOnboarded } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/assignments")({
  head: () => ({
    meta: [
      { title: "Assignments — Intern Company Tracker" },
      {
        name: "description",
        content: "Every open assignment by date and intern, with one-click onboarding.",
      },
      { property: "og:title", content: "Assignments — Intern Company Tracker" },
      { property: "og:description", content: "Open assignments by date and intern." },
    ],
  }),
  component: Assignments,
});

function Assignments() {
  const queryClient = useQueryClient();
  const fetchAssignments = useServerFn(getAssignments);
  const onboard = useServerFn(markOnboarded);
  const [search, setSearch] = useState("");
  const [readyOnly, setReadyOnly] = useState(false);

  const assignments = useQuery({
    queryKey: ["assignments"],
    queryFn: () => fetchAssignments(),
  });

  const move = useMutation({
    mutationFn: (id: string) => onboard({ data: { id } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Couldn't move that company"),
  });

  const term = search.toLowerCase();
  const rows = (assignments.data ?? []).filter((row) => {
    if (readyOnly && !row.readyFlag) return false;
    if (!term) return true;
    return (
      row.name.toLowerCase().includes(term) ||
      row.internName.toLowerCase().includes(term) ||
      (row.dateAssigned ?? "").includes(term)
    );
  });

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.dateAssigned ?? "No date";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const dates = [...groups.keys()].sort((a, b) => (a < b ? 1 : -1));
  const flaggedCount = (assignments.data ?? []).filter((row) => row.readyFlag).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assignments</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} open · {flaggedCount} flagged ready by interns
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search company, intern or date…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-72"
        />
        <Button
          variant={readyOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setReadyOnly((value) => !value)}
        >
          <Flag className="mr-1.5 h-4 w-4" />
          Flagged only
        </Button>
      </div>

      {dates.length === 0 ? (
        <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          Nothing to show.
        </p>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <section key={date}>
              <h2 className="mb-2 text-sm font-semibold">{date}</h2>
              <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                {groups.get(date)!.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
                    <span className="text-xs text-muted-foreground">{row.internName}</span>
                    {row.readyFlag && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                        ready
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => move.mutate(row.id)}
                      disabled={move.isPending}
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Mark onboarded
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

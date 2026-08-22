import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assignTodaysBatch, getOverview } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Admin dashboard — Intern Company Tracker" },
      {
        name: "description",
        content: "Pool counts, onboarded totals, and the daily assignment log.",
      },
      { property: "og:title", content: "Admin dashboard — Intern Company Tracker" },
      { property: "og:description", content: "Pool counts and the daily assignment log." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getOverview);
  const assign = useServerFn(assignTodaysBatch);

  const overview = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview() });

  const assignBatch = useMutation({
    mutationFn: () => assign({ data: { perIntern: 10 } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Assignment failed. Nothing was changed."),
  });

  const data = overview.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.internCount} interns · 10 companies each per day` : "Loading…"}
          </p>
        </div>
        <Button onClick={() => assignBatch.mutate()} disabled={assignBatch.isPending}>
          <Shuffle className="mr-2 h-4 w-4" />
          {assignBatch.isPending ? "Assigning…" : "Assign Today's Batch"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Companies in pool" value={data?.poolTotal} />
        <Stat label="Unassigned" value={data?.unassigned} />
        <Stat label="Assigned" value={data?.assigned} />
        <Stat label="Onboarded" value={data?.onboarded} accent />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Assignment log</h2>
        {!data || data.log.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
            No assignments yet.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {data.log.map((entry) => (
              <li key={entry.date} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-sm font-semibold">{entry.date}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.total} still open from this batch
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {Object.entries(entry.interns)
                    .map(([name, count]) => `${name}: ${count}`)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | undefined;
  accent?: boolean;
}) {
  return (
    <div className="stat-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={`mt-1 font-display text-2xl font-bold ${accent ? "text-success" : "text-foreground"}`}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

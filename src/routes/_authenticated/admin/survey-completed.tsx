import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { getSurveyCompleted } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/survey-completed")({
  head: () => ({
    meta: [
      { title: "Survey completed — Intern Company Tracker" },
      {
        name: "description",
        content: "Final record of companies whose survey is complete, searchable by intern or date.",
      },
      { property: "og:title", content: "Survey completed — Intern Company Tracker" },
      { property: "og:description", content: "Final record of survey-completed companies." },
    ],
  }),
  component: SurveyCompleted,
});

function SurveyCompleted() {
  const fetchSurveyCompleted = useServerFn(getSurveyCompleted);
  const [search, setSearch] = useState("");

  const surveyCompleted = useQuery({
    queryKey: ["survey-completed"],
    queryFn: () => fetchSurveyCompleted(),
  });

  const term = search.toLowerCase();
  const rows = (surveyCompleted.data ?? []).filter((row) =>
    !term
      ? true
      : row.name.toLowerCase().includes(term) ||
        (row.completed_by ?? "").toLowerCase().includes(term) ||
        (row.date_completed ?? "").includes(term),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Survey completed companies</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} total. These are out of the working pool for good.
        </p>
      </div>

      <Input
        placeholder="Filter by company, intern or date…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-72"
      />

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {rows.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">No surveys completed yet.</li>
        )}
        {rows.map((row) => (
          <li key={row.id} className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
              <span className="text-xs text-muted-foreground">{row.completed_by ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{row.date_completed}</span>
            </div>
            {row.notes && <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

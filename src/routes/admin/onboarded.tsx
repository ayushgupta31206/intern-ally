import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { getOnboarded } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/onboarded")({
  head: () => ({
    meta: [
      { title: "Onboarded companies — Intern Company Tracker" },
      {
        name: "description",
        content: "Final record of onboarded companies, searchable by intern or date.",
      },
      { property: "og:title", content: "Onboarded companies — Intern Company Tracker" },
      { property: "og:description", content: "Final record of onboarded companies." },
    ],
  }),
  component: Onboarded,
});

function Onboarded() {
  const fetchOnboarded = useServerFn(getOnboarded);
  const [search, setSearch] = useState("");

  const onboarded = useQuery({ queryKey: ["onboarded"], queryFn: () => fetchOnboarded() });

  const term = search.toLowerCase();
  const rows = (onboarded.data ?? []).filter((row) =>
    !term
      ? true
      : row.name.toLowerCase().includes(term) ||
        (row.onboarded_by ?? "").toLowerCase().includes(term) ||
        (row.date_onboarded ?? "").includes(term),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Onboarded companies</h1>
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
          <li className="p-4 text-sm text-muted-foreground">Nothing onboarded yet.</li>
        )}
        {rows.map((row) => (
          <li key={row.id} className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.name}</span>
              <span className="text-xs text-muted-foreground">{row.onboarded_by ?? "—"}</span>
              <span className="text-xs text-muted-foreground">{row.date_onboarded}</span>
            </div>
            {row.notes && <p className="mt-1 text-xs text-muted-foreground">{row.notes}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

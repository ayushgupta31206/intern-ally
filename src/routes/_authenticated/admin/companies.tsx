import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCompanies, deleteCompany, getPool } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/companies")({
  head: () => ({
    meta: [
      { title: "Company pool — Intern Company Tracker" },
      { name: "description", content: "Paste or upload companies into the unassigned pool." },
      { property: "og:title", content: "Company pool — Intern Company Tracker" },
      { property: "og:description", content: "Paste or upload companies into the pool." },
    ],
  }),
  component: CompanyPool,
});

function CompanyPool() {
  const queryClient = useQueryClient();
  const fetchPool = useServerFn(getPool);
  const add = useServerFn(addCompanies);
  const remove = useServerFn(deleteCompany);
  const [raw, setRaw] = useState("");
  const [filter, setFilter] = useState("");

  const pool = useQuery({ queryKey: ["pool"], queryFn: () => fetchPool() });

  const upload = useMutation({
    mutationFn: (value: string) => add({ data: { raw: value } }),
    onSuccess: (result) => {
      toast.success(
        `Added ${result.added} companies${result.skipped ? ` · ${result.skipped} duplicates skipped` : ""}`,
      );
      setRaw("");
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Upload failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Company removed from the pool");
      queryClient.invalidateQueries({ queryKey: ["pool"] });
    },
    onError: () => toast.error("Could not delete company"),
  });

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRaw((current) => (current ? `${current}\n${text}` : text));
    event.target.value = "";
  }

  const rows = (pool.data ?? []).filter((row) =>
    row.name.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Company pool</h1>
        <p className="text-sm text-muted-foreground">
          One company per line, or upload a CSV (first column is used). Duplicates are ignored.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="space-y-2">
          <Label htmlFor="companies">Paste companies</Label>
          <Textarea
            id="companies"
            rows={8}
            value={raw}
            placeholder={"Acme Inc\nGlobex\nInitech"}
            onChange={(event) => setRaw(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => upload.mutate(raw)}
            disabled={!raw.trim() || upload.isPending}
          >
            <Upload className="mr-2 h-4 w-4" />
            {upload.isPending ? "Adding…" : "Add to pool"}
          </Button>
          <Input type="file" accept=".csv,.txt" onChange={onFile} className="max-w-56" />
        </div>
      </div>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Pool (latest 500)</h2>
          <Input
            placeholder="Search…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="max-w-48"
          />
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {rows.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">No companies yet.</li>
          )}
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
              {row.status === "assigned" ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {row.internName} · {row.dateAssigned}
                </span>
              ) : (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  unassigned
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label={`Delete ${row.name}`}
                title="Delete company"
                disabled={del.isPending}
                onClick={() => del.mutate(row.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

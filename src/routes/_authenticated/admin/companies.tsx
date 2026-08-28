import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addCompanies, deleteCompanies, deleteCompany, getPool } from "@/lib/admin.functions";

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
  const removeMany = useServerFn(deleteCompanies);
  const [raw, setRaw] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const delMany = useMutation({
    mutationFn: (ids: string[]) => removeMany({ data: { ids } }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(`Deleted ${result.deleted} compan${result.deleted === 1 ? "y" : "ies"} from the pool`);
      } else {
        toast.error(result.message || "Bulk delete failed");
      }
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["pool"] });
    },
    onError: () => toast.error("Bulk delete failed"),
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

  const visibleIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} compan${ids.length === 1 ? "y" : "ies"} from the pool? This cannot be undone.`)) return;
    delMany.mutate(ids);
  }

  const busy = del.isPending || delMany.isPending;

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
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={toggleAll}
                aria-label="Select all visible companies"
              />
              Select all
            </label>
            <span className="text-xs text-muted-foreground">
              {selected.size > 0 ? `${selected.size} selected` : `Pool (latest 500)`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={bulkDelete}
                disabled={busy}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete selected
              </Button>
            )}
            <Input
              placeholder="Search…"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="max-w-48"
            />
          </div>
        </div>
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {rows.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">No companies yet.</li>
          )}
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 p-3 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-input"
                checked={selected.has(row.id)}
                onChange={() => toggleOne(row.id)}
                aria-label={`Select ${row.name}`}
              />
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
                disabled={busy}
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

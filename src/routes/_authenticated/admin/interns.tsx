import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addIntern, getInterns, removeIntern } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/interns")({
  head: () => ({
    meta: [
      { title: "Interns — Intern Company Tracker" },
      {
        name: "description",
        content: "Manage which Google accounts can sign in and receive daily company batches.",
      },
      { property: "og:title", content: "Interns — Intern Company Tracker" },
      { property: "og:description", content: "Manage intern access by Google email." },
    ],
  }),
  component: Interns,
});

function Interns() {
  const queryClient = useQueryClient();
  const fetchInterns = useServerFn(getInterns);
  const create = useServerFn(addIntern);
  const destroy = useServerFn(removeIntern);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const interns = useQuery({ queryKey: ["interns"], queryFn: () => fetchInterns() });

  const add = useMutation({
    mutationFn: () => create({ data: { name, email } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setName("");
      setEmail("");
      toast.success("Intern added");
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Couldn't add that intern"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => destroy({ data: { id } }),
    onSuccess: () => {
      toast.success("Intern removed");
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Couldn't remove that intern"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Interns</h1>
        <p className="text-sm text-muted-foreground">
          Only these Google accounts can sign in. Each one gets 10 companies per batch.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Google email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={add.isPending}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </form>

      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {(interns.data ?? []).length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">No interns added yet.</li>
        )}
        {(interns.data ?? []).map((intern) => (
          <li key={intern.id} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{intern.name}</p>
              <p className="truncate text-xs text-muted-foreground">{intern.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${intern.name}`}
              onClick={() => remove.mutate(intern.id)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

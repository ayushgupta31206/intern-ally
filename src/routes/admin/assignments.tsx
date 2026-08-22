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
  component: Assignments;
});

function Assignments() {
  return null;
}

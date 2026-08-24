import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin, adminStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin sign in — Intern Company Tracker" },
      { name: "description", content: "Password-protected admin access for managing assignments." },
      { property: "og:title", content: "Admin sign in — Intern Company Tracker" },
      { property: "og:description", content: "Password-protected admin access." },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const router = useRouter();
  const login = useServerFn(adminLogin);
  const checkStatus = useServerFn(adminStatus);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.trim().length === 0) {
      setError("Enter your admin password");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await login({ data: { password } });
      if (!result.ok) {
        setError(result.message || "Incorrect password");
        return;
      }
      // Confirm the session cookie actually came back before navigating,
      // otherwise the admin loader would silently bounce us straight back here.
      const { isAdmin } = await checkStatus();
      if (!isAdmin) {
        setError("Password accepted, but the session couldn't be saved. Allow cookies for this site, or open the preview in a new tab, then try again.");
        return;
      }
      await router.invalidate();
      navigate({ to: "/admin", replace: true });
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <form onSubmit={onSubmit} className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-bold">Admin sign in</h1>
        </div>
        <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor="password">Admin password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Checking…" : "Sign in"}
          </Button>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="underline-offset-4 hover:underline">
            Intern sign in
          </Link>
        </p>
      </form>
    </main>
  );
}

import { createHash, timingSafeEqual } from "node:crypto";

import { useSession } from "@tanstack/react-start/server";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { supabaseAdmin };

type AdminSession = { isAdmin?: boolean };

function sessionConfig() {
  const password = process.env["ADMIN_SESSION_SECRET"];
  if (!password) throw new Error("ADMIN_SESSION_SECRET is not set");
  return {
    password,
    name: "ict-admin",
    maxAge: 60 * 60 * 12,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function getAdminSession() {
  return useSession<AdminSession>(sessionConfig());
}

export async function isAdminRequest(): Promise<boolean> {
  const session = await getAdminSession();
  return session.data.isAdmin === true;
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminRequest())) throw new Error("Not signed in as admin");
}

/** Timing-safe comparison against the ADMIN_PASSWORD secret. */
export function adminPasswordMatches(input: string): boolean {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("ADMIN_PASSWORD is not configured yet");
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export function parseCompanyNames(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    // Tolerate simple CSV: take the first column.
    const first = line.split(",")[0] ?? "";
    const name = first.replace(/^["']|["']$/g, "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

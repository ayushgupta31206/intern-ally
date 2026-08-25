import { supabaseAdmin } from "@/integrations/supabase/client.server";

export { supabaseAdmin };

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

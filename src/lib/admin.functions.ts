import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCompanyRows, shuffle, today } from "./admin-helpers";

/** Whoever is signed in with Google gets their own admin workspace. */
export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const owner = context.userId;

    const [pool, unassigned, assigned, onboarded, interns, batches] = await Promise.all([
      db.from("companies").select("*", { count: "exact", head: true }).eq("owner_id", owner),
      db
        .from("companies")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", owner)
        .eq("status", "unassigned"),
      db
        .from("companies")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", owner)
        .eq("status", "assigned"),
      db
        .from("onboarded_companies")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", owner),
      db.from("interns").select("id", { count: "exact", head: true }).eq("owner_id", owner),
      db
        .from("companies")
        .select("date_assigned, assigned_to, interns(name)")
        .eq("owner_id", owner)
        .eq("status", "assigned")
        .order("date_assigned", { ascending: false })
        .limit(2000),
    ]);

    const log = new Map<string, { date: string; total: number; interns: Record<string, number> }>();
    for (const row of batches.data ?? []) {
      const date = row.date_assigned ?? "unknown";
      const entry = log.get(date) ?? { date, total: 0, interns: {} };
      const name = (row.interns as { name: string } | null)?.name ?? "Unassigned";
      entry.total += 1;
      entry.interns[name] = (entry.interns[name] ?? 0) + 1;
      log.set(date, entry);
    }

    return {
      poolTotal: pool.count ?? 0,
      unassigned: unassigned.count ?? 0,
      assigned: assigned.count ?? 0,
      onboarded: onboarded.count ?? 0,
      internCount: interns.count ?? 0,
      log: [...log.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30),
    };
  });

export const addCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ raw: z.string().max(500_000) }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const owner = context.userId;

    const rows = parseCompanyRows(data.raw);
    if (rows.length === 0) return { added: 0, skipped: 0, parsed: 0 };

    const { data: existingRows } = await db
      .from("companies")
      .select("name")
      .eq("owner_id", owner)
      .limit(50_000);
    const existing = new Set((existingRows ?? []).map((row) => row.name.toLowerCase()));
    const fresh = rows.filter((row) => !existing.has(row.name.toLowerCase()));

    let added = 0;
    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500).map((row) => ({
        name: row.name,
        contact_name: row.contactName,
        contact_designation: row.contactDesignation,
        contact_email: row.contactEmail,
        owner_id: owner,
      }));
      const { data: inserted, error } = await db.from("companies").insert(chunk).select("id");
      if (error) {
        for (const row of chunk) {
          const { error: rowError } = await db.from("companies").insert(row);
          if (!rowError) added += 1;
        }
      } else {
        added += inserted?.length ?? 0;
      }
    }
    return { added, skipped: rows.length - added, parsed: rows.length };
  });

export const deleteCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("companies")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

export const deleteCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("companies")
      .delete()
      .in("id", data.ids)
      .eq("owner_id", context.userId);
    if (error) return { ok: false as const, deleted: 0, message: error.message };
    return { ok: true as const, deleted: data.ids.length, message: "" };
  });

export const getPool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("companies")
      .select(
        "id, name, status, date_assigned, outcome, contact_name, contact_designation, contact_email, interns(name)",
      )
      .eq("owner_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(500);
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      dateAssigned: row.date_assigned,
      outcome: row.outcome,
      contactName: row.contact_name,
      contactDesignation: row.contact_designation,
      contactEmail: row.contact_email,
      internName: (row.interns as { name: string } | null)?.name ?? null,
    }));
  });

export const getInterns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("interns")
      .select("id, name, email")
      .eq("owner_id", context.userId)
      .order("name", { ascending: true });
    return data ?? [];
  });

export const addIntern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().min(1).max(120), email: z.string().email().max(200) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("interns").insert({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      owner_id: context.userId,
    });
    if (error) return { ok: false as const, message: "That email is already on your list" };
    return { ok: true as const, message: "" };
  });

export const removeIntern = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("interns")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    return { ok: true as const };
  });

export const assignTodaysBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ perIntern: z.number().int().min(1).max(100).default(10) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const owner = context.userId;

    const { data: interns } = await db.from("interns").select("id, name").eq("owner_id", owner);
    if (!interns || interns.length === 0) {
      return { ok: false as const, message: "Add interns before assigning a batch." };
    }

    const date = today();
    const { data: already } = await db
      .from("companies")
      .select("id")
      .eq("owner_id", owner)
      .eq("date_assigned", date)
      .limit(1);
    if (already && already.length > 0) {
      return { ok: false as const, message: `Today's batch (${date}) has already been assigned.` };
    }

    const needed = interns.length * data.perIntern;
    const { data: available } = await db
      .from("companies")
      .select("id")
      .eq("owner_id", owner)
      .eq("status", "unassigned")
      .limit(needed + 1);

    if (!available || available.length < needed) {
      return {
        ok: false as const,
        message: `Not enough unassigned companies: need ${needed}, only ${available?.length ?? 0} left. Nothing was assigned.`,
      };
    }

    const pool = shuffle(available.slice(0, needed).map((row) => row.id));
    let cursor = 0;
    const summary: { intern: string; count: number }[] = [];

    for (const intern of interns) {
      const ids = pool.slice(cursor, cursor + data.perIntern);
      cursor += data.perIntern;
      const { data: updated, error } = await db
        .from("companies")
        .update({ status: "assigned", assigned_to: intern.id, date_assigned: date })
        .in("id", ids)
        .eq("owner_id", owner)
        .eq("status", "unassigned")
        .select("id");
      if (error) return { ok: false as const, message: error.message };
      summary.push({ intern: intern.name, count: updated?.length ?? 0 });
    }

    return {
      ok: true as const,
      message: `Assigned ${needed} companies across ${interns.length} interns for ${date}.`,
      date,
      summary,
    };
  });

export const getAssignments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("companies")
      .select("id, name, date_assigned, outcome, outcome_at, assigned_to, interns(name)")
      .eq("owner_id", context.userId)
      .eq("status", "assigned")
      .order("date_assigned", { ascending: false })
      .order("name", { ascending: true })
      .limit(2000);
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      dateAssigned: row.date_assigned,
      outcome: row.outcome,
      internId: row.assigned_to,
      internName: (row.interns as { name: string } | null)?.name ?? "—",
    }));
  });

export const markOnboarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.string().max(2000).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    const owner = context.userId;

    const { data: company } = await db
      .from("companies")
      .select("id, name, assigned_to, interns(name)")
      .eq("id", data.id)
      .eq("owner_id", owner)
      .maybeSingle();
    if (!company) return { ok: false as const, message: "Company not found" };

    const { error } = await db.from("onboarded_companies").insert({
      name: company.name,
      intern_id: company.assigned_to,
      onboarded_by: (company.interns as { name: string } | null)?.name ?? null,
      date_onboarded: today(),
      notes: data.notes?.trim() || null,
      owner_id: owner,
    });
    if (error) return { ok: false as const, message: error.message };

    await db.from("companies").delete().eq("id", company.id).eq("owner_id", owner);
    return { ok: true as const, message: `${company.name} moved to Onboarded.` };
  });

export const getOnboarded = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase

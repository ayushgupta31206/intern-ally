import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const adminStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { isAdminRequest } = await import("./admin.server");
  return { isAdmin: await isAdminRequest() };
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { adminPasswordMatches, getAdminSession } = await import("./admin.server");
    let ok = false;
    try {
      ok = adminPasswordMatches(data.password);
    } catch (error) {
      return { ok: false as const, message: (error as Error).message };
    }
    if (!ok) return { ok: false as const, message: "Incorrect password" };
    const session = await getAdminSession();
    await session.update({ isAdmin: true });
    return { ok: true as const, message: "" };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const { getAdminSession } = await import("./admin.server");
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const getOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, supabaseAdmin } = await import("./admin.server");
  await requireAdmin();

  const [pool, unassigned, assigned, onboarded, interns, batches] = await Promise.all([
    supabaseAdmin.from("companies").select("*", { count: "exact", head: true }),
    supabaseAdmin
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("status", "unassigned"),
    supabaseAdmin
      .from("companies")
      .select("*", { count: "exact", head: true })
      .eq("status", "assigned"),
    supabaseAdmin.from("onboarded_companies").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("interns").select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("companies")
      .select("date_assigned, assigned_to, interns(name)")
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
  .inputValidator((data: unknown) => z.object({ raw: z.string().max(500_000) }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, supabaseAdmin, parseCompanyNames } = await import("./admin.server");
    await requireAdmin();

    const names = parseCompanyNames(data.raw);
    if (names.length === 0) return { added: 0, skipped: 0, parsed: 0 };

    let added = 0;
    for (let i = 0; i < names.length; i += 500) {
      const chunk = names.slice(i, i + 500).map((name) => ({ name }));
      const { data: inserted, error } = await supabaseAdmin
        .from("companies")
        .upsert(chunk, { onConflict: "name", ignoreDuplicates: true })
        .select("id");
      if (error) {
        // Fall back to row-by-row so one duplicate can't fail the whole batch.
        for (const row of chunk) {
          const { error: rowError } = await supabaseAdmin.from("companies").insert(row);
          if (!rowError) added += 1;
        }
      } else {
        added += inserted?.length ?? 0;
      }
    }
    return { added, skipped: names.length - added, parsed: names.length };
  });

export const getPool = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, supabaseAdmin } = await import("./admin.server");
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("companies")
    .select("id, name, status, date_assigned, ready_flag, interns(name)")
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    dateAssigned: row.date_assigned,
    readyFlag: row.ready_flag,
    internName: (row.interns as { name: string } | null)?.name ?? null,
  }));
});

export const getInterns = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, supabaseAdmin } = await import("./admin.server");
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("interns")
    .select("id, name, email")
    .order("name", { ascending: true });
  return data ?? [];
});

export const addIntern = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ name: z.string().min(1).max(120), email: z.string().email().max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, supabaseAdmin } = await import("./admin.server");
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("interns")
      .insert({ name: data.name.trim(), email: data.email.trim().toLowerCase() });
    if (error) return { ok: false as const, message: "That email is already added" };
    return { ok: true as const, message: "" };
  });

export const removeIntern = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { requireAdmin, supabaseAdmin } = await import("./admin.server");
    await requireAdmin();
    await supabaseAdmin.from("interns").delete().eq("id", data.id);
    return { ok: true as const };
  });

export const assignTodaysBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ perIntern: z.number().int().min(1).max(100).default(10) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, supabaseAdmin, shuffle, today } = await import("./admin.server");
    await requireAdmin();

    const { data: interns } = await supabaseAdmin.from("interns").select("id, name");
    if (!interns || interns.length === 0) {
      return { ok: false as const, message: "Add interns before assigning a batch." };
    }

    const date = today();
    const { data: already } = await supabaseAdmin
      .from("companies")
      .select("id", { head: false })
      .eq("date_assigned", date)
      .limit(1);
    if (already && already.length > 0) {
      return {
        ok: false as const,
        message: `Today's batch (${date}) has already been assigned.`,
      };
    }

    const needed = interns.length * data.perIntern;
    const { data: available } = await supabaseAdmin
      .from("companies")
      .select("id")
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
      const { data: updated, error } = await supabaseAdmin
        .from("companies")
        .update({ status: "assigned", assigned_to: intern.id, date_assigned: date })
        .in("id", ids)
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

export const getAssignments = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, supabaseAdmin } = await import("./admin.server");
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("companies")
    .select("id, name, date_assigned, ready_flag, assigned_to, interns(name)")
    .eq("status", "assigned")
    .order("date_assigned", { ascending: false })
    .order("name", { ascending: true })
    .limit(2000);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    dateAssigned: row.date_assigned,
    readyFlag: row.ready_flag,
    internId: row.assigned_to,
    internName: (row.interns as { name: string } | null)?.name ?? "—",
  }));
});

export const markOnboarded = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), notes: z.string().max(2000).optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { requireAdmin, supabaseAdmin, today } = await import("./admin.server");
    await requireAdmin();

    const { data: company } = await supabaseAdmin
      .from("companies")
      .select("id, name, assigned_to, interns(name)")
      .eq("id", data.id)
      .maybeSingle();
    if (!company) return { ok: false as const, message: "Company not found" };

    const { error } = await supabaseAdmin.from("onboarded_companies").insert({
      name: company.name,
      intern_id: company.assigned_to,
      onboarded_by: (company.interns as { name: string } | null)?.name ?? null,
      date_onboarded: today(),
      notes: data.notes?.trim() || null,
    });
    if (error) return { ok: false as const, message: error.message };

    await supabaseAdmin.from("companies").delete().eq("id", company.id);
    return { ok: true as const, message: `${company.name} moved to Onboarded.` };
  });

export const getOnboarded = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin, supabaseAdmin } = await import("./admin.server");
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("onboarded_companies")
    .select("id, name, onboarded_by, date_onboarded, notes")
    .order("date_onboarded", { ascending: false })
    .limit(2000);
  return data ?? [];
});

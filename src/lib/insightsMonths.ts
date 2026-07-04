// Helpers for month-scoped insights: available month list, snapshotting of
// budget groups so historical insights don't change when budgets are edited,
// plus carry-forward helpers to copy an old snapshot into later months or
// into the live budget list.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "./supabase";
import type { BudgetGroup } from "./budgetGroups";

export type MonthKey = string; // "YYYY-MM-01"

/** Parse "YYYY-MM-DD" as a *local* Date so month arithmetic doesn't shift
 *  by a day when the user is west of UTC. `new Date("2026-06-01")` parses
 *  as UTC midnight, which is May 31 locally in western timezones. */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toKey(d: Date): MonthKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthStart(iso: string): MonthKey {
  const d = parseLocalDate(iso);
  return toKey(new Date(d.getFullYear(), d.getMonth(), 1));
}
export function monthEnd(iso: string): string {
  const d = parseLocalDate(iso);
  return toIsoDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
export function shiftMonth(iso: string, delta: number): MonthKey {
  const d = parseLocalDate(iso);
  return toKey(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}
export function monthLabel(iso: string): string {
  return parseLocalDate(iso).toLocaleString(undefined, { month: "long", year: "numeric" });
}
export function monthShortLabel(iso: string): string {
  return parseLocalDate(iso).toLocaleString(undefined, { month: "short", year: "2-digit" });
}

/** Today as a local YYYY-MM-DD (avoids the UTC offset issue). */
function todayLocalIso(): string {
  return toIsoDate(new Date());
}

/** Enumerate month keys (first of month) between two ISO dates inclusive. */
function enumerateMonths(fromIso: string, toIso: string): MonthKey[] {
  const start = parseLocalDate(monthStart(fromIso));
  const end = parseLocalDate(monthStart(toIso));
  const out: MonthKey[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(toKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return out;
}

/** All months that have transactions, plus the current calendar month. */
export function useAvailableMonths() {
  return useQuery({
    queryKey: ["insights_available_months"],
    queryFn: async (): Promise<MonthKey[]> => {
      const [minRes, maxRes] = await Promise.all([
        supabase.from("transactions").select("occurred_on").order("occurred_on", { ascending: true }).limit(1),
        supabase.from("transactions").select("occurred_on").order("occurred_on", { ascending: false }).limit(1),
      ]);
      if (minRes.error) throw minRes.error;
      if (maxRes.error) throw maxRes.error;
      const now = todayLocalIso();
      const min = (minRes.data?.[0]?.occurred_on as string | undefined) ?? now;
      const max = (maxRes.data?.[0]?.occurred_on as string | undefined) ?? now;
      // Compare via monthStart to sidestep any TZ weirdness on the raw strings.
      const upperKey = monthStart(max) > monthStart(now) ? max : now;
      return enumerateMonths(min, upperKey).reverse(); // newest first
    },
  });
}

// ---- Snapshots ------------------------------------------------------------

type SnapshotRow = { month: string; groups: BudgetGroup[] };

async function fetchSnapshots(userId: string, months: MonthKey[]): Promise<Record<MonthKey, BudgetGroup[]>> {
  if (months.length === 0) return {};
  const { data, error } = await supabase
    .from("budget_group_snapshots")
    .select("month, groups")
    .eq("user_id", userId)
    .in("month", months);
  if (error) throw error;
  const out: Record<MonthKey, BudgetGroup[]> = {};
  for (const row of (data ?? []) as SnapshotRow[]) {
    out[row.month.slice(0, 10)] = (row.groups ?? []) as BudgetGroup[];
  }
  return out;
}

/** Fetch snapshot maps for a list of months; falls back to `currentGroups`
 *  for any month with no snapshot. */
export function useMonthSnapshots(userId: string | null, months: MonthKey[], currentGroups: BudgetGroup[]) {
  return useQuery({
    queryKey: ["budget_snapshots", userId, months.join(",")],
    enabled: !!userId && months.length > 0,
    queryFn: async () => {
      const map = await fetchSnapshots(userId!, months);
      const resolved: Record<MonthKey, BudgetGroup[]> = {};
      for (const m of months) resolved[m] = map[m] ?? currentGroups;
      return resolved;
    },
  });
}

/** Fetch which of the given months already have a stored snapshot (used by
 *  the carry-forward dialog to warn about overwrites). */
export function useSnapshotMonths(userId: string | null) {
  return useQuery({
    queryKey: ["budget_snapshot_months", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MonthKey[]> => {
      const { data, error } = await supabase
        .from("budget_group_snapshots")
        .select("month")
        .eq("user_id", userId!)
        .order("month", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: { month: string }) => r.month.slice(0, 10));
    },
  });
}

/** Freeze the current month's budget configuration once per user session so
 *  historical insights stay accurate when budgets are later edited. */
export function useAutoSnapshotCurrentMonth(userId: string | null, currentGroups: BudgetGroup[]) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const month = monthStart(todayLocalIso());
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("budget_group_snapshots")
        .select("month")
        .eq("user_id", userId).eq("month", month).maybeSingle();
      if (error || cancelled) return;
      const payload = { user_id: userId, month, groups: currentGroups as unknown as object };
      if (data) {
        await supabase.from("budget_group_snapshots")
          .update({ groups: payload.groups }).eq("user_id", userId).eq("month", month);
      } else {
        await supabase.from("budget_group_snapshots").insert(payload);
      }
      qc.invalidateQueries({ queryKey: ["budget_snapshots"] });
      qc.invalidateQueries({ queryKey: ["budget_snapshot_months"] });
    })();
    return () => { cancelled = true; };
  }, [userId, JSON.stringify(currentGroups), qc]);
}

/** Copy a set of budget groups into each target month as a snapshot. Used
 *  when carrying an old month's budgets forward into later past months. */
export async function applySnapshotToMonths(
  userId: string,
  groups: BudgetGroup[],
  targetMonths: MonthKey[],
): Promise<void> {
  if (targetMonths.length === 0) return;
  const rows = targetMonths.map(month => ({
    user_id: userId,
    month,
    groups: groups as unknown as object,
  }));
  const { error } = await supabase
    .from("budget_group_snapshots")
    .upsert(rows, { onConflict: "user_id,month" });
  if (error) throw error;
}

/** Replace the user's live budget list with the given groups. Used when
 *  carrying a past-month snapshot into the current calendar month / Budgets
 *  page. Atomic-ish: delete-all, then insert the new list. */
export async function replaceLiveBudgets(userId: string, groups: BudgetGroup[]): Promise<void> {
  const { error: delErr } = await supabase
    .from("budget_groups").delete().eq("user_id", userId);
  if (delErr) throw delErr;
  if (groups.length === 0) return;
  const rows = groups.map(g => ({
    user_id: userId,
    name: g.name,
    category_ids: g.categoryIds ?? [],
    amount: g.amount,
    period: g.period,
    kind: g.kind,
  }));
  const { error: insErr } = await supabase.from("budget_groups").insert(rows);
  if (insErr) throw insErr;
}

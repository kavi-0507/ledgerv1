// Helpers for month-scoped insights: available month list, snapshotting of
// budget groups so historical insights don't change when budgets are edited.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "./supabase";
import type { BudgetGroup } from "./budgetGroups";

export type MonthKey = string; // "YYYY-MM-01"

export function monthStart(iso: string): MonthKey {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
export function monthEnd(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}
export function shiftMonth(iso: string, delta: number): MonthKey {
  const d = new Date(iso);
  return new Date(d.getFullYear(), d.getMonth() + delta, 1).toISOString().slice(0, 10);
}
export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "long", year: "numeric" });
}
export function monthShortLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", year: "2-digit" });
}

/** Enumerate month keys (first of month) between two ISO dates inclusive. */
function enumerateMonths(fromIso: string, toIso: string): MonthKey[] {
  const start = new Date(monthStart(fromIso));
  const end = new Date(monthStart(toIso));
  const out: MonthKey[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
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
      const now = new Date().toISOString().slice(0, 10);
      const min = (minRes.data?.[0]?.occurred_on as string | undefined) ?? now;
      const max = (maxRes.data?.[0]?.occurred_on as string | undefined) ?? now;
      const upper = new Date(max) > new Date(now) ? max : now;
      return enumerateMonths(min, upper).reverse(); // newest first
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

/** Freeze the current month's budget configuration once per user session so
 *  historical insights stay accurate when budgets are later edited. */
export function useAutoSnapshotCurrentMonth(userId: string | null, currentGroups: BudgetGroup[]) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const month = monthStart(new Date().toISOString());
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("budget_group_snapshots")
        .select("month")
        .eq("user_id", userId).eq("month", month).maybeSingle();
      if (error || cancelled) return;
      // Always upsert current month so it reflects the latest saved budgets
      // *for the current month*. Past months are frozen and never overwritten.
      const payload = { user_id: userId, month, groups: currentGroups as unknown as object };
      if (data) {
        await supabase.from("budget_group_snapshots")
          .update({ groups: payload.groups }).eq("user_id", userId).eq("month", month);
      } else {
        await supabase.from("budget_group_snapshots").insert(payload);
      }
      qc.invalidateQueries({ queryKey: ["budget_snapshots"] });
    })();
    return () => { cancelled = true; };
  }, [userId, JSON.stringify(currentGroups), qc]);
}

// Multi-category budget "groups" persisted in Supabase (`budget_groups`
// table) so they follow the user across devices. A legacy localStorage
// store is migrated on first load per-user, then cleared.

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";

export type BudgetPeriod = "weekly" | "monthly" | "termly";
export type BudgetKind = "expense" | "savings";

export type BudgetGroup = {
  id: string;
  name: string;
  categoryIds: string[];
  amount: number;
  period: BudgetPeriod;
  kind: BudgetKind;
  createdAt: string;
};

const LEGACY_KEY_PREFIX = "ledger:budget-groups:";
const EVT = "ledger:budget-groups-changed";

type DbRow = {
  id: string;
  user_id: string;
  name: string;
  category_ids: string[] | null;
  amount: number;
  period: BudgetPeriod;
  kind: BudgetKind;
  created_at: string;
};

function fromRow(r: DbRow): BudgetGroup {
  return {
    id: r.id,
    name: r.name,
    categoryIds: r.category_ids ?? [],
    amount: Number(r.amount ?? 0),
    period: r.period,
    kind: r.kind,
    createdAt: r.created_at,
  };
}

async function fetchGroups(userId: string): Promise<BudgetGroup[]> {
  const { data, error } = await supabase
    .from("budget_groups").select("*").eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbRow[]).map(fromRow);
}

/** Move any legacy localStorage groups into the DB on first sync for this
 *  user. Idempotent — only fires when the DB is empty and legacy data exists. */
async function migrateLegacy(userId: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const key = LEGACY_KEY_PREFIX + userId;
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;
  let legacy: BudgetGroup[] = [];
  try { legacy = JSON.parse(raw) ?? []; } catch { /* ignore */ }
  if (!Array.isArray(legacy) || legacy.length === 0) {
    window.localStorage.removeItem(key);
    return false;
  }
  const { count } = await supabase
    .from("budget_groups").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) > 0) {
    window.localStorage.removeItem(key);
    return false;
  }
  const rows = legacy.map(g => ({
    user_id: userId,
    name: g.name,
    category_ids: g.categoryIds ?? [],
    amount: g.amount,
    period: g.period,
    kind: g.kind,
  }));
  const { error } = await supabase.from("budget_groups").insert(rows);
  if (error) { console.error("[budget_groups] legacy migration failed", error); return false; }
  window.localStorage.removeItem(key);
  return true;
}

function useUserId() {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUid(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUid(session?.user?.id ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);
  return uid;
}

export function useBudgetGroups() {
  const uid = useUserId();
  const [groups, setGroups] = useState<BudgetGroup[]>([]);
  const migratedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (!uid) { setGroups([]); return; }
    try {
      if (!migratedRef.current.has(uid)) {
        migratedRef.current.add(uid);
        await migrateLegacy(uid);
      }
      setGroups(await fetchGroups(uid));
    } catch (err) {
      console.error("[budget_groups] fetch failed", err);
    }
  }, [uid]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onChange = () => { void refresh(); };
    window.addEventListener(EVT, onChange);
    return () => window.removeEventListener(EVT, onChange);
  }, [refresh]);

  const notify = () => window.dispatchEvent(new CustomEvent(EVT));

  const upsert = useCallback((g: Omit<BudgetGroup, "id" | "createdAt"> & { id?: string }): string => {
    if (!uid) return g.id ?? "";
    const payload = {
      user_id: uid,
      name: g.name,
      category_ids: g.categoryIds ?? [],
      amount: g.amount,
      period: g.period,
      kind: g.kind,
    };
    const targetId = g.id ?? crypto.randomUUID();
    void (async () => {
      if (g.id) {
        const { error } = await supabase.from("budget_groups").update(payload).eq("id", g.id).eq("user_id", uid);
        if (error) console.error("[budget_groups] update failed", error);
      } else {
        const { error } = await supabase.from("budget_groups").insert({ ...payload, id: targetId });
        if (error) console.error("[budget_groups] insert failed", error);
      }
      notify();
    })();
    return targetId;
  }, [uid]);

  const remove = useCallback((id: string) => {
    if (!uid) return;
    void (async () => {
      const { error } = await supabase.from("budget_groups").delete().eq("id", id).eq("user_id", uid);
      if (error) console.error("[budget_groups] delete failed", error);
      notify();
    })();
  }, [uid]);

  const addMany = useCallback((items: Array<Omit<BudgetGroup, "id" | "createdAt">>) => {
    if (!uid || items.length === 0) return;
    void (async () => {
      const rows = items.map(g => ({
        user_id: uid,
        name: g.name,
        category_ids: g.categoryIds ?? [],
        amount: g.amount,
        period: g.period,
        kind: g.kind,
      }));
      const { error } = await supabase.from("budget_groups").insert(rows);
      if (error) console.error("[budget_groups] insert many failed", error);
      notify();
    })();
  }, [uid]);

  return { groups, upsert, remove, addMany, userId: uid };
}


// ---- Category kind detection ---------------------------------------------

export type CategoryKind = "income" | "transfer" | "savings" | "expense";

export function detectCategoryKind(name: string | null | undefined): CategoryKind {
  const n = (name ?? "").toLowerCase();
  if (/income|salary|wage/.test(n)) return "income";
  if (/transfer/.test(n)) return "transfer";
  if (/saving/.test(n)) return "savings";
  return "expense";
}

// ---- Default student suggestions -----------------------------------------

export type StudentSuggestion = {
  name: string;
  categoryMatchers: RegExp[];
  kind: BudgetKind;
  defaultAmount: number;
};

export const STUDENT_SUGGESTIONS: StudentSuggestion[] = [
  { name: "Rent & Bills",         kind: "expense", defaultAmount: 800, categoryMatchers: [/^rent(\s*&\s*housing)?$/i, /utilit|bills?/i] },
  { name: "Food Budget",          kind: "expense", defaultAmount: 250, categoryMatchers: [/grocer|supermarket/i, /eating\s*out|restaurant|takeaway/i, /meal\s*plan|tiffin/i] },
  { name: "Transport Budget",     kind: "expense", defaultAmount: 80,  categoryMatchers: [/transport|travel|tfl|commute/i] },
  { name: "Lifestyle Budget",     kind: "expense", defaultAmount: 120, categoryMatchers: [/shopping|clothes/i, /entertain|fun|leisure/i] },
  { name: "Subscriptions Budget", kind: "expense", defaultAmount: 30,  categoryMatchers: [/subscription/i] },
  { name: "Health Budget",        kind: "expense", defaultAmount: 30,  categoryMatchers: [/health|medical|pharmacy/i] },
  { name: "Other Buffer",         kind: "expense", defaultAmount: 40,  categoryMatchers: [/^other$|misc/i] },
  { name: "Savings Target",       kind: "savings", defaultAmount: 100, categoryMatchers: [/saving/i] },
];

export function matchSuggestionCategories<T extends { id: string; name: string }>(
  s: StudentSuggestion,
  cats: T[],
): string[] {
  const ids: string[] = [];
  for (const c of cats) {
    if (s.categoryMatchers.some(r => r.test(c.name))) ids.push(c.id);
  }
  return ids;
}

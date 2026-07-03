// Multi-category budget "groups" persisted in localStorage.
// The DB `budgets` table only supports a single category per row, so we
// keep the richer grouping model client-side. This is intentional and keeps
// the student-focused UX flexible without a schema migration.

import { useEffect, useState, useCallback } from "react";
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

const KEY_PREFIX = "ledger:budget-groups:";
const EVT = "ledger:budget-groups-changed";

function keyFor(userId: string | null) {
  return KEY_PREFIX + (userId ?? "anon");
}

function readAll(userId: string | null): BudgetGroup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(userId: string | null, groups: BudgetGroup[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(userId), JSON.stringify(groups));
  window.dispatchEvent(new CustomEvent(EVT));
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
  const [groups, setGroups] = useState<BudgetGroup[]>(() => readAll(null));

  useEffect(() => { setGroups(readAll(uid)); }, [uid]);
  useEffect(() => {
    const onChange = () => setGroups(readAll(uid));
    window.addEventListener(EVT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [uid]);

  const upsert = useCallback((g: Omit<BudgetGroup, "id" | "createdAt"> & { id?: string }) => {
    const now = new Date().toISOString();
    const current = readAll(uid);
    if (g.id) {
      const next = current.map(x => x.id === g.id ? { ...x, ...g, id: g.id, createdAt: x.createdAt } as BudgetGroup : x);
      writeAll(uid, next);
      return g.id;
    }
    const id = crypto.randomUUID();
    writeAll(uid, [...current, { ...g, id, createdAt: now }]);
    return id;
  }, [uid]);

  const remove = useCallback((id: string) => {
    writeAll(uid, readAll(uid).filter(g => g.id !== id));
  }, [uid]);

  const addMany = useCallback((items: Array<Omit<BudgetGroup, "id" | "createdAt">>) => {
    const now = new Date().toISOString();
    const current = readAll(uid);
    const next = [...current, ...items.map(g => ({ ...g, id: crypto.randomUUID(), createdAt: now }))];
    writeAll(uid, next);
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

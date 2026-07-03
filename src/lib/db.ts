import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type {
  DbCategory, DbTransaction, DbBudget, DbMerchantRule,
  DbReminder, DbRecommendation, DbImport, DbWeeklyReview, DbProfile,
} from "./supabase";

/** Return the current user's default account id, creating one if none exists. */
export async function ensureDefaultAccountId(userId: string): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from("accounts").select("id,is_active").eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (selErr) throw selErr;
  const active = (existing ?? []).find((a: any) => a.is_active !== false);
  if (active) return active.id;
  if (existing && existing.length > 0) return existing[0].id;
  const { data: created, error: insErr } = await supabase
    .from("accounts").insert({ user_id: userId, name: "Main Account", is_active: true })
    .select("id").single();
  if (insErr) throw insErr;
  return created.id;
}

/** Derive a human review reason from a transaction row + its category. */
export function deriveReviewReason(t: { needs_review?: boolean | null; category_id?: string | null }, categoryName?: string | null): string | null {
  if (!t.needs_review) return null;
  if (!t.category_id) return "Missing category";
  if (categoryName && categoryName.toLowerCase() === "other") return "Other category";
  return "Needs review";
}


// ---- Categories ----
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async (): Promise<DbCategory[]> => {
      const { data, error } = await supabase
        .from("categories").select("*").order("sort_order", { ascending: true }).order("name");
      if (error) throw error;
      return (data ?? []) as DbCategory[];
    },
  });
}

// ---- Transactions ----
export type TxFilters = {
  search?: string;
  direction?: "in" | "out" | "";
  category_id?: string | "";
  needs_review?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
};

export function useTransactions(f: TxFilters = {}) {
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 50;
  return useQuery({
    queryKey: ["transactions", f],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*, categories(id,name,color)", { count: "exact" })
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false });
      if (f.search) q = q.ilike("description", `%${f.search}%`);
      if (f.direction) q = q.eq("direction", f.direction);
      if (f.category_id) q = q.eq("category_id", f.category_id);
      if (f.needs_review) q = q.eq("needs_review", true);
      if (f.from) q = q.gte("occurred_on", f.from);
      if (f.to) q = q.lte("occurred_on", f.to);
      q = q.range((page - 1) * pageSize, page * pageSize - 1);
      const { data, error, count } = await q;
      if (error) throw error;
      return {
        items: (data ?? []) as (DbTransaction & { categories?: { id: string; name: string; color: string | null } | null })[],
        total: count ?? 0,
        page, pageSize,
      };
    },
  });
}

// ---- Budgets ----
export function useBudgets() {
  return useQuery({
    queryKey: ["budgets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budgets")
        .select("*, categories(id,name,color)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as (DbBudget & { categories?: { id: string; name: string; color: string | null } | null })[];
    },
  });
}

// ---- Merchant rules ----
export function useMerchantRules() {
  return useQuery({
    queryKey: ["merchant_rules"],
    queryFn: async (): Promise<DbMerchantRule[]> => {
      const { data, error } = await supabase.from("merchant_rules").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbMerchantRule[];
    },
  });
}

// ---- Reminders ----
export function useReminders() {
  return useQuery({
    queryKey: ["reminders"],
    queryFn: async (): Promise<DbReminder[]> => {
      const { data, error } = await supabase
        .from("reminders")
        .select("*")
        .order("due_on", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as DbReminder[];
    },
  });
}

// ---- Recommendations ----
export function useRecommendations() {
  return useQuery({
    queryKey: ["recommendations"],
    queryFn: async (): Promise<DbRecommendation[]> => {
      const { data, error } = await supabase
        .from("recommendations").select("*")
        .eq("dismissed", false).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbRecommendation[];
    },
  });
}

// ---- Imports ----
export function useImports() {
  return useQuery({
    queryKey: ["imports"],
    queryFn: async (): Promise<DbImport[]> => {
      const { data, error } = await supabase.from("imports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbImport[];
    },
  });
}

// ---- Weekly review ----
export function useWeeklyReviews() {
  return useQuery({
    queryKey: ["weekly_reviews"],
    queryFn: async (): Promise<DbWeeklyReview[]> => {
      const { data, error } = await supabase.from("weekly_reviews").select("*").order("week_start", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbWeeklyReview[];
    },
  });
}

// ---- Profile ----
export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<DbProfile | null> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userData.user.id).maybeSingle();
      if (error) throw error;
      return data as DbProfile | null;
    },
  });
}

// ---- Utility for start of month ----
export function startOfMonth(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x.toISOString().slice(0, 10);
}
export function endOfMonth(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return x.toISOString().slice(0, 10);
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import type {
  DbCategory, DbTransaction, DbBudget, DbMerchantRule,
  DbReminder, DbRecommendation, DbImportBatch, DbWeeklyReview, DbProfile,
} from "./supabase";

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
        .from("budgets").select("*, categories(id,name,color)").order("name", { ascending: true });
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
      const { data, error } = await supabase.from("reminders").select("*").order("due_at", { ascending: true, nullsFirst: false });
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
        .eq("is_dismissed", false).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbRecommendation[];
    },
  });
}

// ---- Import batches ----
export function useImportBatches() {
  return useQuery({
    queryKey: ["import_batches"],
    queryFn: async (): Promise<DbImportBatch[]> => {
      const { data, error } = await supabase.from("import_batches").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbImportBatch[];
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
      const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
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

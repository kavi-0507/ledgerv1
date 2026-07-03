import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export type DbCategory = {
  id: string;
  user_id: string;
  name: string;
  behaviour: string | null;
  color: string | null;
  is_default: boolean | null;
  sort_order: number | null;
};

export type DbTransaction = {
  id: string;
  user_id: string;
  occurred_on: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  category_id: string | null;
  behaviour: string | null;
  merchant: string | null;
  needs_review: boolean;
  review_reason: string | null;
  notes: string | null;
  is_shared: boolean | null;
  shared_split: number | null;
  dedupe_hash: string | null;
  import_batch_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export type DbBudget = {
  id: string;
  user_id: string;
  name: string;
  scope: "overall" | "category";
  period: "weekly" | "monthly";
  category_id: string | null;
  amount: number;
  starts_on: string | null;
  created_at: string;
  updated_at: string | null;
};

export type DbMerchantRule = {
  id: string;
  user_id: string;
  pattern: string;
  category_id: string | null;
  behaviour: string | null;
  is_active: boolean | null;
  created_at: string;
};

export type DbReminder = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  state: "pending" | "snoozed" | "dismissed" | "done";
  created_at: string;
};

export type DbRecommendation = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  tone: "positive" | "warning" | "negative" | "neutral" | "info" | null;
  is_dismissed: boolean | null;
  created_at: string;
};

export type DbImportBatch = {
  id: string;
  user_id: string;
  filename: string | null;
  status: string | null;
  totals: Record<string, number> | null;
  created_at: string;
};

export type DbWeeklyReview = {
  id: string;
  user_id: string;
  week_start: string;
  state: "open" | "completed";
  score: number | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
};

export type DbProfile = {
  id: string;
  currency: string | null;
  display_name: string | null;
};

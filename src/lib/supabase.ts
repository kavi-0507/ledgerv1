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
  slug: string | null;
  behaviour: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number | null;
};

export type DbTransaction = {
  id: string;
  user_id: string;
  account_id: string | null;
  occurred_on: string;
  description: string;
  merchant: string | null;
  amount: number;
  direction: "in" | "out";
  category_id: string | null;
  needs_review: boolean;
  review_reason: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
};

export type DbBudget = {
  id: string;
  user_id: string;
  scope: "overall" | "category";
  period: "weekly" | "monthly";
  category_id: string | null;
  amount: number;
  starts_on: string | null;
  is_active: boolean | null;
  created_at: string;
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
  detail: string | null;
  due_on: string | null;
  state: "pending" | "snoozed" | "dismissed" | "done";
  snoozed_until: string | null;
  amount: number | null;
  category_id: string | null;
  recurrence: string | null;
  created_at: string;
};

export type DbRecommendation = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  tone: "positive" | "warning" | "negative" | "neutral" | "info" | null;
  category_id: string | null;
  score_delta: number | null;
  dismissed: boolean | null;
  valid_for: string | null;
  created_at: string;
};

export type DbImport = {
  id: string;
  user_id: string;
  filename: string | null;
  status: string | null;
  total_rows: number | null;
  new_rows: number | null;
  duplicate_rows: number | null;
  invalid_rows: number | null;
  imported_rows: number | null;
  preview_token: string | null;
  committed_at: string | null;
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

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

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
  default_source_category_id?: string | null;
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
  category_id: string | null;
  occurred_on: string;
  amount: number;
  direction: "in" | "out";
  description: string;
  merchant: string | null;
  notes: string | null;
  behaviour: string | null;
  needs_review: boolean;
  is_transfer: boolean | null;
  source: string | null;
  import_id: string | null;
  external_hash: string | null;
  created_at: string;
  updated_at: string | null;
};

export type DbAccount = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean | null;
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
  default_source_rule_id?: string | null;
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

export type ImportStatus =
  | "preview"
  | "pending"
  | "confirmed"
  | "committed"
  | "completed"
  | "cancelled"
  | "failed";

export type DbImport = {
  id: string;
  user_id: string;
  filename: string | null;
  status: ImportStatus | null;
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
  defaults_seeded_at?: string | null;
  defaults_source_user_id?: string | null;
};

export type RentBillRecurrence = "one-off" | "weekly" | "monthly" | "termly" | "yearly";
export type RentBillStatus = "pending" | "paid";

export type DbRentBill = {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  due_date: string;
  recurrence: RentBillRecurrence;
  status: RentBillStatus;
  paid_at: string | null;
  notes: string | null;
  series_id: string | null;
  created_at: string;
  updated_at: string | null;
};

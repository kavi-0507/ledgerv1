// Loose types — the backend response shapes aren't fully specified in the
// docs, so we render defensively via optional fields.

export type Money = string | number | null | undefined;

export type Transaction = {
  id: number;
  occurred_on: string;
  description: string;
  amount: Money;
  direction?: "in" | "out";
  category?: string | null;
  behaviour?: string | null;
  needs_review?: boolean;
  merchant?: string | null;
  review_reason?: string | null;
  [k: string]: unknown;
};

export type TransactionsPage = {
  items?: Transaction[];
  transactions?: Transaction[];
  results?: Transaction[];
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
  [k: string]: unknown;
};

export type Budget = {
  id: number;
  name: string;
  scope?: "overall" | "category" | string;
  period?: "monthly" | "weekly" | string;
  category?: string | null;
  amount: Money;
  spent?: Money;
  remaining?: Money;
  percentage_used?: number;
  projected_spending?: Money;
  warning?: boolean | string | null;
  category_score?: number | null;
  [k: string]: unknown;
};

export type Reminder = {
  id: number;
  title?: string;
  description?: string;
  due_at?: string;
  state?: string;
  [k: string]: unknown;
};

export type MerchantRule = {
  id: number;
  pattern: string;
  category: string;
  behaviour?: string | null;
  [k: string]: unknown;
};

export type ImportBatch = {
  id: number;
  filename?: string;
  imported_at?: string;
  count?: number;
  new_rows?: number;
  duplicates?: number;
  [k: string]: unknown;
};

export type Dashboard = {
  score?: number | { value?: number; label?: string } | null;
  spending?: Money;
  income?: Money;
  cash_flow?: Money;
  remaining_budget?: Money;
  fixed_commitments?: Money;
  budget_progress?: unknown;
  category_breakdown?: Array<{
    category?: string;
    name?: string;
    amount?: Money;
    percentage?: number;
    color?: string;
  }>;
  spending_trends?: Array<{
    date?: string;
    label?: string;
    amount?: Money;
    spending?: Money;
  }>;
  recommendations?: Array<{
    id?: number | string;
    title?: string;
    description?: string;
    body?: string;
    tone?: string;
  }>;
  review_count?: number;
  reminder_count?: number;
  recent_transactions?: Transaction[];
  [k: string]: unknown;
};

export type Insights = {
  score_explanation?: {
    score?: number;
    label?: string;
    summary?: string;
    factors?: Array<{ label?: string; impact?: string; description?: string }>;
  };
  category_scores?: Array<{
    category?: string;
    score?: number;
    trend?: string;
  }>;
  comparison_cards?: Array<{
    title?: string;
    current?: Money;
    previous?: Money;
    change?: string;
    tone?: string;
  }>;
  recommendation_cards?: Array<{
    title?: string;
    description?: string;
    body?: string;
    tone?: string;
  }>;
  biggest_changes?: Array<{
    category?: string;
    change?: string;
    amount?: Money;
    direction?: string;
  }>;
  spending_patterns?: Array<{ label?: string; description?: string }>;
  chart_data?: unknown;
  [k: string]: unknown;
};

export type WeeklyReview = {
  current?: {
    id?: number;
    period_start?: string;
    period_end?: string;
    summary?: string;
    items?: unknown[];
    ready?: boolean;
  } | null;
  completed?: Array<{
    id?: number;
    completed_at?: string;
    summary?: string;
  }>;
  [k: string]: unknown;
};

export type Categories = {
  categories?: string[] | Array<{ name?: string }>;
  behaviours?: string[];
  [k: string]: unknown;
};

export type ImportPreview = {
  preview_token?: string;
  new_rows?: Array<Record<string, unknown>>;
  exact_duplicates?: Array<Record<string, unknown>>;
  possible_duplicates?: Array<Record<string, unknown>>;
  invalid_rows?: Array<Record<string, unknown>>;
  categorisation_preview?: Array<Record<string, unknown>>;
  [k: string]: unknown;
};

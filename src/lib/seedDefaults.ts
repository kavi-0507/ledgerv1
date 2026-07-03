// Seeds default categories, merchant rules, and budget groups for a user
// the first time they sign in. Idempotent: each section only runs if the
// corresponding store is empty for this user, so users can freely delete or
// edit defaults without them reappearing.
//
// All three stores live in Supabase (categories, merchant_rules,
// budget_groups) so defaults follow the user across devices.

import { supabase } from "./supabase";
import { STUDENT_SUGGESTIONS, matchSuggestionCategories } from "./budgetGroups";

const SEED_FLAG_PREFIX = "ledger:seeded:";

const SEED_FLAG_PREFIX = "ledger:seeded:";
const BUDGET_KEY_PREFIX = "ledger:budget-groups:";

type DefaultCategory = {
  name: string;
  behaviour: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
};

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Essentials
  { name: "Rent & Housing", behaviour: "necessary",  color: "#3F8F76", icon: "🏠", sort_order: 10 },
  { name: "Utilities",      behaviour: "necessary",  color: "#3F8F76", icon: "💡", sort_order: 20 },
  { name: "Groceries",      behaviour: "necessary",  color: "#3F8F76", icon: "🛒", sort_order: 30 },
  { name: "Meal Plan",      behaviour: "necessary",  color: "#3F8F76", icon: "🍱", sort_order: 40 },
  { name: "Transport",      behaviour: "necessary",  color: "#3F8F76", icon: "🚇", sort_order: 50 },
  // Lifestyle
  { name: "Eating Out",     behaviour: "social",     color: "#E1A54B", icon: "🍔", sort_order: 60 },
  { name: "Shopping",       behaviour: "treat",      color: "#E1A54B", icon: "🛍️", sort_order: 70 },
  { name: "Entertainment",  behaviour: "social",     color: "#E1A54B", icon: "🎮", sort_order: 80 },
  { name: "Subscriptions",  behaviour: "convenience", color: "#E1A54B", icon: "📺", sort_order: 90 },
  { name: "Health",         behaviour: "necessary",  color: "#E1A54B", icon: "🏥", sort_order: 100 },
  // Finances
  { name: "Savings",        behaviour: "necessary",  color: "#5FB89A", icon: "💰", sort_order: 110 },
  { name: "Income",         behaviour: null,         color: "#5FB89A", icon: "📈", sort_order: 120 },
  { name: "Transfer",       behaviour: null,         color: "#5FB89A", icon: "🔄", sort_order: 130 },
  // Other
  { name: "Other",          behaviour: null,         color: "#8AA39B", icon: "📦", sort_order: 200 },
];

type DefaultRule = { pattern: string; categoryName: string; behaviour?: string | null };

// Regex patterns matched against merchant + description in the importer.
const DEFAULT_RULES: DefaultRule[] = [
  { pattern: "\\b(tfl|transport for london|oyster|uber|bolt|trainline|national rail|lner|gwr)\\b", categoryName: "Transport" },
  { pattern: "\\b(sakshis?|saakshis?|tiffin|meal ?plan)\\b", categoryName: "Meal Plan" },
  { pattern: "\\b(tesco|sainsbury'?s?|lidl|aldi|co-?op|waitrose|morrisons|asda|iceland|m&s food)\\b", categoryName: "Groceries" },
  { pattern: "\\b(deliveroo|uber ?eats|just ?eat|justeat)\\b", categoryName: "Eating Out" },
  { pattern: "\\b(wetherspoon|nando'?s|pret|greggs|leon|itsu|five ?guys|pizza express|dishoom|franco manca|wagamama|byron|starbucks|costa|caffe nero)\\b", categoryName: "Eating Out" },
  { pattern: "\\b(netflix|spotify|disney\\+?|prime video|apple\\.com\\/bill|itunes|hbo|youtube ?premium)\\b", categoryName: "Subscriptions" },
  { pattern: "\\b(voxi|vodafone|ee mobile|o2|three|giffgaff|sky mobile|bt|virgin ?media|octopus energy|british gas|thames water)\\b", categoryName: "Utilities" },
  { pattern: "\\b(openai|chatgpt|anthropic|claude\\.ai|github|cursor\\.sh|figma|notion|vercel)\\b", categoryName: "Subscriptions" },
  { pattern: "\\b(amazon|amzn|ebay|argos|ikea|zara|h&m|uniqlo|asos)\\b", categoryName: "Shopping" },
  { pattern: "\\b(boots|superdrug|pharmacy|nhs)\\b", categoryName: "Health" },
];

async function seedCategories(userId: string): Promise<Map<string, string>> {
  const { data: existing, error } = await supabase
    .from("categories").select("id,name").eq("user_id", userId);
  if (error) throw error;
  const byName = new Map<string, string>();
  (existing ?? []).forEach((c: any) => byName.set(String(c.name).toLowerCase(), c.id));

  const toInsert = DEFAULT_CATEGORIES
    .filter(c => !byName.has(c.name.toLowerCase()))
    .map(c => ({ ...c, user_id: userId }));

  if (toInsert.length > 0) {
    const { data, error: insErr } = await supabase
      .from("categories").insert(toInsert).select("id,name");
    if (insErr) throw insErr;
    (data ?? []).forEach((c: any) => byName.set(String(c.name).toLowerCase(), c.id));
  }
  return byName;
}

async function seedMerchantRules(userId: string, catByName: Map<string, string>) {
  const { count, error } = await supabase
    .from("merchant_rules").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  const toInsert = DEFAULT_RULES
    .map(r => ({
      user_id: userId,
      pattern: r.pattern,
      category_id: catByName.get(r.categoryName.toLowerCase()) ?? null,
      behaviour: r.behaviour ?? null,
      is_active: true,
    }))
    .filter(r => r.category_id);

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from("merchant_rules").insert(toInsert);
    if (insErr) throw insErr;
  }
}

function seedBudgetGroups(userId: string, catByName: Map<string, string>) {
  if (typeof window === "undefined") return;
  const key = BUDGET_KEY_PREFIX + userId;
  const raw = window.localStorage.getItem(key);
  if (raw) {
    try { if ((JSON.parse(raw) as unknown[]).length > 0) return; } catch { /* fall through */ }
  }

  const cats = Array.from(catByName.entries()).map(([name, id]) => ({ id, name }));
  const now = new Date().toISOString();
  const groups: BudgetGroup[] = [];
  for (const s of STUDENT_SUGGESTIONS) {
    const ids = matchSuggestionCategories(s, cats);
    if (ids.length === 0) continue;
    groups.push({
      id: crypto.randomUUID(),
      name: s.name,
      categoryIds: ids,
      amount: s.defaultAmount,
      period: "monthly",
      kind: s.kind,
      createdAt: now,
    });
  }

  if (groups.length > 0) {
    window.localStorage.setItem(key, JSON.stringify(groups));
    window.dispatchEvent(new CustomEvent("ledger:budget-groups-changed"));
  }
}

/** Idempotent per-user seed. Safe to call on every sign-in. */
export async function seedDefaultsForUser(userId: string): Promise<void> {
  if (!userId) return;
  const flagKey = SEED_FLAG_PREFIX + userId;
  // The category / rule checks are themselves idempotent; the flag just
  // avoids the extra roundtrips once we've done it in this browser.
  const alreadyLocal = typeof window !== "undefined" && window.localStorage.getItem(flagKey);

  try {
    const catByName = await seedCategories(userId);
    await seedMerchantRules(userId, catByName);
    seedBudgetGroups(userId, catByName);
    if (typeof window !== "undefined") window.localStorage.setItem(flagKey, "1");
  } catch (err) {
    if (!alreadyLocal) console.error("[seedDefaults] failed:", err);
  }
}

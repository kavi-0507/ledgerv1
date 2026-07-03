// Category presentation helpers: icon + group + display name.
// The DB stores whatever category names the user created. This module only
// affects display + ordering; it never mutates data.

export type CategoryGroup = "ESSENTIALS" | "LIFESTYLE" | "FINANCES" | "OTHER";

export const CATEGORY_GROUPS: CategoryGroup[] = ["ESSENTIALS", "LIFESTYLE", "FINANCES", "OTHER"];

type Meta = { icon: string; group: CategoryGroup; order: number; displayName?: string };

// Match on a normalised name (lowercased). Keys are substrings tried in order.
const RULES: Array<{ match: RegExp; meta: Meta }> = [
  // Essentials
  { match: /^rent(\s*&\s*housing)?$/i, meta: { icon: "🏠", group: "ESSENTIALS", order: 1 } },
  { match: /household|home/i,          meta: { icon: "🏡", group: "ESSENTIALS", order: 2 } },
  { match: /utilit|bills?/i,           meta: { icon: "💡", group: "ESSENTIALS", order: 3 } },
  { match: /grocer|supermarket/i,      meta: { icon: "🛒", group: "ESSENTIALS", order: 4 } },
  { match: /transport|travel card|tfl|commute/i, meta: { icon: "🚇", group: "ESSENTIALS", order: 5 } },
  // Lifestyle
  { match: /eating\s*out|restaurant|takeaway|food\s*out/i, meta: { icon: "🍔", group: "LIFESTYLE", order: 1 } },
  { match: /shopping|clothes/i,        meta: { icon: "🛍️", group: "LIFESTYLE", order: 2 } },
  { match: /entertain|fun|leisure/i,   meta: { icon: "🎮", group: "LIFESTYLE", order: 3 } },
  { match: /health|medical|pharmacy/i, meta: { icon: "🏥", group: "LIFESTYLE", order: 4 } },
  // Finances
  { match: /saving/i,                  meta: { icon: "💰", group: "FINANCES", order: 1 } },
  { match: /income|salary|wage/i,      meta: { icon: "📈", group: "FINANCES", order: 2 } },
  { match: /transfer/i,                meta: { icon: "🔄", group: "FINANCES", order: 3 } },
  // Other
  { match: /uncategori[sz]ed/i,        meta: { icon: "❓", group: "OTHER", order: 99 } },
  { match: /other|misc/i,              meta: { icon: "📦", group: "OTHER", order: 1 } },
];

export function getCategoryMeta(name: string | null | undefined): Meta {
  const n = (name ?? "").trim();
  for (const r of RULES) if (r.match.test(n)) return r.meta;
  return { icon: "📦", group: "OTHER", order: 50 };
}

export function categoryIcon(name: string | null | undefined): string {
  return getCategoryMeta(name).icon;
}

export type GroupedCategory<T> = { group: CategoryGroup; items: T[] };

export function groupCategories<T extends { name: string }>(cats: T[]): GroupedCategory<T>[] {
  const buckets = new Map<CategoryGroup, T[]>();
  CATEGORY_GROUPS.forEach(g => buckets.set(g, []));
  const sorted = [...cats].sort((a, b) => {
    const ma = getCategoryMeta(a.name), mb = getCategoryMeta(b.name);
    if (ma.order !== mb.order) return ma.order - mb.order;
    return a.name.localeCompare(b.name);
  });
  for (const c of sorted) buckets.get(getCategoryMeta(c.name).group)!.push(c);
  return CATEGORY_GROUPS
    .map(g => ({ group: g, items: buckets.get(g) ?? [] }))
    .filter(b => b.items.length > 0);
}

// ---- Purpose / behaviour ----
export const PURPOSE_PRESETS = [
  "Necessary", "Convenience", "Social", "Academic", "Travel",
  "Treat", "Impulse", "Shared", "Subscription", "Emergency", "Other",
] as const;
export type PurposePreset = (typeof PURPOSE_PRESETS)[number];

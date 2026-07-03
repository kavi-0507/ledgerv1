// Merchant normalization + confidence-based categorization pipeline.
// Pure functions — no I/O. Consumed by the CSV import flow.

export type Confidence = "high" | "medium" | "low";
export type CatState = "auto_applied" | "suggested" | "manual_review";

export type CatRow = {
  index: number;                 // stable ref back to source array
  occurred_on: string;
  description: string;
  amount: number;                // absolute
  direction: "in" | "out";
  signedAmount: number;          // + credit / - debit (post-normalisation)
  merchant: string;              // normalised
};

export type BuiltInHit = {
  categoryKeywords: string[];    // e.g. ["transport"]
  label: string;                 // human label for suggestion
  confidence: number;            // 0..1
  source: "user_rule" | "builtin";
};

export type CategoryLite = { id: string; name: string };

/* ---------------- Normalisation ---------------- */

const NOISE_PREFIXES = [
  /^card payment (to|from)\s+/i,
  /^payment (to|from)\s+/i,
  /^direct debit\s+/i,
  /^dd\s+/i,
  /^bp\s+/i,
  /^pos\s+/i,
  /^contactless\s+/i,
  /^visa\s+/i,
  /^mastercard\s+/i,
  /^purchase\s+/i,
  /^online\s+/i,
];

const NOISE_TAILS = [
  /\s+\d{2}\/\d{2}\/\d{2,4}.*$/,
  /\s+ref[:\s].*$/i,
  /\s+on \d{2}[- ]\w{3}[- ]?\d{0,4}.*$/i,
  /\s+\d{4,}$/,                    // trailing long digit ref
  /\s+(gb|uk|us|london|manchester)[a-z\s]*$/i,
  /\s+[a-z]{2,3}\*\S+$/i,          // "SP* CO", "SQ *"
];

export function normalizeMerchant(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  // Strip common prefixes/tails
  for (const re of NOISE_PREFIXES) s = s.replace(re, "");
  for (const re of NOISE_TAILS) s = s.replace(re, "");
  // Common tokenised noise
  s = s.replace(/\*+/g, " ").replace(/[_|]+/g, " ").replace(/\s{2,}/g, " ").trim();
  // Drop trailing city / country tokens if 3+ tokens
  const tokens = s.split(/\s+/);
  if (tokens.length >= 3) {
    const last = tokens[tokens.length - 1].toLowerCase();
    if (["gb", "uk", "us", "london", "manchester", "leeds", "birmingham"].includes(last)) tokens.pop();
  }
  s = tokens.join(" ").trim();
  // Title-case cheaply
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(w => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/* ---------------- Built-in patterns ---------------- */

type BuiltIn = {
  match: RegExp;
  label: string;
  categoryKeywords: string[];      // used to fuzzy-map to user's categories
  confidence: number;
};

const BUILTINS: BuiltIn[] = [
  // Transport
  { match: /\b(tfl|transport for london|oyster)\b/i, label: "Transport", categoryKeywords: ["transport", "travel", "commute"], confidence: 0.98 },
  { match: /\b(uber(?!\s*eats)|bolt\.eu|bolt\b|lyft|trainline|national rail|lner|gwr)\b/i, label: "Transport", categoryKeywords: ["transport", "travel"], confidence: 0.92 },
  // Groceries
  { match: /\b(tesco|sainsbury'?s?|lidl|aldi|co-?op|waitrose|morrisons|asda|iceland|marks ?& ?spencer|m&s food)\b/i, label: "Groceries", categoryKeywords: ["grocer", "supermarket"], confidence: 0.95 },
  // Food delivery / eating out
  { match: /\b(deliveroo|uber ?eats|just ?eat|justeat)\b/i, label: "Food delivery", categoryKeywords: ["eating", "food", "restaurant", "takeaway"], confidence: 0.95 },
  { match: /\b(wetherspoon|spoons|jd ?wetherspoon|nando'?s|pret|greggs|leon|itsu|five ?guys|honest burgers|pizza express|dishoom|franco manca|wagamama|byron|shake shack|starbucks|costa|caffe nero)\b/i, label: "Eating out", categoryKeywords: ["eating", "restaurant"], confidence: 0.9 },
  // Subscriptions / entertainment
  { match: /\b(netflix|spotify|disney\+?|prime video|apple\.com\/bill|apple services|itunes|hulu|hbo|youtube ?premium)\b/i, label: "Entertainment / Subscription", categoryKeywords: ["entertain", "subscription", "leisure"], confidence: 0.97 },
  // Phone / bills
  { match: /\b(voxi|vodafone|ee mobile|o2\b|three\b|giffgaff|sky mobile|bt\b|virgin ?media|octopus energy|british gas|thames water)\b/i, label: "Bills", categoryKeywords: ["bill", "utilit", "phone"], confidence: 0.94 },
  // Software / AI
  { match: /\b(openai|chatgpt|anthropic|claude\.ai|github|cursor\.sh|figma|notion|linear\.app|vercel|cloudflare)\b/i, label: "Software / Subscription", categoryKeywords: ["software", "subscription", "entertain"], confidence: 0.95 },
  // Shopping
  { match: /\b(amazon|amzn|amzn mktp|ebay|argos|ikea|zara|h&m|uniqlo|asos)\b/i, label: "Shopping", categoryKeywords: ["shopping", "clothes"], confidence: 0.9 },
];

/* ---------------- Low-confidence indicators ---------------- */

const LOW_CONF_RE = /\b(cr|bp|transfer|payment from|refund|reversal|repayment|reimburse|standing order)\b/i;

export function isPersonalNameLike(name: string): boolean {
  // Two capitalised words, no digits, no common merchant tokens
  const tokens = name.split(/\s+/);
  if (tokens.length !== 2) return false;
  if (/\d/.test(name)) return false;
  return tokens.every(t => /^[A-Z][a-z]{1,}$/.test(t));
}

/* ---------------- Category mapping ---------------- */

export function findCategoryByKeywords(cats: CategoryLite[], keywords: string[]): CategoryLite | null {
  const lower = cats.map(c => ({ c, n: c.name.toLowerCase() }));
  for (const k of keywords) {
    const hit = lower.find(x => x.n.includes(k.toLowerCase()));
    if (hit) return hit.c;
  }
  return null;
}

/* ---------------- Grouping + scoring ---------------- */

export type MerchantGroup = {
  key: string;                     // merchant + direction bucket key
  merchant: string;
  direction: "in" | "out";
  rows: CatRow[];
  total: number;                   // absolute total spend/credit
  suggestion: {
    categoryId: string | null;     // user category id (resolved) or null
    label: string;                 // human label
    confidence: number;            // 0..1
    tier: Confidence;
    state: CatState;
    source: "user_rule" | "builtin" | "none";
    reasons: string[];             // why low/medium
  };
  samples: string[];               // up to 3 sample descriptions
  hasMixedSigns: boolean;          // group had both +/- before splitting
};

function tierOf(score: number): Confidence {
  if (score >= 0.85) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

function matchBuiltin(merchant: string, desc: string): BuiltIn | null {
  const hay = `${merchant} ${desc}`;
  for (const b of BUILTINS) if (b.match.test(hay)) return b;
  return null;
}

export type UserRule = { pattern: string; category_id: string | null };

function matchUserRule(rules: UserRule[], desc: string, merchant: string): UserRule | null {
  const hay = `${desc} ${merchant}`;
  for (const r of rules) {
    try {
      const re = new RegExp(r.pattern, "i");
      if (re.test(hay)) return r;
    } catch {
      if (hay.toLowerCase().includes(r.pattern.toLowerCase())) return r;
    }
  }
  return null;
}

/**
 * Categorise a batch of parsed rows and group by merchant.
 * @param rows raw rows (must include original description + signed amount)
 * @param cats user categories
 * @param rules user merchant rules
 */
export function categorizeBatch(
  rows: Array<{
    occurred_on: string;
    description: string;
    signedAmount: number;
  }>,
  cats: CategoryLite[],
  rules: UserRule[],
): MerchantGroup[] {
  // Step 1: normalise + per-row categorisation
  const enriched: (CatRow & { userHit: UserRule | null; builtIn: BuiltIn | null })[] = rows.map((r, i) => {
    const merchant = normalizeMerchant(r.description) || r.description.trim() || "Unknown";
    const direction: "in" | "out" = r.signedAmount >= 0 ? "in" : "out";
    return {
      index: i,
      occurred_on: r.occurred_on,
      description: r.description,
      amount: Math.abs(r.signedAmount),
      direction,
      signedAmount: r.signedAmount,
      merchant,
      userHit: matchUserRule(rules, r.description, merchant),
      builtIn: matchBuiltin(merchant, r.description),
    };
  });

  // Step 2: group by merchant (regardless of direction first, so we can detect mixed)
  const byMerchant = new Map<string, typeof enriched>();
  for (const r of enriched) {
    const arr = byMerchant.get(r.merchant) ?? [];
    arr.push(r);
    byMerchant.set(r.merchant, arr);
  }

  const groups: MerchantGroup[] = [];
  for (const [merchant, arr] of byMerchant) {
    const hasIn = arr.some(r => r.direction === "in");
    const hasOut = arr.some(r => r.direction === "out");
    const mixed = hasIn && hasOut;

    // If mixed sign, split into two buckets, flag both as review-worthy
    const buckets: Array<{ direction: "in" | "out"; rows: typeof enriched }> = mixed
      ? [
          { direction: "out", rows: arr.filter(r => r.direction === "out") },
          { direction: "in", rows: arr.filter(r => r.direction === "in") },
        ]
      : [{ direction: arr[0].direction, rows: arr }];

    for (const b of buckets) {
      if (b.rows.length === 0) continue;
      const reasons: string[] = [];
      const total = b.rows.reduce((s, r) => s + r.amount, 0);

      // Suggestion: prefer user rule, else built-in
      const anyUserHit = b.rows.find(r => r.userHit)?.userHit ?? null;
      const anyBuiltin = b.rows.find(r => r.builtIn)?.builtIn ?? null;

      let categoryId: string | null = null;
      let label = "";
      let score = 0;
      let source: "user_rule" | "builtin" | "none" = "none";

      if (anyUserHit) {
        categoryId = anyUserHit.category_id;
        label = cats.find(c => c.id === anyUserHit.category_id)?.name ?? "User rule";
        score = 1.0;
        source = "user_rule";
      } else if (anyBuiltin) {
        const cat = findCategoryByKeywords(cats, anyBuiltin.categoryKeywords);
        categoryId = cat?.id ?? null;
        label = cat?.name ?? anyBuiltin.label;
        score = anyBuiltin.confidence;
        source = "builtin";
        if (!cat) {
          score = Math.min(score, 0.7);
          reasons.push("No matching user category — create one to auto-apply");
        }
      } else {
        label = "Uncategorised";
        score = 0.3;
        reasons.push("No pattern match");
      }

      // Downgrades
      const anyLowText = b.rows.some(r => LOW_CONF_RE.test(r.description));
      if (anyLowText) {
        score = Math.min(score, 0.5);
        reasons.push("Contains transfer/refund/CR/BP keywords");
      }
      if (mixed) {
        score = Math.min(score, 0.5);
        reasons.push("Merchant has both credits and debits — split & review");
      }
      if (b.direction === "in" && source !== "user_rule") {
        // Incoming money without an explicit rule → usually needs review
        score = Math.min(score, 0.5);
        reasons.push("Incoming amount — confirm category");
      }
      if (b.rows.length === 1 && source === "builtin") {
        score = Math.min(score, 0.8); // single-tx merchant caps at medium unless very high
      }
      if (source === "none" && isPersonalNameLike(merchant)) {
        reasons.push("Looks like a personal name");
      }

      const tier = tierOf(score);
      let state: CatState;
      if (tier === "high" && categoryId) state = "auto_applied";
      else if (tier === "medium" && categoryId) state = "suggested";
      else state = "manual_review";

      groups.push({
        key: `${merchant}__${b.direction}`,
        merchant,
        direction: b.direction,
        rows: b.rows.map(r => ({
          index: r.index, occurred_on: r.occurred_on, description: r.description,
          amount: r.amount, direction: r.direction, signedAmount: r.signedAmount, merchant: r.merchant,
        })),
        total,
        suggestion: { categoryId, label, confidence: score, tier, state, source, reasons },
        samples: Array.from(new Set(b.rows.map(r => r.description))).slice(0, 3),
        hasMixedSigns: mixed,
      });
    }
  }

  // Sort: manual_review first, then suggested, then auto; then by total desc
  const order: Record<CatState, number> = { manual_review: 0, suggested: 1, auto_applied: 2 };
  groups.sort((a, b) => {
    const s = order[a.suggestion.state] - order[b.suggestion.state];
    if (s !== 0) return s;
    return b.total - a.total;
  });

  return groups;
}

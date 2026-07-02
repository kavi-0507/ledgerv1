// Money / date formatters. Numbers are always tabular.

export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatMoney(
  v: unknown,
  opts: { currency?: string; signed?: boolean; compact?: boolean } = {},
): string {
  const n = toNumber(v);
  if (n === null) return "—";
  const { currency = "GBP", signed = false, compact = false } = opts;
  const abs = Math.abs(n);
  try {
    const formatted = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: compact && abs >= 1000 ? 0 : 2,
      minimumFractionDigits: compact && abs >= 1000 ? 0 : 2,
    }).format(abs);
    if (signed) {
      if (n > 0) return `+${formatted}`;
      if (n < 0) return `−${formatted}`;
    } else if (n < 0) {
      return `−${formatted}`;
    }
    return formatted;
  } catch {
    return String(v);
  }
}

export function formatPercent(v: unknown, digits = 0): string {
  const n = toNumber(v);
  if (n === null) return "—";
  const value = n > 1.5 ? n : n * 100;
  return `${value.toFixed(digits)}%`;
}

export function formatDate(v: unknown): string {
  if (!v) return "—";
  try {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return String(v);
  }
}

export function formatDateShort(v: unknown): string {
  if (!v) return "—";
  try {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
    }).format(d);
  } catch {
    return String(v);
  }
}

export function formatDateTime(v: unknown): string {
  if (!v) return "—";
  try {
    const d = new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(v);
  }
}

// Turn "grocery_shopping" / "needs_review" / "in" into "Grocery shopping".
export function humanize(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v).replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Array<[K, T[]]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return Array.from(map.entries());
}

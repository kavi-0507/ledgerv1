export const categories = [
  "Rent & Housing",
  "Utilities",
  "Groceries",
  "Meal Plan",
  "Eating out",
  "Transport",
  "Shopping",
  "Entertainment",
  "Subscriptions",
  "Health",
  "Rent & bills",
  "Other",
  "Income",
  "Savings",
  "Transfer",
] as const;
export type Category = string;
export type CategoryDefinition = { id: string; name: string; custom?: boolean };
export type ReviewReason = "category" | "possible_duplicate" | "refund";
export type CsvMapping = { key: string; header: boolean; dateCol: number; descCol: number; amountCol: number; debitCol: number; creditCol: number; order: "DMY" | "MDY"; amountMode: string };
export type Runway = { mode: "manual" | "estimate"; availableNow?: number; recordedAt?: string; nextPaymentDate: string; estimateFrom?: string };
export type Transaction = {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: Category;
  review: boolean;
  reviewReasons?: ReviewReason[];
  source: string;
};
export type Bill = {
  id: string;
  name: string;
  amount: number;
  date: string;
  recurrence: "monthly" | "weekly" | "termly" | "yearly" | "once";
  payments: { date: string; transactionId: string; dueDate?: string }[];
};
export type Budget = { category: Category; limit: number };
export type Rule = { id: string; merchant: string; category: Category; direction?: number };
export type LedgerState = {
  version?: 2;
  categoryDefs?: CategoryDefinition[];
  budgetMonths?: { month: string; budgets: Budget[]; income?: number; savings?: number }[];
  csvMappings?: CsvMapping[];
  runway?: Runway | null;
  name: string;
  income: number;
  savings: number;
  setup: boolean;
  transactions: Transaction[];
  budgets: Budget[];
  bills: Bill[];
  rules: Rule[];
  imports: {
    id: string;
    name: string;
    date: string;
    count: number;
    duplicates: number;
  }[];
};
export const today = () => new Date().toLocaleDateString("en-CA");
export const currentMonth = () => today().slice(0, 7);
export const categoryOptions = (state: LedgerState) => [...categories.map(name => ({ id: name as string, name: name as string })), ...(state.categoryDefs || [])];
export const categoryName = (state: LedgerState, id: string) => categoryOptions(state).find(c => c.id === id)?.name || id;
export const budgetsForMonth = (state: LedgerState, month: string) => state.budgetMonths?.find(x => x.month === month)?.budgets || state.budgets;
export const planMetaForMonth = (state: LedgerState, month: string) => { const saved=state.budgetMonths?.find(x=>x.month===month); return { income: saved?.income ?? state.income, savings: saved?.savings ?? state.savings }; };
export function saveMonthBudgets(state: LedgerState, month: string, budgets: Budget[], income?: number, savings?: number): LedgerState {
  const previous = state.budgetMonths?.find(x=>x.month===month);
  const months = (state.budgetMonths || []).filter(x => x.month !== month);
  months.push({ month, budgets, income: income ?? previous?.income ?? state.income, savings: savings ?? previous?.savings ?? state.savings });
  return { ...state, budgets: month >= currentMonth() ? budgets : state.budgets, budgetMonths: months };
}
export function ensureBudgetHistory(state: LedgerState): LedgerState {
  const snapshots = [...(state.budgetMonths || [])];
  const existing = new Set(snapshots.map(s=>s.month));
  for (const month of new Set(state.transactions.map(t=>t.date.slice(0,7)))) if (!existing.has(month)) snapshots.push({month,budgets:state.budgets.map(b=>({...b})),income:state.income,savings:state.savings});
  return {...state,budgetMonths:snapshots};
}
export function upgradeState(input: LedgerState): LedgerState {
  if (input.version === 2) return { ...input, categoryDefs: input.categoryDefs || [], csvMappings: input.csvMappings || [], runway: input.runway || null,
    budgetMonths: (input.budgetMonths || []).map(m=>({ ...m, income: m.income ?? input.income, savings: m.savings ?? input.savings })) };
  const months = new Set(input.transactions.map(t => t.date.slice(0, 7)));
  months.add(currentMonth());
  return { ...input, version: 2, categoryDefs: [], csvMappings: [], runway: null,
    budgetMonths: [...months].map(month => ({ month, budgets: input.budgets.map(b => ({ ...b })), income: input.income, savings: input.savings })),
    transactions: input.transactions.map(t => ({ ...t, reviewReasons: t.review ? ["category"] : [] })) };
}
export const normalizeMerchant = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/^(card payment|contactless|direct debit|pos|sq \*)\s*/i, "").replace(/\b(?:london|online|gb|uk)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export function csvFormatKey(rows: string[][], header: boolean) {
  if (!rows.length) return "";
  if (header) return "header:" + rows[0].map(x => x.trim().toLowerCase().replace(/\s+/g," ")).join("|");
  const signature = rows[0].map(x => /^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}$/.test(x)?"date":/^[£(\-+\d,. )]+$/.test(x)?"money":"text");
  return "no-header:" + signature.join("|");
}
export function reviewGroups(state: LedgerState) {
  const groups = new Map<string, Transaction[]>();
  for (const t of state.transactions.filter(t => t.review && (t.reviewReasons || ["category"]).includes("category"))) {
    const key = normalizeMerchant(t.merchant) + ":" + Math.sign(t.amount);
    groups.set(key, [...(groups.get(key) || []), t]);
  }
  return [...groups].map(([key, transactions]) => ({ key, transactions }));
}
export function applyGroupCategory(state: LedgerState, key: string, category: Category, remember: boolean): LedgerState {
  const group = reviewGroups(state).find(g => g.key === key);
  if (!group) return state;
  const ids = new Set(group.transactions.map(t => t.id));
  const merchant = normalizeMerchant(group.transactions[0].merchant);
  const direction = Math.sign(group.transactions[0].amount);
  return { ...state, transactions: state.transactions.map(t => ids.has(t.id) ? { ...t, category, reviewReasons: (t.reviewReasons || []).filter(r => r !== "category"), review: (t.reviewReasons || []).some(r => r !== "category") } : t),
    rules: remember ? [...state.rules.filter(r => normalizeMerchant(r.merchant) !== merchant || (r.direction && r.direction !== direction)), { id: crypto.randomUUID(), merchant, category, direction }] : state.rules };
}
export function suggestBudgets(state: LedgerState, month = currentMonth()) {
  const months = [...new Set(state.transactions.map(t => t.date.slice(0, 7)).filter(m => m < month))].sort().slice(-3);
  const enough = months.length > 0 && state.transactions.filter(t => months.includes(t.date.slice(0,7)) && t.amount < 0).length >= 10;
  if (enough) return { basis: `Based on ${months.join(", ")}`, budgets: categoryOptions(state).filter(c => !["Income","Savings","Transfer","Other"].includes(c.id)).map(c => ({ category: c.id, limit: Math.ceil(months.reduce((n,m) => n + totals(state,m).byCategory(c.id),0) / months.length / 5) * 5 })).filter(b => b.limit > 0) };
  const starter: [string, number][] = [["Rent & bills",800],["Groceries",180],["Eating out",70],["Transport",80],["Shopping",60],["Subscriptions",30],["Health",30],["Entertainment",50],["Other",40]];
  return { basis: "Starter example — change any amount", budgets: starter.map(([category,limit]) => ({category,limit})) };
}
export function runwayEstimate(state: LedgerState, asOf = today()) {
  const setting = state.runway;
  if (!setting || setting.nextPaymentDate <= asOf) return null;
  const start = setting.mode === "estimate" ? (setting.estimateFrom || currentMonth() + "-01") : asOf;
  const history = state.transactions.filter(t => t.date >= start && t.date <= asOf);
  const sinceManual = state.transactions.filter(t=>t.date > (setting.recordedAt || asOf) && t.date <= asOf && t.category !== "Transfer" && t.category !== "Savings").reduce((n,t)=>n+t.amount,0);
  const base = setting.mode === "manual" ? (setting.availableNow || 0) + sinceManual : history.filter(t => t.category === "Income").reduce((n,t) => n + t.amount,0) + history.filter(t => t.amount < 0 && !["Savings","Transfer"].includes(t.category)).reduce((n,t) => n + t.amount,0);
  const bills = state.bills.filter(b => b.date > asOf && b.date < setting.nextPaymentDate && !billPaid(b)).reduce((n,b) => n + b.amount,0);
  const saved = -state.transactions.filter(t => t.date.startsWith(currentMonth()) && t.category === "Savings" && t.amount < 0).reduce((n,t) => n + t.amount,0);
  const remainingSavings = Math.max(0,state.savings-saved);
  const available = base - bills - remainingSavings;
  const weeks = Math.max(1,(+new Date(setting.nextPaymentDate) - +new Date(asOf)) / 604800000);
  return { available, weekly: available / weeks, bills, remainingSavings, start };
}
export const billPaid = (bill: Bill) => bill.payments.some(p => p.dueDate ? p.dueDate === bill.date : p.date.slice(0,7) === bill.date.slice(0,7));
export function blankState(): LedgerState {
  return {
    version: 2,
    categoryDefs: [],
    budgetMonths: [],
    csvMappings: [],
    runway: null,
    name: "",
    income: 0,
    savings: 0,
    setup: false,
    transactions: [],
    budgets: [],
    bills: [],
    rules: [],
    imports: [],
  };
}
export const money = (n: number, digits = 2) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(n) < 0.005 ? 0 : n);
export const shortDate = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
export function demoState(): LedgerState {
  const m = currentMonth();
  const tx: [number, string, number, Category, boolean][] = [
    [1, "Student finance", 1600, "Income", false],
    [1, "Monthly rent", -650, "Rent & Housing", false],
    [3, "Octopus Energy", -42, "Utilities", false],
    [4, "Tesco", -42.6, "Groceries", false],
    [5, "Transport for London", -24, "Transport", false],
    [7, "Spotify", -5.99, "Subscriptions", false],
    [8, "Sainsbury’s", -38.2, "Groceries", false],
    [10, "Uniqlo", -64.9, "Shopping", false],
    [12, "Pret A Manger", -8.5, "Eating out", false],
    [13, "Tesco", -36.75, "Groceries", false],
    [15, "Nando’s", -24.5, "Eating out", false],
    [16, "Transport for London", -18.4, "Transport", false],
    [17, "Savings pot", -150, "Savings", false],
    [19, "Co-op", -24.8, "Groceries", false],
    [21, "Campus café", -6.8, "Eating out", false],
    [22, "Amazon", -29.99, "Shopping", false],
    [24, "Tesco", -32.4, "Groceries", false],
    [25, "Sam Taylor", -18, "Other", true],
    [26, "Transport for London", -7.8, "Transport", false],
    [27, "SQ * COMMON GROUND", -9.5, "Other", true],
    [27, "COMMON GROUND", -7.5, "Other", true],
    [28, "Sainsbury’s", -28.6, "Groceries", false],
  ];
  return {
    name: "Alex",
    income: 1600,
    savings: 150,
    setup: true,
    transactions: tx.map(([d, merchant, amount, category, review], i) => ({
      id: "demo-" + i,
      date: `${m}-${String(d).padStart(2, "0")}`,
      merchant,
      amount,
      category,
      review,
      source: "sample",
    })),
    budgets: [
      { category: "Groceries", limit: 260 },
      { category: "Eating out", limit: 100 },
      { category: "Transport", limit: 80 },
      { category: "Shopping", limit: 120 },
      { category: "Subscriptions", limit: 30 },
      { category: "Rent & Housing", limit: 650 },
      { category: "Utilities", limit: 65 },
      { category: "Other", limit: 45 },
    ],
    bills: [
      {
        id: "rent",
        name: "Rent",
        amount: 650,
        date: `${m}-01`,
        recurrence: "monthly",
        payments: [{ date: `${m}-01`, transactionId: "demo-1" }],
      },
      {
        id: "energy",
        name: "Octopus Energy",
        amount: 42,
        date: `${m}-03`,
        recurrence: "monthly",
        payments: [{ date: `${m}-03`, transactionId: "demo-2" }],
      },
      {
        id: "wifi",
        name: "Broadband",
        amount: 23,
        date: `${m}-30`,
        recurrence: "monthly",
        payments: [],
      },
    ],
    rules: [{ id: "tesco", merchant: "Tesco", category: "Groceries" }],
    imports: [
      {
        id: "sample",
        name: "Example bank CSV",
        date: today(),
        count: 21,
        duplicates: 0,
      },
    ],
  };
}
export function totals(state: LedgerState, month: string) {
  const monthPlan = planMetaForMonth(state,month);
  const tx = state.transactions.filter((t) => t.date.startsWith(month));
  const spendTx = tx.filter(
    (t) =>
      t.amount < 0 && !["Savings", "Transfer", "Income"].includes(t.category),
  );
  const spent = -spendTx.reduce((n, t) => n + t.amount, 0);
  const earned = tx
    .filter((t) => t.amount > 0 && t.category === "Income")
    .reduce((n, t) => n + t.amount, 0);
  const saved = -tx
    .filter((t) => t.amount < 0 && t.category === "Savings")
    .reduce((n, t) => n + t.amount, 0);
  const reserve = Math.max(monthPlan.savings, saved);
  const unpaid = state.bills
    .filter(
      (b) =>
        b.date.startsWith(month) &&
        !billPaid(b),
    )
    .reduce((n, b) => n + b.amount, 0);
  const available = (monthPlan.income || earned) - spent - reserve - unpaid;
  return {
    tx,
    spendTx,
    spent,
    earned,
    saved,
    unpaid,
    available,
    review: tx.filter((t) => t.review).length,
    byCategory: (c: string) =>
      -spendTx
        .filter((t) => t.category === c)
        .reduce((n, t) => n + t.amount, 0),
  };
}
export function nextDue(date: string, recurrence: Bill["recurrence"]) {
  if (recurrence === "once") return date;
  const [y, m, d] = date.split("-").map(Number);
  if (recurrence === "weekly") {
    const n = new Date(y, m - 1, d + 7, 12);
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }
  const offset =
    recurrence === "monthly" ? 1 : recurrence === "termly" ? 4 : 12;
  const n = new Date(y, m - 1 + offset, 1, 12);
  const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
export function categorise(
  merchant: string,
  amount: number,
  rules: Rule[],
): { category: Category; review: boolean; reviewReasons: ReviewReason[] } {
  const rule = rules.find((r) =>
    normalizeMerchant(merchant).includes(normalizeMerchant(r.merchant)) && (!r.direction || r.direction === Math.sign(amount)),
  );
  if (/refund|reversal|repayment/i.test(merchant)) return { category: rule?.category || "Other", review: true, reviewReasons: ["refund"] };
  if (rule) return { category: rule.category, review: false, reviewReasons: [] };
  if (/transfer/i.test(merchant)) return { category: "Transfer", review: true, reviewReasons: ["category"] };
  if (amount > 0) return { category: "Income", review: true, reviewReasons: ["category"] };
  const patterns: [RegExp, Category][] = [
    [/tesco|sainsbury|aldi|lidl|co-op|waitrose|asda|morrisons|iceland|m&s food/i, "Groceries"],
    [/tiffin|meal ?plan|sakshi/i, "Meal Plan"],
    [
      /pret|nando|costa|starbucks|greggs|deliveroo|uber eats|just eat|wetherspoon|leon|itsu|five guys|pizza express|wagamama|caffe nero/i,
      "Eating out",
    ],
    [
      /tfl|transport for london|oyster|trainline|national rail|uber|bolt|lner|gwr/i,
      "Transport",
    ],
    [/spotify|netflix|disney|apple.com\/bill|openai|chatgpt|anthropic|github|youtube premium|prime video/i, "Subscriptions"],
    [/boots|superdrug|pharmacy|nhs/i, "Health"],
    [/cinema|odeon|vue cinema|steam games|ticketmaster/i, "Entertainment"],
    [/rent|landlord|lettings/i, "Rent & Housing"],
    [
      /octopus|british gas|thames water|broadband|vodafone|giffgaff|voxi|sky mobile|virgin media/i,
      "Utilities",
    ],
    [/amazon|uniqlo|asos|ikea|zara|h&m/i, "Shopping"],
    [/savings pot/i, "Savings"],
  ];
  const match = patterns.find(([re]) => re.test(merchant));
  return match
    ? { category: match[1], review: false, reviewReasons: [] }
    : { category: "Other", review: true, reviewReasons: ["category"] };
}
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const first = s.split(/\r?\n/)[0] || "";
  const delimiter =
    (first.match(/;/g) || []).length > (first.match(/,/g) || []).length
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      if (quoted && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (quoted)
    throw new Error("A quoted field is not closed. Please check the CSV file.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export function parseDate(value: string, order: "DMY" | "MDY") {
  let y: number, m: number, d: number;
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T].*)?$/);
  const local = value.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (iso) {
    y = +iso[1];
    m = +iso[2];
    d = +iso[3];
  } else if (local) {
    y = +local[3];
    if (y < 100) y += 2000;
    m = +(order === "DMY" ? local[2] : local[1]);
    d = +(order === "DMY" ? local[1] : local[2]);
  } else {
    if (!/[a-z]/i.test(value)) return null;
    const n = new Date(value);
    if (isNaN(+n)) return null;
    y = n.getFullYear();
    m = n.getMonth() + 1;
    d = n.getDate();
  }
  const date = new Date(y, m - 1, d, 12);
  if (
    date.getFullYear() !== y ||
    date.getMonth() + 1 !== m ||
    date.getDate() !== d
  )
    return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
export function parseAmount(s: string) {
  const v = s.trim();
  if (!v) return NaN;
  const neg = /^\(.*\)$/.test(v);
  const n = Number(v.replace(/[£$€,\s()]/g, ""));
  return neg ? -n : n;
}
export const fingerprint = (
  t: Pick<Transaction, "date" | "merchant" | "amount">,
) =>
  `${t.date}|${t.merchant.toLowerCase().replace(/\s+/g, " ").trim()}|${Math.round(t.amount * 100)}`;

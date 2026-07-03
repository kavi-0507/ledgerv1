// Shared budget health / score logic used by Home and Insights so the two
// pages always tell the same story. All maths runs off the user's saved
// budget groups (localStorage) — never hardcoded templates.

import { detectCategoryKind, type BudgetGroup, type BudgetPeriod } from "./budgetGroups";

export type CatLite = { id: string; name: string };

export type Tx = {
  amount: number;
  direction: string;
  category_id: string | null;
  is_transfer?: boolean | null;
  occurred_on: string;
  needs_review?: boolean | null;
};

export function normalisePeriod(amount: number, period: BudgetPeriod): number {
  if (period === "weekly") return amount * (52 / 12);
  if (period === "termly") return amount / 3;
  return amount;
}

export type GroupStatus = "unused" | "on_track" | "at_risk" | "projected_over" | "over";

export type GroupHealth = {
  group: BudgetGroup;
  budget: number;      // monthly-normalised
  spent: number;
  remaining: number;
  pct: number;         // 0..(>100)
  projected: number;   // projected month-end spend
  status: GroupStatus;
};

export type BudgetHealth = {
  hasBudgets: boolean;
  groups: GroupHealth[];
  expenseGroups: GroupHealth[];
  savingsGroups: GroupHealth[];
  totalBudget: number;
  totalSavings: number;
  totalPlannedOutgoing: number;
  totalExpenseSpent: number;   // outflow excluding transfer / income / savings-kind
  budgetedSpent: number;       // spend within tracked expense groups
  uncategorisedSpent: number;
  uncategorisedCount: number;
  savingsSpent: number;
  needsReviewCount: number;
  projectedTotalExpense: number;
  score: number | null;
  scoreLabel: string;          // "Excellent" | ... | "Set your first budget"
  overBudget: GroupHealth[];
  projectedOver: GroupHealth[];
  healthy: GroupHealth[];      // expense groups under 50% used
  progressFactor: number;      // days elapsed / total days
};

export function computeHealth({
  groups, categories, transactions, monthFrom, monthTo,
}: {
  groups: BudgetGroup[];
  categories: CatLite[];
  transactions: Tx[];
  monthFrom: string;
  monthTo: string;
}): BudgetHealth {
  const catById = new Map(categories.map(c => [c.id, c]));

  const from = new Date(monthFrom);
  const to = new Date(monthTo);
  const totalDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
  const today = new Date();
  const rawElapsed = Math.round((today.getTime() - from.getTime()) / 86400000) + 1;
  const elapsed = Math.max(1, Math.min(totalDays, rawElapsed));
  const projectionFactor = totalDays / elapsed;

  const spendByCat = new Map<string | null, number>();
  let totalExpenseSpent = 0;
  let uncategorisedSpent = 0;
  let uncategorisedCount = 0;
  let savingsSpent = 0;
  let needsReviewCount = 0;

  for (const t of transactions) {
    if (t.needs_review) needsReviewCount++;
    if (t.is_transfer) continue;
    if (t.direction !== "out") continue;
    const cat = t.category_id ? catById.get(t.category_id) : null;
    const kind = detectCategoryKind(cat?.name);
    if (kind === "transfer" || kind === "income") continue;
    const amt = Number(t.amount || 0);
    if (kind === "savings") { savingsSpent += amt; continue; }
    totalExpenseSpent += amt;
    if (!t.category_id) { uncategorisedSpent += amt; uncategorisedCount++; }
    spendByCat.set(t.category_id, (spendByCat.get(t.category_id) ?? 0) + amt);
  }

  const groupHealths: GroupHealth[] = groups.map(g => {
    const budget = normalisePeriod(Number(g.amount || 0), g.period);
    const spent = g.categoryIds.reduce((s, id) => s + (spendByCat.get(id) ?? 0), 0);
    const remaining = budget - spent;
    const pct = budget > 0 ? (spent / budget) * 100 : 0;
    const projected = spent * projectionFactor;
    let status: GroupStatus;
    if (g.kind === "expense") {
      if (spent === 0) status = "unused";
      else if (pct > 100) status = "over";
      else if (budget > 0 && projected > budget) status = "projected_over";
      else if (pct >= 80) status = "at_risk";
      else status = "on_track";
    } else {
      status = pct >= 100 ? "on_track" : pct >= 50 ? "at_risk" : "unused";
    }
    return { group: g, budget, spent, remaining, pct, projected, status };
  });

  const expenseGroups = groupHealths.filter(g => g.group.kind === "expense");
  const savingsGroups = groupHealths.filter(g => g.group.kind === "savings");
  const totalBudget = expenseGroups.reduce((s, g) => s + g.budget, 0);
  const totalSavings = savingsGroups.reduce((s, g) => s + g.budget, 0);
  const budgetedSpent = expenseGroups.reduce((s, g) => s + g.spent, 0);
  const projectedTotalExpense = totalExpenseSpent * projectionFactor;

  const overBudget = expenseGroups.filter(g => g.status === "over");
  const projectedOver = expenseGroups.filter(g => g.status === "projected_over");
  const healthy = expenseGroups.filter(g => g.pct < 50 && g.spent > 0);

  let score: number | null = null;
  let scoreLabel = "Set your first budget";
  if (expenseGroups.length > 0) {
    let s = 100;
    if (overBudget.length > 0) s -= 20;
    if (projectedOver.length > 0) s -= 10;
    if (uncategorisedSpent > 0) s -= 5;
    if (needsReviewCount > 0) s -= 5;
    if (totalBudget > 0 && projectedTotalExpense > totalBudget) s -= 25;
    score = Math.max(0, Math.min(100, s));
    scoreLabel = score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Watch out" : "Needs attention";
  }

  return {
    hasBudgets: expenseGroups.length + savingsGroups.length > 0,
    groups: groupHealths, expenseGroups, savingsGroups,
    totalBudget, totalSavings, totalPlannedOutgoing: totalBudget + totalSavings,
    totalExpenseSpent, budgetedSpent, uncategorisedSpent, uncategorisedCount,
    savingsSpent, needsReviewCount, projectedTotalExpense,
    score, scoreLabel, overBudget, projectedOver, healthy,
    progressFactor: elapsed / totalDays,
  };
}

export function scoreTone(score: number | null): "positive" | "warning" | "negative" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 70) return "positive";
  if (score >= 50) return "warning";
  return "negative";
}

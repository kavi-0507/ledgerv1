import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, CopyPlus, PieChart, Sparkles, TrendingDown, TrendingUp,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { SkeletonChart, SkeletonStatCard } from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCategories, useActiveMonth } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { useBudgetGroups, type BudgetGroup } from "@/lib/budgetGroups";
import { computeHealth, scoreTone, type Tx as HealthTx } from "@/lib/budgetHealth";
import {
  useAvailableMonths, useMonthSnapshots, useAutoSnapshotCurrentMonth, useSnapshotMonths,
  applySnapshotToMonths, replaceLiveBudgets,
  monthStart, monthEnd, shiftMonth, monthLabel, monthShortLabel, type MonthKey,
} from "@/lib/insightsMonths";
import { z } from "zod";

const searchSchema = z.object({ month: z.string().optional() });

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
  validateSearch: (s) => searchSchema.parse(s),
});

const TREND_WINDOW = 6;

function InsightsPage() {
  const { month: monthParam } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active = useActiveMonth();
  const cats = useCategories();
  const { groups, userId } = useBudgetGroups();
  const availableMonths = useAvailableMonths();

  useAutoSnapshotCurrentMonth(userId, groups);

  // Selected month falls back to the active (latest data) month.
  const selectedMonth: MonthKey | undefined = monthParam
    ? monthStart(monthParam)
    : active.data?.from ? monthStart(active.data.from) : undefined;

  const setMonth = (m: MonthKey) => {
    navigate({ search: () => ({ month: m }), replace: true });
  };

  const months = availableMonths.data ?? [];
  const canPrev = !!selectedMonth && months.length > 0 && selectedMonth > months[months.length - 1];
  const canNext = !!selectedMonth && months.length > 0 && selectedMonth < months[0];

  // Trend window: previous (TREND_WINDOW-1) months + selected month.
  const trendMonths: MonthKey[] = useMemo(() => {
    if (!selectedMonth) return [];
    const arr: MonthKey[] = [];
    for (let i = TREND_WINDOW - 1; i >= 0; i--) arr.push(shiftMonth(selectedMonth, -i));
    return arr;
  }, [selectedMonth]);

  const snapshots = useMonthSnapshots(userId, trendMonths, groups);

  // Fetch transactions for the whole trend window in one query.
  const trendTx = useQuery({
    queryKey: ["insights_trend_tx", trendMonths[0], trendMonths[trendMonths.length - 1]],
    enabled: trendMonths.length > 0,
    queryFn: async (): Promise<HealthTx[]> => {
      const from = trendMonths[0];
      const to = monthEnd(trendMonths[trendMonths.length - 1]);
      const { data, error } = await supabase
        .from("transactions")
        .select("amount,category_id,direction,is_transfer,occurred_on,needs_review")
        .gte("occurred_on", from).lte("occurred_on", to);
      if (error) throw error;
      return (data ?? []) as HealthTx[];
    },
  });

  const loading = active.isLoading || cats.isLoading || trendTx.isLoading || snapshots.isLoading;

  const currentMonth = monthStart(new Date().toISOString().slice(0, 10));
  const sourceGroups: BudgetGroup[] = selectedMonth ? (snapshots.data?.[selectedMonth] ?? groups) : groups;
  const [carryOpen, setCarryOpen] = useState(false);

  return (
    <AppShell header={<h1 className="truncate text-display text-xl sm:text-2xl">Insights</h1>}>
      <PageHeader
        eyebrow="Insights"
        title="Why am I okay — or not?"
        description={selectedMonth ? `Reviewing ${monthLabel(selectedMonth)}.` : "Insights from your own budgets and spending."}
        actions={selectedMonth && months.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <MonthPicker
              selected={selectedMonth}
              months={months}
              canPrev={canPrev}
              canNext={canNext}
              onChange={setMonth}
            />
            {sourceGroups.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setCarryOpen(true)}>
                <CopyPlus className="mr-1.5 h-4 w-4" />Carry forward…
              </Button>
            )}
          </div>
        ) : null}
      />


      <QueryBoundary
        isLoading={loading}
        isError={trendTx.isError || snapshots.isError}
        error={trendTx.error ?? snapshots.error}
        onRetry={() => { trendTx.refetch(); snapshots.refetch(); }}
        loading={<div className="space-y-6"><SkeletonChart /><div className="grid gap-4 md:grid-cols-3"><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /></div></div>}
      >
        {groups.length === 0 && !Object.values(snapshots.data ?? {}).some(g => g.length > 0) ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="Create your first budget to unlock insights"
            description="Insights are based on the budgets you save — no fake data, no templates."
            action={<Link to="/budgets"><Button>Go to budgets</Button></Link>}
          />
        ) : selectedMonth ? (
          <Body
            selectedMonth={selectedMonth}
            trendMonths={trendMonths}
            allTx={trendTx.data ?? []}
            snapshots={snapshots.data ?? {}}
            categories={cats.data ?? []}
          />
        ) : null}
      </QueryBoundary>

      {selectedMonth && userId && (
        <CarryForwardDialog
          open={carryOpen}
          onOpenChange={setCarryOpen}
          sourceMonth={selectedMonth}
          sourceGroups={sourceGroups}
          currentMonth={currentMonth}
          userId={userId}
        />
      )}
    </AppShell>
  );
}

function MonthPicker({ selected, months, canPrev, canNext, onChange }: {
  selected: MonthKey;
  months: MonthKey[];
  canPrev: boolean;
  canNext: boolean;
  onChange: (m: MonthKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline" size="icon"
        disabled={!canPrev}
        onClick={() => onChange(shiftMonth(selected, -1))}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Select value={selected} onValueChange={onChange}>
        <SelectTrigger className="min-w-[180px]">
          <SelectValue>{monthLabel(selected)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {months.map(m => (
            <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline" size="icon"
        disabled={!canNext}
        onClick={() => onChange(shiftMonth(selected, 1))}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function filterTx(all: HealthTx[], from: string, to: string): HealthTx[] {
  return all.filter(t => t.occurred_on >= from && t.occurred_on <= to);
}

function Body({ selectedMonth, trendMonths, allTx, snapshots, categories }: {
  selectedMonth: MonthKey;
  trendMonths: MonthKey[];
  allTx: HealthTx[];
  snapshots: Record<MonthKey, ReturnType<typeof useBudgetGroups>["groups"]>;
  categories: { id: string; name: string }[];
}) {
  const monthFrom = selectedMonth;
  const monthTo = monthEnd(selectedMonth);
  const prevMonth = shiftMonth(selectedMonth, -1);
  const prevFrom = prevMonth;
  const prevTo = monthEnd(prevMonth);

  const curTx = useMemo(() => filterTx(allTx, monthFrom, monthTo), [allTx, monthFrom, monthTo]);
  const prevTx = useMemo(() => filterTx(allTx, prevFrom, prevTo), [allTx, prevFrom, prevTo]);

  const curGroups = snapshots[selectedMonth] ?? [];
  const prevGroups = snapshots[prevMonth] ?? [];

  const health = useMemo(
    () => computeHealth({ groups: curGroups, categories, transactions: curTx, monthFrom, monthTo }),
    [curGroups, categories, curTx, monthFrom, monthTo],
  );
  const prevHealth = useMemo(
    () => computeHealth({ groups: prevGroups, categories, transactions: prevTx, monthFrom: prevFrom, monthTo: prevTo }),
    [prevGroups, categories, prevTx, prevFrom, prevTo],
  );
  const hasPrev = prevTx.length > 0 || prevGroups.length > 0;

  const {
    score, scoreLabel, totalBudget, totalSavings, totalExpenseSpent, projectedTotalExpense,
    expenseGroups, overBudget, projectedOver, uncategorisedSpent, uncategorisedCount,
    savingsSpent,
  } = health;

  const remainingBudget = Math.max(0, totalBudget - totalExpenseSpent);
  const atRisk = expenseGroups.filter(g => g.status === "at_risk" || g.status === "projected_over").length;

  // ---- Trend series -------------------------------------------------------
  const trendSeries = useMemo(() => {
    return trendMonths.map(m => {
      const from = m, to = monthEnd(m);
      const tx = filterTx(allTx, from, to);
      const g = snapshots[m] ?? [];
      const h = computeHealth({ groups: g, categories, transactions: tx, monthFrom: from, monthTo: to });
      return {
        month: m,
        label: monthShortLabel(m),
        spending: Math.round(h.totalExpenseSpent),
        budget: Math.round(h.totalBudget),
        score: h.score,
      };
    });
  }, [trendMonths, allTx, snapshots, categories]);

  // ---- Category drivers & top-category trend -----------------------------
  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const sumByCat = (rows: HealthTx[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.is_transfer || r.direction !== "out" || !r.category_id) continue;
      const name = catById.get(r.category_id)?.name ?? "";
      if (/income|transfer|saving/i.test(name)) continue;
      m.set(r.category_id, (m.get(r.category_id) ?? 0) + Number(r.amount || 0));
    }
    return m;
  };

  const drivers = useMemo(() => {
    const cur = sumByCat(curTx); const prev = sumByCat(prevTx);
    const trackedIds = new Set(expenseGroups.flatMap(g => g.group.categoryIds));
    return Array.from(cur.entries())
      .filter(([id]) => trackedIds.has(id))
      .map(([id, curAmt]) => {
        const prevAmt = prev.get(id) ?? 0;
        return { id, name: catById.get(id)?.name ?? "Unknown", cur: curAmt, prev: prevAmt, change: curAmt - prevAmt };
      })
      .sort((a, b) => b.cur - a.cur);
  }, [curTx, prevTx, expenseGroups, catById]);

  const topDrivers = drivers.slice(0, 5);

  // Biggest movers (all categories, not just tracked)
  const movers = useMemo(() => {
    const cur = sumByCat(curTx); const prev = sumByCat(prevTx);
    const ids = new Set([...cur.keys(), ...prev.keys()]);
    const list = Array.from(ids).map(id => {
      const c = cur.get(id) ?? 0, p = prev.get(id) ?? 0;
      return { id, name: catById.get(id)?.name ?? "Unknown", cur: c, prev: p, change: c - p };
    });
    const biggestIncrease = [...list].sort((a, b) => b.change - a.change)[0];
    const biggestDecrease = [...list].sort((a, b) => a.change - b.change)[0];
    return { biggestIncrease, biggestDecrease };
  }, [curTx, prevTx, catById]);

  // Top category trend: pick top 3 categories from selected month, plot over trend window.
  const topCatTrend = useMemo(() => {
    const topIds = topDrivers.slice(0, 3).map(d => d.id);
    if (topIds.length === 0) return { series: [], catNames: [] as string[] };
    const catNames = topIds.map(id => catById.get(id)?.name ?? "Unknown");
    const series = trendMonths.map(m => {
      const tx = filterTx(allTx, m, monthEnd(m));
      const sums = sumByCat(tx);
      const row: Record<string, string | number> = { label: monthShortLabel(m) };
      topIds.forEach((id, i) => { row[catNames[i]] = Math.round(sums.get(id) ?? 0); });
      return row;
    });
    return { series, catNames };
  }, [topDrivers, trendMonths, allTx, catById]);

  // ---- Comparison ---------------------------------------------------------
  const diff = totalExpenseSpent - prevHealth.totalExpenseSpent;
  const diffPct = prevHealth.totalExpenseSpent > 0 ? (diff / prevHealth.totalExpenseSpent) * 100 : 0;
  const scoreDiff = score !== null && prevHealth.score !== null ? score - prevHealth.score : null;

  // ---- Budget vs actual chart --------------------------------------------
  const budgetVsActual = expenseGroups.map(g => ({
    name: g.group.name,
    Budget: Math.round(g.budget),
    Spent: Math.round(g.spent),
  }));

  return (
    <div className="space-y-8">
      {/* Score & summary tiles */}
      <div className="surface-elevated grid gap-6 p-6 sm:p-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col items-start justify-center gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Budget score</p>
          <div className="flex items-baseline gap-2">
            <span data-numeric className="text-display text-7xl text-primary">{score ?? "—"}</span>
            {score !== null && <StatusPill tone={scoreTone(score)} dot>{scoreLabel}</StatusPill>}
          </div>
          <p className="text-sm text-muted-foreground">
            {totalBudget > 0 ? `Spending ${formatMoney(totalExpenseSpent, { compact: true })} of ${formatMoney(totalBudget, { compact: true })}` : "Add an expense budget to grow your score."}
          </p>
          {scoreDiff !== null && (
            <StatusPill tone={scoreDiff >= 0 ? "positive" : "negative"} dot>
              {scoreDiff >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {scoreDiff >= 0 ? "+" : ""}{scoreDiff} vs last month
            </StatusPill>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="Total spending" value={formatMoney(totalExpenseSpent, { compact: true })} />
          <MiniStat label="Total budgeted" value={formatMoney(totalBudget, { compact: true })} />
          <MiniStat label="Remaining" value={formatMoney(remainingBudget, { compact: true })} hint={totalBudget > 0 ? `${Math.round((remainingBudget / totalBudget) * 100)}% left` : undefined} />
          <MiniStat label="Savings target" value={formatMoney(totalSavings, { compact: true })} hint={totalSavings > 0 ? `${formatMoney(savingsSpent, { compact: true })} saved` : undefined} />
          <MiniStat label="Over budget" value={String(overBudget.length)} tone={overBudget.length > 0 ? "negative" : "neutral"} />
          <MiniStat label="At risk" value={String(atRisk)} tone={atRisk > 0 ? "warning" : "neutral"} />
          <MiniStat label="Uncategorised" value={String(uncategorisedCount)} hint={uncategorisedSpent > 0 ? formatMoney(uncategorisedSpent, { compact: true }) : undefined} tone={uncategorisedCount > 0 ? "warning" : "neutral"} />
          <MiniStat label="Projected total" value={formatMoney(projectedTotalExpense, { compact: true })} hint={totalBudget > 0 && projectedTotalExpense > totalBudget ? `${formatMoney(projectedTotalExpense - totalBudget)} over` : undefined} />
        </div>
      </div>

      {/* Budget performance */}
      {expenseGroups.length === 0 ? (
        <EmptyState
          icon={<PieChart className="h-5 w-5" />}
          title="No expense budgets for this month"
          description={`No saved budgets were active in ${monthLabel(selectedMonth)}.`}
          action={<Link to="/budgets"><Button size="sm">Add a budget</Button></Link>}
        />
      ) : (
        <section>
          <h2 className="mb-3 text-display text-2xl">Budget performance</h2>
          <div className="surface-card divide-y divide-border">
            {expenseGroups.map(g => {
              const tone = g.status === "over" ? "negative" : g.status === "projected_over" ? "warning" : g.status === "at_risk" ? "warning" : g.status === "unused" ? "neutral" : "positive";
              const label = g.status === "over" ? "Over" : g.status === "projected_over" ? "Trending over" : g.status === "at_risk" ? "Watch" : g.status === "unused" ? "Unused" : "On track";
              const linked = g.group.categoryIds.map(id => catById.get(id)?.name).filter(Boolean).join(", ");
              return (
                <div key={g.group.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{g.group.name}</p>
                      <StatusPill tone={tone as any} dot>{label}</StatusPill>
                    </div>
                    {linked && <p className="mt-0.5 truncate text-xs text-muted-foreground">{linked}</p>}
                    <ProgressBar
                      value={g.pct}
                      tone={g.status === "over" ? "negative" : g.status === "projected_over" || g.status === "at_risk" ? "warning" : "primary"}
                      className="mt-2 max-w-md"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMoney(g.spent, { compact: true })} of {formatMoney(g.budget, { compact: true })} · {Math.round(g.pct)}% · {formatMoney(g.remaining, { compact: true })} left
                    </p>
                  </div>
                  <div className="text-right">
                    <p data-numeric className="text-display text-xl">{formatMoney(g.spent, { compact: true })}</p>
                    <p className="text-xs text-muted-foreground">of {formatMoney(g.budget, { compact: true })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Budget vs actual chart */}
      {budgetVsActual.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Budget vs actual</h2>
          <div className="surface-card p-4">
            <ResponsiveContainer width="100%" height={Math.max(240, budgetVsActual.length * 44)}>
              <BarChart data={budgetVsActual} layout="vertical" margin={{ left: 12, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tickFormatter={(v) => formatMoney(v, { compact: true })} stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis type="category" dataKey="name" width={140} stroke="var(--muted-foreground)" fontSize={12} />
                <ReTooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Legend />
                <Bar dataKey="Budget" fill="var(--muted-foreground)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="Spent" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Month-to-month comparison */}
      <section>
        <h2 className="mb-3 text-display text-2xl">Month-to-month comparison</h2>
        {hasPrev ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat
              label="Spending change"
              value={`${diff <= 0 ? "−" : "+"}${formatMoney(Math.abs(diff), { compact: true })}`}
              tone={diff <= 0 ? "positive" : "negative"}
              hint={prevHealth.totalExpenseSpent > 0 ? `${diffPct.toFixed(0)}% vs ${monthShortLabel(prevMonth)}` : "no prior spend"}
            />
            <MiniStat
              label="Score change"
              value={scoreDiff === null ? "—" : `${scoreDiff >= 0 ? "+" : ""}${scoreDiff}`}
              tone={scoreDiff === null ? "neutral" : scoreDiff >= 0 ? "positive" : "negative"}
              hint={`Now ${score ?? "—"} · was ${prevHealth.score ?? "—"}`}
            />
            <MiniStat
              label="Biggest increase"
              value={movers.biggestIncrease && movers.biggestIncrease.change > 0 ? movers.biggestIncrease.name : "—"}
              hint={movers.biggestIncrease && movers.biggestIncrease.change > 0 ? `+${formatMoney(movers.biggestIncrease.change, { compact: true })}` : undefined}
              tone="warning"
            />
            <MiniStat
              label="Biggest decrease"
              value={movers.biggestDecrease && movers.biggestDecrease.change < 0 ? movers.biggestDecrease.name : "—"}
              hint={movers.biggestDecrease && movers.biggestDecrease.change < 0 ? `−${formatMoney(Math.abs(movers.biggestDecrease.change), { compact: true })}` : undefined}
              tone="positive"
            />
          </div>
        ) : (
          <div className="surface-card p-6 text-sm text-muted-foreground">
            Month-to-month insights will appear after you import another month of transactions.
          </div>
        )}
      </section>

      {/* Top drivers */}
      {topDrivers.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Top spending drivers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {topDrivers.map((d) => {
              const down = d.change < 0;
              const isNew = d.prev === 0 && d.cur > 0;
              return (
                <div key={d.id} className="surface-card flex items-start gap-3 p-4">
                  <span className={down ? "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-positive-soft text-positive" : "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-warning-soft text-warning"}>
                    {down ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatMoney(d.cur, { compact: true })} this month
                      {isNew ? " · new activity" : ` · ${down ? "−" : "+"}${formatMoney(Math.abs(d.change), { compact: true })} vs last month`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trend charts */}
      <section>
        <h2 className="mb-3 text-display text-2xl">Trends</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <TrendCard title="Total monthly spending">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendSeries} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis tickFormatter={(v) => formatMoney(v, { compact: true })} stroke="var(--muted-foreground)" fontSize={12} />
                <ReTooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="spending" stroke="var(--primary)" strokeWidth={2} dot />
                <Line type="monotone" dataKey="budget" stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </TrendCard>

          <TrendCard title="Budget score over time">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trendSeries} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={12} />
                <ReTooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </TrendCard>

          {topCatTrend.catNames.length > 0 && (
            <TrendCard title="Top category spending" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={topCatTrend.series} margin={{ left: 0, right: 12, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis tickFormatter={(v) => formatMoney(v, { compact: true })} stroke="var(--muted-foreground)" fontSize={12} />
                  <ReTooltip formatter={(v: number) => formatMoney(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                  <Legend />
                  {topCatTrend.catNames.map((n, i) => (
                    <Line key={n} type="monotone" dataKey={n}
                      stroke={["var(--primary)", "var(--warning)", "var(--positive)"][i] ?? "var(--muted-foreground)"}
                      strokeWidth={2} dot />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </TrendCard>
          )}
        </div>
      </section>
    </div>
  );
}

function TrendCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`surface-card p-4 ${className ?? ""}`}>
      <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function MiniStat({ label, value, trailing, hint, tone }: {
  label: string; value: string; trailing?: React.ReactNode; hint?: string;
  tone?: "positive" | "warning" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive" ? "text-positive" :
    tone === "warning" ? "text-warning" :
    tone === "negative" ? "text-negative" : "";
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p data-numeric className={`text-display text-2xl ${toneClass}`}>{value}</p>
        {trailing}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---- Carry-forward dialog ------------------------------------------------

function CarryForwardDialog({
  open, onOpenChange, sourceMonth, sourceGroups, currentMonth, userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sourceMonth: MonthKey;
  sourceGroups: BudgetGroup[];
  currentMonth: MonthKey;
  userId: string;
}) {
  const qc = useQueryClient();
  const snapshotMonths = useSnapshotMonths(userId);
  const [selected, setSelected] = useState<Set<MonthKey>>(new Set());
  const [busy, setBusy] = useState(false);
  // Reset selection when opened or source changes
  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open, sourceMonth]);


  // Candidate targets: every month from sourceMonth+1 up to currentMonth.
  const targets: MonthKey[] = useMemo(() => {
    if (sourceMonth >= currentMonth) return [];
    const out: MonthKey[] = [];
    let cur = shiftMonth(sourceMonth, 1);
    while (cur <= currentMonth) {
      out.push(cur);
      cur = shiftMonth(cur, 1);
    }
    return out;
  }, [sourceMonth, currentMonth]);

  const snapshotSet = useMemo(
    () => new Set(snapshotMonths.data ?? []),
    [snapshotMonths.data],
  );
  const willOverwriteCount = Array.from(selected).filter(m => snapshotSet.has(m) || m === currentMonth).length;
  const includesCurrent = selected.has(currentMonth);

  const toggle = (m: MonthKey, on?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      const shouldAdd = on ?? !next.has(m);
      if (shouldAdd) next.add(m); else next.delete(m);
      return next;
    });
  };

  async function handleApply() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const monthsList = Array.from(selected);
      const pastMonths = monthsList.filter(m => m !== currentMonth);
      await applySnapshotToMonths(userId, sourceGroups, pastMonths);
      if (includesCurrent) {
        await replaceLiveBudgets(userId, sourceGroups);
      }
      qc.invalidateQueries({ queryKey: ["budget_snapshots"] });
      qc.invalidateQueries({ queryKey: ["budget_snapshot_months"] });
      if (includesCurrent) window.dispatchEvent(new CustomEvent("ledger:budget-groups-changed"));
      toast.success(`Copied ${sourceGroups.length} budget${sourceGroups.length === 1 ? "" : "s"} to ${monthsList.length} month${monthsList.length === 1 ? "" : "s"}`);
      onOpenChange(false);
    } catch (err) {
      console.error("[carry-forward] failed", err);
      toast.error("Couldn't carry these budgets forward. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Carry {monthLabel(sourceMonth)} budgets forward</DialogTitle>
          <DialogDescription>
            Copy this month's {sourceGroups.length} saved budget{sourceGroups.length === 1 ? "" : "s"} into the months you pick below. Existing snapshots and your live budgets are only replaced for the months you tick.
          </DialogDescription>
        </DialogHeader>

        {targets.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            No later months to carry into — this is already the current month.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set(targets))}>Select all</Button>
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set(targets.filter(m => m !== currentMonth)))}>All past months</Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border border-border">
              {targets.map(m => {
                const hasSnap = snapshotSet.has(m);
                const isCurrent = m === currentMonth;
                const checked = selected.has(m);
                return (
                  <label key={m} className="flex cursor-pointer items-center gap-3 border-b border-border/60 p-3 last:border-b-0 hover:bg-muted/40">
                    <Checkbox checked={checked} onCheckedChange={(v) => toggle(m, v === true)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{monthLabel(m)}</p>
                      <p className="text-xs text-muted-foreground">
                        {isCurrent
                          ? "Current month — this also replaces your live budgets on the Budgets page."
                          : hasSnap
                            ? "Already has a saved snapshot — it will be overwritten."
                            : "No snapshot yet — will be created."}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            {willOverwriteCount > 0 && (
              <p className="text-xs text-warning">
                {willOverwriteCount} of the selected month{willOverwriteCount === 1 ? "" : "s"} will overwrite existing data.
              </p>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleApply} disabled={busy || selected.size === 0}>
            {busy ? "Copying…" : `Copy to ${selected.size} month${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

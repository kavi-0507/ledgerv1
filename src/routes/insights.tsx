import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PieChart, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { SkeletonChart, SkeletonStatCard } from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useCategories, useActiveMonth } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { useBudgetGroups } from "@/lib/budgetGroups";
import { computeHealth, scoreTone, type Tx as HealthTx } from "@/lib/budgetHealth";

export const Route = createFileRoute("/insights")({ component: InsightsPage });

function shiftMonth(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function useMonthPair(from: string | undefined, to: string | undefined) {
  const prevFrom = from ? shiftMonth(from, -1) : undefined;
  const prevTo = to ? shiftMonth(to, -1) : undefined;
  return useQuery({
    queryKey: ["insights_tx", from, to],
    enabled: !!from && !!to,
    queryFn: async () => {
      const [cur, prev] = await Promise.all([
        supabase.from("transactions").select("amount,category_id,direction,is_transfer,occurred_on,needs_review").gte("occurred_on", from!).lte("occurred_on", to!),
        supabase.from("transactions").select("amount,category_id,direction,is_transfer,occurred_on,needs_review").gte("occurred_on", prevFrom!).lte("occurred_on", prevTo!),
      ]);
      if (cur.error) throw cur.error;
      if (prev.error) throw prev.error;
      return { current: (cur.data ?? []) as HealthTx[], previous: (prev.data ?? []) as HealthTx[], prevFrom: prevFrom!, prevTo: prevTo! };
    },
  });
}

function InsightsPage() {
  const active = useActiveMonth();
  const tx = useMonthPair(active.data?.from, active.data?.to);
  const cats = useCategories();
  const { groups } = useBudgetGroups();

  const loading = active.isLoading || tx.isLoading || cats.isLoading;

  return (
    <AppShell header={<h1 className="truncate text-display text-xl sm:text-2xl">Insights</h1>}>
      <PageHeader
        eyebrow="Insights"
        title="Why am I okay — or not?"
        description={active.data?.label ? `Comparing ${active.data.label}${active.data.isFallback ? " (latest month with data)" : ""} against the previous month.` : "Insights from your own budgets and spending."}
      />

      <QueryBoundary
        isLoading={loading} isError={tx.isError} error={tx.error}
        onRetry={() => { tx.refetch(); }}
        loading={<div className="space-y-6"><SkeletonChart /><div className="grid gap-4 md:grid-cols-3"><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /></div></div>}
      >
        {groups.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="Create your first budget to unlock insights"
            description="Insights are based on the budgets you save — no fake data, no templates."
            action={<Link to="/budgets"><Button>Go to budgets</Button></Link>}
          />
        ) : (
          <Body
            current={tx.data?.current ?? []}
            previous={tx.data?.previous ?? []}
            prevFrom={tx.data?.prevFrom ?? ""}
            prevTo={tx.data?.prevTo ?? ""}
            monthFrom={active.data?.from ?? ""}
            monthTo={active.data?.to ?? ""}
            categories={cats.data ?? []}
            groups={groups}
          />
        )}
      </QueryBoundary>
    </AppShell>
  );
}

function Body({ current, previous, prevFrom, prevTo, monthFrom, monthTo, categories, groups }: {
  current: HealthTx[]; previous: HealthTx[]; prevFrom: string; prevTo: string;
  monthFrom: string; monthTo: string;
  categories: { id: string; name: string }[];
  groups: ReturnType<typeof useBudgetGroups>["groups"];
}) {
  const health = useMemo(
    () => computeHealth({ groups, categories, transactions: current, monthFrom, monthTo }),
    [groups, categories, current, monthFrom, monthTo],
  );
  const prevHealth = useMemo(
    () => computeHealth({ groups, categories, transactions: previous, monthFrom: prevFrom, monthTo: prevTo }),
    [groups, categories, previous, prevFrom, prevTo],
  );

  const {
    score, scoreLabel, totalBudget, totalExpenseSpent, projectedTotalExpense,
    expenseGroups, overBudget, projectedOver, uncategorisedSpent,
  } = health;

  const diff = totalExpenseSpent - prevHealth.totalExpenseSpent;
  const diffPct = prevHealth.totalExpenseSpent > 0 ? (diff / prevHealth.totalExpenseSpent) * 100 : 0;

  // Top drivers: category spend within tracked budgets vs previous month
  const drivers = useMemo(() => {
    const catById = new Map(categories.map(c => [c.id, c]));
    const sumBy = (rows: HealthTx[]) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        if (r.is_transfer || r.direction !== "out" || !r.category_id) continue;
        const name = catById.get(r.category_id)?.name ?? "";
        if (/income|transfer|saving/i.test(name)) continue;
        m.set(r.category_id, (m.get(r.category_id) ?? 0) + Number(r.amount || 0));
      }
      return m;
    };
    const cur = sumBy(current); const prev = sumBy(previous);
    const trackedIds = new Set(expenseGroups.flatMap(g => g.group.categoryIds));
    return Array.from(cur.entries())
      .filter(([id]) => trackedIds.has(id))
      .map(([id, curAmt]) => {
        const prevAmt = prev.get(id) ?? 0;
        return { name: catById.get(id)?.name ?? "Unknown", cur: curAmt, prev: prevAmt, change: curAmt - prevAmt };
      })
      .sort((a, b) => b.cur - a.cur)
      .slice(0, 5);
  }, [current, previous, categories, expenseGroups]);

  // Recommendations derived from user's own budgets
  const recs = useMemo(() => {
    const out: { tone: "negative" | "warning" | "positive" | "neutral"; title: string; body: string }[] = [];
    for (const g of overBudget) {
      out.push({ tone: "negative", title: `Trim ${g.group.name}`, body: `You're ${formatMoney(g.spent - g.budget)} over. Try capping the next week at ${formatMoney(Math.max(0, g.budget - g.spent) / 4)}.` });
    }
    for (const g of projectedOver) {
      out.push({ tone: "warning", title: `Pace ${g.group.name}`, body: `On track for ${formatMoney(g.projected)}. Slowing to ${formatMoney(g.budget / 30)} a day keeps you inside your budget.` });
    }
    if (uncategorisedSpent > 0) {
      out.push({ tone: "warning", title: "Categorise your spend", body: `${formatMoney(uncategorisedSpent)} isn't linked to a budget. Categorising sharpens every insight.` });
    }
    const healthy = health.healthy.slice(0, 1)[0];
    if (healthy) out.push({ tone: "positive", title: `${healthy.group.name} is a win`, body: `Only ${Math.round(healthy.pct)}% used with ${formatMoney(healthy.remaining)} to spare.` });
    return out.slice(0, 4);
  }, [overBudget, projectedOver, uncategorisedSpent, health.healthy]);

  return (
    <div className="space-y-8">
      {/* Score */}
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
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat label="This month" value={formatMoney(totalExpenseSpent, { compact: true })} />
          <MiniStat
            label="vs last month"
            value={formatMoney(Math.abs(diff), { compact: true })}
            trailing={<StatusPill tone={diff <= 0 ? "positive" : "negative"} dot>
              {diff <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              {prevHealth.totalExpenseSpent > 0 ? `${diffPct.toFixed(0)}%` : "new"}
            </StatusPill>}
          />
          <MiniStat label="Projected total" value={formatMoney(projectedTotalExpense, { compact: true })} hint={totalBudget > 0 ? (projectedTotalExpense > totalBudget ? `${formatMoney(projectedTotalExpense - totalBudget)} over budget` : `Within your ${formatMoney(totalBudget, { compact: true })} plan`) : undefined} />
        </div>
      </div>

      {/* Budget health */}
      {expenseGroups.length === 0 ? (
        <EmptyState
          icon={<PieChart className="h-5 w-5" />}
          title="No expense budgets yet"
          description="Add an expense budget to see how each one is tracking."
          action={<Link to="/budgets"><Button size="sm">Add a budget</Button></Link>}
        />
      ) : (
        <section>
          <h2 className="mb-3 text-display text-2xl">Budget health</h2>
          <div className="surface-card divide-y divide-border">
            {expenseGroups.map(g => {
              const tone = g.status === "over" ? "negative" : g.status === "projected_over" ? "warning" : g.status === "at_risk" ? "warning" : g.status === "unused" ? "neutral" : "positive";
              const label = g.status === "over" ? "Over" : g.status === "projected_over" ? "Trending over" : g.status === "at_risk" ? "Watch" : g.status === "unused" ? "Unused" : "On track";
              return (
                <div key={g.group.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{g.group.name}</p>
                      <StatusPill tone={tone as any} dot>{label}</StatusPill>
                    </div>
                    <ProgressBar
                      value={g.pct}
                      tone={g.status === "over" ? "negative" : g.status === "projected_over" || g.status === "at_risk" ? "warning" : "primary"}
                      className="mt-2 max-w-md"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Projected {formatMoney(g.projected, { compact: true })} of {formatMoney(g.budget, { compact: true })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p data-numeric className="text-display text-xl">{formatMoney(g.spent, { compact: true })}</p>
                    <p className="text-xs text-muted-foreground">{formatMoney(g.remaining, { compact: true })} left</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Top drivers */}
      {drivers.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Top spending drivers</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {drivers.map((d, i) => {
              const down = d.change < 0;
              const isNew = d.prev === 0 && d.cur > 0;
              return (
                <div key={i} className="surface-card flex items-start gap-3 p-4">
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

      {/* Recommendations */}
      {recs.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Recommendations</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {recs.map((r, i) => (
              <div key={i} className="surface-card p-5">
                <div className="mb-1"><StatusPill tone={r.tone}>{r.tone === "negative" ? "Fix" : r.tone === "warning" ? "Watch" : r.tone === "positive" ? "Win" : "Info"}</StatusPill></div>
                <p className="font-medium">{r.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MiniStat({ label, value, trailing, hint }: { label: string; value: string; trailing?: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <p data-numeric className="text-display text-3xl">{value}</p>
        {trailing}
      </div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

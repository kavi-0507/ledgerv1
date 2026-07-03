import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { SkeletonChart, SkeletonStatCard } from "@/components/ds/Skeletons";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useBudgets, useCategories, useRecommendations, useActiveMonth } from "@/lib/db";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/insights")({ component: InsightsPage });

function shiftMonth(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function useInsightsData(from: string | undefined, to: string | undefined) {
  const prevFrom = from ? shiftMonth(from, -1) : undefined;
  const prevTo = to ? shiftMonth(to, -1) : undefined;

  return useQuery({
    queryKey: ["insights", from, to],
    enabled: !!from && !!to,
    queryFn: async () => {
      const [cur, prev] = await Promise.all([
        supabase.from("transactions").select("amount,category_id,direction,occurred_on").gte("occurred_on", from!).lte("occurred_on", to!),
        supabase.from("transactions").select("amount,category_id,direction,occurred_on").gte("occurred_on", prevFrom!).lte("occurred_on", prevTo!),
      ]);
      if (cur.error) throw cur.error;
      if (prev.error) throw prev.error;
      return { current: cur.data ?? [], previous: prev.data ?? [] };
    },
  });
}

function InsightsPage() {
  const active = useActiveMonth();
  const data = useInsightsData(active.data?.from, active.data?.to);
  const budgets = useBudgets();
  const cats = useCategories();
  const recs = useRecommendations();

  return (
    <AppShell header={<h1 className="truncate text-display text-xl sm:text-2xl">Insights</h1>}>
      <PageHeader eyebrow="Insights" title="Understand your habits." description={active.data?.label ? `Comparing ${active.data.label}${active.data.isFallback ? " (latest month with data)" : ""} against the previous month.` : "Scores and comparisons from your own spending."} />

      <QueryBoundary
        isLoading={active.isLoading || data.isLoading || budgets.isLoading} isError={data.isError} error={data.error}
        onRetry={() => { data.refetch(); budgets.refetch(); }}
        loading={<div className="space-y-6"><SkeletonChart /><div className="grid gap-4 md:grid-cols-3"><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /></div></div>}
      >
        <Body current={data.data?.current ?? []} previous={data.data?.previous ?? []} budgets={budgets.data ?? []} categories={cats.data ?? []} recs={recs.data ?? []} />
      </QueryBoundary>
    </AppShell>
  );
}

function sumOut(rows: any[]) {
  return rows.filter(r => r.direction === "out").reduce((s, r) => s + Number(r.amount || 0), 0);
}

function Body({ current, previous, budgets, categories, recs }: { current: any[]; previous: any[]; budgets: any[]; categories: any[]; recs: any[] }) {
  const spentCur = useMemo(() => sumOut(current), [current]);
  const spentPrev = useMemo(() => sumOut(previous), [previous]);

  const overall = budgets.find(b => b.scope === "overall");
  const overallAmt = overall ? Number(overall.amount) : null;
  const score = overallAmt && overallAmt > 0
    ? Math.max(0, Math.min(100, Math.round(100 - ((spentCur / overallAmt) * 100 - 80))))
    : null;

  const byCat = new Map<string | null, number>();
  for (const r of current) {
    if (r.direction !== "out") continue;
    byCat.set(r.category_id, (byCat.get(r.category_id) ?? 0) + Number(r.amount || 0));
  }
  const byCatPrev = new Map<string | null, number>();
  for (const r of previous) {
    if (r.direction !== "out") continue;
    byCatPrev.set(r.category_id, (byCatPrev.get(r.category_id) ?? 0) + Number(r.amount || 0));
  }

  const categoryScores = categories.map(c => {
    const budget = budgets.find(b => b.category_id === c.id);
    const spent = byCat.get(c.id) ?? 0;
    if (!budget) return null;
    const amt = Number(budget.amount);
    const pct = amt > 0 ? (spent / amt) * 100 : 0;
    const score = Math.max(0, Math.min(100, Math.round(100 - (pct - 80))));
    return { category: c.name, score, spent, budget: amt };
  }).filter(Boolean) as { category: string; score: number; spent: number; budget: number }[];

  const biggest = Array.from(byCat.entries())
    .map(([cid, cur]) => {
      const prev = byCatPrev.get(cid) ?? 0;
      const change = cur - prev;
      const cat = categories.find(c => c.id === cid);
      return { category: cat?.name ?? "Uncategorised", change, cur, prev };
    })
    .filter(x => Math.abs(x.change) > 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, 6);

  const nothing = current.length === 0 && previous.length === 0 && budgets.length === 0 && recs.length === 0;
  if (nothing) return <EmptyState icon={<Sparkles className="h-5 w-5" />} title="No insights yet" description="Add transactions and budgets to see patterns and scores." />;

  const diff = spentCur - spentPrev;
  const diffPct = spentPrev > 0 ? (diff / spentPrev) * 100 : 0;

  return (
    <div className="space-y-8">
      <div className="surface-elevated grid gap-6 p-6 sm:p-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="flex flex-col items-start justify-center gap-2">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Budget score</p>
          <div className="flex items-baseline gap-2">
            <span data-numeric className="text-display text-7xl text-primary">{score ?? "—"}</span>
            {score !== null && <StatusPill tone={score >= 70 ? "positive" : score >= 40 ? "warning" : "negative"} dot>{score >= 70 ? "On track" : score >= 40 ? "Watch" : "Over"}</StatusPill>}
          </div>
          <p className="text-sm text-muted-foreground">
            {overallAmt ? `Spending ${formatMoney(spentCur, { compact: true })} of ${formatMoney(overallAmt, { compact: true })}` : "Set an overall budget to see your score."}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">This month</p>
            <p data-numeric className="text-display text-3xl mt-1">{formatMoney(spentCur, { compact: true })}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">vs last month</p>
            <div className="mt-1 flex items-center gap-2">
              <p data-numeric className="text-display text-3xl">{formatMoney(Math.abs(diff), { compact: true })}</p>
              <StatusPill tone={diff <= 0 ? "positive" : "negative"} dot>
                {diff <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {diffPct.toFixed(0)}%
              </StatusPill>
            </div>
          </div>
        </div>
      </div>

      {categoryScores.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Category scores</h2>
          <div className="surface-card divide-y divide-border">
            {categoryScores.map((c, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.category}</p>
                  <ProgressBar value={c.score} tone={c.score >= 75 ? "positive" : c.score >= 50 ? "primary" : "warning"} className="mt-2 max-w-md" />
                </div>
                <div className="text-right">
                  <p data-numeric className="text-display text-xl">{c.score}</p>
                  <p className="text-xs text-muted-foreground">{formatMoney(c.spent, { compact: true })} / {formatMoney(c.budget, { compact: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {biggest.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Biggest changes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {biggest.map((b, i) => {
              const down = b.change < 0;
              return (
                <div key={i} className="surface-card flex items-start gap-3 p-4">
                  <span className={down ? "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-positive-soft text-positive" : "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-warning-soft text-warning"}>
                    {down ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.category}</p>
                    <p className="text-sm text-muted-foreground">{down ? "−" : "+"}{formatMoney(Math.abs(b.change), { compact: true })} · now {formatMoney(b.cur, { compact: true })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {recs.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Recommendations</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {recs.map(r => (
              <div key={r.id} className="surface-card p-5">
                <div className="mb-1"><StatusPill tone={r.tone ?? "neutral"}>{r.tone ?? "info"}</StatusPill></div>
                <p className="font-medium">{r.title}</p>
                {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  AlertTriangle, ClipboardCheck, PiggyBank, Receipt, Sparkles,
  TrendingDown, TrendingUp, Wallet,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatCard } from "@/components/ds/StatCard";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonChart, SkeletonRow, SkeletonStatCard } from "@/components/ds/Skeletons";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";
import { useCategories, useActiveMonth } from "@/lib/db";
import { formatDateShort, formatMoney } from "@/lib/format";
import { categoryIcon } from "@/lib/categories";
import { useBudgetGroups } from "@/lib/budgetGroups";
import { computeHealth, scoreTone, type Tx as HealthTx } from "@/lib/budgetHealth";

export const Route = createFileRoute("/")({ component: HomePage });

type Tx = HealthTx & {
  id: string;
  description: string;
  merchant: string | null;
  behaviour: string | null;
  categories?: { id: string; name: string; color: string | null } | null;
};

function useMonthTransactions(from: string | undefined, to: string | undefined) {
  return useQuery({
    queryKey: ["home_month_tx", from, to],
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,occurred_on,description,merchant,behaviour,amount,direction,is_transfer,category_id,needs_review,categories(id,name,color)")
        .gte("occurred_on", from!).lte("occurred_on", to!)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Tx[];
    },
  });
}

function HomePage() {
  const active = useActiveMonth();
  const tx = useMonthTransactions(active.data?.from, active.data?.to);
  const cats = useCategories();
  const { groups } = useBudgetGroups();

  const loading = active.isLoading || tx.isLoading || cats.isLoading;
  const error = active.error ?? tx.error ?? cats.error;

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Overview</p>
            <h1 className="truncate text-display text-xl sm:text-2xl">Your money at a glance</h1>
          </div>
          <Link to="/transactions">
            <Button size="sm" variant="outline"><Receipt className="mr-1.5 h-4 w-4" />Activity</Button>
          </Link>
        </div>
      }
    >
      <PageHeader
        eyebrow="Home"
        title="Am I okay this month?"
        description={active.data?.label ? `Showing ${active.data.label}${active.data.isFallback ? " (latest month with activity)" : ""}.` : "A calm summary of your spending, budgets and progress."}
      />
      <QueryBoundary
        isLoading={loading} isError={!!error} error={error}
        onRetry={() => { tx.refetch(); }}
        loading={<HomeSkeleton />}
      >
        <HomeContent
          transactions={tx.data ?? []}
          categories={cats.data ?? []}
          groups={groups}
          monthFrom={active.data?.from ?? ""}
          monthTo={active.data?.to ?? ""}
        />
      </QueryBoundary>
    </AppShell>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard />
      </div>
      <SkeletonChart />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
        <div className="surface-card p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>
      </div>
    </div>
  );
}

function HomeContent({ transactions, categories, groups, monthFrom, monthTo }: {
  transactions: Tx[];
  categories: { id: string; name: string }[];
  groups: ReturnType<typeof useBudgetGroups>["groups"];
  monthFrom: string; monthTo: string;
}) {
  const health = useMemo(
    () => computeHealth({ groups, categories, transactions, monthFrom, monthTo }),
    [groups, categories, transactions, monthFrom, monthTo],
  );

  const {
    score, scoreLabel, totalBudget, totalExpenseSpent, uncategorisedSpent, uncategorisedCount,
    needsReviewCount, overBudget, projectedOver, healthy, savingsGroups, expenseGroups,
  } = health;

  const remaining = totalBudget > 0 ? totalBudget - totalExpenseSpent : null;
  const attentionCount =
    overBudget.length + projectedOver.length + uncategorisedCount + needsReviewCount;

  // Trend: expense outflow per day
  const trendMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.is_transfer || t.direction !== "out") continue;
    const cat = t.categories?.name;
    if (cat && /income|transfer|saving/i.test(cat)) continue;
    trendMap.set(t.occurred_on, (trendMap.get(t.occurred_on) ?? 0) + Number(t.amount || 0));
  }
  const trends = Array.from(trendMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, label: formatDateShort(date), value: amount }));

  // Peak window: top consecutive 3 days
  const peakInsight = (() => {
    if (trends.length < 3) return null;
    let best = { start: 0, sum: 0 };
    for (let i = 0; i <= trends.length - 3; i++) {
      const sum = trends[i].value + trends[i + 1].value + trends[i + 2].value;
      if (sum > best.sum) best = { start: i, sum };
    }
    const total = trends.reduce((s, x) => s + x.value, 0);
    if (total === 0 || best.sum / total < 0.35) return null;
    return `Most of your spending happened between ${trends[best.start].label} and ${trends[best.start + 2].label}.`;
  })();

  // Budget snapshot picks
  const snapshot = (() => {
    const worst = [...expenseGroups].sort((a, b) => b.pct - a.pct).find(g => g.pct > 100);
    const risk = projectedOver.find(g => !worst || g.group.id !== worst.group.id);
    const best = [...expenseGroups].filter(g => g.spent > 0).sort((a, b) => a.pct - b.pct)[0];
    const picks: typeof expenseGroups = [];
    [worst, risk, best].forEach(g => { if (g && !picks.find(p => p.group.id === g.group.id)) picks.push(g); });
    return picks.slice(0, 3);
  })();

  const recent = transactions.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Top stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {score !== null ? (
          <StatCard
            label="Budget score" value={String(score)} icon={<Sparkles className="h-4 w-4" />}
            hint={scoreLabel}
            delta={{ value: scoreLabel, tone: scoreTone(score) === "negative" ? "negative" : scoreTone(score) === "positive" ? "positive" : "neutral" }}
          />
        ) : (
          <CtaCard label="Budget score" title="Set your first budget" description="Create a budget to unlock your score." to="/budgets" cta="Create budget" icon={<Sparkles className="h-4 w-4" />} />
        )}

        <StatCard
          label="Spent this month" value={formatMoney(totalExpenseSpent, { compact: true })}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={totalBudget > 0 ? `of ${formatMoney(totalBudget, { compact: true })} planned` : "Excludes income, transfers and savings"}
        />

        {remaining !== null ? (
          <StatCard
            label="Remaining budget" value={formatMoney(remaining, { compact: true })}
            icon={<Wallet className="h-4 w-4" />}
            hint={remaining < 0 ? "You're over your planned spend" : `${Math.round((totalExpenseSpent / totalBudget) * 100)}% used`}
            delta={remaining < 0 ? { value: "Over", tone: "negative" } : undefined}
          />
        ) : (
          <CtaCard label="Remaining budget" title="Create a budget" description="Track how much you have left each month." to="/budgets" cta="Create a budget" icon={<Wallet className="h-4 w-4" />} />
        )}

        <StatCard
          label="Needs attention" value={String(attentionCount)}
          icon={<ClipboardCheck className="h-4 w-4" />}
          hint={attentionCount === 0 ? "You're all caught up" : "Alerts across your budgets and activity"}
          delta={attentionCount > 0 ? { value: `${attentionCount}`, tone: "negative" } : undefined}
        />
      </div>

      {/* Alerts */}
      {attentionCount > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Needs your attention</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {overBudget.map(g => (
              <AlertCard
                key={"o" + g.group.id} tone="negative"
                title={`${g.group.name} is over`}
                body={`${formatMoney(g.spent)} spent of ${formatMoney(g.budget)}. You're ${formatMoney(g.spent - g.budget)} over.`}
                to="/budgets" cta="View budget"
              />
            ))}
            {projectedOver.map(g => (
              <AlertCard
                key={"p" + g.group.id} tone="warning"
                title={`${g.group.name} is trending over`}
                body={`On pace to spend ${formatMoney(g.projected)} — ${formatMoney(g.projected - g.budget)} more than planned.`}
                to="/insights" cta="See insights"
              />
            ))}
            {uncategorisedCount > 0 && (
              <AlertCard
                tone="warning"
                title={`${uncategorisedCount} uncategorised transaction${uncategorisedCount === 1 ? "" : "s"}`}
                body={`${formatMoney(uncategorisedSpent)} isn't assigned to a budget yet.`}
                to="/review" cta="Categorise"
              />
            )}
            {needsReviewCount > 0 && (
              <AlertCard
                tone="warning"
                title={`${needsReviewCount} transaction${needsReviewCount === 1 ? "" : "s"} to review`}
                body="A few entries need a quick check to keep your budgets accurate."
                to="/review" cta="Review"
              />
            )}
          </div>
        </section>
      )}

      {/* Going well */}
      {(healthy.length > 0 || savingsGroups.some(s => s.pct > 0)) && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Going well</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {healthy.slice(0, 4).map(g => (
              <GoodCard
                key={g.group.id}
                title={`${g.group.name} is under control`}
                body={`${formatMoney(g.spent)} of ${formatMoney(g.budget)}. ${formatMoney(g.remaining)} remaining.`}
              />
            ))}
            {savingsGroups.filter(s => s.pct > 0).slice(0, 2).map(s => (
              <GoodCard
                key={s.group.id}
                icon={<PiggyBank className="h-4 w-4" />}
                title={`${s.group.name}: ${Math.round(s.pct)}% saved`}
                body={`${formatMoney(s.spent)} set aside of ${formatMoney(s.budget)} target.`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Budget snapshot */}
      {expenseGroups.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-display text-2xl">Budget snapshot</h2>
            <Link to="/budgets" className="text-xs text-muted-foreground hover:text-foreground">View all budgets →</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {totalBudget > 0 && (
              <MiniBudget name="Total monthly budget" spent={totalExpenseSpent} budget={totalBudget} />
            )}
            {snapshot.map(g => (
              <MiniBudget key={g.group.id} name={g.group.name} spent={g.spent} budget={g.budget} />
            ))}
            {savingsGroups[0] && (
              <MiniBudget name={savingsGroups[0].group.name} spent={savingsGroups[0].spent} budget={savingsGroups[0].budget} tone="positive" />
            )}
          </div>
        </section>
      )}

      {/* Trend */}
      <div className="surface-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-display text-2xl">Spending trend</h2>
          <StatusPill tone="neutral">Expenses only</StatusPill>
        </div>
        {trends.length === 0 ? (
          <EmptyState title="Not enough data yet" description="Once you add a few transactions, your daily spending will chart here." />
        ) : (
          <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatMoney(v, { compact: true })} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
                    labelStyle={{ color: "var(--muted-foreground)" }}
                    formatter={(v: number) => formatMoney(v)}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" fill="url(#sp)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--foreground)", stroke: "var(--primary)", strokeWidth: 1.5 }} activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--background)", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {peakInsight && <p className="mt-3 text-sm text-muted-foreground">{peakInsight}</p>}
          </>
        )}
      </div>

      {/* Recent activity preview */}
      <div className="surface-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-display text-2xl">Recent activity</h2>
          <Link to="/transactions" className="text-xs text-muted-foreground hover:text-foreground">View activity →</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No transactions yet" description="Add one manually or import a CSV." action={<Link to="/import"><Button size="sm">Import CSV</Button></Link>} />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map(t => {
              const catName = t.categories?.name ?? null;
              const title = t.merchant || t.description;
              return (
                <li key={t.id} className="flex items-center gap-3 py-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-base" aria-hidden>
                    {catName ? categoryIcon(catName) : "❓"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(t.occurred_on)}{catName ? ` · ${catName}` : ""}</p>
                  </div>
                  <span data-numeric className={`text-sm font-medium ${t.direction === "in" ? "text-positive" : ""}`}>
                    {t.direction === "in" ? "+" : "−"}{formatMoney(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function CtaCard({ label, title, description, to, cta, icon }: {
  label: string; title: string; description: string; to: string; cta: string; icon?: React.ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        {icon && <span className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">{icon}</span>}
      </div>
      <p className="text-display text-2xl">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      <Link to={to}><Button size="sm" className="w-full sm:w-auto">{cta}</Button></Link>
    </div>
  );
}

function AlertCard({ tone, title, body, to, cta }: {
  tone: "negative" | "warning"; title: string; body: string; to: string; cta: string;
}) {
  const bg = tone === "negative" ? "bg-negative-soft text-negative" : "bg-warning-soft text-warning";
  return (
    <div className="surface-card flex items-start gap-3 p-4">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${bg}`}>
        <AlertTriangle className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
        <Link to={to} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">{cta} →</Link>
      </div>
    </div>
  );
}

function GoodCard({ title, body, icon }: { title: string; body: string; icon?: React.ReactNode }) {
  return (
    <div className="surface-card flex items-start gap-3 p-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-positive-soft text-positive">
        {icon ?? <TrendingDown className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function MiniBudget({ name, spent, budget, tone }: { name: string; spent: number; budget: number; tone?: "positive" }) {
  const pct = budget > 0 ? (spent / budget) * 100 : 0;
  const barTone = tone === "positive" ? "positive" : pct > 100 ? "negative" : pct > 80 ? "warning" : "primary";
  return (
    <div className="surface-card space-y-2 p-4">
      <p className="truncate text-sm font-medium">{name}</p>
      <div className="flex items-baseline gap-2">
        <span data-numeric className="text-display text-2xl">{formatMoney(spent, { compact: true })}</span>
        <span className="text-xs text-muted-foreground">of {formatMoney(budget, { compact: true })}</span>
      </div>
      <ProgressBar value={pct} tone={barTone} />
    </div>
  );
}

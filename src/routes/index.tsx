import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bell, ClipboardCheck, Receipt, Sparkles, TrendingUp, Wallet } from "lucide-react";
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
import { useBudgets, useReminders, useRecommendations, startOfMonth, endOfMonth } from "@/lib/db";
import { formatDateShort, formatMoney, humanize } from "@/lib/format";

export const Route = createFileRoute("/")({ component: HomePage });

function useMonthTransactions() {
  const from = startOfMonth();
  const to = endOfMonth();
  return useQuery({
    queryKey: ["home_month_tx", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("id,occurred_on,description,amount,direction,category_id,needs_review,categories(id,name,color)")
        .gte("occurred_on", from).lte("occurred_on", to)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function HomePage() {
  const tx = useMonthTransactions();
  const budgets = useBudgets();
  const reminders = useReminders();
  const recs = useRecommendations();

  const loading = tx.isLoading || budgets.isLoading;
  const error = tx.error ?? budgets.error;

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
      <PageHeader eyebrow="Home" title="Good to see you." description="A calm summary of your spending, budgets and progress this month." />
      <QueryBoundary
        isLoading={loading}
        isError={!!error}
        error={error}
        onRetry={() => { tx.refetch(); budgets.refetch(); }}
        loading={<HomeSkeleton />}
      >
        <HomeContent
          transactions={tx.data ?? []}
          budgets={budgets.data ?? []}
          reminders={reminders.data ?? []}
          recs={recs.data ?? []}
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

type Tx = { id: string; occurred_on: string; description: string; amount: number; direction: string; category_id: string | null; needs_review: boolean; categories?: { id: string; name: string; color: string | null } | null };

function HomeContent({ transactions, budgets, reminders, recs }: {
  transactions: Tx[];
  budgets: any[];
  reminders: any[];
  recs: any[];
}) {
  const spent = useMemo(() => transactions.filter(t => t.direction === "out").reduce((s, t) => s + Number(t.amount || 0), 0), [transactions]);
  const income = useMemo(() => transactions.filter(t => t.direction === "in").reduce((s, t) => s + Number(t.amount || 0), 0), [transactions]);

  const overall = budgets.find(b => b.scope === "overall");
  const overallAmount = overall ? Number(overall.amount) : null;
  const remaining = overallAmount !== null ? overallAmount - spent : null;

  const reviewCount = transactions.filter(t => t.needs_review).length;

  // score: 100 minus percent-over-budget (rough)
  const score = overallAmount && overallAmount > 0
    ? Math.max(0, Math.min(100, Math.round(100 - ((spent / overallAmount) * 100 - 80))))
    : null;

  const categoryMap = new Map<string, { name: string; color: string | null; amount: number }>();
  for (const t of transactions) {
    if (t.direction !== "out") continue;
    const key = t.categories?.id ?? "uncat";
    const entry = categoryMap.get(key) ?? { name: t.categories?.name ?? "Uncategorised", color: t.categories?.color ?? null, amount: 0 };
    entry.amount += Number(t.amount || 0);
    categoryMap.set(key, entry);
  }
  const categories = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount).slice(0, 6);

  // Build daily trend for the month
  const trendMap = new Map<string, number>();
  for (const t of transactions) {
    if (t.direction !== "out") continue;
    trendMap.set(t.occurred_on, (trendMap.get(t.occurred_on) ?? 0) + Number(t.amount || 0));
  }
  const trends = Array.from(trendMap.entries()).sort(([a],[b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ label: formatDateShort(date), value: amount }));

  const recent = transactions.slice(0, 6);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Budget score" value={score !== null ? String(score) : "—"} hint="How you're tracking this month" icon={<Sparkles className="h-4 w-4" />} />
        <StatCard label="Spent this month" value={formatMoney(spent, { compact: true })} icon={<TrendingUp className="h-4 w-4" />} hint={income ? `Income ${formatMoney(income, { compact: true })}` : "No income yet"} />
        <StatCard label="Remaining" value={remaining !== null ? formatMoney(remaining, { compact: true }) : "—"} icon={<Wallet className="h-4 w-4" />} hint={overallAmount !== null ? `Budget ${formatMoney(overallAmount, { compact: true })}` : "Set an overall budget"} />
        <StatCard label="Needs review" value={String(reviewCount)} icon={<ClipboardCheck className="h-4 w-4" />} hint="Transactions to check" />
      </div>

      {reminders.length > 0 && (
        <div className="surface-card p-4 flex items-start gap-3">
          <Bell className="h-4 w-4 mt-0.5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">You have {reminders.length} reminder{reminders.length === 1 ? "" : "s"}</p>
            <Link to="/review" className="text-xs text-muted-foreground hover:text-foreground">Go to review →</Link>
          </div>
        </div>
      )}

      <div className="surface-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-display text-2xl">Spending trend</h2>
          <StatusPill tone="neutral">This month</StatusPill>
        </div>
        {trends.length === 0 ? (
          <EmptyState title="No spending yet" description="As you add transactions, your daily spending will chart here." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends}>
                <defs>
                  <linearGradient id="sp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} formatter={(v: number) => formatMoney(v)} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="url(#sp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface-card p-5">
          <h2 className="text-display text-2xl mb-4">Categories</h2>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spending yet this month.</p>
          ) : (
            <ul className="space-y-3">
              {categories.map((c, i) => {
                const total = categories.reduce((s, x) => s + x.amount, 0);
                const pct = total > 0 ? (c.amount / total) * 100 : 0;
                return (
                  <li key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span data-numeric className="text-muted-foreground">{formatMoney(c.amount)}</span>
                    </div>
                    <ProgressBar value={pct} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="surface-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-display text-2xl">Recent activity</h2>
            <Link to="/transactions" className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="No transactions yet" description="Add one manually or import a CSV." action={<Link to="/import"><Button size="sm">Import CSV</Button></Link>} />
          ) : (
            <ul className="divide-y divide-border">
              {recent.map(t => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <div className="h-9 w-9 grid place-items-center rounded-md bg-muted text-xs font-medium">{t.description.slice(0,1).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDateShort(t.occurred_on)} · {t.categories?.name ?? "Uncategorised"}</p>
                  </div>
                  <span data-numeric className={`text-sm font-medium ${t.direction === "in" ? "text-positive" : ""}`}>
                    {t.direction === "in" ? "+" : "−"}{formatMoney(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {recs.length > 0 && (
        <div className="surface-card p-5">
          <h2 className="text-display text-2xl mb-4">Recommendations</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {recs.slice(0,4).map(r => (
              <li key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-1">
                  <StatusPill tone={r.tone ?? "neutral"}>{humanize(r.tone ?? "info")}</StatusPill>
                </div>
                <p className="text-sm font-medium">{r.title}</p>
                {r.body && <p className="text-xs text-muted-foreground mt-1">{r.body}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

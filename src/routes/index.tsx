import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  ClipboardCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  Receipt,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatCard } from "@/components/ds/StatCard";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonChart, SkeletonRow, SkeletonStatCard } from "@/components/ds/Skeletons";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Dashboard } from "@/lib/types";
import {
  formatDateShort,
  formatMoney,
  formatPercent,
  humanize,
  toNumber,
} from "@/lib/format";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const q = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<Dashboard>("/dashboard?spending_mode=net"),
    retry: 1,
  });

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Overview
            </p>
            <h1 className="truncate text-display text-xl sm:text-2xl">Your money at a glance</h1>
          </div>
          <Link to="/transactions">
            <Button size="sm" variant="outline">
              <Receipt className="mr-1.5 h-4 w-4" />
              Activity
            </Button>
          </Link>
        </div>
      }
    >
      <PageHeader
        eyebrow="Home"
        title="Good to see you."
        description="A calm summary of your spending, budgets and progress this month."
      />

      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => q.refetch()}
        loading={<HomeSkeleton />}
      >
        {q.data ? <HomeContent data={q.data} /> : null}
      </QueryBoundary>
    </AppShell>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <SkeletonChart />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
        <div className="surface-card p-4">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    </div>
  );
}

function scoreValue(score: Dashboard["score"]): { value: number | null; label?: string } {
  if (typeof score === "number") return { value: score };
  if (score && typeof score === "object") {
    return { value: toNumber(score.value), label: score.label };
  }
  return { value: null };
}

function HomeContent({ data }: { data: Dashboard }) {
  const s = scoreValue(data.score);
  const trends = (data.spending_trends ?? []).map((p) => ({
    label: p.label ?? formatDateShort(p.date),
    value: toNumber(p.amount ?? p.spending) ?? 0,
  }));
  const categories = data.category_breakdown ?? [];
  const recs = data.recommendations ?? [];
  const recent = data.recent_transactions ?? [];

  return (
    <div className="space-y-8">
      {/* KPI ROW */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Budget score"
          value={s.value !== null ? `${Math.round(s.value)}` : "—"}
          hint={s.label ?? "How well you're tracking this month"}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          label="Spent this month"
          value={formatMoney(data.spending, { compact: true })}
          icon={<TrendingUp className="h-4 w-4" />}
          hint={data.income ? `Income ${formatMoney(data.income, { compact: true })}` : undefined}
        />
        <StatCard
          label="Remaining"
          value={formatMoney(data.remaining_budget, { compact: true })}
          icon={<Wallet className="h-4 w-4" />}
          hint={
            data.fixed_commitments
              ? `Fixed ${formatMoney(data.fixed_commitments, { compact: true })}`
              : undefined
          }
        />
        <StatCard
          label="To review"
          value={data.review_count ?? 0}
          icon={<ClipboardCheck className="h-4 w-4" />}
          hint={
            data.reminder_count
              ? `${data.reminder_count} reminders active`
              : "You're all caught up"
          }
        />
      </div>

      {/* TREND + CATEGORIES */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-5 sm:p-6 lg:col-span-2">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Spending trend
              </p>
              <h2 className="text-display text-2xl">Where your money went</h2>
            </div>
            {data.cash_flow !== undefined && (
              <StatusPill
                tone={(toNumber(data.cash_flow) ?? 0) >= 0 ? "positive" : "negative"}
                dot
              >
                Net {formatMoney(data.cash_flow, { signed: true, compact: true })}
              </StatusPill>
            )}
          </div>

          {trends.length > 0 ? (
            <div className="h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                    }}
                    formatter={(v: number) => formatMoney(v)}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#trendFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No trend yet"
              description="Log or import a few transactions and your spending trend will appear here."
              icon={<TrendingUp className="h-5 w-5" />}
            />
          )}
        </div>

        <div className="surface-card p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Top categories
          </p>
          <h2 className="text-display text-2xl">Breakdown</h2>
          <div className="mt-4 space-y-4">
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No category data yet.
              </p>
            )}
            {categories.slice(0, 6).map((c, i) => {
              const name = c.category ?? c.name ?? `Category ${i + 1}`;
              const amount = toNumber(c.amount);
              const pct = toNumber(c.percentage);
              return (
                <div key={`${name}-${i}`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">{humanize(name)}</span>
                    <span data-numeric className="text-muted-foreground">
                      {amount !== null ? formatMoney(amount) : "—"}
                    </span>
                  </div>
                  <ProgressBar value={pct ?? 0} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RECOMMENDATIONS + RECENT */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Recommendations
              </p>
              <h2 className="text-display text-2xl">Small wins</h2>
            </div>
            <Link to="/insights">
              <Button size="sm" variant="ghost">
                See all
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recommendations right now. Keep it up.
            </p>
          ) : (
            <ul className="space-y-3">
              {recs.slice(0, 4).map((r, i) => (
                <li
                  key={String(r.id ?? i)}
                  className="rounded-lg border border-border bg-muted/40 p-4"
                >
                  <p className="font-medium">{r.title ?? "Suggestion"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {r.description ?? r.body ?? ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="surface-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Recent activity
              </p>
              <h2 className="text-display text-2xl">Latest transactions</h2>
            </div>
            <Link to="/transactions">
              <Button size="sm" variant="ghost">
                Open
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              title="Nothing yet"
              description="Your latest transactions will show up here."
              icon={<Receipt className="h-5 w-5" />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {recent.slice(0, 6).map((t) => {
                const amt = toNumber(t.amount) ?? 0;
                const isOut = t.direction === "out" || amt < 0;
                return (
                  <li
                    key={t.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(t.occurred_on)}
                        {t.category ? ` · ${humanize(t.category)}` : ""}
                      </p>
                    </div>
                    <span
                      data-numeric
                      className={
                        isOut
                          ? "shrink-0 text-foreground"
                          : "shrink-0 text-positive"
                      }
                    >
                      {formatMoney(Math.abs(amt) * (isOut ? -1 : 1), {
                        signed: true,
                      })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {(data.reminder_count ?? 0) > 0 && (
        <div className="surface-card flex items-start gap-4 border-l-4 border-l-warning p-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-warning-soft text-warning">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="font-medium">
              You have {data.reminder_count} reminder{data.reminder_count === 1 ? "" : "s"}
            </p>
            <p className="text-sm text-muted-foreground">
              Handle them from the Review page.
            </p>
          </div>
          <Link to="/review">
            <Button size="sm">Open review</Button>
          </Link>
        </div>
      )}

      {(data.budget_progress ||
        (data as { spending_mode?: string }).spending_mode) && (
        <p className="text-center text-xs text-muted-foreground">
          Showing net spending ({formatPercent(data.budget_progress ? 1 : 0, 0)} data source: local backend).
        </p>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { SkeletonChart, SkeletonStatCard } from "@/components/ds/Skeletons";
import { api } from "@/lib/api";
import type { Insights } from "@/lib/types";
import { formatMoney, humanize, toNumber } from "@/lib/format";

export const Route = createFileRoute("/insights")({
  component: InsightsPage,
});

function InsightsPage() {
  const q = useQuery({
    queryKey: ["insights"],
    queryFn: () => api.get<Insights>("/insights"),
    retry: 1,
  });

  return (
    <AppShell
      header={
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Insights
          </p>
          <h1 className="truncate text-display text-xl sm:text-2xl">
            Patterns & recommendations
          </h1>
        </div>
      }
    >
      <PageHeader
        eyebrow="Insights"
        title="Understand your habits."
        description="Scores, comparisons and gentle nudges from your own spending."
      />

      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => q.refetch()}
        loading={
          <div className="space-y-6">
            <SkeletonChart />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </div>
          </div>
        }
      >
        {q.data ? <InsightsBody data={q.data} /> : null}
      </QueryBoundary>
    </AppShell>
  );
}

function InsightsBody({ data }: { data: Insights }) {
  const s = data.score_explanation;
  const cats = data.category_scores ?? [];
  const cmps = data.comparison_cards ?? [];
  const recs = data.recommendation_cards ?? [];
  const bigs = data.biggest_changes ?? [];
  const patterns = data.spending_patterns ?? [];

  const nothing =
    !s && cats.length === 0 && cmps.length === 0 && recs.length === 0 && bigs.length === 0;

  if (nothing) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="No insights yet"
        description="Once you have a few weeks of transactions, patterns will appear here."
      />
    );
  }

  return (
    <div className="space-y-8">
      {s && (
        <div className="surface-elevated grid gap-6 p-6 sm:p-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="flex flex-col items-start justify-center gap-2">
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
              Overall score
            </p>
            <div className="flex items-baseline gap-2">
              <span data-numeric className="text-display text-7xl text-primary">
                {s.score ?? "—"}
              </span>
              {s.label && (
                <StatusPill tone="primary" dot>
                  {s.label}
                </StatusPill>
              )}
            </div>
            {s.summary && (
              <p className="text-sm text-muted-foreground">{s.summary}</p>
            )}
          </div>

          {(s.factors?.length ?? 0) > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {s.factors!.map((f, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{f.label ?? `Factor ${i + 1}`}</p>
                    {f.impact && (
                      <StatusPill
                        tone={
                          /neg|down|worse/i.test(f.impact)
                            ? "negative"
                            : /pos|up|better/i.test(f.impact)
                              ? "positive"
                              : "neutral"
                        }
                      >
                        {humanize(f.impact)}
                      </StatusPill>
                    )}
                  </div>
                  {f.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {f.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {cmps.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">This period vs last</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cmps.map((c, i) => {
              const change = c.change ?? "";
              const isDown = /(-|down|less|below)/i.test(change);
              const isUp = /(\+|up|more|above)/i.test(change);
              return (
                <div key={i} className="surface-card space-y-2 p-5">
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {c.title ?? "Comparison"}
                  </p>
                  <p data-numeric className="text-display text-3xl">
                    {formatMoney(c.current, { compact: true })}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>vs {formatMoney(c.previous, { compact: true })}</span>
                    {(isDown || isUp) && (
                      <StatusPill tone={isDown ? "positive" : "negative"} dot>
                        {isDown ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : (
                          <TrendingUp className="h-3 w-3" />
                        )}
                        {humanize(change)}
                      </StatusPill>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {cats.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Category scores</h2>
          <div className="surface-card divide-y divide-border">
            {cats.map((c, i) => {
              const score = toNumber(c.score) ?? 0;
              return (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {humanize(c.category ?? "Category")}
                    </p>
                    <ProgressBar
                      value={score}
                      tone={score >= 75 ? "positive" : score >= 50 ? "primary" : "warning"}
                      className="mt-2 max-w-md"
                    />
                  </div>
                  <div className="text-right">
                    <p data-numeric className="text-display text-xl">
                      {Math.round(score)}
                    </p>
                    {c.trend && (
                      <p className="text-xs text-muted-foreground">
                        {humanize(c.trend)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {bigs.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Biggest changes</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {bigs.map((b, i) => {
              const dir = b.direction ?? "";
              const isDown = /down|less|-/i.test(dir);
              return (
                <div key={i} className="surface-card flex items-start gap-3 p-4">
                  <span
                    className={
                      isDown
                        ? "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-positive-soft text-positive"
                        : "grid h-10 w-10 shrink-0 place-items-center rounded-md bg-warning-soft text-warning"
                    }
                  >
                    {isDown ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {humanize(b.category ?? "Category")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {b.change ?? "Change"} · {formatMoney(b.amount, { compact: true })}
                    </p>
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
            {recs.map((r, i) => (
              <div key={i} className="surface-card p-5">
                <p className="font-medium">{r.title ?? "Suggestion"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.description ?? r.body ?? ""}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {patterns.length > 0 && (
        <section>
          <h2 className="mb-3 text-display text-2xl">Patterns</h2>
          <ul className="surface-card divide-y divide-border">
            {patterns.map((p, i) => (
              <li key={i} className="p-4">
                <p className="font-medium">{p.label ?? "Pattern"}</p>
                {p.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

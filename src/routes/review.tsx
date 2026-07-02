import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCircle2, ClipboardCheck, ClockAlert } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonRow } from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import { api, toQuery } from "@/lib/api";
import type { Reminder, TransactionsPage, WeeklyReview } from "@/lib/types";
import { formatDate, formatDateShort, formatDateTime, formatMoney, humanize, toNumber } from "@/lib/format";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const qc = useQueryClient();

  const unresolvedQ = useQuery({
    queryKey: ["transactions", { review_status: "needs_review", page: 1 }],
    queryFn: () =>
      api.get<TransactionsPage>(
        `/transactions${toQuery({ review_status: "needs_review", page: 1, page_size: 50 })}`,
      ),
    retry: 1,
  });
  const remindersQ = useQuery({
    queryKey: ["reminders"],
    queryFn: () => api.get<{ items?: Reminder[]; reminders?: Reminder[] } | Reminder[]>("/reminders"),
    retry: 1,
  });
  const weeklyQ = useQuery({
    queryKey: ["weekly-review"],
    queryFn: () => api.get<WeeklyReview>("/weekly-review"),
    retry: 1,
  });

  const unresolved =
    unresolvedQ.data?.items ??
    unresolvedQ.data?.transactions ??
    unresolvedQ.data?.results ??
    [];
  const reminders: Reminder[] = Array.isArray(remindersQ.data)
    ? remindersQ.data
    : ((remindersQ.data as { items?: Reminder[]; reminders?: Reminder[] } | undefined)?.items ??
       (remindersQ.data as { items?: Reminder[]; reminders?: Reminder[] } | undefined)?.reminders ??
       []);

  const dismissM = useMutation({
    mutationFn: (id: number) => api.post(`/reminders/${id}/dismiss`),
    onSuccess: () => {
      toast.success("Reminder dismissed");
      qc.invalidateQueries({ queryKey: ["reminders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("Couldn't dismiss", { description: e.message }),
  });
  const snoozeM = useMutation({
    mutationFn: (id: number) => api.post(`/reminders/${id}/snooze`, { minutes: 60 }),
    onSuccess: () => {
      toast.success("Snoozed for 1 hour");
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: (e: Error) => toast.error("Couldn't snooze", { description: e.message }),
  });

  const completeM = useMutation({
    mutationFn: () => api.post("/weekly-review/complete"),
    onSuccess: () => {
      toast.success("Weekly review complete");
      qc.invalidateQueries({ queryKey: ["weekly-review"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("Couldn't complete", { description: e.message }),
  });

  return (
    <AppShell
      header={
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Review
          </p>
          <h1 className="truncate text-display text-xl sm:text-2xl">
            Check in with your money
          </h1>
        </div>
      }
    >
      <PageHeader
        eyebrow="Review"
        title="A calm weekly check-in."
        description="Resolve flagged transactions, act on reminders, then close the loop."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* LEFT: unresolved */}
        <section className="surface-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Needs review
              </p>
              <h2 className="text-display text-2xl">Unresolved transactions</h2>
            </div>
            <StatusPill tone={unresolved.length > 0 ? "warning" : "positive"} dot>
              {unresolved.length}
            </StatusPill>
          </div>

          <QueryBoundary
            isLoading={unresolvedQ.isLoading}
            isError={unresolvedQ.isError}
            error={unresolvedQ.error}
            onRetry={() => unresolvedQ.refetch()}
            loading={
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            }
          >
            {unresolved.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="You're all caught up"
                description="No transactions need your attention right now."
              />
            ) : (
              <ul className="divide-y divide-border">
                {unresolved.map((t) => {
                  const amt = toNumber(t.amount) ?? 0;
                  const isOut = t.direction === "out" || amt < 0;
                  return (
                    <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateShort(t.occurred_on)}
                          {t.category ? ` · ${humanize(t.category)}` : ""}
                        </p>
                        {t.review_reason && (
                          <p className="mt-1 text-sm text-warning">
                            {t.review_reason}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p
                          data-numeric
                          className={isOut ? "text-foreground" : "text-positive"}
                        >
                          {formatMoney(Math.abs(amt) * (isOut ? -1 : 1), { signed: true })}
                        </p>
                        <Link to="/transactions">
                          <Button size="sm" variant="ghost" className="mt-1">
                            Resolve
                          </Button>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </QueryBoundary>
        </section>

        {/* RIGHT: reminders + weekly review */}
        <aside className="space-y-6">
          <div className="surface-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Reminders
                </p>
                <h2 className="text-display text-2xl">Active</h2>
              </div>
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <QueryBoundary
              isLoading={remindersQ.isLoading}
              isError={remindersQ.isError}
              error={remindersQ.error}
              onRetry={() => remindersQ.refetch()}
              loading={<><SkeletonRow /><SkeletonRow /></>}
            >
              {reminders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No active reminders.
                </p>
              ) : (
                <ul className="space-y-3">
                  {reminders.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-border bg-muted/30 p-3"
                    >
                      <p className="font-medium">{r.title ?? "Reminder"}</p>
                      {r.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {r.description}
                        </p>
                      )}
                      {r.due_at && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <ClockAlert className="h-3 w-3" />
                          {formatDateTime(r.due_at)}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={snoozeM.isPending}
                          onClick={() => snoozeM.mutate(r.id)}
                        >
                          Snooze 1h
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={dismissM.isPending}
                          onClick={() => dismissM.mutate(r.id)}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </QueryBoundary>
          </div>

          <div className="surface-elevated p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                <ClipboardCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Weekly review
                </p>
                <h2 className="text-display text-2xl">This week</h2>
              </div>
            </div>

            <QueryBoundary
              isLoading={weeklyQ.isLoading}
              isError={weeklyQ.isError}
              error={weeklyQ.error}
              onRetry={() => weeklyQ.refetch()}
              loading={<div className="mt-4"><SkeletonRow /></div>}
            >
              <div className="mt-4 space-y-3">
                {weeklyQ.data?.current ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {weeklyQ.data.current.period_start &&
                        `${formatDate(weeklyQ.data.current.period_start)} → ${formatDate(weeklyQ.data.current.period_end)}`}
                    </p>
                    {weeklyQ.data.current.summary && (
                      <p className="text-sm">{weeklyQ.data.current.summary}</p>
                    )}
                    <Button
                      className="w-full"
                      disabled={completeM.isPending}
                      onClick={() => completeM.mutate()}
                    >
                      {completeM.isPending ? "Completing…" : "Mark review complete"}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No open weekly review right now.
                  </p>
                )}

                {(weeklyQ.data?.completed?.length ?? 0) > 0 && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm font-medium">
                      Past reviews ({weeklyQ.data!.completed!.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {weeklyQ.data!.completed!.slice(0, 8).map((c, i) => (
                        <li key={c.id ?? i}>
                          {formatDate(c.completed_at)}
                          {c.summary ? ` · ${c.summary}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </QueryBoundary>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

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
import { supabase } from "@/lib/supabase";
import { useReminders, useWeeklyReviews } from "@/lib/db";
import { formatDate, formatDateShort, formatDateTime, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/review")({ component: ReviewPage });

function startOfWeek(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // to Monday
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function ReviewPage() {
  const qc = useQueryClient();

  const unresolvedQ = useQuery({
    queryKey: ["transactions", { needs_review: true }],
    queryFn: async () => {
      const { data, error } = await supabase.from("transactions")
        .select("id,description,amount,direction,occurred_on,review_reason,categories(id,name)")
        .eq("needs_review", true).order("occurred_on", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const remindersQ = useReminders();
  const weeklyQ = useWeeklyReviews();

  const dismissM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reminders").update({ state: "dismissed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reminder dismissed"); qc.invalidateQueries({ queryKey: ["reminders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const snoozeM = useMutation({
    mutationFn: async (id: string) => {
      const due = new Date(Date.now() + 60 * 60_000).toISOString();
      const { error } = await supabase.from("reminders").update({ state: "snoozed", snoozed_until: due }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Snoozed for 1 hour"); qc.invalidateQueries({ queryKey: ["reminders"] }); },
    onError: (e: Error) => toast.error(e.message),
  });


  const currentWeek = (weeklyQ.data ?? []).find(w => w.state === "open");
  const completedWeeks = (weeklyQ.data ?? []).filter(w => w.state === "completed");

  const completeM = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;
      if (currentWeek) {
        const { error } = await supabase.from("weekly_reviews").update({
          state: "completed", completed_at: new Date().toISOString(),
        }).eq("id", currentWeek.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("weekly_reviews").insert({
          user_id: userId, week_start: startOfWeek(), state: "completed", completed_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Weekly review complete"); qc.invalidateQueries({ queryKey: ["weekly_reviews"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const unresolved = unresolvedQ.data ?? [];
  const reminders = (remindersQ.data ?? []).filter(r => r.state === "pending" || r.state === "snoozed");

  return (
    <AppShell header={<h1 className="truncate text-display text-xl sm:text-2xl">Review</h1>}>
      <PageHeader eyebrow="Review" title="A calm weekly check-in." description="Resolve flagged transactions, act on reminders, then close the loop." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="surface-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Needs review</p>
              <h2 className="text-display text-2xl">Unresolved transactions</h2>
            </div>
            <StatusPill tone={unresolved.length > 0 ? "warning" : "positive"} dot>{unresolved.length}</StatusPill>
          </div>
          <QueryBoundary
            isLoading={unresolvedQ.isLoading} isError={unresolvedQ.isError} error={unresolvedQ.error}
            onRetry={() => unresolvedQ.refetch()}
            loading={<><SkeletonRow /><SkeletonRow /><SkeletonRow /></>}
          >
            {unresolved.length === 0 ? (
              <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="You're all caught up" description="No transactions need your attention right now." />
            ) : (
              <ul className="divide-y divide-border">
                {unresolved.map((t: any) => (
                  <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateShort(t.occurred_on)}{t.categories?.name ? ` · ${t.categories.name}` : ""}
                      </p>
                      {t.review_reason && <p className="mt-1 text-sm text-warning">{t.review_reason}</p>}
                    </div>
                    <div className="text-right">
                      <p data-numeric className={t.direction === "in" ? "text-positive" : ""}>
                        {t.direction === "in" ? "+" : "−"}{formatMoney(t.amount)}
                      </p>
                      <Link to="/transactions"><Button size="sm" variant="ghost" className="mt-1">Resolve</Button></Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </QueryBoundary>
        </section>

        <aside className="space-y-6">
          <div className="surface-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Reminders</p>
                <h2 className="text-display text-2xl">Active</h2>
              </div>
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <QueryBoundary
              isLoading={remindersQ.isLoading} isError={remindersQ.isError} error={remindersQ.error}
              onRetry={() => remindersQ.refetch()} loading={<><SkeletonRow /><SkeletonRow /></>}
            >
              {reminders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active reminders.</p>
              ) : (
                <ul className="space-y-3">
                  {reminders.map(r => (
                    <li key={r.id} className="rounded-lg border border-border bg-muted/30 p-3">
                      <p className="font-medium">{r.title}</p>
                      {r.detail && <p className="mt-0.5 text-sm text-muted-foreground">{r.detail}</p>}
                      {r.due_on && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><ClockAlert className="h-3 w-3" />{formatDate(r.due_on)}</p>}

                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" disabled={snoozeM.isPending} onClick={() => snoozeM.mutate(r.id)}>Snooze 1h</Button>
                        <Button size="sm" variant="ghost" disabled={dismissM.isPending} onClick={() => dismissM.mutate(r.id)}>Dismiss</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </QueryBoundary>
          </div>

          <div className="surface-elevated p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-soft text-primary"><ClipboardCheck className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Weekly review</p>
                <h2 className="text-display text-2xl">This week</h2>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">Week starting {formatDate(currentWeek?.week_start ?? startOfWeek())}.</p>
              <Button className="w-full" disabled={completeM.isPending} onClick={() => completeM.mutate()}>
                {completeM.isPending ? "Saving…" : currentWeek ? "Mark review complete" : "Complete this week"}
              </Button>
              {completedWeeks.length > 0 && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium">Past reviews ({completedWeeks.length})</summary>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {completedWeeks.slice(0, 8).map(c => (
                      <li key={c.id}>{formatDate(c.completed_at ?? c.week_start)}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

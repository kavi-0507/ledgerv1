import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PieChart, Plus, Trash2 } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { ProgressBar } from "@/components/ds/ProgressBar";
import { SkeletonStatCard } from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import type { DbBudget, DbCategory } from "@/lib/supabase";
import { useBudgets, useCategories, startOfMonth, endOfMonth } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { formatMoney } from "@/lib/format";

export const Route = createFileRoute("/budgets")({ component: BudgetsPage });

function useMonthSpendByCategory() {
  const from = startOfMonth();
  const to = endOfMonth();
  return useQuery({
    queryKey: ["budgets_month_spend", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount,category_id,direction,occurred_on")
        .eq("direction", "out")
        .gte("occurred_on", from).lte("occurred_on", to);
      if (error) throw error;
      const byCat = new Map<string | null, number>();
      let total = 0;
      for (const r of data ?? []) {
        const amt = Number((r as any).amount || 0);
        byCat.set((r as any).category_id, (byCat.get((r as any).category_id) ?? 0) + amt);
        total += amt;
      }
      return { byCat, total };
    },
  });
}

function BudgetsPage() {
  const [editing, setEditing] = useState<DbBudget | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useBudgets();
  const catsQ = useCategories();
  const spendQ = useMonthSpendByCategory();

  const items = q.data ?? [];
  const overall = items.find(b => b.scope === "overall");
  const categoryBudgets = items.filter(b => b.scope !== "overall");

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between gap-3">
          <h1 className="truncate text-display text-xl sm:text-2xl">Budgets</h1>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" />New budget</Button>
        </div>
      }
    >
      <PageHeader eyebrow="Budgets" title="Set intentions, not limits." description="Overall and category budgets with live progress." />

      <QueryBoundary
        isLoading={q.isLoading || spendQ.isLoading}
        isError={q.isError} error={q.error}
        onRetry={() => { q.refetch(); spendQ.refetch(); }}
        loading={<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /></div>}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={<PieChart className="h-5 w-5" />}
            title="No budgets yet"
            description="Create your first budget to see progress and projections."
            action={<Button onClick={() => setCreating(true)}>Create budget</Button>}
          />
        ) : (
          <div className="space-y-8">
            {overall && (
              <BudgetCard budget={overall} highlight spent={spendQ.data?.total ?? 0} onEdit={() => setEditing(overall)} />
            )}
            {categoryBudgets.length > 0 && (
              <div>
                <h2 className="mb-3 text-display text-2xl">Category budgets</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryBudgets.map(b => (
                    <BudgetCard
                      key={b.id}
                      budget={b}
                      spent={spendQ.data?.byCat.get(b.category_id) ?? 0}
                      onEdit={() => setEditing(b)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </QueryBoundary>

      <BudgetDialog
        open={creating || editing !== null}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        budget={editing ?? undefined}
        categories={catsQ.data ?? []}
      />
    </AppShell>
  );
}

function BudgetCard({ budget, highlight, spent, onEdit }: { budget: DbBudget & { categories?: any }; highlight?: boolean; spent: number; onEdit: () => void }) {
  const qc = useQueryClient();
  const amount = Number(budget.amount);
  const pct = amount > 0 ? (spent / amount) * 100 : 0;
  const remaining = amount - spent;

  // Projection: linear based on day-of-month
  const now = new Date();
  const day = now.getDate();
  const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = budget.period === "monthly" ? spent / day * total : spent;

  const tone: "primary" | "warning" | "negative" = pct > 100 ? "negative" : pct > 80 ? "warning" : "primary";

  const deleteM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("budgets").delete().eq("id", budget.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Budget deleted"); qc.invalidateQueries({ queryKey: ["budgets"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const catName = budget.categories?.name ?? (budget.scope === "overall" ? "Overall" : "Uncategorised");

  return (
    <div className={highlight ? "surface-elevated space-y-4 p-6" : "surface-card space-y-4 p-5 sm:p-6"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{budget.scope} · {budget.period}</p>
          <h3 className="mt-1 truncate text-display text-2xl">{budget.name || catName}</h3>
        </div>
        {pct > 80 && <StatusPill tone={pct > 100 ? "negative" : "warning"} dot>{pct > 100 ? "Over" : "Watch"}</StatusPill>}
      </div>

      <div className="flex items-baseline gap-2">
        <span data-numeric className="text-display text-4xl">{formatMoney(spent, { compact: true })}</span>
        <span className="text-sm text-muted-foreground">of {formatMoney(amount, { compact: true })}</span>
      </div>

      <ProgressBar value={pct} tone={tone} />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Remaining</p>
          <p data-numeric className="mt-1">{formatMoney(remaining)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Projected</p>
          <p data-numeric className={projected > amount ? "mt-1 text-negative" : "mt-1"}>{formatMoney(projected)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>Edit</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Trash2 className="mr-1 h-4 w-4" />Delete</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
              <AlertDialogDescription>Your transactions won't be affected.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteM.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function BudgetDialog({ open, onOpenChange, budget, categories }: { open: boolean; onOpenChange: (o: boolean) => void; budget?: DbBudget; categories: DbCategory[] }) {
  const qc = useQueryClient();
  const isEdit = !!budget;
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"overall" | "category">("category");
  const [period, setPeriod] = useState<"weekly" | "monthly">("monthly");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (open) {
      setName(budget?.name ?? "");
      setScope((budget?.scope as any) ?? "category");
      setPeriod((budget?.period as any) ?? "monthly");
      setCategoryId(budget?.category_id ?? "");
      setAmount(budget?.amount != null ? String(budget.amount) : "");
    }
  }, [open, budget]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name, scope, period,
        category_id: scope === "overall" ? null : (categoryId || null),
        amount: Number(amount),
      };
      if (isEdit) {
        const { error } = await supabase.from("budgets").update(payload).eq("id", budget!.id);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not signed in");
        const { error } = await supabase.from("budgets").insert({ ...payload, user_id: userData.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Budget updated" : "Budget created");
      qc.invalidateQueries({ queryKey: ["budgets"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = name.trim() && amount && (scope === "overall" || categoryId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "New budget"}</DialogTitle>
          <DialogDescription>Choose a name, scope and amount. Progress updates automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Monthly essentials" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="overall">Overall</SelectItem><SelectItem value="category">Category</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          {scope === "category" && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : isEdit ? "Save changes" : "Create budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

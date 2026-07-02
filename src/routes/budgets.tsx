import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import type { Budget, Categories } from "@/lib/types";
import { formatMoney, humanize, toNumber } from "@/lib/format";

export const Route = createFileRoute("/budgets")({
  component: BudgetsPage,
});

function BudgetsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Budget | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["budgets"],
    queryFn: () => api.get<{ items?: Budget[]; budgets?: Budget[] } | Budget[]>("/budgets"),
    retry: 1,
  });
  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Categories>("/categories"),
  });

  const items: Budget[] = Array.isArray(q.data)
    ? q.data
    : ((q.data as { items?: Budget[]; budgets?: Budget[] } | undefined)?.items ??
       (q.data as { items?: Budget[]; budgets?: Budget[] } | undefined)?.budgets ??
       []);

  const overall = items.find((b) => b.scope === "overall");
  const categoryBudgets = items.filter((b) => b.scope !== "overall");

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["budgets"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const categories = normalizeCategoryList(catsQ.data);

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Budgets
            </p>
            <h1 className="truncate text-display text-xl sm:text-2xl">
              Where you want to spend
            </h1>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New budget
          </Button>
        </div>
      }
    >
      <PageHeader
        eyebrow="Budgets"
        title="Set intentions, not limits."
        description="Overall and category budgets with live progress and projections."
      />

      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => q.refetch()}
        loading={
          <div className="space-y-4">
            <SkeletonStatCard />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </div>
          </div>
        }
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
              <BudgetCard
                budget={overall}
                highlight
                onEdit={() => setEditing(overall)}
              />
            )}
            {categoryBudgets.length > 0 && (
              <div>
                <h2 className="mb-3 text-display text-2xl">Category budgets</h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categoryBudgets.map((b) => (
                    <BudgetCard
                      key={b.id}
                      budget={b}
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
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false);
            setEditing(null);
          }
        }}
        budget={editing ?? undefined}
        categories={categories}
        onSaved={invalidate}
      />
    </AppShell>
  );
}

function normalizeCategoryList(cats: Categories | undefined): string[] {
  if (!cats) return [];
  const raw = cats.categories ?? [];
  return Array.isArray(raw)
    ? raw.map((c) => (typeof c === "string" ? c : (c?.name ?? ""))).filter(Boolean)
    : [];
}

function BudgetCard({
  budget,
  highlight,
  onEdit,
}: {
  budget: Budget;
  highlight?: boolean;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const spent = toNumber(budget.spent) ?? 0;
  const amount = toNumber(budget.amount) ?? 0;
  const remaining = toNumber(budget.remaining) ?? amount - spent;
  const projected = toNumber(budget.projected_spending);
  let pct = toNumber(budget.percentage_used);
  if (pct === null && amount > 0) pct = (spent / amount) * 100;
  pct = pct ?? 0;

  const warning = !!budget.warning || pct > 100;
  const projectedOver = projected !== null && projected > amount;
  const tone: "primary" | "warning" | "negative" | "positive" =
    pct > 100 ? "negative" : warning ? "warning" : pct > 75 ? "warning" : "primary";

  const deleteM = useMutation({
    mutationFn: () => api.del(`/budgets/${budget.id}`),
    onSuccess: () => {
      toast.success("Budget deleted");
      qc.invalidateQueries({ queryKey: ["budgets"] });
    },
    onError: (e: Error) => toast.error("Couldn't delete", { description: e.message }),
  });

  return (
    <div className={
      highlight
        ? "surface-elevated space-y-4 p-6"
        : "surface-card interactive space-y-4 p-5 sm:p-6"
    }>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            {humanize(budget.scope ?? "budget")} · {humanize(budget.period ?? "monthly")}
          </p>
          <h3 className="mt-1 truncate text-display text-2xl">
            {budget.name || (budget.category ? humanize(budget.category) : "Budget")}
          </h3>
        </div>
        {warning && (
          <StatusPill tone={pct > 100 ? "negative" : "warning"} dot>
            {pct > 100 ? "Over" : "Watch"}
          </StatusPill>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span data-numeric className="text-display text-4xl">
          {formatMoney(spent, { compact: true })}
        </span>
        <span className="text-sm text-muted-foreground">
          of {formatMoney(amount, { compact: true })}
        </span>
      </div>

      <ProgressBar value={pct} tone={tone} />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Remaining
          </p>
          <p data-numeric className="mt-1">
            {formatMoney(remaining)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Projected
          </p>
          <p
            data-numeric
            className={projectedOver ? "mt-1 text-negative" : "mt-1"}
          >
            {formatMoney(projected)}
          </p>
        </div>
      </div>

      {budget.category_score !== null && budget.category_score !== undefined && (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          Category score{" "}
          <span data-numeric className="font-medium">
            {Math.round(Number(budget.category_score))}
          </span>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Trash2 className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this budget?</AlertDialogTitle>
              <AlertDialogDescription>
                Your transactions won't be affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteM.mutate()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function BudgetDialog({
  open,
  onOpenChange,
  budget,
  categories,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  budget?: Budget;
  categories: string[];
  onSaved: () => void;
}) {
  const isEdit = !!budget;
  const [form, setForm] = useState({
    name: budget?.name ?? "",
    scope: (budget?.scope as string) ?? "category",
    period: (budget?.period as string) ?? "monthly",
    category: budget?.category ?? "",
    amount:
      budget?.amount !== undefined && budget?.amount !== null
        ? String(budget.amount)
        : "",
  });

  // Reset form when opening for a different budget
  useState(() => form);

  const saveM = useMutation({
    mutationFn: () =>
      isEdit
        ? api.patch(`/budgets/${budget!.id}`, form)
        : api.post("/budgets", form),
    onSuccess: () => {
      toast.success(isEdit ? "Budget updated" : "Budget created");
      onOpenChange(false);
      onSaved();
    },
    onError: (e: Error) => toast.error("Couldn't save", { description: e.message }),
  });

  const valid = form.name.trim() && form.amount && form.period && form.scope;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o && budget) {
          setForm({
            name: budget.name ?? "",
            scope: (budget.scope as string) ?? "category",
            period: (budget.period as string) ?? "monthly",
            category: budget.category ?? "",
            amount:
              budget.amount !== undefined && budget.amount !== null
                ? String(budget.amount)
                : "",
          });
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "New budget"}</DialogTitle>
          <DialogDescription>
            Choose a name, scope and amount. Progress updates automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Monthly essentials"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select
                value={form.scope}
                onValueChange={(v) => setForm({ ...form, scope: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select
                value={form.period}
                onValueChange={(v) => setForm({ ...form, period: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.scope === "category" && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category ?? ""}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{humanize(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!valid || saveM.isPending}
            onClick={() => saveM.mutate()}
          >
            {saveM.isPending ? "Saving…" : isEdit ? "Save changes" : "Create budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

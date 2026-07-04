import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PieChart, Plus, Trash2, PiggyBank, Wallet, Sparkles, AlertTriangle, X, CopyPlus } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useCategories, useActiveMonth } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { categoryIcon, groupCategories } from "@/lib/categories";
import {
  useBudgetGroups, detectCategoryKind, STUDENT_SUGGESTIONS, matchSuggestionCategories,
  type BudgetGroup, type BudgetKind, type BudgetPeriod,
} from "@/lib/budgetGroups";
import { useSnapshotMonths, replaceLiveBudgets, monthLabel, type MonthKey } from "@/lib/insightsMonths";

export const Route = createFileRoute("/budgets")({ component: BudgetsPage });

type CatLite = { id: string; name: string };

/** Sum outflow spend grouped by category, excluding transfers and income. */
function useSpendByCategory(from: string | undefined, to: string | undefined) {
  return useQuery({
    queryKey: ["budgets_spend_by_cat", from, to],
    enabled: !!from && !!to,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("amount,category_id,direction,is_transfer,occurred_on")
        .gte("occurred_on", from!).lte("occurred_on", to!);
      if (error) throw error;
      const byCat = new Map<string | null, number>();
      for (const r of data ?? []) {
        const row = r as { amount: number; category_id: string | null; direction: "in" | "out"; is_transfer: boolean | null };
        if (row.is_transfer) continue;
        if (row.direction !== "out") continue;
        const amt = Number(row.amount || 0);
        byCat.set(row.category_id, (byCat.get(row.category_id) ?? 0) + amt);
      }
      return byCat;
    },
  });
}

function BudgetsPage() {
  const [editing, setEditing] = useState<BudgetGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [carryFromOpen, setCarryFromOpen] = useState(false);

  const catsQ = useCategories();
  const active = useActiveMonth();
  const spendQ = useSpendByCategory(active.data?.from, active.data?.to);
  const { groups, upsert, remove, addMany, userId } = useBudgetGroups();

  const cats: CatLite[] = catsQ.data ?? [];
  const catById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);

  const expenseGroups = groups.filter(g => g.kind === "expense");
  const savingsGroups = groups.filter(g => g.kind === "savings");

  const totalMonthlyBudget = expenseGroups.reduce((s, g) => s + normalisePeriod(g.amount, g.period), 0);
  const totalSavingsTarget = savingsGroups.reduce((s, g) => s + normalisePeriod(g.amount, g.period), 0);
  const totalPlannedOutgoing = totalMonthlyBudget + totalSavingsTarget;

  const totalSpent = useMemo(() => {
    if (!spendQ.data) return 0;
    let sum = 0;
    for (const g of expenseGroups) {
      for (const cid of g.categoryIds) sum += spendQ.data.get(cid) ?? 0;
    }
    return sum;
  }, [spendQ.data, expenseGroups]);

  // Categories already used by any active expense group (for overlap logic)
  const usedCategoryIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of expenseGroups) g.categoryIds.forEach(id => s.add(id));
    return s;
  }, [expenseGroups]);

  // Which student suggestions are still missing (by name)
  const missingSuggestions = useMemo(() => {
    const existing = new Set(groups.map(g => g.name.toLowerCase()));
    return STUDENT_SUGGESTIONS.filter(s => !existing.has(s.name.toLowerCase()));
  }, [groups]);

  function seedAll() {
    const items = STUDENT_SUGGESTIONS
      .filter(s => !groups.some(g => g.name.toLowerCase() === s.name.toLowerCase()))
      .map(s => ({
        name: s.name,
        kind: s.kind,
        period: "monthly" as BudgetPeriod,
        amount: s.defaultAmount,
        categoryIds: matchSuggestionCategories(s, cats),
      }))
      // Enforce no overlap across suggestions we're adding (pre-existing groups already checked)
      .reduce<{ used: Set<string>; out: Array<{name:string;kind:BudgetKind;period:BudgetPeriod;amount:number;categoryIds:string[]}> }>((acc, s) => {
        const filtered = s.categoryIds.filter(id => !acc.used.has(id));
        // Savings target may share the Savings category with itself only; expense groups strip anything already taken
        const ids = s.kind === "savings" ? s.categoryIds : filtered;
        if (s.kind === "expense") ids.forEach(id => acc.used.add(id));
        acc.out.push({ ...s, categoryIds: ids });
        return acc;
      }, { used: new Set(usedCategoryIds), out: [] }).out;
    addMany(items);
    toast.success(`Added ${items.length} suggested budget${items.length === 1 ? "" : "s"}`);
  }

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between gap-3">
          <h1 className="truncate text-display text-xl sm:text-2xl">Budgets</h1>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setCarryFromOpen(true)}>
              <CopyPlus className="mr-1.5 h-4 w-4" />Carry from…
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" />New budget</Button>
          </div>
        </div>
      }
    >
      <PageHeader
        eyebrow="Budgets"
        title="Plan the month, not every swipe."
        description={active.data?.label ? `Tracking ${active.data.label}${active.data.isFallback ? " (latest month with data)" : ""}. Income and transfers are excluded from budget maths.` : "Overall and category budgets with live progress."}
      />

      <QueryBoundary
        isLoading={catsQ.isLoading || spendQ.isLoading || active.isLoading}
        isError={spendQ.isError} error={spendQ.error}
        onRetry={() => { spendQ.refetch(); }}
        loading={<div className="grid gap-4 md:grid-cols-3"><SkeletonStatCard /><SkeletonStatCard /><SkeletonStatCard /></div>}
      >
        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            icon={<Wallet className="h-5 w-5" />}
            label="Total Monthly Budget"
            hint="Sum of active expense budgets. Auto-calculated."
            value={totalMonthlyBudget}
            secondary={<>Spent <span data-numeric>{formatMoney(totalSpent, { compact: true })}</span></>}
            progress={totalMonthlyBudget > 0 ? (totalSpent / totalMonthlyBudget) * 100 : 0}
          />
          <SummaryCard
            icon={<PiggyBank className="h-5 w-5" />}
            label="Savings Target"
            hint="Money you plan to set aside this month."
            value={totalSavingsTarget}
            tone="positive"
          />
          <SummaryCard
            icon={<Sparkles className="h-5 w-5" />}
            label="Total Planned Outgoing"
            hint="Monthly budget + savings target."
            value={totalPlannedOutgoing}
          />
        </div>

        {/* Suggested student budgets */}
        {missingSuggestions.length > 0 && (
          <section className="mt-8 surface-card p-5 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-display text-2xl">Suggested student budgets</h2>
                <p className="text-sm text-muted-foreground">Non-overlapping defaults built for student life. Amounts are just starting points.</p>
              </div>
              <Button size="sm" onClick={seedAll}><Plus className="mr-1.5 h-4 w-4" />Add all</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {missingSuggestions.map(s => {
                const ids = matchSuggestionCategories(s, cats);
                return (
                  <div key={s.name} className="rounded-lg border border-border/60 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{s.kind === "savings" ? "Savings target" : "Expense budget"}</p>
                        <p className="font-medium">{s.name}</p>
                      </div>
                      <span data-numeric className="text-sm text-muted-foreground">{formatMoney(s.defaultAmount, { compact: true })}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ids.length === 0
                        ? <span className="text-xs text-muted-foreground">No matching categories yet</span>
                        : ids.map(id => {
                            const c = catById.get(id);
                            return c ? <CategoryChip key={id} name={c.name} /> : null;
                          })}
                    </div>
                    <Button
                      variant="outline" size="sm" className="w-full"
                      disabled={ids.length === 0}
                      onClick={() => {
                        // Filter overlaps for expense
                        const clean = s.kind === "expense" ? ids.filter(id => !usedCategoryIds.has(id)) : ids;
                        upsert({ name: s.name, kind: s.kind, period: "monthly", amount: s.defaultAmount, categoryIds: clean });
                        toast.success(`${s.name} added`);
                      }}
                    >Add</Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Existing budget groups */}
        <section className="mt-8">
          {groups.length === 0 ? (
            <EmptyState
              icon={<PieChart className="h-5 w-5" />}
              title="No budgets yet"
              description="Add the student defaults above or create a custom budget."
              action={<Button onClick={() => setCreating(true)}>Create custom budget</Button>}
            />
          ) : (
            <>
              <h2 className="mb-3 text-display text-2xl">Your budgets</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map(g => (
                  <GroupCard
                    key={g.id}
                    group={g}
                    cats={cats}
                    spendByCat={spendQ.data}
                    onEdit={() => setEditing(g)}
                    onDelete={() => { remove(g.id); toast.success("Budget removed"); }}
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </QueryBoundary>

      <BudgetDialog
        open={creating || editing !== null}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        group={editing ?? undefined}
        categories={cats}
        usedCategoryIds={usedCategoryIds}
        onSubmit={(payload) => {
          upsert({ id: editing?.id, ...payload });
          toast.success(editing ? "Budget updated" : "Budget created");
          setEditing(null); setCreating(false);
        }}
      />

      {userId && (
        <CarryFromDialog
          open={carryFromOpen}
          onOpenChange={setCarryFromOpen}
          userId={userId}
          categories={cats}
        />
      )}
    </AppShell>
  );
}

function normalisePeriod(amount: number, period: BudgetPeriod): number {
  if (period === "weekly") return amount * (52 / 12);
  if (period === "termly") return amount / 3; // ~3 months per term
  return amount;
}

function SummaryCard({ icon, label, hint, value, secondary, progress, tone = "primary" }:
  { icon: React.ReactNode; label: string; hint?: React.ReactNode; value: number; secondary?: React.ReactNode; progress?: number; tone?: "primary" | "positive" }) {
  return (
    <div className="surface-elevated p-6 space-y-3">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-md ${tone === "positive" ? "bg-positive-soft text-positive" : "bg-primary-soft text-primary"}`}>{icon}</span>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      </div>
      <p data-numeric className="text-display text-4xl">{formatMoney(value, { compact: true })}</p>
      {secondary && <p className="text-sm text-muted-foreground">{secondary}</p>}
      {progress !== undefined && (
        <ProgressBar value={progress} tone={progress > 100 ? "negative" : progress > 80 ? "warning" : "primary"} />
      )}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function CategoryChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill border border-border/60 bg-muted/50 px-2 py-0.5 text-xs">
      <span aria-hidden>{categoryIcon(name)}</span>{name}
    </span>
  );
}

function GroupCard({ group, cats, spendByCat, onEdit, onDelete }: {
  group: BudgetGroup;
  cats: CatLite[];
  spendByCat: Map<string | null, number> | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catById = useMemo(() => new Map(cats.map(c => [c.id, c])), [cats]);
  const spent = group.categoryIds.reduce((s, id) => s + (spendByCat?.get(id) ?? 0), 0);
  const amount = Number(group.amount);
  const pct = amount > 0 ? (spent / amount) * 100 : 0;
  const remaining = amount - spent;

  const now = new Date();
  const day = now.getDate();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = group.period === "monthly" && day > 0 ? (spent / day) * totalDays : spent;

  const isSavings = group.kind === "savings";
  const tone: "primary" | "warning" | "negative" | "positive" =
    isSavings ? "positive" : pct > 100 ? "negative" : pct > 80 ? "warning" : "primary";

  return (
    <div className="surface-card space-y-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{isSavings ? "Savings target" : "Expense budget"} · {group.period}</p>
          <h3 className="mt-1 truncate text-display text-xl">{group.name}</h3>
        </div>
        {!isSavings && pct > 80 && <StatusPill tone={pct > 100 ? "negative" : "warning"} dot>{pct > 100 ? "Over" : "Watch"}</StatusPill>}
      </div>

      <div className="flex items-baseline gap-2">
        <span data-numeric className="text-display text-3xl">{formatMoney(spent, { compact: true })}</span>
        <span className="text-sm text-muted-foreground">of {formatMoney(amount, { compact: true })}</span>
      </div>

      <ProgressBar value={pct} tone={tone === "positive" ? "positive" : tone} />

      <div className="flex flex-wrap gap-1.5">
        {group.categoryIds.length === 0
          ? <span className="text-xs text-muted-foreground">No categories linked</span>
          : group.categoryIds.map(id => {
              const c = catById.get(id);
              return c ? <CategoryChip key={id} name={c.name} /> : null;
            })}
      </div>

      {!isSavings && (
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
      )}

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
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ---------- Dialog ----------

type Payload = {
  name: string;
  kind: BudgetKind;
  period: BudgetPeriod;
  amount: number;
  categoryIds: string[];
};

function BudgetDialog({
  open, onOpenChange, group, categories, usedCategoryIds, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  group?: BudgetGroup;
  categories: CatLite[];
  usedCategoryIds: Set<string>;
  onSubmit: (p: Payload) => void;
}) {
  const isEdit = !!group;
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"overall" | "category">("category");
  const [kind, setKind] = useState<BudgetKind>("expense");
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allowOverlap, setAllowOverlap] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setKind(group?.kind ?? "expense");
    setPeriod(group?.period ?? "monthly");
    setAmount(group?.amount != null ? String(group.amount) : "");
    setSelected(new Set(group?.categoryIds ?? []));
    setScope(group && group.categoryIds.length === 0 ? "overall" : "category");
    setAllowOverlap(false);
  }, [open, group]);

  const grouped = useMemo(() => groupCategories(categories), [categories]);

  const ownIds = new Set(group?.categoryIds ?? []);
  const conflicts = Array.from(selected).filter(id => usedCategoryIds.has(id) && !ownIds.has(id));
  const conflictCats = conflicts.map(id => categories.find(c => c.id === id)?.name).filter(Boolean) as string[];

  // Ignore expense/savings overlap between kinds: if the current is savings,
  // usedCategoryIds only contains expense budget categories, so a savings
  // category won't appear there → no false positive.
  const hasConflict = conflicts.length > 0;
  const blocked = hasConflict && !allowOverlap;

  const valid =
    name.trim().length > 0 &&
    Number(amount) > 0 &&
    (scope === "overall" || selected.size > 0) &&
    !blocked;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit budget" : "New budget"}</DialogTitle>
          <DialogDescription>Give it a name, pick a scope and period, then choose the categories it should track.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Budget name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Food Budget" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as "overall" | "category")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="overall">Overall (custom cap)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as BudgetPeriod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="termly">Termly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as BudgetKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense budget (spending limit)</SelectItem>
                <SelectItem value="savings">Savings target (money to set aside)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scope === "category" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Categories</Label>
                <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              </div>
              <div className="max-h-56 overflow-auto rounded-md border border-border/60 p-2 space-y-3">
                {grouped.map(g => (
                  <div key={g.group}>
                    <p className="px-1 text-[10px] uppercase tracking-wider text-muted-foreground">{g.group}</p>
                    <div className="mt-1 grid grid-cols-1 gap-1">
                      {g.items.map(c => {
                        const cKind = detectCategoryKind(c.name);
                        const isExcluded = kind === "expense" && (cKind === "income" || cKind === "transfer");
                        const isTaken = usedCategoryIds.has(c.id) && !ownIds.has(c.id);
                        return (
                          <label key={c.id} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${isExcluded ? "opacity-50" : "hover:bg-muted/50"} cursor-pointer`}>
                            <Checkbox
                              checked={selected.has(c.id)}
                              disabled={isExcluded}
                              onCheckedChange={() => !isExcluded && toggle(c.id)}
                            />
                            <span aria-hidden>{categoryIcon(c.name)}</span>
                            <span className="flex-1 truncate">{c.name}</span>
                            {isExcluded && <span className="text-xs text-muted-foreground">excluded</span>}
                            {isTaken && !isExcluded && <span className="text-xs text-warning">in another budget</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {selected.size > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Array.from(selected).map(id => {
                    const c = categories.find(x => x.id === id);
                    if (!c) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 rounded-pill bg-primary-soft text-primary px-2 py-0.5 text-xs">
                        <span aria-hidden>{categoryIcon(c.name)}</span>{c.name}
                        <button type="button" onClick={() => toggle(id)} className="ml-0.5 opacity-70 hover:opacity-100"><X className="h-3 w-3" /></button>
                      </span>
                    );
                  })}
                </div>
              )}

              {hasConflict && (
                <div className="rounded-md border border-warning/40 bg-warning-soft/50 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                    <div className="space-y-2">
                      <p><strong>{conflictCats.join(", ")}</strong> {conflictCats.length === 1 ? "is" : "are"} already part of another budget for this period. Including {conflictCats.length === 1 ? "it" : "them"} again may cause double-counting.</p>
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox checked={allowOverlap} onCheckedChange={v => setAllowOverlap(!!v)} />
                        Include anyway (I know what I'm doing)
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Amount</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => onSubmit({
              name: name.trim(),
              kind, period,
              amount: Number(amount),
              categoryIds: scope === "overall" ? [] : Array.from(selected),
            })}
          >{isEdit ? "Save changes" : "Create budget"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Carry from past-month snapshot --------------------------------------

function CarryFromDialog({
  open, onOpenChange, userId, categories,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  categories: CatLite[];
}) {
  const qc = useQueryClient();
  const snapshotMonths = useSnapshotMonths(userId);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey | "">("");
  const [busy, setBusy] = useState(false);

  const monthOptions = snapshotMonths.data ?? [];

  const previewQ = useQuery({
    queryKey: ["budget_snapshot_preview", userId, selectedMonth],
    enabled: !!selectedMonth,
    queryFn: async (): Promise<BudgetGroup[]> => {
      const { data, error } = await supabase
        .from("budget_group_snapshots")
        .select("groups").eq("user_id", userId).eq("month", selectedMonth).maybeSingle();
      if (error) throw error;
      return ((data?.groups ?? []) as BudgetGroup[]);
    },
  });

  const preview = previewQ.data ?? [];
  const catById = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  async function handleApply() {
    if (!selectedMonth || preview.length === 0) return;
    setBusy(true);
    try {
      await replaceLiveBudgets(userId, preview);
      window.dispatchEvent(new CustomEvent("ledger:budget-groups-changed"));
      qc.invalidateQueries({ queryKey: ["budget_snapshots"] });
      qc.invalidateQueries({ queryKey: ["budget_snapshot_months"] });
      toast.success(`Replaced live budgets with ${preview.length} from ${monthLabel(selectedMonth)}`);
      onOpenChange(false);
      setSelectedMonth("");
    } catch (err) {
      console.error("[carry-from] failed", err);
      toast.error("Couldn't apply that month's budgets. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Carry forward from another month</DialogTitle>
          <DialogDescription>
            Replace your live budgets with the list saved for a past month. Snapshots for older months aren't changed — only your current live budgets are overwritten.
          </DialogDescription>
        </DialogHeader>

        {monthOptions.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            No saved past-month snapshots yet. Visit Insights on a month to freeze its budgets first.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Month to copy from</Label>
              <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v as MonthKey)}>
                <SelectTrigger><SelectValue placeholder="Pick a month" /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedMonth && (
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                {preview.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">That month had no budgets saved.</p>
                ) : preview.map(g => (
                  <div key={g.id} className="flex items-center justify-between gap-3 border-b border-border/60 p-3 last:border-b-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{g.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {g.categoryIds.map(id => catById.get(id)?.name).filter(Boolean).join(", ") || "No categories linked"}
                      </p>
                    </div>
                    <span data-numeric className="text-sm">{formatMoney(Number(g.amount || 0), { compact: true })}<span className="text-muted-foreground"> /{g.period}</span></span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-warning">
              This replaces every budget in your live list. Past-month snapshots stay untouched.
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleApply} disabled={busy || !selectedMonth || preview.length === 0}>
            {busy ? "Applying…" : "Replace live budgets"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

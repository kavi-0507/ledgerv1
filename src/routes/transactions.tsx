import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonRow } from "@/components/ds/Skeletons";
import { EmptyState } from "@/components/ds/EmptyState";
import { StatusPill } from "@/components/ds/StatusPill";
import { CategorySelect } from "@/components/ds/CategorySelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useCategories, useTransactions, ensureDefaultAccountId, deriveReviewReason } from "@/lib/db";
import { formatDateShort, formatMoney } from "@/lib/format";
import { categoryIcon, PURPOSE_PRESETS } from "@/lib/categories";

export const Route = createFileRoute("/transactions")({ component: TransactionsPage });

function TransactionsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [needsReview, setNeedsReview] = useState(false);
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const categories = useCategories();
  const q = useTransactions({ search, direction, category_id: categoryId, needs_review: needsReview || undefined, page, pageSize: 50 });

  const items = (q.data?.items ?? []) as Tx[];
  const selectedItems = useMemo(() => items.filter(t => selected.has(t.id)), [items, selected]);
  const totalsSource = selected.size > 0 ? selectedItems : items;
  const totals = useMemo(() => {
    let inSum = 0, outSum = 0;
    for (const t of totalsSource) {
      if (t.direction === "in") inSum += Number(t.amount) || 0;
      else outSum += Number(t.amount) || 0;
    }
    return { inSum, outSum, net: inSum - outSum, count: totalsSource.length };
  }, [totalsSource]);

  const activeCategoryName = categoryId
    ? (categories.data ?? []).find((c: any) => c.id === categoryId)?.name ?? null
    : null;

  const clearSelection = () => setSelected(new Set());
  const resetOnFilterChange = () => { setPage(1); clearSelection(); };

  const toggleId = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllOnPage = () => setSelected(new Set(items.map(t => t.id)));

  const bulkInvalidate = () => {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["home_month_tx"] });
  };

  const bulkReview = useMutation({
    mutationFn: async (needs: boolean) => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      const { error } = await supabase.from("transactions").update({ needs_review: needs }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, needs) => {
      toast.success(needs ? "Flagged for review" : "Marked reviewed");
      clearSelection();
      bulkInvalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (ids.length === 0) return;
      const { error } = await supabase.from("transactions").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      clearSelection();
      bulkInvalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between gap-4">
          <h1 className="text-display text-xl sm:text-2xl">Activity</h1>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={selectMode ? "secondary" : "outline"}
              onClick={() => {
                if (selectMode) clearSelection();
                setSelectMode(m => !m);
              }}
            >
              {selectMode ? "Done" : "Select"}
            </Button>
            <NewTransactionDialog />
          </div>
        </div>
      }
    >
      <PageHeader eyebrow="Transactions" title="Every payment, in one place." />

      <div className="surface-card p-4 space-y-3 mb-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search description…" value={search} onChange={e => { setSearch(e.target.value); resetOnFilterChange(); }} className="pl-9" />
          </div>
          <Select value={direction || "all"} onValueChange={(v) => { setDirection(v === "all" ? "" : v as any); resetOnFilterChange(); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="out">Expense</SelectItem>
              <SelectItem value="in">Income</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-[200px]">
            <CategorySelect value={categoryId} onChange={(v) => { setCategoryId(v); resetOnFilterChange(); }} categories={categories.data ?? []} />
          </div>
          <label className="flex items-center gap-2 text-sm px-3">
            <Checkbox checked={needsReview} onCheckedChange={(v) => { setNeedsReview(!!v); resetOnFilterChange(); }} />
            Needs review
          </label>
        </div>
      </div>

      {/* Totals + bulk action bar */}
      {items.length > 0 && (
        <div className="surface-card mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {selected.size > 0
                ? `${selected.size} selected`
                : `${activeCategoryName ? activeCategoryName + " · " : ""}This page (${totals.count})`}
            </span>
            <span>Expenses <span data-numeric className="font-medium">{formatMoney(totals.outSum)}</span></span>
            <span>Income <span data-numeric className="font-medium text-positive">{formatMoney(totals.inSum)}</span></span>
            <span>
              Net{" "}
              <span
                data-numeric
                className={cn(
                  "font-medium",
                  totals.net > 0 && "text-positive",
                  totals.net < 0 && "text-destructive",
                )}
              >
                {totals.net < 0 ? "−" : ""}{formatMoney(Math.abs(totals.net))}
              </span>
            </span>
          </div>
          {selectMode && (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={selectAllOnPage} disabled={items.length === 0}>
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection} disabled={selected.size === 0}>
                Clear
              </Button>
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
              <Button size="sm" variant="outline" disabled={selected.size === 0 || bulkReview.isPending} onClick={() => bulkReview.mutate(false)}>
                Mark reviewed
              </Button>
              <Button size="sm" variant="outline" disabled={selected.size === 0 || bulkReview.isPending} onClick={() => bulkReview.mutate(true)}>
                Flag for review
              </Button>
              <Button size="sm" variant="destructive" disabled={selected.size === 0 || bulkDelete.isPending} onClick={() => setConfirmBulkDelete(true)}>
                <Trash2 className="mr-1.5 h-4 w-4" />Delete
              </Button>
            </div>
          )}
        </div>
      )}

      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => q.refetch()}
        loading={<div className="surface-card p-4"><SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow /></div>}
      >
        {q.data && q.data.items.length === 0 ? (
          <EmptyState title="No transactions match" description="Try clearing filters or add your first transaction." />
        ) : (
          <div className="surface-card divide-y divide-border">
            {items.map(t => (
              <TxRow
                key={t.id}
                t={t}
                categories={categories.data ?? []}
                selectMode={selectMode}
                selected={selected.has(t.id)}
                onToggle={() => toggleId(t.id)}
              />
            ))}
          </div>
        )}
        {q.data && q.data.total > q.data.pageSize && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page} of {Math.ceil(q.data.total / q.data.pageSize)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => { setPage(p => p - 1); clearSelection(); }}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= Math.ceil(q.data.total / q.data.pageSize)} onClick={() => { setPage(p => p + 1); clearSelection(); }}>Next</Button>
            </div>
          </div>
        )}
      </QueryBoundary>

      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} transaction{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmBulkDelete(false); bulkDelete.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

type Tx = {
  id: string; occurred_on: string; description: string; merchant: string | null; amount: number; direction: string;
  category_id: string | null; needs_review: boolean; behaviour: string | null;
  categories?: { id: string; name: string; color: string | null } | null;
};

function TxRow({
  t, categories, selectMode, selected, onToggle,
}: {
  t: Tx; categories: any[];
  selectMode: boolean; selected: boolean; onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const catName = t.categories?.name ?? null;
  const title = t.merchant || t.description;
  const sub = t.merchant && t.description && t.merchant !== t.description ? t.description : null;
  const handleClick = () => {
    if (selectMode) onToggle();
    else setOpen(true);
  };
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/40 interactive cursor-pointer",
          selectMode && selected && "bg-muted/60",
        )}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
      >
        {selectMode && (
          <span onClick={(e) => e.stopPropagation()} className="shrink-0">
            <Checkbox checked={selected} onCheckedChange={onToggle} />
          </span>
        )}
        <div className="h-9 w-9 grid place-items-center rounded-md bg-muted text-base shrink-0" aria-hidden>
          {catName ? categoryIcon(catName) : "❓"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{title}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
            <span>{formatDateShort(t.occurred_on)}</span>
            {catName && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5">
                  <span aria-hidden>{categoryIcon(catName)}</span>{catName}
                </span>
              </>
            )}
            {t.behaviour && (
              <span className="inline-flex items-center rounded-full border border-border/60 px-1.5 py-0.5">
                {t.behaviour}
              </span>
            )}
            {sub && <span className="truncate">· {sub}</span>}
          </div>
        </div>
        {t.needs_review && <StatusPill tone="warning">Review</StatusPill>}
        <span data-numeric className={`text-sm font-medium ${t.direction === "in" ? "text-positive" : ""}`}>
          {t.direction === "in" ? "+" : "−"}{formatMoney(t.amount)}
        </span>
      </div>
      {open && <TransactionDialog mode="edit" tx={t} categories={categories} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["transactions"] }); }} />}
    </>
  );
}

function NewTransactionDialog() {
  const qc = useQueryClient();
  const categories = useCategories();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add</Button></DialogTrigger>
      {open && (
        <TransactionDialog
          mode="create"
          categories={categories.data ?? []}
          onClose={() => {
            setOpen(false);
            qc.invalidateQueries({ queryKey: ["transactions"] });
            qc.invalidateQueries({ queryKey: ["home_month_tx"] });
          }}
        />
      )}
    </Dialog>
  );
}

/* ---------- Shared modal for create + edit ---------- */

type ModalProps =
  | { mode: "create"; categories: any[]; onClose: () => void; tx?: undefined }
  | { mode: "edit"; tx: Tx; categories: any[]; onClose: () => void };

function TransactionDialog(props: ModalProps) {
  const { mode, categories, onClose } = props;
  const editing = mode === "edit" ? props.tx : null;

  const [merchant, setMerchant] = useState(editing?.merchant ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [direction, setDirection] = useState<"out" | "in">((editing?.direction as any) ?? "out");
  const [occurredOn, setOccurredOn] = useState(editing?.occurred_on ?? new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? "");
  const [behaviour, setBehaviour] = useState(editing?.behaviour ?? "");
  const [needsReview, setNeedsReview] = useState(editing?.needs_review ?? false);
  const [editReview, setEditReview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const reviewReason = useMemo(
    () => deriveReviewReason({ needs_review: editing?.needs_review, category_id: editing?.category_id ?? null }, editing?.categories?.name),
    [editing],
  );

  const save = useMutation({
    mutationFn: async () => {
      const m = merchant.trim();
      const d = description.trim();
      if (!m && !d) throw new Error("Merchant is required");
      if (!amount) throw new Error("Amount is required");
      const payload: any = {
        merchant: m || null,
        description: d || m,
        amount: Number(amount),
        direction,
        occurred_on: occurredOn,
        category_id: categoryId || null,
        behaviour: behaviour.trim() || null,
        needs_review: needsReview,
      };
      if (mode === "create") {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not signed in");
        payload.user_id = userData.user.id;
        payload.account_id = await ensureDefaultAccountId(userData.user.id);
        payload.source = "manual";
        const { error } = await supabase.from("transactions").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("transactions").update(payload).eq("id", editing!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(mode === "create" ? "Transaction added" : "Saved"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await supabase.from("transactions").delete().eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const content = (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "New transaction" : "Edit transaction"}</DialogTitle>
      </DialogHeader>

      {editing?.needs_review && !editReview && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Needs review</p>
              <p className="text-xs text-muted-foreground">{reviewReason ?? "Confirm the details below."}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { setEditReview(true); setNeedsReview(false); }}>
              Mark reviewed
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {/* Direction segmented */}
        <div className="space-y-1.5">
          <Label>Type</Label>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-input p-1">
            <button
              type="button"
              onClick={() => setDirection("out")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors",
                direction === "out" ? "bg-destructive text-destructive-foreground" : "hover:bg-muted",
              )}
            >
              <ArrowDownLeft className="h-4 w-4" /> Expense
            </button>
            <button
              type="button"
              onClick={() => setDirection("in")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-sm px-3 py-1.5 text-sm transition-colors",
                direction === "in" ? "bg-positive text-white" : "hover:bg-muted",
              )}
            >
              <ArrowUpRight className="h-4 w-4" /> Income
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Merchant</Label>
          <Input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="Tesco, Deliveroo, TfL…" autoFocus />
        </div>

        <div className="space-y-1.5">
          <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Extra note" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
              <Input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="pl-6" placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={occurredOn} onChange={e => setOccurredOn(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Category</Label>
          <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} />
        </div>

        <div className="space-y-1.5">
          <Label>Purpose <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Select
            value={behaviour && (PURPOSE_PRESETS as readonly string[]).includes(behaviour) ? behaviour : (behaviour ? "__custom" : "__none")}
            onValueChange={(v) => {
              if (v === "__none") setBehaviour("");
              else if (v === "__custom") setBehaviour(behaviour || "");
              else setBehaviour(v);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Purpose" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">None</SelectItem>
              {PURPOSE_PRESETS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              <SelectItem value="__custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {behaviour !== "" && !(PURPOSE_PRESETS as readonly string[]).includes(behaviour) && (
            <Input value={behaviour} onChange={e => setBehaviour(e.target.value)} placeholder="Custom purpose" />
          )}
        </div>

        {(editReview || (!editing?.needs_review && mode === "edit")) && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={needsReview} onCheckedChange={(v) => setNeedsReview(!!v)} />
            Flag as needs review
          </label>
        )}
      </div>

      <DialogFooter className="!justify-between gap-2 sm:!justify-between">
        {mode === "edit" ? (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={del.isPending}>
            <Trash2 className="mr-1.5 h-4 w-4" />Delete
          </Button>
        ) : <span />}
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {mode === "create" ? "Add transaction" : "Save"}
        </Button>
      </DialogFooter>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmDelete(false); del.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContent>
  );

  // For "create" the parent Dialog is already open (DialogTrigger); for "edit" wrap here.
  if (mode === "edit") {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        {content}
      </Dialog>
    );
  }
  return content;
}

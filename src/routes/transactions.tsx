import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Receipt,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonRow } from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { api, toQuery } from "@/lib/api";
import type { Categories, Transaction, TransactionsPage } from "@/lib/types";
import {
  formatDate,
  formatDateShort,
  formatMoney,
  groupBy,
  humanize,
  toNumber,
} from "@/lib/format";

export const Route = createFileRoute("/transactions")({
  component: TransactionsPageRoute,
});

type Filter = "all" | "in" | "out";
type Sort = "newest" | "oldest" | "amount_high" | "amount_low";
type ReviewStatus = "" | "needs_review" | "ready";

function TransactionsPageRoute() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("");
  const [category, setCategory] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Categories>("/categories"),
  });

  const listQ = useQuery({
    queryKey: ["transactions", { query, filter, sort, reviewStatus, category, page }],
    queryFn: () =>
      api.get<TransactionsPage>(
        `/transactions${toQuery({
          page,
          page_size: pageSize,
          query: query || undefined,
          filter,
          sort,
          category: category || undefined,
          review_status: reviewStatus || undefined,
        })}`,
      ),
    retry: 1,
  });

  const items =
    listQ.data?.items ??
    listQ.data?.transactions ??
    listQ.data?.results ??
    [];

  const grouped = useMemo(
    () =>
      groupBy(items, (t) => {
        const d = new Date(t.occurred_on);
        return Number.isNaN(d.getTime())
          ? t.occurred_on
          : d.toISOString().slice(0, 10);
      }),
    [items],
  );

  const categories = normalizeCategoryList(catsQ.data);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Activity
            </p>
            <h1 className="truncate text-display text-xl sm:text-2xl">
              All transactions
            </h1>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add
          </Button>
        </div>
      }
    >
      <PageHeader
        eyebrow="Transactions"
        title="Your activity"
        description="Search, filter and review every movement of your money."
      />

      {/* Toolbar */}
      <div className="surface-card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search descriptions…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => { setFilter(v as Filter); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value="in">Money in</SelectItem>
            <SelectItem value="out">Money out</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => { setSort(v as Sort); setPage(1); }}>
          <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="amount_high">Amount: high → low</SelectItem>
            <SelectItem value="amount_low">Amount: low → high</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={reviewStatus || "any"}
          onValueChange={(v) => {
            setReviewStatus(v === "any" ? "" : (v as ReviewStatus));
            setPage(1);
          }}
        >
          <SelectTrigger><SelectValue placeholder="Review" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any review status</SelectItem>
            <SelectItem value="needs_review">Needs review</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={category || "any"}
          onValueChange={(v) => {
            setCategory(v === "any" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{humanize(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryBoundary
        isLoading={listQ.isLoading}
        isError={listQ.isError}
        error={listQ.error}
        onRetry={() => listQ.refetch()}
        loading={
          <div className="surface-card p-4">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="No transactions match"
            description="Try clearing your filters, or add one manually."
            action={<Button onClick={() => setCreateOpen(true)}>Add transaction</Button>}
          />
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, list]) => (
              <section key={String(day)} className="surface-card overflow-hidden">
                <header className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
                  <p className="text-sm font-medium">{formatDate(day)}</p>
                  <p data-numeric className="text-xs text-muted-foreground">
                    {list.length} item{list.length === 1 ? "" : "s"}
                  </p>
                </header>
                <ul className="divide-y divide-border">
                  {list.map((t) => (
                    <TxRow key={t.id} tx={t} onClick={() => setOpenId(t.id)} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </QueryBoundary>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Page {listQ.data?.page ?? page}
          {listQ.data?.total_pages ? ` of ${listQ.data.total_pages}` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={(listQ.data?.page ?? page) <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              listQ.data?.total_pages
                ? (listQ.data.page ?? page) >= listQ.data.total_pages
                : items.length < pageSize
            }
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <TransactionDrawer
        id={openId}
        onClose={() => setOpenId(null)}
        categories={categories}
        onChanged={invalidate}
      />

      <CreateTransactionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories}
        onCreated={invalidate}
      />
    </AppShell>
  );
}

function normalizeCategoryList(cats: Categories | undefined): string[] {
  if (!cats) return [];
  const raw = cats.categories ?? [];
  const list = Array.isArray(raw)
    ? raw.map((c) => (typeof c === "string" ? c : (c?.name ?? "")))
    : [];
  return list.filter(Boolean);
}

function TxRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) {
  const amt = toNumber(tx.amount) ?? 0;
  const isOut = tx.direction === "out" || amt < 0;
  const displayAmt = Math.abs(amt) * (isOut ? -1 : 1);
  return (
    <li>
      <button
        onClick={onClick}
        className="interactive grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 text-left hover:bg-muted/40"
      >
        <span
          className={
            isOut
              ? "grid h-9 w-9 place-items-center rounded-md bg-muted text-muted-foreground"
              : "grid h-9 w-9 place-items-center rounded-md bg-positive-soft text-positive"
          }
        >
          {isOut ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{tx.description}</p>
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDateShort(tx.occurred_on)}</span>
            {tx.category && <span>· {humanize(tx.category)}</span>}
            {tx.needs_review && (
              <StatusPill tone="warning" className="ml-1">
                Needs review
              </StatusPill>
            )}
          </p>
        </div>
        <span data-numeric className={isOut ? "text-foreground" : "text-positive"}>
          {formatMoney(displayAmt, { signed: true })}
        </span>
      </button>
    </li>
  );
}

/* ---------------- Drawer ---------------- */

function TransactionDrawer({
  id,
  onClose,
  categories,
  onChanged,
}: {
  id: number | null;
  onClose: () => void;
  categories: string[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["transaction", id],
    queryFn: () => api.get<Transaction>(`/transactions/${id}`),
    enabled: id !== null,
  });

  const tx = q.data;
  const [category, setCategory] = useState<string>("");
  const [behaviour, setBehaviour] = useState<string>("");
  const [needsReview, setNeedsReview] = useState<boolean | null>(null);

  // sync when data arrives
  const currentCategory = category || (tx?.category ?? "");
  const currentBehaviour = behaviour || (tx?.behaviour ?? "");
  const currentReview = needsReview ?? tx?.needs_review ?? false;

  const saveM = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.patch<Transaction>(`/transactions/${id}`, patch),
    onSuccess: () => {
      toast.success("Transaction updated");
      qc.invalidateQueries({ queryKey: ["transaction", id] });
      onChanged();
    },
    onError: (e: Error) => toast.error("Couldn't update", { description: e.message }),
  });

  const deleteM = useMutation({
    mutationFn: () => api.del<{ id: number }>(`/transactions/${id}`),
    onSuccess: () => {
      toast.success("Transaction deleted");
      onClose();
      onChanged();
    },
    onError: (e: Error) => toast.error("Couldn't delete", { description: e.message }),
  });

  const ruleM = useMutation({
    mutationFn: () =>
      api.post("/merchant-rules", {
        pattern: (tx?.merchant ?? tx?.description ?? "").toString().toUpperCase(),
        category: currentCategory,
        behaviour: currentBehaviour || undefined,
      }),
    onSuccess: () => {
      toast.success("Merchant rule created", {
        description: "Future matches will use this rule.",
      });
      qc.invalidateQueries({ queryKey: ["merchant-rules"] });
    },
    onError: (e: Error) =>
      toast.error("Couldn't create rule", { description: e.message }),
  });

  return (
    <Sheet open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Transaction</SheetTitle>
          <SheetDescription>
            View, edit or delete this transaction.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-4">
          <QueryBoundary
            isLoading={q.isLoading}
            isError={q.isError}
            error={q.error}
            onRetry={() => q.refetch()}
            loading={
              <div className="space-y-3">
                <SkeletonRow />
                <SkeletonRow />
              </div>
            }
          >
            {tx && (
              <>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Amount
                  </p>
                  <p
                    data-numeric
                    className="text-display text-4xl"
                  >
                    {formatMoney(tx.amount, { signed: true })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDate(tx.occurred_on)} · {tx.description}
                  </p>
                  {tx.needs_review && tx.review_reason && (
                    <div className="mt-3 rounded-lg border border-warning/40 bg-warning-soft/40 p-3 text-sm text-warning">
                      {tx.review_reason}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={currentCategory || ""}
                      onValueChange={setCategory}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                      <SelectContent>
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>{humanize(c)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Behaviour</Label>
                    <Input
                      value={currentBehaviour}
                      onChange={(e) => setBehaviour(e.target.value)}
                      placeholder="Necessary, Discretionary…"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!currentReview}
                      onChange={(e) => setNeedsReview(e.target.checked)}
                    />
                    Needs review
                  </label>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!currentCategory || ruleM.isPending}
                  onClick={() => ruleM.mutate()}
                  title={
                    !currentCategory
                      ? "Set a category first"
                      : "Create a merchant rule for this description"
                  }
                >
                  <Wand2 className="mr-1.5 h-4 w-4" />
                  {ruleM.isPending ? "Creating rule…" : "Create merchant rule"}
                </Button>
              </>
            )}
          </QueryBoundary>
        </div>

        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
          {tx && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="sm:mr-auto">
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This can't be undone.
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

              <Button
                disabled={saveM.isPending}
                onClick={() =>
                  saveM.mutate({
                    category: currentCategory || undefined,
                    behaviour: currentBehaviour || undefined,
                    needs_review: !!currentReview,
                  })
                }
              >
                {saveM.isPending ? "Saving…" : "Save changes"}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Create dialog ---------------- */

function CreateTransactionDialog({
  open,
  onOpenChange,
  categories,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  categories: string[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    occurred_on: new Date().toISOString().slice(0, 10),
    description: "",
    amount: "",
    direction: "out" as "in" | "out",
    category: "",
    behaviour: "",
  });

  const createM = useMutation({
    mutationFn: () => api.post<Transaction>("/transactions", form),
    onSuccess: () => {
      toast.success("Transaction added");
      onOpenChange(false);
      onCreated();
      setForm({
        occurred_on: new Date().toISOString().slice(0, 10),
        description: "",
        amount: "",
        direction: "out",
        category: "",
        behaviour: "",
      });
    },
    onError: (e: Error) => toast.error("Couldn't add", { description: e.message }),
  });

  const valid = form.description.trim() && form.amount && form.occurred_on;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a transaction</DialogTitle>
          <DialogDescription>
            The backend handles categorisation and duplicate detection.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.occurred_on}
                onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select
                value={form.direction}
                onValueChange={(v) =>
                  setForm({ ...form, direction: v as "in" | "out" })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="out">Money out</SelectItem>
                  <SelectItem value="in">Money in</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Cafe, salary, rent…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Amount</Label>
              <Input
                inputMode="decimal"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{humanize(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Behaviour (optional)</Label>
            <Textarea
              rows={2}
              value={form.behaviour}
              onChange={(e) => setForm({ ...form, behaviour: e.target.value })}
              placeholder="Necessary, Discretionary, Academic…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!valid || createM.isPending}
            onClick={() => createM.mutate()}
          >
            {createM.isPending ? "Adding…" : "Add transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonRow } from "@/components/ds/Skeletons";
import { EmptyState } from "@/components/ds/EmptyState";
import { StatusPill } from "@/components/ds/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useCategories, useTransactions } from "@/lib/db";
import { formatDateShort, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/transactions")({ component: TransactionsPage });

function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<"" | "in" | "out">("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [needsReview, setNeedsReview] = useState(false);
  const [page, setPage] = useState(1);

  const categories = useCategories();
  const q = useTransactions({ search, direction, category_id: categoryId, needs_review: needsReview || undefined, page, pageSize: 50 });

  return (
    <AppShell
      header={
        <div className="flex w-full items-center justify-between gap-4">
          <h1 className="text-display text-xl sm:text-2xl">Activity</h1>
          <NewTransactionDialog />
        </div>
      }
    >
      <PageHeader eyebrow="Transactions" title="Every payment, in one place." />

      <div className="surface-card p-4 space-y-3 mb-6">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
          </div>
          <Select value={direction || "all"} onValueChange={(v) => { setDirection(v === "all" ? "" : v as any); setPage(1); }}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="out">Money out</SelectItem>
              <SelectItem value="in">Money in</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryId || "all"} onValueChange={(v) => { setCategoryId(v === "all" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categories.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm px-3">
            <Checkbox checked={needsReview} onCheckedChange={(v) => { setNeedsReview(!!v); setPage(1); }} />
            Needs review
          </label>
        </div>
      </div>

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
            {q.data?.items.map(t => <TxRow key={t.id} t={t as any} categories={categories.data ?? []} />)}
          </div>
        )}
        {q.data && q.data.total > q.data.pageSize && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Page {page} of {Math.ceil(q.data.total / q.data.pageSize)}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= Math.ceil(q.data.total / q.data.pageSize)} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </QueryBoundary>
    </AppShell>
  );
}

type Tx = {
  id: string; occurred_on: string; description: string; amount: number; direction: string;
  category_id: string | null; needs_review: boolean; review_reason: string | null;
  categories?: { id: string; name: string; color: string | null } | null;
};

function TxRow({ t, categories }: { t: Tx; categories: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/40 interactive" onClick={() => setOpen(true)}>
        <div className="h-9 w-9 grid place-items-center rounded-md bg-muted text-xs font-medium shrink-0">{t.description.slice(0,1).toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{t.description}</p>
          <p className="text-xs text-muted-foreground">{formatDateShort(t.occurred_on)} · {t.categories?.name ?? "Uncategorised"}</p>
        </div>
        {t.needs_review && <StatusPill tone="warning">Review</StatusPill>}
        <span data-numeric className={`text-sm font-medium ${t.direction === "in" ? "text-positive" : ""}`}>
          {t.direction === "in" ? "+" : "−"}{formatMoney(t.amount)}
        </span>
      </button>
      {open && <EditDialog t={t} categories={categories} onClose={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["transactions"] }); }} />}
    </>
  );
}

function EditDialog({ t, categories, onClose }: { t: Tx; categories: any[]; onClose: () => void }) {
  const [description, setDescription] = useState(t.description);
  const [amount, setAmount] = useState(String(t.amount));
  const [direction, setDirection] = useState(t.direction);
  const [occurredOn, setOccurredOn] = useState(t.occurred_on);
  const [categoryId, setCategoryId] = useState(t.category_id ?? "");
  const [needsReview, setNeedsReview] = useState(t.needs_review);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transactions").update({
        description, amount: Number(amount), direction, occurred_on: occurredOn,
        category_id: categoryId || null, needs_review: needsReview,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("transactions").delete().eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit transaction</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={occurredOn} onChange={e => setOccurredOn(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="out">Money out</SelectItem><SelectItem value="in">Money in</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={needsReview} onCheckedChange={(v) => setNeedsReview(!!v)} />
            Needs review
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending}><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTransactionDialog() {
  const qc = useQueryClient();
  const categories = useCategories();
  const [open, setOpen] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const m = merchant.trim();
      const d = description.trim();
      const { error } = await supabase.from("transactions").insert({
        user_id: userData.user.id,
        merchant: m || null,
        description: d || m,
        amount: Number(amount),
        direction,
        occurred_on: occurredOn,
        category_id: categoryId || null,
        source: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction added");
      setOpen(false); setMerchant(""); setDescription(""); setAmount(""); setCategoryId("");
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["home_month_tx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1.5 h-4 w-4" />Add</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New transaction</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Merchant</Label><Input value={merchant} onChange={e => setMerchant(e.target.value)} placeholder="Tesco" /></div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional details" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={occurredOn} onChange={e => setOccurredOn(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="out">Money out</SelectItem><SelectItem value="in">Money in</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorised</SelectItem>
                  {(categories.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending || (!merchant && !description) || !amount}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

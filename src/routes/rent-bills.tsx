import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Trash2, Check, CalendarDays, Link2 } from "lucide-react";
import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { EmptyState } from "@/components/ds/EmptyState";
import { StatusPill } from "@/components/ds/StatusPill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRentBills, useCategories, ensureDefaultAccountId } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { DbRentBill, RentBillRecurrence } from "@/lib/supabase";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rent-bills")({
  component: RentBillsPage,
});

type FormState = {
  title: string;
  amount: string;
  due_date: string;
  recurrence: RentBillRecurrence;
  notes: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  amount: "",
  due_date: new Date().toISOString().slice(0, 10),
  recurrence: "monthly",
  notes: "",
};

const RECURRENCE_LABELS: Record<RentBillRecurrence, string> = {
  "one-off": "One-off",
  weekly: "Weekly",
  monthly: "Monthly",
  termly: "Termly",
  yearly: "Yearly",
};

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addRecurrence(dateStr: string, recurrence: RentBillRecurrence): string {
  const d = parseLocalDate(dateStr);
  switch (recurrence) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "termly":
      d.setMonth(d.getMonth() + 4);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      return dateStr;
  }
  return d.toISOString().slice(0, 10);
}

function relativeDueLabel(dueDate: string): { text: string; overdue: boolean } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseLocalDate(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { text: "Due today", overdue: false };
  if (diffDays === 1) return { text: "Due tomorrow", overdue: false };
  if (diffDays === -1) return { text: "1 day overdue", overdue: true };
  if (diffDays < 0) return { text: `${Math.abs(diffDays)} days overdue`, overdue: true };
  return { text: `Due in ${diffDays} days`, overdue: false };
}

function BillDialog({
  bill,
  open,
  onOpenChange,
  onSave,
}: {
  bill?: DbRentBill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(
    bill
      ? {
          title: bill.title,
          amount: String(bill.amount),
          due_date: bill.due_date,
          recurrence: bill.recurrence,
          notes: bill.notes ?? "",
        }
      : EMPTY_FORM,
  );

  const isEdit = !!bill;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    if (!isEdit) setForm(EMPTY_FORM);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit deadline" : "Add deadline"}</DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update this rent or utility payment deadline."
                : "Create a new rent or utility payment deadline."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Rent, Electricity, Water"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="due_date">Due date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recurrence">Recurrence</Label>
              <Select
                value={form.recurrence}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, recurrence: v as RentBillRecurrence }))
                }
              >
                <SelectTrigger id="recurrence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Reference number, provider, etc."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">{isEdit ? "Save changes" : "Add deadline"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type CandidateTx = {
  id: string;
  occurred_on: string;
  amount: number;
  description: string;
  merchant: string | null;
  categories: { name: string } | null;
};

const BILL_CATEGORIES = ["rent & housing", "utilities"];

function useCandidateTransactions() {
  return useQuery({
    queryKey: ["bill_candidate_tx"],
    queryFn: async (): Promise<CandidateTx[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 120);
      const { data, error } = await supabase
        .from("transactions")
        .select("id,occurred_on,amount,description,merchant,categories(name)")
        .eq("direction", "out")
        .gte("occurred_on", since.toISOString().slice(0, 10))
        .order("occurred_on", { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as unknown as CandidateTx[]).filter((t) =>
        BILL_CATEGORIES.includes((t.categories?.name ?? "").toLowerCase()),
      );
    },
  });
}

function RentBillsPage() {
  const { data: bills = [], isLoading, error } = useRentBills();
  const { data: candidateTx = [] } = useCandidateTransactions();
  const { data: categories = [] } = useCategories();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DbRentBill | undefined>();
  const [payingBill, setPayingBill] = useState<DbRentBill | undefined>();

  const addMutation = useMutation({
    mutationFn: async (values: FormState) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("rent_bills").insert({
        user_id: userData.user.id,
        title: values.title,
        amount: Number(values.amount),
        due_date: values.due_date,
        recurrence: values.recurrence,
        notes: values.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rent_bills"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: FormState }) => {
      const { error } = await supabase
        .from("rent_bills")
        .update({
          title: values.title,
          amount: Number(values.amount),
          due_date: values.due_date,
          recurrence: values.recurrence,
          notes: values.notes || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rent_bills"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rent_bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rent_bills"] }),
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["rent_bills"] });
    queryClient.invalidateQueries({ queryKey: ["bill_candidate_tx"] });
    queryClient.invalidateQueries({ queryKey: ["transactions"] });
  };

  const markPaidMutation = useMutation({
    mutationFn: async ({ bill, tx, create }: { bill: DbRentBill; tx?: CandidateTx; create?: boolean }) => {
      const seriesId = bill.series_id ?? bill.id;
      let txId: string | null = tx?.id ?? null;
      let paidAt = tx ? new Date(tx.occurred_on + "T12:00:00").toISOString() : new Date().toISOString();

      if (create) {
        const userId = bill.user_id;
        const accountId = await ensureDefaultAccountId(userId);
        const wantUtil = !/rent|housing|accommodation/i.test(bill.title);
        const cat = categories.find((c) =>
          wantUtil ? c.name.toLowerCase() === "utilities" : c.name.toLowerCase() === "rent & housing",
        );
        const today = new Date();
        const occurred = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const { data: created, error: txErr } = await supabase
          .from("transactions")
          .insert({
            user_id: userId,
            account_id: accountId,
            category_id: cat?.id ?? null,
            occurred_on: occurred,
            amount: Number(bill.amount),
            direction: "out",
            description: bill.title,
            merchant: bill.title,
            behaviour: "necessary",
            needs_review: false,
            source: "manual",
          })
          .select("id")
          .single();
        if (txErr) throw txErr;
        txId = created.id;
        paidAt = new Date().toISOString();
      }

      const { error: updErr } = await supabase
        .from("rent_bills")
        .update({ status: "paid", paid_at: paidAt, series_id: seriesId, transaction_id: txId })
        .eq("id", bill.id);
      if (updErr) throw updErr;

      if (bill.recurrence === "one-off") return;

      const { data: later } = await supabase
        .from("rent_bills")
        .select("id")
        .eq("series_id", seriesId)
        .eq("status", "pending")
        .gt("due_date", bill.due_date)
        .limit(1);
      if ((later ?? []).length > 0) return;

      const nextDue = addRecurrence(bill.due_date, bill.recurrence);
      const { error: insErr } = await supabase.from("rent_bills").insert({
        user_id: bill.user_id,
        title: bill.title,
        amount: bill.amount,
        due_date: nextDue,
        recurrence: bill.recurrence,
        status: "pending",
        notes: bill.notes,
        series_id: seriesId,
      });
      if (insErr) throw insErr;
    },
    onSuccess: invalidateAll,
  });

  const addFromTxMutation = useMutation({
    mutationFn: async (t: CandidateTx) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("rent_bills").insert({
        user_id: userData.user.id,
        title: t.categories?.name === "Utilities" ? (t.merchant || t.description) : "Rent",
        amount: Math.abs(Number(t.amount)),
        due_date: t.occurred_on,
        recurrence: "one-off",
        status: "paid",
        paid_at: new Date(t.occurred_on + "T12:00:00").toISOString(),
        transaction_id: t.id,
        notes: t.merchant || t.description,
      });
      if (error) throw error;
    },
    onSuccess: invalidateAll,
  });

  const handleSave = (values: FormState) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, values }, { onSuccess: () => setEditing(undefined) });
    } else {
      addMutation.mutate(values, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const pending = bills.filter((b) => b.status === "pending");
  const history = bills
    .filter((b) => b.status === "paid")
    .sort((a, b) => (b.paid_at ?? "").localeCompare(a.paid_at ?? ""));

  const linkedIds = new Set(bills.map((b) => b.transaction_id).filter(Boolean) as string[]);
  const freeTx = candidateTx.filter((t) => !linkedIds.has(t.id));
  const isMatch = (bill: DbRentBill, t: CandidateTx) => {
    if (Math.abs(Math.abs(Number(t.amount)) - Number(bill.amount)) > 0.01) return false;
    const diff = Math.abs(parseLocalDate(t.occurred_on).getTime() - parseLocalDate(bill.due_date).getTime());
    return diff <= 7 * 86400000;
  };
  // Each transaction suggested for at most one bill
  const suggestions = new Map<string, CandidateTx>();
  const used = new Set<string>();
  for (const b of pending) {
    const m = freeTx.find((t) => !used.has(t.id) && isMatch(b, t));
    if (m) {
      suggestions.set(b.id, m);
      used.add(m.id);
    }
  }
  const suggestionFor = (b: DbRentBill) => suggestions.get(b.id);
  const candidatesFor = (b: DbRentBill) =>
    [...freeTx].sort((x, y) => Number(isMatch(b, y)) - Number(isMatch(b, x)));
  const unlogged = freeTx.filter((t) => !used.has(t.id));

  return (
    <AppShell
      header={
        <PageHeader
          title="Rent & Bills"
          description="Deadlines and payment history, separate from your spending feed."
          actions={
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add deadline
                </Button>
              </DialogTrigger>
              <BillDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSave={handleSave}
              />
            </Dialog>
          }
        />
      }
    >
      <div className="space-y-8">
        {isLoading && (
          <div className="surface-card p-8 text-center text-muted-foreground">Loading…</div>
        )}

        {!isLoading && error && (
          <div className="surface-card p-8 text-center text-negative">
            Could not load rent bills.
          </div>
        )}

        {!isLoading && !error && bills.length === 0 && (
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="No rent or bills yet"
            description="Add your first deadline to start tracking housing and utility payments."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add deadline
              </Button>
            }
          />
        )}

        {!isLoading && !error && bills.length > 0 && (
          <>
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Upcoming deadlines
              </h2>
              {pending.length === 0 ? (
                <div className="surface-card p-6 text-sm text-muted-foreground">
                  No pending deadlines. Great job keeping up.
                </div>
              ) : (
                <div className="space-y-2">
                  {pending.map((bill) => {
                    const rel = relativeDueLabel(bill.due_date);
                    return (
                      <div
                        key={bill.id}
                        className={cn(
                          "surface-card flex items-center justify-between gap-4 p-4",
                          rel.overdue && "border-warning/30 bg-warning-soft/30",
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{bill.title}</p>
                            <StatusPill tone={rel.overdue ? "warning" : "neutral"}>
                              {rel.text}
                            </StatusPill>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{formatMoney(bill.amount)}</span>
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {formatDate(bill.due_date)}
                            </span>
                            <span>{RECURRENCE_LABELS[bill.recurrence]}</span>
                          </div>
                          {bill.notes && (
                            <p className="text-xs text-muted-foreground">{bill.notes}</p>
                          )}
                          {(() => {
                            const m = suggestionFor(bill);
                            if (!m) return null;
                            return (
                              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-positive-soft/40 px-2 py-1.5 text-xs">
                                <span>
                                  Possible payment found: {m.merchant || m.description},{" "}
                                  {formatDate(m.occurred_on)}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => markPaidMutation.mutate({ bill, tx: m })}
                                  disabled={markPaidMutation.isPending}
                                >
                                  Confirm
                                </Button>
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(bill)}
                            aria-label="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label="Delete">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete deadline?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes “{bill.title}” and its history entry if paid.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(bill.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            variant={rel.overdue ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPayingBill(bill)}
                            disabled={markPaidMutation.isPending}
                          >
                            <Check className="mr-1.5 h-4 w-4" />
                            Mark paid
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Payment history
              </h2>
              {history.length === 0 ? (
                <div className="surface-card p-6 text-sm text-muted-foreground">
                  No paid entries yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((bill) => (
                    <div
                      key={bill.id}
                      className="surface-card flex items-center justify-between gap-4 p-4 opacity-80"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">{bill.title}</p>
                          <StatusPill tone="positive">Paid</StatusPill>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span>{formatMoney(bill.amount)}</span>
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            Due {formatDate(bill.due_date)}
                          </span>
                          {bill.paid_at && (
                            <span>Paid {formatDate(bill.paid_at.slice(0, 10))}</span>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete history entry?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This removes the paid record for “{bill.title}”.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(bill.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {!isLoading && unlogged.length > 0 && (
          <section>
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Payments found in transactions
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Rent & utility payments from your transactions that aren't on this page yet.
            </p>
            <div className="space-y-2">
              {unlogged.map((t) => (
                <div key={t.id} className="surface-card flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate font-medium">{t.merchant || t.description}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatMoney(Math.abs(Number(t.amount)))}</span>
                      <span>{formatDate(t.occurred_on)}</span>
                      <span>{t.categories?.name}</span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addFromTxMutation.mutate(t)}
                    disabled={addFromTxMutation.isPending}
                  >
                    <Link2 className="mr-1.5 h-4 w-4" />
                    Add to history
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {editing && (
        <BillDialog
          bill={editing}
          open={!!editing}
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
          onSave={handleSave}
        />
      )}

      <Dialog open={!!payingBill} onOpenChange={(o) => !o && setPayingBill(undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark “{payingBill?.title}” as paid</DialogTitle>
            <DialogDescription>
              Link a transaction you've already uploaded, or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto py-2">
            {payingBill && candidatesFor(payingBill).length === 0 && (
              <p className="text-sm text-muted-foreground">No rent or utility transactions available to link.</p>
            )}
            {payingBill &&
              candidatesFor(payingBill).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    markPaidMutation.mutate({ bill: payingBill, tx: t });
                    setPayingBill(undefined);
                  }}
                  className="surface-card flex w-full items-center justify-between gap-3 p-3 text-left hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.merchant || t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(t.occurred_on)} · {t.categories?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isMatch(payingBill, t) && <StatusPill tone="positive">Match</StatusPill>}
                    <span className="text-sm">{formatMoney(Math.abs(Number(t.amount)))}</span>
                  </div>
                </button>
              ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => {
                if (payingBill) markPaidMutation.mutate({ bill: payingBill });
                setPayingBill(undefined);
              }}
            >
              Just mark paid
            </Button>
            <Button
              onClick={() => {
                if (payingBill) markPaidMutation.mutate({ bill: payingBill, create: true });
                setPayingBill(undefined);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

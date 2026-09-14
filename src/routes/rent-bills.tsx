import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Pencil, Trash2, Check, CalendarDays, X } from "lucide-react";
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
import { useRentBills } from "@/lib/db";
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

function RentBillsPage() {
  const { data: bills = [], isLoading, error } = useRentBills();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DbRentBill | undefined>();

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

  const markPaidMutation = useMutation({
    mutationFn: async (bill: DbRentBill) => {
      const seriesId = bill.series_id ?? bill.id;
      const { error: updErr } = await supabase
        .from("rent_bills")
        .update({ status: "paid", paid_at: new Date().toISOString(), series_id: seriesId })
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rent_bills"] }),
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
                            onClick={() => markPaidMutation.mutate(bill)}
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
    </AppShell>
  );
}

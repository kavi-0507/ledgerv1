import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Plus, ShieldCheck, Trash2, WifiOff } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonRow } from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { API_BASE_URL, api } from "@/lib/api";
import type { Categories, MerchantRule, Reminder } from "@/lib/types";
import { humanize } from "@/lib/format";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <AppShell
      header={
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Settings
          </p>
          <h1 className="truncate text-display text-xl sm:text-2xl">Preferences & rules</h1>
        </div>
      }
    >
      <PageHeader
        eyebrow="Settings"
        title="Set your rules once."
        description="Manage merchant rules, reminders and how the app connects to your local backend."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConnectionCard />
        <PreferencesCard />
        <MerchantRulesCard />
        <RemindersCard />
        <PrivacyCard />
      </div>
    </AppShell>
  );
}

/* -------- Connection -------- */
function ConnectionCard() {
  const q = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<{ status?: string; database?: string }>("/health"),
    retry: 0,
    refetchInterval: 30_000,
  });

  const ok = !!q.data && q.data.status === "ok";

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={
            ok
              ? "grid h-10 w-10 place-items-center rounded-md bg-positive-soft text-positive"
              : "grid h-10 w-10 place-items-center rounded-md bg-negative-soft text-negative"
          }
        >
          {ok ? <CheckCircle2 className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            API connection
          </p>
          <h2 className="text-display text-2xl">
            {q.isLoading ? "Checking…" : ok ? "Connected" : "Not reachable"}
          </h2>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Base URL: <span className="font-medium text-foreground">{API_BASE_URL}</span>
      </p>
      {q.data && (
        <p className="mt-1 text-sm text-muted-foreground">
          Database: <span className="font-medium text-foreground">{q.data.database ?? "—"}</span>
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="outline" size="sm" onClick={() => q.refetch()}>
          Test connection
        </Button>
      </div>
    </div>
  );
}

/* -------- Preferences (limited by API) -------- */
function PreferencesCard() {
  return (
    <div className="surface-card p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        Preferences
      </p>
      <h2 className="text-display text-2xl">App behaviour</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The backend hasn't exposed a preferences endpoint yet, so these are visibly disabled.
      </p>
      <div className="mt-4 space-y-3">
        <DisabledPref label="Currency" hint="No settings endpoint in the API." />
        <DisabledPref label="Default spending mode" hint="No settings endpoint in the API." />
        <DisabledPref label="Notifications" hint="Reminders are managed under Review." />
      </div>
    </div>
  );
}

function DisabledPref({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 p-3">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <StatusPill tone="neutral">Unavailable</StatusPill>
    </div>
  );
}

/* -------- Merchant rules -------- */
function MerchantRulesCard() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ["merchant-rules"],
    queryFn: () =>
      api.get<{ items?: MerchantRule[]; rules?: MerchantRule[] } | MerchantRule[]>("/merchant-rules"),
    retry: 1,
  });

  const rules: MerchantRule[] = Array.isArray(q.data)
    ? q.data
    : ((q.data as { items?: MerchantRule[]; rules?: MerchantRule[] } | undefined)?.items ??
       (q.data as { items?: MerchantRule[]; rules?: MerchantRule[] } | undefined)?.rules ??
       []);

  const deleteM = useMutation({
    mutationFn: (id: number) => api.del(`/merchant-rules/${id}`),
    onSuccess: () => {
      toast.success("Rule deleted");
      qc.invalidateQueries({ queryKey: ["merchant-rules"] });
    },
    onError: (e: Error) => toast.error("Couldn't delete", { description: e.message }),
  });

  return (
    <div className="surface-card p-5 sm:p-6 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Merchant rules
          </p>
          <h2 className="text-display text-2xl">Auto-categorisation</h2>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New rule
        </Button>
      </div>

      <QueryBoundary
        isLoading={q.isLoading}
        isError={q.isError}
        error={q.error}
        onRetry={() => q.refetch()}
        loading={<><SkeletonRow /><SkeletonRow /></>}
      >
        {rules.length === 0 ? (
          <EmptyState
            title="No merchant rules yet"
            description="Rules match a text pattern and set a category and behaviour automatically."
            action={<Button onClick={() => setCreating(true)}>Create rule</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rules.map((r) => (
              <li
                key={r.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.pattern}</p>
                  <p className="text-xs text-muted-foreground">
                    → {humanize(r.category)}
                    {r.behaviour ? ` · ${humanize(r.behaviour)}` : ""}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Existing transactions won't change.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteM.mutate(r.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>

      <CreateRuleDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function CreateRuleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const catsQ = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Categories>("/categories"),
  });
  const categories: string[] = (() => {
    const raw = catsQ.data?.categories ?? [];
    return Array.isArray(raw)
      ? raw.map((c) => (typeof c === "string" ? c : (c?.name ?? ""))).filter(Boolean)
      : [];
  })();

  const [pattern, setPattern] = useState("");
  const [category, setCategory] = useState("");
  const [behaviour, setBehaviour] = useState("");

  const m = useMutation({
    mutationFn: () =>
      api.post("/merchant-rules", {
        pattern: pattern.toUpperCase(),
        category,
        behaviour: behaviour || undefined,
      }),
    onSuccess: () => {
      toast.success("Rule created");
      qc.invalidateQueries({ queryKey: ["merchant-rules"] });
      setPattern("");
      setCategory("");
      setBehaviour("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error("Couldn't create rule", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New merchant rule</DialogTitle>
          <DialogDescription>
            When a transaction description matches the pattern, this category is applied automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Pattern</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="FICTIONAL CAFE"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input
              list="ds-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Groceries"
            />
            <datalist id="ds-cat">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label>Behaviour (optional)</Label>
            <Input
              value={behaviour}
              onChange={(e) => setBehaviour(e.target.value)}
              placeholder="Necessary"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!pattern || !category || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Creating…" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Reminders -------- */
function RemindersCard() {
  const q = useQuery({
    queryKey: ["reminders"],
    queryFn: () => api.get<{ items?: Reminder[]; reminders?: Reminder[] } | Reminder[]>("/reminders"),
    retry: 1,
  });
  const reminders: Reminder[] = Array.isArray(q.data)
    ? q.data
    : ((q.data as { items?: Reminder[]; reminders?: Reminder[] } | undefined)?.items ??
       (q.data as { items?: Reminder[]; reminders?: Reminder[] } | undefined)?.reminders ??
       []);

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Reminder settings
          </p>
          <h2 className="text-display text-2xl">Manage from Review</h2>
        </div>
        <StatusPill tone="info">{reminders.length} active</StatusPill>
      </div>
      <p className="text-sm text-muted-foreground">
        The API supports updating, snoozing and dismissing reminders. Do this from the Review page.
      </p>
      <div className="mt-4">
        <a href="/review" className="text-sm font-medium text-primary hover:underline">
          Open Review →
        </a>
      </div>
    </div>
  );
}

/* -------- Privacy -------- */
function PrivacyCard() {
  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Data & privacy
          </p>
          <h2 className="text-display text-2xl">Your data stays local</h2>
        </div>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>· All data lives in your local SQLite database.</li>
        <li>· CSV files are processed in memory and never retained.</li>
        <li>· PDF import is experimental and disabled in the normal workflow.</li>
      </ul>
    </div>
  );
}

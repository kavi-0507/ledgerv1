import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { LogOut, Plus, ShieldCheck, Tag, Trash2, UserRound } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonRow } from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useCategories, useMerchantRules, useProfile } from "@/lib/db";
import { categoryIcon } from "@/lib/categories";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  return (
    <AppShell header={<h1 className="truncate text-display text-xl sm:text-2xl">Settings</h1>}>
      <PageHeader eyebrow="Settings" title="Preferences & rules." description="Manage your session, merchant rules and account." />
      <div className="grid gap-6 lg:grid-cols-2">
        <SessionCard />
        <ProfileCard />
        <CategoriesCard />
        <MerchantRulesCard />
        <PrivacyCard />
      </div>
    </AppShell>
  );
}

function SessionCard() {
  const { user, signOut } = useAuth();
  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-positive-soft text-positive"><UserRound className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Session</p>
          <h2 className="text-display text-2xl">Signed in</h2>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Email: <span className="font-medium text-foreground">{user?.email ?? "—"}</span></p>
      <p className="mt-1 text-sm text-muted-foreground">User ID: <span className="font-mono text-xs">{user?.id ?? "—"}</span></p>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={() => signOut()}><LogOut className="mr-1.5 h-4 w-4" />Sign out</Button>
      </div>
    </div>
  );
}

function ProfileCard() {
  const qc = useQueryClient();
  const profileQ = useProfile();
  const [displayName, setDisplayName] = useState<string>("");
  const [currency, setCurrency] = useState<string>("GBP");
  const [hydrated, setHydrated] = useState(false);

  if (profileQ.data && !hydrated) {
    setDisplayName(profileQ.data.display_name ?? "");
    setCurrency(profileQ.data.currency ?? "GBP");
    setHydrated(true);
  }


  const save = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").upsert({
        id: userData.user.id, display_name: displayName || null, currency,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["profile"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="surface-card p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Profile</p>
      <h2 className="text-display text-2xl">Preferences</h2>
      <div className="mt-4 grid gap-3">
        <div className="space-y-1.5">
          <Label>Display name</Label>
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={profileQ.data?.display_name ?? "Your name"} />
        </div>
        <div className="space-y-1.5">
          <Label>Currency</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GBP">GBP · £</SelectItem>
              <SelectItem value="USD">USD · $</SelectItem>
              <SelectItem value="EUR">EUR · €</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Display only — amounts are stored numerically.</p>
        </div>
        <div>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save profile</Button>
        </div>
      </div>
    </div>
  );
}

function MerchantRulesCard() {
  const qc = useQueryClient();
  const q = useMerchantRules();
  const catsQ = useCategories();
  const [creating, setCreating] = useState(false);
  const rules = q.data ?? [];

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rule deleted"); qc.invalidateQueries({ queryKey: ["merchant_rules"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="surface-card p-5 sm:p-6 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Merchant rules</p>
          <h2 className="text-display text-2xl">Auto-categorisation</h2>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="mr-1.5 h-4 w-4" />New rule</Button>
      </div>
      <QueryBoundary
        isLoading={q.isLoading} isError={q.isError} error={q.error}
        onRetry={() => q.refetch()} loading={<><SkeletonRow /><SkeletonRow /></>}
      >
        {rules.length === 0 ? (
          <EmptyState
            title="No merchant rules yet"
            description="Rules match a text pattern and set a category automatically on import."
            action={<Button onClick={() => setCreating(true)}>Create rule</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rules.map(r => {
              const cat = (catsQ.data ?? []).find(c => c.id === r.category_id);
              return (
                <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium font-mono text-sm">{r.pattern}</p>
                    <p className="text-xs text-muted-foreground">→ {cat?.name ?? "Uncategorised"}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
                        <AlertDialogDescription>Existing transactions won't change.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteM.mutate(r.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </li>
              );
            })}
          </ul>
        )}
      </QueryBoundary>
      <CreateRuleDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}

function CreateRuleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const catsQ = useCategories();
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const m = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const { error } = await supabase.from("merchant_rules").insert({
        user_id: userData.user.id, pattern, category_id: categoryId || null, is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rule created");
      qc.invalidateQueries({ queryKey: ["merchant_rules"] });
      setPattern(""); setCategoryId(""); onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New merchant rule</DialogTitle>
          <DialogDescription>When a description matches (case-insensitive), the chosen category is applied on import.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2"><Label>Pattern (text or regex)</Label><Input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="starbucks" /></div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
              <SelectContent>{(catsQ.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!pattern || !categoryId || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "Creating…" : "Create rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrivacyCard() {
  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft text-primary"><ShieldCheck className="h-4 w-4" /></span>
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Data & privacy</p>
          <h2 className="text-display text-2xl">Your data</h2>
        </div>
      </div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        <li>· Data is stored in Supabase and protected by Row-Level Security.</li>
        <li>· Only your account can read or write your rows.</li>
        <li>· CSV files are parsed in your browser and never uploaded raw.</li>
        <li>· PDF import is not supported in this build.</li>
      </ul>
    </div>
  );
}

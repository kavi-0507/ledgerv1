import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileWarning, Sparkles, Trash2, Upload } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonRow } from "@/components/ds/Skeletons";
import { CategorySelect } from "@/components/ds/CategorySelect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { useImports, useMerchantRules, useCategories, ensureDefaultAccountId } from "@/lib/db";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { categorizeBatch, type MerchantGroup, type CatState } from "@/lib/merchantCategorizer";

export const Route = createFileRoute("/import")({ component: ImportPage });

type ParsedRow = {
  occurred_on: string;
  description: string;
  amount: number;              // absolute
  direction: "in" | "out";
  signedAmount: number;        // signed (for grouping)
  external_hash: string;
  raw: Record<string, string>;
  reason?: string;
};

type Preview = {
  filename: string;
  new_rows: ParsedRow[];
  exact_duplicates: ParsedRow[];
  possible_duplicates: ParsedRow[];
  invalid_rows: (ParsedRow & { reason: string })[];
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.length > 0);
  if (lines.length === 0) return [];
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === ",") { out.push(cur); cur = ""; }
        else if (ch === '"') inQ = true;
        else cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const header = parseLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(l => {
    const values = parseLine(l);
    const row: Record<string, string> = {};
    header.forEach((h, i) => row[h] = (values[i] ?? "").trim());
    return row;
  });
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) if (row[k]) return row[k];
  return "";
}

function normalizeDate(s: string): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

type Step = "upload" | "categorise";

function ImportPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const historyQ = useImports();
  const rulesQ = useMerchantRules();
  const catsQ = useCategories();

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast.error("CSV only", { description: "PDF import is disabled." });
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data: existing } = await supabase.from("transactions").select("description,amount,occurred_on,direction");
      const existingFuzzy = (existing ?? []) as any[];
      const existingHashes = new Set<string>();
      for (const e of existingFuzzy) {
        existingHashes.add(`${e.occurred_on}|${(e.description ?? "").toLowerCase()}|${Number(e.amount)}|${e.direction}`);
      }

      const parsed: (ParsedRow & { reason?: string })[] = [];
      for (const r of rows) {
        const dateRaw = pick(r, ["date", "occurred_on", "transaction date", "posting date"]);
        const desc = pick(r, ["description", "details", "narrative", "memo", "merchant"]);
        const amtStr = pick(r, ["amount", "value", "debit", "credit"]);
        const occurred_on = normalizeDate(dateRaw);
        const amt = Number(amtStr.replace(/[,£$€\s]/g, ""));
        if (!occurred_on || !desc || !Number.isFinite(amt) || amt === 0) {
          parsed.push({
            occurred_on: dateRaw, description: desc, amount: amt, signedAmount: amt,
            direction: "out", external_hash: "", raw: r, reason: "Missing date, description or amount",
          });
          continue;
        }
        // Positive amount = credit/in, negative = debit/out (per requirements)
        const direction: "in" | "out" = amt >= 0 ? "in" : "out";
        const abs = Math.abs(amt);
        const hash = `${occurred_on}|${desc.trim().toLowerCase()}|${abs}|${direction}`;
        parsed.push({
          occurred_on, description: desc.trim(), amount: abs, signedAmount: amt,
          direction, external_hash: hash, raw: r,
        });
      }

      const invalid = parsed.filter(p => p.reason);
      const valid = parsed.filter(p => !p.reason);
      const exact: ParsedRow[] = [];
      const possible: ParsedRow[] = [];
      const news: ParsedRow[] = [];
      const seenInBatch = new Set<string>();
      for (const p of valid) {
        if (existingHashes.has(p.external_hash) || seenInBatch.has(p.external_hash)) {
          exact.push(p);
        } else {
          const near = existingFuzzy.find(x => Math.abs(Number(x.amount) - p.amount) < 0.01 &&
            Math.abs(new Date(x.occurred_on).getTime() - new Date(p.occurred_on).getTime()) < 3 * 86400_000);
          if (near) possible.push(p);
          else news.push(p);
          seenInBatch.add(p.external_hash);
        }
      }

      setFilename(file.name);
      setPreview({ filename: file.name, new_rows: news, exact_duplicates: exact, possible_duplicates: possible, invalid_rows: invalid as any });
      setStep("upload");
      toast.success("Preview ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  const p = preview;
  const history = historyQ.data ?? [];

  return (
    <AppShell
      header={<h1 className="truncate text-display text-xl sm:text-2xl">CSV import</h1>}
    >
      <PageHeader eyebrow="Import" title="Bring your data in." description="Upload a CSV — duplicates are flagged, merchants grouped, and only exceptions need your attention." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {step === "upload" && (
            <div className="surface-card p-6">
              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-display text-2xl">Upload a CSV</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Files are parsed in your browser and never uploaded raw.</p>
                </div>
                <div className="flex gap-2">
                  <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={onFileChange} className="hidden" />
                  <Button onClick={() => fileInput.current?.click()} disabled={busy}>
                    <Upload className="mr-1.5 h-4 w-4" />{busy ? "Reading…" : "Choose CSV"}
                  </Button>
                </div>
              </div>
              {filename && <p className="mt-4 text-sm text-muted-foreground">Selected: <span className="font-medium text-foreground">{filename}</span></p>}
              {catsQ.data && catsQ.data.length === 0 && (
                <p className="mt-3 text-xs text-warning">No categories yet — auto-categorisation will be blank.</p>
              )}
            </div>
          )}

          {p && step === "upload" && (
            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
                  <h2 className="text-display text-2xl">Before you categorise</h2>
                </div>
                <StatusPill tone="info">{p.filename}</StatusPill>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PreviewCount label="New rows" tone="positive" count={p.new_rows.length} />
                <PreviewCount label="Exact duplicates" tone="neutral" count={p.exact_duplicates.length} />
                <PreviewCount label="Possible duplicates" tone="warning" count={p.possible_duplicates.length} />
                <PreviewCount label="Invalid rows" tone="negative" count={p.invalid_rows.length} />
              </div>

              {p.possible_duplicates.length > 0 && <PreviewRows title="Possible duplicates" icon={<FileWarning className="h-4 w-4" />} rows={p.possible_duplicates} />}
              {p.invalid_rows.length > 0 && <PreviewRows title="Invalid rows" icon={<AlertTriangle className="h-4 w-4" />} rows={p.invalid_rows} />}

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => { setPreview(null); setFilename(""); if (fileInput.current) fileInput.current.value = ""; }}>Discard</Button>
                <Button
                  disabled={p.new_rows.length + p.possible_duplicates.length === 0}
                  onClick={() => setStep("categorise")}
                >
                  <Sparkles className="mr-1.5 h-4 w-4" />
                  Review categorisation
                </Button>
              </div>
            </div>
          )}

          {p && step === "categorise" && (
            <CategoriseStep
              preview={p}
              categories={catsQ.data ?? []}
              rules={(rulesQ.data ?? []).map(r => ({ pattern: r.pattern, category_id: r.category_id }))}
              onBack={() => setStep("upload")}
              onDone={() => {
                setPreview(null); setFilename(""); setStep("upload");
                if (fileInput.current) fileInput.current.value = "";
                qc.invalidateQueries({ queryKey: ["imports"] });
                qc.invalidateQueries({ queryKey: ["transactions"] });
                qc.invalidateQueries({ queryKey: ["home_month_tx"] });
                qc.invalidateQueries({ queryKey: ["merchant_rules"] });
              }}
            />
          )}
        </div>

        <div className="surface-card p-5 sm:p-6">
          <h2 className="text-display text-2xl">Import history</h2>
          <p className="mt-1 text-sm text-muted-foreground">Delete a batch to remove all its transactions.</p>
          <QueryBoundary
            isLoading={historyQ.isLoading} isError={historyQ.isError} error={historyQ.error}
            onRetry={() => historyQ.refetch()}
            loading={<div className="mt-4"><SkeletonRow /><SkeletonRow /></div>}
          >
            {history.length === 0 ? (
              <EmptyState icon={<Upload className="h-5 w-5" />} title="No imports yet" description="Upload your first CSV to see history here." />
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {history.map(h => (
                  <li key={h.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{h.filename ?? "Batch"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.created_at)}
                        {h.imported_rows != null ? ` · ${h.imported_rows} imported` : ""}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this import batch?</AlertDialogTitle>
                          <AlertDialogDescription>All transactions from this batch will be removed. This can't be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => {
                            const { error } = await supabase.from("imports").delete().eq("id", h.id);
                            if (error) toast.error(error.message);
                            else { toast.success("Import removed"); qc.invalidateQueries({ queryKey: ["imports"] }); }
                          }}>Delete batch</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </li>
                ))}
              </ul>
            )}
          </QueryBoundary>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------- Categorise step ---------------- */

type GroupEdit = {
  categoryId: string | null;
  state: CatState;             // effective state after user edits
  saveAsRule: boolean;
  accepted: boolean;           // only meaningful for suggested
};

function CategoriseStep({
  preview, categories, rules, onBack, onDone,
}: {
  preview: Preview;
  categories: { id: string; name: string }[];
  rules: { pattern: string; category_id: string | null }[];
  onBack: () => void;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  // Rows to import = new + possible duplicates (matching original behaviour)
  const rowsToImport = useMemo(
    () => [...preview.new_rows, ...preview.possible_duplicates],
    [preview],
  );

  const groups: MerchantGroup[] = useMemo(
    () => categorizeBatch(
      rowsToImport.map(r => ({
        occurred_on: r.occurred_on,
        description: r.description,
        signedAmount: r.signedAmount,
      })),
      categories,
      rules,
    ),
    [rowsToImport, categories, rules],
  );

  // Per-group edit state, seeded from suggestions
  const [edits, setEdits] = useState<Record<string, GroupEdit>>(() => {
    const m: Record<string, GroupEdit> = {};
    for (const g of groups) {
      m[g.key] = {
        categoryId: g.suggestion.categoryId,
        state: g.suggestion.state,
        saveAsRule: false,
        accepted: g.suggestion.state === "auto_applied",
      };
    }
    return m;
  });

  const counts = useMemo(() => {
    let auto = 0, suggested = 0, manual = 0;
    for (const g of groups) {
      const e = edits[g.key];
      if (!e) continue;
      // Effective state: if user picked a category and accepted/high, auto; if suggested & accepted, auto; if no cat, manual
      if (!e.categoryId) manual += g.rows.length;
      else if (e.accepted || g.suggestion.state === "auto_applied") auto += g.rows.length;
      else suggested += g.rows.length;
    }
    return { auto, suggested, manual };
  }, [groups, edits]);

  const confirmM = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;
      const accountId = await ensureDefaultAccountId(userId);

      // Build row payload from group decisions
      const rowDecisions = new Map<number, { categoryId: string | null; needsReview: boolean; merchant: string }>();
      for (const g of groups) {
        const e = edits[g.key];
        if (!e) continue;
        const catId = e.categoryId;
        // needs_review true when: manual (no cat), or suggested-but-not-accepted, or mixed-signs credits
        const needsReview =
          !catId ||
          (g.suggestion.state === "suggested" && !e.accepted) ||
          (g.suggestion.state === "manual_review");
        for (const r of g.rows) {
          rowDecisions.set(r.index, { categoryId: catId, needsReview, merchant: g.merchant });
        }
      }

      const toInsert = rowsToImport.map((r, i) => {
        const d = rowDecisions.get(i) ?? { categoryId: null, needsReview: true, merchant: r.description };
        return {
          user_id: userId,
          account_id: accountId,
          occurred_on: r.occurred_on,
          merchant: d.merchant,
          description: r.description,
          amount: r.amount,
          direction: r.direction,
          category_id: d.categoryId,
          needs_review: d.needsReview,
          source: "import",
          external_hash: r.external_hash,
        };
      });

      if (toInsert.length > 0) {
        const { error } = await supabase.from("transactions").insert(toInsert);
        if (error) throw error;
      }

      // Create merchant rules for groups where user opted in
      const rulesToInsert: any[] = [];
      for (const g of groups) {
        const e = edits[g.key];
        if (!e || !e.saveAsRule || !e.categoryId) continue;
        // Escape regex specials
        const escaped = g.merchant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        rulesToInsert.push({
          user_id: userId,
          pattern: escaped,
          category_id: e.categoryId,
          is_active: true,
        });
      }
      if (rulesToInsert.length > 0) {
        const { error } = await supabase.from("merchant_rules").insert(rulesToInsert);
        if (error) throw error;
      }

      const { error: impErr } = await supabase.from("imports").insert({
        user_id: userId, filename: preview.filename, status: "committed",
        total_rows: preview.new_rows.length + preview.exact_duplicates.length + preview.possible_duplicates.length + preview.invalid_rows.length,
        new_rows: preview.new_rows.length,
        duplicate_rows: preview.exact_duplicates.length + preview.possible_duplicates.length,
        invalid_rows: preview.invalid_rows.length,
        imported_rows: toInsert.length,
        committed_at: new Date().toISOString(),
      });
      if (impErr) throw impErr;
    },
    onSuccess: () => { toast.success("Import confirmed"); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Split groups by state for display buckets
  const manual = groups.filter(g => (edits[g.key]?.categoryId ?? null) === null);
  const suggested = groups.filter(g => edits[g.key]?.categoryId && g.suggestion.state !== "auto_applied" && !edits[g.key]?.accepted);
  const auto = groups.filter(g => edits[g.key]?.categoryId && (g.suggestion.state === "auto_applied" || edits[g.key]?.accepted));

  return (
    <div className="surface-card p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Step 2 · Review merchants</p>
          <h2 className="text-display text-2xl">Confirm categorisation</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {groups.length} merchant group{groups.length === 1 ? "" : "s"} from {rowsToImport.length} transactions.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />Back
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CountTile label="Auto-applied" count={counts.auto} tone="positive" />
        <CountTile label="Awaiting approval" count={counts.suggested} tone="warning" />
        <CountTile label="Manual review" count={counts.manual} tone="neutral" />
      </div>

      {manual.length > 0 && (
        <GroupSection title="Manual review" description="No confident category — pick one or leave for later." icon={<AlertTriangle className="h-4 w-4" />}>
          {manual.map(g => (
            <MerchantCard key={g.key} g={g} edit={edits[g.key]} categories={categories}
              onChange={(patch) => setEdits(prev => ({ ...prev, [g.key]: { ...prev[g.key], ...patch } }))} />
          ))}
        </GroupSection>
      )}

      {suggested.length > 0 && (
        <GroupSection title="Suggestions to approve" description="Medium-confidence guesses — approve or change." icon={<Sparkles className="h-4 w-4" />}>
          {suggested.map(g => (
            <MerchantCard key={g.key} g={g} edit={edits[g.key]} categories={categories}
              onChange={(patch) => setEdits(prev => ({ ...prev, [g.key]: { ...prev[g.key], ...patch } }))} />
          ))}
        </GroupSection>
      )}

      {auto.length > 0 && (
        <GroupSection title="Auto-applied" description="High-confidence matches. Change anytime." icon={<CheckCircle2 className="h-4 w-4" />}>
          {auto.map(g => (
            <MerchantCard key={g.key} g={g} edit={edits[g.key]} categories={categories}
              onChange={(patch) => setEdits(prev => ({ ...prev, [g.key]: { ...prev[g.key], ...patch } }))} />
          ))}
        </GroupSection>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onBack}>Back</Button>
        <Button disabled={confirmM.isPending} onClick={() => confirmM.mutate()}>
          <CheckCircle2 className="mr-1.5 h-4 w-4" />
          {confirmM.isPending ? "Confirming…" : `Confirm ${rowsToImport.length} rows`}
        </Button>
      </div>
    </div>
  );
}

function GroupSection({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">{icon}{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-2">{children}</div>
    </div>
  );
}

function CountTile({ label, count, tone }: { label: string; count: number; tone: "positive" | "neutral" | "warning" | "negative" }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span data-numeric className="text-display text-2xl">{count}</span>
        <StatusPill tone={tone}>tx</StatusPill>
      </div>
    </div>
  );
}

function MerchantCard({
  g, edit, categories, onChange,
}: {
  g: MerchantGroup;
  edit: GroupEdit | undefined;
  categories: { id: string; name: string }[];
  onChange: (patch: Partial<GroupEdit>) => void;
}) {
  const [showTx, setShowTx] = useState(false);
  if (!edit) return null;
  const tone = g.suggestion.tier === "high" ? "positive" : g.suggestion.tier === "medium" ? "warning" : "neutral";
  const dirLabel = g.direction === "in" ? "Credit" : "Spend";
  const canAccept = !!edit.categoryId && g.suggestion.state === "suggested" && !edit.accepted;

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium truncate">{g.merchant}</p>
            <StatusPill tone={tone}>{g.suggestion.tier} · {Math.round(g.suggestion.confidence * 100)}%</StatusPill>
            {g.hasMixedSigns && <StatusPill tone="warning">mixed signs</StatusPill>}
            <span className="text-xs text-muted-foreground">
              {g.rows.length} tx · {dirLabel} {formatMoney(g.total)}
            </span>
          </div>
          {g.samples.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground truncate">e.g. {g.samples.join(" · ")}</p>
          )}
          {g.suggestion.reasons.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">{g.suggestion.reasons.join(" · ")}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 min-w-[220px]">
          <div className="w-full">
            <CategorySelect
              value={edit.categoryId ?? ""}
              onChange={(v) => onChange({ categoryId: v || null, accepted: !!v })}
              categories={categories}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canAccept && (
              <Button size="sm" variant="secondary" onClick={() => onChange({ accepted: true })}>
                Accept
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowTx(v => !v)}>
              {showTx ? "Hide" : "View"} tx
            </Button>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={edit.saveAsRule}
              onCheckedChange={(v) => onChange({ saveAsRule: !!v })}
              disabled={!edit.categoryId}
            />
            Save as future rule
          </label>
        </div>
      </div>

      {showTx && (
        <ul className="mt-3 divide-y divide-border rounded border border-border text-xs">
          {g.rows.map((r) => (
            <li key={r.index} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 px-2 py-1.5">
              <span className="text-muted-foreground">{r.occurred_on}</span>
              <span className="truncate">{r.description}</span>
              <span data-numeric className={r.direction === "in" ? "text-positive" : ""}>
                {r.direction === "in" ? "+" : "−"}{formatMoney(r.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- Preview helpers (unchanged) ---------------- */

function PreviewCount({ label, count, tone }: { label: string; count: number; tone: "positive" | "neutral" | "warning" | "negative" }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span data-numeric className="text-display text-3xl">{count}</span>
        <StatusPill tone={tone}>{humanize(tone)}</StatusPill>
      </div>
    </div>
  );
}

function PreviewRows({ title, icon, rows }: { title: string; icon: React.ReactNode; rows: (ParsedRow & { reason?: string })[] }) {
  return (
    <div className="mt-5">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">{icon} {title} · {rows.length}</p>
      <div className="max-h-60 overflow-auto rounded-lg border border-border">
        <ul className="divide-y divide-border text-sm">
          {rows.slice(0, 20).map((r, i) => (
            <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-3 py-2">
              <span className="text-muted-foreground">{r.occurred_on}</span>
              <span className="truncate">{r.description} {r.reason && <span className="text-warning">· {r.reason}</span>}</span>
              <span data-numeric className="text-muted-foreground">{r.amount}</span>
            </li>
          ))}
          {rows.length > 20 && <li className="px-3 py-2 text-xs text-muted-foreground">+ {rows.length - 20} more</li>}
        </ul>
      </div>
    </div>
  );
}

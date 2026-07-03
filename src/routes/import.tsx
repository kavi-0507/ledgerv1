import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileWarning, Trash2, Upload } from "lucide-react";

import { AppShell } from "@/components/ds/AppShell";
import { PageHeader } from "@/components/ds/PageHeader";
import { StatusPill } from "@/components/ds/StatusPill";
import { EmptyState } from "@/components/ds/EmptyState";
import { QueryBoundary } from "@/components/ds/QueryBoundary";
import { SkeletonRow } from "@/components/ds/Skeletons";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { useImportBatches, useMerchantRules, useCategories } from "@/lib/db";
import { formatDateTime, humanize } from "@/lib/format";

export const Route = createFileRoute("/import")({ component: ImportPage });

type ParsedRow = {
  occurred_on: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  dedupe_hash: string;
  category_id: string | null;
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

// tiny hash: sha256 hex via SubtleCrypto
async function sha256(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

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
  // dd/mm/yyyy
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

function ImportPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const historyQ = useImportBatches();
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

      // Existing rows for dedupe (compute hash client-side; column may not exist in DB)
      const { data: existing } = await supabase.from("transactions").select("description,amount,occurred_on,direction");
      const existingFuzzy = (existing ?? []) as any[];
      const existingHashes = new Set<string>();
      for (const e of existingFuzzy) {
        existingHashes.add(`${e.occurred_on}|${(e.description ?? "").toLowerCase()}|${Number(e.amount)}|${e.direction}`);
      }

      const rules = rulesQ.data ?? [];

      const parsed: (ParsedRow & { reason?: string })[] = [];
      for (const r of rows) {
        const dateRaw = pick(r, ["date", "occurred_on", "transaction date", "posting date"]);
        const desc = pick(r, ["description", "details", "narrative", "memo", "merchant"]);
        const amtStr = pick(r, ["amount", "value", "debit", "credit"]);
        const occurred_on = normalizeDate(dateRaw);
        const amt = Number(amtStr.replace(/[,£$€\s]/g, ""));
        if (!occurred_on || !desc || !Number.isFinite(amt) || amt === 0) {
          parsed.push({ occurred_on: dateRaw, description: desc, amount: amt, direction: "out", dedupe_hash: "", category_id: null, raw: r, reason: "Missing date, description or amount" });
          continue;
        }
        const direction: "in" | "out" = amt >= 0 ? (r["debit"] ? "out" : "in") : "out";
        const abs = Math.abs(amt);
        const hash = `${occurred_on}|${desc.trim().toLowerCase()}|${abs}|${direction}`;
        // rule match
        let category_id: string | null = null;
        for (const rule of rules) {
          try {
            const re = new RegExp(rule.pattern, "i");
            if (re.test(desc)) { category_id = rule.category_id ?? null; break; }
          } catch {
            if (desc.toLowerCase().includes(rule.pattern.toLowerCase())) { category_id = rule.category_id ?? null; break; }
          }
        }
        parsed.push({ occurred_on, description: desc.trim(), amount: abs, direction, dedupe_hash: hash, category_id, raw: r });
      }

      const invalid = parsed.filter(p => p.reason);
      const valid = parsed.filter(p => !p.reason);
      const exact: ParsedRow[] = [];
      const possible: ParsedRow[] = [];
      const news: ParsedRow[] = [];
      const seenInBatch = new Set<string>();
      for (const p of valid) {
        if (existingHashes.has(p.dedupe_hash) || seenInBatch.has(p.dedupe_hash)) {
          exact.push(p);
        } else {
          // fuzzy: same amount+date within 3 days
          const near = existingFuzzy.find(x => Math.abs(Number(x.amount) - p.amount) < 0.01 &&
            Math.abs(new Date(x.occurred_on).getTime() - new Date(p.occurred_on).getTime()) < 3 * 86400_000);
          if (near) possible.push(p);
          else news.push(p);
          seenInBatch.add(p.dedupe_hash);
        }
      }

      setFilename(file.name);
      setPreview({ filename: file.name, new_rows: news, exact_duplicates: exact, possible_duplicates: possible, invalid_rows: invalid as any });
      toast.success("Preview ready");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  const confirmM = useMutation({
    mutationFn: async () => {
      if (!preview) return;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;
      const { data: batch, error: batchErr } = await supabase.from("import_batches").insert({
        user_id: userId, filename: preview.filename, status: "completed",
        totals: { new: preview.new_rows.length, exact: preview.exact_duplicates.length, possible: preview.possible_duplicates.length, invalid: preview.invalid_rows.length },
      }).select().single();
      if (batchErr) throw batchErr;

      const toInsert = [...preview.new_rows, ...preview.possible_duplicates].map(r => ({
        user_id: userId, occurred_on: r.occurred_on,
        merchant: r.description, description: r.description,
        amount: r.amount, direction: r.direction, category_id: r.category_id,
        source: "import",
      }));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("transactions").insert(toInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Import confirmed");
      setPreview(null); setFilename("");
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["import_batches"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["home_month_tx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: async (id: string) => {
      // delete transactions in batch first
      await supabase.from("transactions").delete().eq("import_batch_id", id);
      const { error } = await supabase.from("import_batches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Import batch removed");
      qc.invalidateQueries({ queryKey: ["import_batches"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = preview;
  const history = historyQ.data ?? [];

  return (
    <AppShell
      header={
        <h1 className="truncate text-display text-xl sm:text-2xl">CSV import</h1>
      }
    >
      <PageHeader eyebrow="Import" title="Bring your data in." description="Upload a CSV — duplicates and invalid rows are flagged before you confirm." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
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
                <Button variant="outline" disabled title="PDF import is not supported in this build.">Import PDF</Button>
              </div>
            </div>
            {filename && <p className="mt-4 text-sm text-muted-foreground">Selected: <span className="font-medium text-foreground">{filename}</span></p>}
            {catsQ.data && catsQ.data.length === 0 && (
              <p className="mt-3 text-xs text-warning">No categories yet — auto-categorisation will be blank.</p>
            )}
          </div>

          {p && (
            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Preview</p>
                  <h2 className="text-display text-2xl">Before you confirm</h2>
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
                <Button variant="ghost" onClick={() => setPreview(null)}>Discard</Button>
                <Button disabled={confirmM.isPending || (p.new_rows.length + p.possible_duplicates.length === 0)} onClick={() => confirmM.mutate()}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {confirmM.isPending ? "Confirming…" : `Confirm ${p.new_rows.length + p.possible_duplicates.length} rows`}
                </Button>
              </div>
            </div>
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
                        {h.totals?.new !== undefined ? ` · ${h.totals.new} new` : ""}
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
                          <AlertDialogAction onClick={() => deleteM.mutate(h.id)}>Delete batch</AlertDialogAction>
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

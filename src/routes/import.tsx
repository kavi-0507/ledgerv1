import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { api } from "@/lib/api";
import type { ImportBatch, ImportPreview } from "@/lib/types";
import { formatDateTime, humanize } from "@/lib/format";

export const Route = createFileRoute("/import")({
  component: ImportPage,
});

function ImportPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [filename, setFilename] = useState<string>("");

  const historyQ = useQuery({
    queryKey: ["imports"],
    queryFn: () => api.get<{ items?: ImportBatch[]; imports?: ImportBatch[] } | ImportBatch[]>("/imports"),
    retry: 1,
  });

  const history: ImportBatch[] = Array.isArray(historyQ.data)
    ? historyQ.data
    : ((historyQ.data as { items?: ImportBatch[]; imports?: ImportBatch[] } | undefined)?.items ??
       (historyQ.data as { items?: ImportBatch[]; imports?: ImportBatch[] } | undefined)?.imports ??
       []);

  const previewM = useMutation({
    mutationFn: (payload: { filename: string; csv_text: string }) =>
      api.post<ImportPreview>("/imports/preview", payload),
    onSuccess: (data) => {
      setPreview(data);
      toast.success("Preview ready");
    },
    onError: (e: Error) =>
      toast.error("Couldn't preview import", { description: e.message }),
  });

  const confirmM = useMutation({
    mutationFn: (token: string) =>
      api.post("/imports/confirm", { preview_token: token }),
    onSuccess: () => {
      toast.success("Import confirmed");
      setPreview(null);
      setFilename("");
      if (fileInput.current) fileInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["imports"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) =>
      toast.error("Couldn't confirm import", { description: e.message }),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.del(`/imports/${id}`),
    onSuccess: () => {
      toast.success("Import batch removed");
      qc.invalidateQueries({ queryKey: ["imports"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error("Couldn't delete", { description: e.message }),
  });

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast.error("CSV only", { description: "PDF import is disabled." });
      return;
    }
    const text = await file.text();
    setFilename(file.name);
    previewM.mutate({ filename: file.name, csv_text: text });
  }

  const p = preview;

  return (
    <AppShell
      header={
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Import
          </p>
          <h1 className="truncate text-display text-xl sm:text-2xl">CSV import</h1>
        </div>
      }
    >
      <PageHeader
        eyebrow="Import"
        title="Bring your data in."
        description="Upload a CSV — we preview duplicates, invalid rows and categorisation before you confirm."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {/* Uploader */}
          <div className="surface-card p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-display text-2xl">Upload a CSV</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Files are processed in memory and never stored raw.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInput}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onFileChange}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInput.current?.click()}
                  disabled={previewM.isPending}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {previewM.isPending ? "Reading…" : "Choose CSV"}
                </Button>
                <Button
                  variant="outline"
                  disabled
                  title="PDF import is experimental and disabled in the normal workflow."
                >
                  Import PDF
                </Button>
              </div>
            </div>

            {filename && (
              <p className="mt-4 text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{filename}</span>
              </p>
            )}
          </div>

          {/* Preview */}
          {p && (
            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    Preview
                  </p>
                  <h2 className="text-display text-2xl">Before you confirm</h2>
                </div>
                <StatusPill tone="info" dot>
                  Token {String(p.preview_token ?? "").slice(0, 8) || "—"}
                </StatusPill>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <PreviewCount label="New rows" tone="positive" count={p.new_rows?.length ?? 0} />
                <PreviewCount label="Exact duplicates" tone="neutral" count={p.exact_duplicates?.length ?? 0} />
                <PreviewCount label="Possible duplicates" tone="warning" count={p.possible_duplicates?.length ?? 0} />
                <PreviewCount label="Invalid rows" tone="negative" count={p.invalid_rows?.length ?? 0} />
              </div>

              {(p.possible_duplicates?.length ?? 0) > 0 && (
                <PreviewRows
                  title="Possible duplicates"
                  icon={<FileWarning className="h-4 w-4" />}
                  rows={p.possible_duplicates ?? []}
                />
              )}
              {(p.invalid_rows?.length ?? 0) > 0 && (
                <PreviewRows
                  title="Invalid rows"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  rows={p.invalid_rows ?? []}
                />
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  Discard
                </Button>
                <Button
                  disabled={!p.preview_token || confirmM.isPending}
                  onClick={() => confirmM.mutate(p.preview_token!)}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {confirmM.isPending ? "Confirming…" : "Confirm import"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* History */}
        <div className="surface-card p-5 sm:p-6">
          <h2 className="text-display text-2xl">Import history</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Delete a batch to remove all its transactions.
          </p>
          <QueryBoundary
            isLoading={historyQ.isLoading}
            isError={historyQ.isError}
            error={historyQ.error}
            onRetry={() => historyQ.refetch()}
            loading={
              <div className="mt-4">
                <SkeletonRow />
                <SkeletonRow />
              </div>
            }
          >
            {history.length === 0 ? (
              <EmptyState
                icon={<Upload className="h-5 w-5" />}
                title="No imports yet"
                description="Upload your first CSV to see history here."
              />
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {h.filename ?? `Batch #${h.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.imported_at)}
                        {h.count !== undefined ? ` · ${h.count} rows` : ""}
                        {h.new_rows !== undefined ? ` · ${h.new_rows} new` : ""}
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
                          <AlertDialogTitle>Delete this import batch?</AlertDialogTitle>
                          <AlertDialogDescription>
                            All transactions from this batch will be removed. This can't be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteM.mutate(h.id)}>
                            Delete batch
                          </AlertDialogAction>
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

function PreviewCount({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "positive" | "neutral" | "warning" | "negative";
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span data-numeric className="text-display text-3xl">
          {count}
        </span>
        <StatusPill tone={tone}>{humanize(tone)}</StatusPill>
      </div>
    </div>
  );
}

function PreviewRows({
  title,
  icon,
  rows,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Array<Record<string, unknown>>;
}) {
  return (
    <div className="mt-5">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon} {title} · {rows.length}
      </p>
      <div className="max-h-60 overflow-auto rounded-lg border border-border">
        <ul className="divide-y divide-border text-sm">
          {rows.slice(0, 20).map((r, i) => (
            <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 px-3 py-2">
              <span className="text-muted-foreground">
                {String(r.occurred_on ?? r.date ?? "")}
              </span>
              <span className="truncate">
                {String(r.description ?? r.merchant ?? r.reason ?? "—")}
              </span>
              <span data-numeric className="text-muted-foreground">
                {String(r.amount ?? "")}
              </span>
            </li>
          ))}
          {rows.length > 20 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              + {rows.length - 20} more
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

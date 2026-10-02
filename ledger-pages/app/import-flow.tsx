"use client";
import { useState, useRef, useMemo } from "react";
import { Upload, Download, FileText, Check, ShieldCheck } from "lucide-react";
import {
  type Transaction,
  today,
  money,
  shortDate,
  parseCsv,
  parseDate,
  parseAmount,
  categorise,
  fingerprint,
  csvFormatKey,
  categoryName,
  normalizeMerchant,
} from "@/lib/ledger";
import { Field, type FormProps } from "./forms";
export default function ImportFlow({
  state,
  busy,
  commit,
  close,
  onDone,
}: FormProps & { onDone: (month: string) => void }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [filename, setFilename] = useState("");
  const [header, setHeader] = useState(true);
  const [dateCol, setDateCol] = useState(0);
  const [descCol, setDescCol] = useState(1);
  const [amountCol, setAmountCol] = useState(2);
  const [debitCol, setDebitCol] = useState(2);
  const [creditCol, setCreditCol] = useState(3);
  const [order, setOrder] = useState<"DMY" | "MDY">("DMY");
  const [amountMode, setAmountMode] = useState("signed");
  const [step, setStep] = useState(1);
  const [problem, setProblem] = useState("");
  const [exclude, setExclude] = useState(false);
  const [mappingKey,setMappingKey] = useState("");
  const [usingSavedMapping,setUsingSavedMapping] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const read = async (file: File) => {
    setProblem("");
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setProblem("Choose a CSV file exported from your bank.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProblem(
        "This file is over 5 MB. Export a smaller date range and try again.",
      );
      return;
    }
    try {
      const parsed = parseCsv(await file.text());
      if (!parsed.length)
        throw Error("This file is empty. Choose a CSV with transactions.");
      if (parsed.length > 10001)
        throw Error("Import no more than 10,000 entries at a time.");
      const first = parsed[0].map((h) => h.toLowerCase());
      const hasHeader = first.some((h) =>
        /^(date|description|details|memo|amount|debit|credit|transaction date|merchant|money in|money out|paid in|paid out)$/.test(
          h,
        ),
      );
      const key = csvFormatKey(parsed,hasHeader);
      const saved = (state.csvMappings || []).find(m=>m.key===key);
      setRows(parsed);
      setFilename(file.name);
      setMappingKey(key);
      setUsingSavedMapping(!!saved);
      setHeader(saved?.header ?? hasHeader);
      setDateCol(saved?.dateCol ?? Math.max(0, first.findIndex((h) => /date/.test(h))));
      setDescCol(saved?.descCol ?? (hasHeader ? Math.max(0, first.findIndex((h) => /description|details|memo|merchant|narrative/.test(h))) : 1));
      const a = first.findIndex((h) => /^(amount|value)$/.test(h));
      const debit = first.findIndex((h) => /debit|money out|paid out/.test(h));
      const credit = first.findIndex((h) => /credit|money in|paid in/.test(h));
      setAmountCol(saved?.amountCol ?? (a >= 0 ? a : 2));
      setDebitCol(saved?.debitCol ?? (debit >= 0 ? debit : 2));
      setCreditCol(saved?.creditCol ?? (credit >= 0 ? credit : 3));
      setAmountMode(saved?.amountMode ?? (debit >= 0 && credit >= 0 ? "split" : "signed"));
      setOrder(saved?.order ?? "DMY");
      setExclude(false);
      setStep(saved ? 3 : 2);
    } catch (e) {
      setProblem((e as Error).message);
    }
  };
  const preview = useMemo(() => {
    const hashes = new Set(state.transactions.map(fingerprint));
    const fresh: Transaction[] = [];
    const duplicates: Transaction[] = [];
    const invalid: { row: number; reason: string }[] = [];
    const data = header ? rows.slice(1) : rows;
    data.forEach((r, i) => {
      const date = parseDate(r[dateCol] || "", order);
      const merchant = (r[descCol] || "").trim();
      let amount =
        amountMode === "split"
          ? Math.abs(parseAmount(r[creditCol]?.trim() || "0")) -
            Math.abs(parseAmount(r[debitCol]?.trim() || "0"))
          : parseAmount(r[amountCol] || "");
      if (amountMode === "out") amount = -Math.abs(amount);
      if (!date || !merchant || !Number.isFinite(amount) || amount === 0) {
        invalid.push({
          row: i + (header ? 2 : 1),
          reason: !date
            ? "Date not recognised"
            : !merchant
              ? "Missing merchant description"
              : "Missing or invalid amount",
        });
        return;
      }
      amount = Math.round(amount * 100) / 100;
      const t: Transaction = {
        id: "row-" + i,
        date,
        merchant,
        amount,
        ...categorise(merchant, amount, state.rules),
        source: "",
      };
      const key = fingerprint(t);
      if (hashes.has(key)) duplicates.push(t);
      else {
        hashes.add(key);
        const near = [...state.transactions,...fresh].some(
          (x) =>
            Math.abs(x.amount - amount) < 0.01 &&
            Math.abs(+new Date(x.date) - +new Date(date)) <= 3 * 86400000 &&
            normalizeMerchant(x.merchant) === normalizeMerchant(merchant),
        );
        if (near) { t.review = true; t.reviewReasons = [...(t.reviewReasons || []), "possible_duplicate"]; }
        fresh.push(t);
      }
    });
    return { fresh, duplicates, invalid };
  }, [
    rows,
    header,
    dateCol,
    descCol,
    amountCol,
    debitCol,
    creditCol,
    order,
    amountMode,
    state,
  ]);
  const width = Math.max(3, ...rows.map((r) => r.length));
  const options = (value: number, change: (n: number) => void) => (
    <select value={value} onChange={(e) => change(+e.target.value)}>
      {Array.from({ length: width }, (_, i) => (
        <option key={i} value={i}>
          {header ? rows[0]?.[i] || `Column ${i + 1}` : `Column ${i + 1}`}
          {rows[header ? 1 : 0]?.[i]
            ? ` · ${rows[header ? 1 : 0][i].slice(0, 24)}`
            : ""}
        </option>
      ))}
    </select>
  );
  const sample = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        [
          "Date,Description,Amount\n" +
            today() +
            ",Tesco,-24.50\n" +
            today() +
            ",Transport for London,-8.20\n" +
            today() +
            ",Campus café,-6.00\n",
        ],
        { type: "text/csv" },
      ),
    );
    a.download = "ledger-example.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div>
      <div className="step-indicator">
        <span className={step === 1 ? "current" : ""}>1. Choose a file</span>
        <span className={step === 2 ? "current" : ""}>2. Check details</span>
        <span className={step === 3 ? "current" : ""}>3. Preview & add</span>
      </div>
      {problem && (
        <p className="dialog-error" role="alert">
          {problem}
        </p>
      )}
      {step === 1 ? (
        <>
          <p className="dialog-description">
            Export your transactions as a CSV from your bank. Familiar merchants
            are sorted for you; only unclear entries need a check.
          </p>
          <button
            className="drop-zone"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) void read(e.dataTransfer.files[0]);
            }}
          >
            <span>
              <Upload size={26} />
            </span>
            <strong>Drop your bank CSV here</strong>
            <p>or click to choose a file</p>
            <small>
              CSV files up to 5 MB · Your original file stays unchanged
            </small>
          </button>
          <input
            className="hidden"
            type="file"
            accept=".csv,text/csv"
            ref={input}
            onChange={(e) => {
              if (e.target.files?.[0]) void read(e.target.files[0]);
            }}
          />
          <div className="import-assurances">
            <span>
              <Check size={15} />
              See a preview before adding
            </span>
            <span>
              <Check size={15} />
              Duplicates checked for you
            </span>
          </div>
          <button className="text-button" onClick={sample}>
            <Download size={15} />
            Download a sample CSV
          </button>
        </>
      ) : step === 2 ? (
        <>
          <p className="dialog-description">
            <FileText size={16} /> {filename}
            <br />
            We’ve matched the columns. Check these against your bank file before
            continuing.
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={header}
              onChange={(e) => setHeader(e.target.checked)}
            />
            <span>The first row contains column names</span>
          </label>
          <div className="form-grid">
            <Field label="Transaction date">
              {options(dateCol, setDateCol)}
            </Field>
            <Field label="Merchant or description">
              {options(descCol, setDescCol)}
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Date format">
              <select
                value={order}
                onChange={(e) => setOrder(e.target.value as "DMY" | "MDY")}
              >
                <option value="DMY">Day / month / year (UK)</option>
                <option value="MDY">Month / day / year (US)</option>
              </select>
            </Field>
            <Field label="Amount format">
              <select
                value={amountMode}
                onChange={(e) => setAmountMode(e.target.value)}
              >
                <option value="signed">Negative = out, positive = in</option>
                <option value="out">All amounts are money out</option>
                <option value="split">Separate money in / out</option>
              </select>
            </Field>
          </div>
          {amountMode === "split" ? (
            <div className="form-grid">
              <Field label="Money out (debit)">
                {options(debitCol, setDebitCol)}
              </Field>
              <Field label="Money in (credit)">
                {options(creditCol, setCreditCol)}
              </Field>
            </div>
          ) : (
            <Field label="Amount">{options(amountCol, setAmountCol)}</Field>
          )}
          <div className="sample-table">
            <div>
              <strong>First entries as we understand them</strong>
            </div>
            {preview.fresh.slice(0, 3).map((t) => (
              <div key={t.id}>
                <span>
                  {shortDate(t.date)} · {t.merchant}
                </span>
                <strong className={t.amount > 0 ? "positive" : ""}>
                  {money(t.amount)}
                </strong>
              </div>
            ))}
            {!preview.fresh.length && (
              <p className="muted">
                No new valid entries yet. Check the columns, or continue to see
                duplicates.
              </p>
            )}
          </div>
          <div className="dialog-actions">
            <button className="button outline" onClick={() => setStep(1)}>
              Choose another file
            </button>
            <button
              className="button primary"
              onClick={() => {
                const cols =
                  amountMode === "split"
                    ? [dateCol, descCol, debitCol, creditCol]
                    : [dateCol, descCol, amountCol];
                if (new Set(cols).size !== cols.length) {
                  setProblem(
                    "Each detail needs its own column. Check your choices.",
                  );
                  return;
                }
                setProblem("");
                setStep(3);
              }}
            >
              Preview import
            </button>
          </div>
        </>
      ) : (
        <>
          {usingSavedMapping && <div className="plain-note">Using the column and date choices you confirmed for this CSV format. <button className="text-button" onClick={()=>setStep(2)}>Edit details</button></div>}
          <p className="dialog-description">
            Here’s exactly what will happen. Nothing is added until you confirm.
          </p>
          <div className="import-stats">
            <div>
              <strong>{preview.fresh.length}</strong>
              <span>new transactions</span>
            </div>
            <div>
              <strong>{preview.duplicates.length}</strong>
              <span>duplicates skipped</span>
            </div>
            <div>
              <strong>{preview.fresh.filter((t) => t.review).length}</strong>
              <span>to check afterwards</span>
            </div>
          </div>
          <div className="sample-table preview-scroll">
            {preview.fresh.map((t) => (
              <div key={t.id}>
                <span>
                  <strong>{t.merchant}</strong>
                  <small>
                    {shortDate(t.date)} · {categoryName(state,t.category)}
                    {t.reviewReasons?.includes("possible_duplicate") ? " · Check possible duplicate" : t.reviewReasons?.includes("refund") ? " · Check refund" : t.review ? " · Check category afterwards" : ""}
                  </small>
                </span>
                <strong className={t.amount > 0 ? "positive" : ""}>
                  {money(t.amount)}
                </strong>
              </div>
            ))}
          </div>
          {preview.duplicates.length > 0 && (
            <details className="import-details">
              <summary>
                {preview.duplicates.length} exact duplicates will be skipped
              </summary>
              <p>
                Same date, description and amount as an existing entry or
                another row in this file. If these are separate payments, add
                the extra entry manually afterwards.
              </p>
              {preview.duplicates.slice(0, 20).map((t, i) => (
                <small key={i}>
                  {shortDate(t.date)} · {t.merchant} · {money(t.amount)}
                </small>
              ))}
            </details>
          )}
          {preview.invalid.length > 0 && (
            <div className="invalid-rows">
              <strong>{preview.invalid.length} rows couldn’t be read</strong>
              <div>
                {preview.invalid.slice(0, 10).map((r) => (
                  <p key={r.row}>
                    Row {r.row}: {r.reason}
                  </p>
                ))}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={exclude}
                  onChange={(e) => setExclude(e.target.checked)}
                />
                <span>Skip these rows and import the valid entries</span>
              </label>
            </div>
          )}
          <p className="plain-note">
            <ShieldCheck size={17} />
            Duplicates are skipped. Uncertain categories need a check.
          </p>
          <div className="dialog-actions">
            <button className="button outline" onClick={() => setStep(2)}>
              Back to details
            </button>
            <button
              className="button primary"
              disabled={
                busy ||
                !preview.fresh.length ||
                (preview.invalid.length > 0 && !exclude)
              }
              onClick={async () => {
                const id = crypto.randomUUID();
                const transactions = preview.fresh.map((t) => ({
                  ...t,
                  id: crypto.randomUUID(),
                  source: id,
                }));
                if (
                  await commit(
                    {
                      ...state,
                      transactions: [...state.transactions, ...transactions],
                      csvMappings: [...(state.csvMappings || []).filter(m=>m.key!==mappingKey), {key:mappingKey,header,dateCol,descCol,amountCol,debitCol,creditCol,order,amountMode}].slice(-50),
                      imports: [
                        {
                          id,
                          name: filename,
                          date: today(),
                          count: transactions.length,
                          duplicates: preview.duplicates.length,
                        },
                        ...state.imports,
                      ],
                    },
                    `${transactions.length} transactions added`,
                  )
                ) {
                  onDone(
                    transactions
                      .map((t) => t.date)
                      .sort()
                      .at(-1)!
                      .slice(0, 7),
                  );
                  close();
                }
              }}
            >
              {busy ? "Adding…" : `Add ${preview.fresh.length} transactions`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

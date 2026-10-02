"use client";
import { useState, type ReactNode, type FormEvent } from "react";
import {
  Check,
  Plus,
  Trash2,
  Settings,
  Repeat2,
  ShieldCheck,
  CircleHelp,
} from "lucide-react";
import {
  type Category,
  type LedgerState,
  type Transaction,
  type Bill,
  today,
  money,
  shortDate,
  nextDue,
  billPaid,
  categoryOptions,
  categoryName,
  budgetsForMonth,
  saveMonthBudgets,
  categorise,
} from "@/lib/ledger";
import ImportFlow from "./import-flow";
import PlanSetup from "./plan-setup";
import RunwayForm from "./runway-form";
import CategorySettings from "./category-settings";
export type Modal =
  | { type: "import" }
  | { type: "setup" }
  | { type: "runway" }
  | { type: "transaction"; transaction?: Transaction }
  | { type: "bill"; bill?: Bill }
  | { type: "payment"; bill: Bill }
  | { type: "budget"; category?: Category }
  | { type: "help" }
  | { type: "delete"; transaction: Transaction }
  | { type: "undo"; importId: string }
  | null;
export type FormProps = {
  state: LedgerState;
  busy: boolean;
  commit: (next: LedgerState, message: string) => Promise<boolean>;
  close: () => void;
};
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ModalContent({
  modal,
  state,
  busy,
  commit,
  close,
  onImport,
  month,
}: FormProps & { modal: Modal; onImport: (m: string) => void; month: string }) {
  if (!modal) return null;
  const p = { state, busy, commit, close };
  if (modal.type === "import") return <ImportFlow {...p} onDone={onImport} />;
  if (modal.type === "setup") return <PlanSetup {...p} month={month} />;
  if (modal.type === "runway") return <RunwayForm {...p} />;
  if (modal.type === "transaction")
    return <TransactionForm {...p} transaction={modal.transaction} />;
  if (modal.type === "bill") return <BillForm {...p} bill={modal.bill} />;
  if (modal.type === "payment") return <PaymentForm {...p} bill={modal.bill} />;
  if (modal.type === "budget")
    return <BudgetForm {...p} category={modal.category} month={month} />;
  if (modal.type === "delete")
    return (
      <>
        <p className="dialog-description">
          {modal.transaction.merchant} · {money(modal.transaction.amount)} ·{" "}
          {shortDate(modal.transaction.date)}. Any bill payment linked to this
          entry will also be removed.
        </p>
        <div className="dialog-actions">
          <button className="button outline" onClick={close}>
            Keep transaction
          </button>
          <button
            disabled={busy}
            className="button danger"
            onClick={async () => {
              const id = modal.transaction.id;
              if (
                await commit(
                  {
                    ...state,
                    transactions: state.transactions.filter((t) => t.id !== id),
                    bills: state.bills.map((b) => ({
                      ...b,
                      payments: b.payments.filter(
                        (p) => p.transactionId !== id,
                      ),
                    })),
                  },
                  "Transaction deleted",
                )
              )
                close();
            }}
          >
            Delete transaction
          </button>
        </div>
      </>
    );
  if (modal.type === "undo")
    return (
      <>
        <p className="dialog-description">
          Remove the transactions added by this import and any linked bill
          payments. Your saved categories and remembered merchants stay.
        </p>
        <div className="dialog-actions">
          <button className="button outline" onClick={close}>
            Keep import
          </button>
          <button
            className="button danger"
            disabled={busy}
            onClick={async () => {
              const ids = new Set(
                state.transactions
                  .filter((t) => t.source === modal.importId)
                  .map((t) => t.id),
              );
              if (
                await commit(
                  {
                    ...state,
                    transactions: state.transactions.filter(
                      (t) => !ids.has(t.id),
                    ),
                    imports: state.imports.filter(
                      (i) => i.id !== modal.importId,
                    ),
                    bills: state.bills.map((b) => ({
                      ...b,
                      payments: b.payments.filter(
                        (p) => !ids.has(p.transactionId),
                      ),
                    })),
                  },
                  "Import removed",
                )
              )
                close();
            }}
          >
            Undo import
          </button>
        </div>
      </>
    );
  return (
    <div className="help-content">
      <p>Ledger helps you answer one question: “Am I okay this month?”</p>
      <h3>Start with your monthly money</h3>
      <p>
        Add what you expect to receive and a savings goal. Divide a student loan
        paid per term by the months it needs to last.
      </p>
      <h3>Import, then check just the uncertain entries</h3>
      <p>
        Export a CSV from your bank. Preview the dates and amounts before adding
        it. Familiar merchants are sorted for you. Unclear entries go to “To
        check”.
      </p>
      <h3>What “left for this month” means</h3>
      <p>
        Money received (or your planned income) minus spending, your savings
        goal or savings already made — whichever is larger — and unpaid bills
        due this month. Transfers are excluded. This is a planning estimate, not
        your bank balance.
      </p>
      <h3>Bills and transactions</h3>
      <p>
        A bill is a deadline. Link a payment already in your spending or add a
        new payment if it hasn’t been imported. Ledger never sends money or pays
        a bill.
      </p>
      <h3>Your own money stays private</h3>
      <p>
        Real entries are saved to your signed-in account. Example mode is a
        separate, temporary space for trying things out.
      </p>
      <button className="button primary" onClick={close}>
        Got it
      </button>
    </div>
  );
}
function TransactionForm({
  state,
  transaction,
  busy,
  commit,
  close,
}: FormProps & { transaction?: Transaction }) {
  const [merchant, setMerchant] = useState(transaction?.merchant || "");
  const [amount, setAmount] = useState(
    String(Math.abs(transaction?.amount || 0) || ""),
  );
  const [date, setDate] = useState(transaction?.date || today());
  const [direction, setDirection] = useState(
    transaction && transaction.amount > 0 ? "in" : "out",
  );
  const [category, setCategory] = useState<Category>(
    transaction?.category || "Other",
  );
  const [remember, setRemember] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    const tx: Transaction = {
      id: transaction?.id || crypto.randomUUID(),
      merchant: merchant.trim(),
      amount:
        (Math.round(Number(amount) * 100) * (direction === "out" ? -1 : 1)) /
        100,
      date,
      category,
      review: false,
      reviewReasons: [],
      source: transaction?.source || "Manual",
    };
    if (!tx.merchant) return;
    const next = {
      ...state,
      transactions: transaction
        ? state.transactions.map((t) => (t.id === tx.id ? tx : t))
        : [...state.transactions, tx],
      rules: remember
        ? [
            ...state.rules.filter(
              (r) => r.merchant.toLowerCase() !== merchant.trim().toLowerCase(),
            ),
            { id: crypto.randomUUID(), merchant: merchant.trim(), category },
          ]
        : state.rules,
    };
    if (
      await commit(
        next,
        transaction ? "Transaction updated" : "Transaction added",
      )
    )
      close();
  };
  return (
    <form onSubmit={save}>
      <p className="dialog-description">
        {transaction?.review
          ? "We’re unsure what this was for. Choose a category and you’re done."
          : "This spending entry updates your overview and your plan."}
      </p>
      <Field label="Who was it with?">
        <input
          required
          maxLength={200}
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="e.g. Tesco"
        />
      </Field>
      <div className="form-grid">
        <Field label="Amount (£)">
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            max="1000000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Money direction">
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="out">Money out</option>
            <option value="in">Money in</option>
          </select>
        </Field>
      </div>
      <div className="form-grid">
        <Field label="Date">
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
          >
            {categoryOptions(state).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
      </div>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        <span>
          Remember this merchant next time
          <small>
            Future imports containing “{merchant || "this merchant"}” use this
            category.
          </small>
        </span>
      </label>
      <div className="dialog-actions">
        <button type="button" className="button outline" onClick={close}>
          Cancel
        </button>
        <button disabled={busy} className="button primary">
          {busy ? "Saving…" : transaction ? "Save & finish" : "Add transaction"}
        </button>
      </div>
    </form>
  );
}
function BudgetForm({
  state,
  category,
  month,
  busy,
  commit,
  close,
}: FormProps & { category?: Category; month: string }) {
  const monthBudgets = budgetsForMonth(state,month);
  const [cat, setCat] = useState<Category>(
    category ||
      categoryOptions(state).map(c=>c.id).find(
        (c) =>
          !monthBudgets.some((b) => b.category === c) &&
          !["Income", "Savings", "Transfer"].includes(c),
      ) ||
      "Other",
  );
  const [limit, setLimit] = useState(
    String(monthBudgets.find((b) => b.category === cat)?.limit || ""),
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          await commit(
            saveMonthBudgets(state,month,[
              ...monthBudgets.filter((b) => b.category !== cat),
              { category: cat, limit: Math.round(+limit * 100) / 100 },
            ]),
            "Spending plan updated",
          )
        )
          close();
      }}
    >
      <p className="dialog-description">
        How much would you like to spend here each month? Change it whenever
        life changes.
      </p>
      <Field label="Category">
        <select
          value={cat}
          disabled={!!category}
          onChange={(e) => {
            setCat(e.target.value as Category);
            setLimit(
              String(
                monthBudgets.find((b) => b.category === e.target.value)
                  ?.limit || "",
              ),
            );
          }}
        >
          {categoryOptions(state)
            .filter((c) => !["Income", "Savings", "Transfer"].includes(c.id))
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>
      </Field>
      <Field label="Monthly spending limit (£)">
        <input
          required
          type="number"
          step="0.01"
          min="0"
          max="1000000000"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </Field>
      <p className="muted">
        Applies to your ongoing monthly plan. Past transactions stay as they
        are.
      </p>
      <div className="dialog-actions">
        <button type="button" className="button outline" onClick={close}>
          Cancel
        </button>
        <button disabled={busy} className="button primary">
          Save my plan
        </button>
      </div>
    </form>
  );
}
function BillForm({
  state,
  bill,
  busy,
  commit,
  close,
}: FormProps & { bill?: Bill }) {
  const [name, setName] = useState(bill?.name || "");
  const [amount, setAmount] = useState(String(bill?.amount || ""));
  const [date, setDate] = useState(bill?.date || today());
  const [recurrence, setRecurrence] = useState<Bill["recurrence"]>(
    bill?.recurrence || "monthly",
  );
  const [remove, setRemove] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const next: Bill = {
          id: bill?.id || crypto.randomUUID(),
          name: name.trim(),
          amount: +amount,
          date,
          recurrence,
          payments: bill?.payments || [],
        };
        if (!next.name) return;
        if (
          await commit(
            {
              ...state,
              bills: bill
                ? state.bills.map((b) => (b.id === bill.id ? next : b))
                : [...state.bills, next],
            },
            "Bill saved",
          )
        )
          close();
      }}
    >
      <p className="dialog-description">
        This creates a reminder, not a spending entry. Record a payment once
        you’ve actually paid it.
      </p>
      <Field label="What is it for?">
        <input
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Rent or Octopus Energy"
        />
      </Field>
      <div className="form-grid">
        <Field label="Amount (£)">
          <input
            required
            type="number"
            step="0.01"
            min="0.01"
            max="1000000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Next due date">
          <input
            required
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="How often?">
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Bill["recurrence"])}
        >
          {[
            ["monthly", "Monthly"],
            ["weekly", "Weekly"],
            ["termly", "Every 4 months"],
            ["yearly", "Yearly"],
            ["once", "One-off"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      {bill && bill.payments.length > 0 && (
        <div className="payment-history">
          <h3>Payment history</h3>
          {bill.payments.map((p) => {
            const t = state.transactions.find((t) => t.id === p.transactionId);
            return (
              <div key={p.transactionId}>
                <span>
                  <Check size={14} /> {shortDate(p.date)} ·{" "}
                  {t?.merchant || "Linked payment"}
                </span>
                <strong>{money(Math.abs(t?.amount || bill.amount))}</strong>
              </div>
            );
          })}
          {recurrence !== "once" &&
            billPaid(bill) && (
              <button
                type="button"
                className="text-button"
                onClick={() => setDate(nextDue(date, recurrence))}
              >
                Move reminder to the next due date
              </button>
            )}
        </div>
      )}
      {bill && (
        <div className="remove-block">
          {remove ? (
            <>
              <p>
                Remove this reminder? Paid transactions stay in your spending.
              </p>
              <button
                type="button"
                className="text-button negative"
                disabled={busy}
                onClick={async () => {
                  if (
                    await commit(
                      {
                        ...state,
                        bills: state.bills.filter((b) => b.id !== bill.id),
                      },
                      "Bill reminder removed",
                    )
                  )
                    close();
                }}
              >
                Yes, remove this bill
              </button>
            </>
          ) : (
            <button
              type="button"
              className="text-button negative"
              onClick={() => setRemove(true)}
            >
              Remove bill
            </button>
          )}
        </div>
      )}
      <div className="dialog-actions">
        <button type="button" className="button outline" onClick={close}>
          Cancel
        </button>
        <button disabled={busy} className="button primary">
          Save bill
        </button>
      </div>
    </form>
  );
}
function PaymentForm({
  state,
  bill,
  busy,
  commit,
  close,
}: FormProps & { bill: Bill }) {
  const linked = new Set(
    state.bills.flatMap((b) => b.payments.map((p) => p.transactionId)),
  );
  const matches = state.transactions.filter(
    (t) =>
      t.amount < 0 &&
      Math.abs(-t.amount - bill.amount) < 0.01 &&
      !linked.has(t.id) &&
      Math.abs(+new Date(t.date) - +new Date(bill.date)) <= 14 * 86400000,
  );
  const [selected, setSelected] = useState(matches[0]?.id || "new");
  const [date, setDate] = useState(today());
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        let transactions = state.transactions;
        let tx = transactions.find((t) => t.id === selected);
        if (selected === "new") {
          tx = {
            id: crypto.randomUUID(),
            date,
            merchant: bill.name,
            amount: -bill.amount,
            category: categorise(bill.name,-bill.amount,state.rules).review ? "Rent & bills" : categorise(bill.name,-bill.amount,state.rules).category,
            review: false,
            reviewReasons: [],
            source: "Bill payment",
          };
          transactions = [...transactions, tx];
        } else if (tx)
          transactions = transactions.map((t) =>
            t.id === tx!.id
              ? { ...t, category: categorise(bill.name,-bill.amount,state.rules).review ? "Rent & bills" : categorise(bill.name,-bill.amount,state.rules).category, review: false, reviewReasons: [] }
              : t,
          );
        if (!tx) return;
        const payment = { date: tx.date, transactionId: tx.id, dueDate: bill.date };
        if (
          await commit(
            {
              ...state,
              transactions,
              bills: state.bills.map((b) =>
                b.id === bill.id
                  ? { ...b, payments: [...b.payments, payment] }
                  : b,
              ),
            },
            selected === "new"
              ? "Payment recorded as one new transaction"
              : "Payment linked without adding a transaction",
          )
        )
          close();
      }}
    >
      <p className="dialog-description">
        <strong>
          {bill.name} · {money(bill.amount)}
        </strong>
        <br />
        If this payment is already in your spending, link it below so it isn’t
        counted twice.
      </p>
      {matches.map((t) => (
        <label className="payment-option" key={t.id}>
          <input
            type="radio"
            name="payment"
            checked={selected === t.id}
            onChange={() => setSelected(t.id)}
          />
          <span>
            <strong>Link {t.merchant}</strong>
            <small>
              {shortDate(t.date)} · {money(-t.amount)} · No new transaction
            </small>
          </span>
        </label>
      ))}
      <label className="payment-option">
        <input
          type="radio"
          name="payment"
          checked={selected === "new"}
          onChange={() => setSelected("new")}
        />
        <span>
          <strong>Add a new payment</strong>
          <small>Only choose this if the payment hasn’t been imported.</small>
        </span>
      </label>
      {selected === "new" && (
        <Field label="Date you paid">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      )}
      <div className="plain-note">
        <CircleHelp size={17} />
        Ledger records what you’ve paid. It doesn’t send money or pay the bill.
      </div>
      <div className="dialog-actions">
        <button type="button" className="button outline" onClick={close}>
          Cancel
        </button>
        <button disabled={busy} className="button primary">
          {selected === "new" ? "Add one payment" : "Confirm linked payment"}
        </button>
      </div>
    </form>
  );
}
export function SettingsPanel({
  state,
  commit,
  busy,
  demo,
  onMode,
}: Omit<FormProps, "close"> & { demo: boolean; onMode: () => void }) {
  const [name, setName] = useState(state.name);
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState<Category>("Groceries");
  return (
    <div className="settings-grid">
      <CategorySettings state={state} commit={commit} busy={busy} />
      <section className="card">
        <div className="card-heading">
          <h2>Your space</h2>
          <Settings size={20} />
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await commit({ ...state, name: name.trim() }, "Name updated");
          }}
        >
          <Field label="Your first name">
            <input
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <div className="fixed-field">GBP · British pounds (£)</div>
          </Field>
          <button disabled={busy} className="button primary">
            Save preferences
          </button>
        </form>
        <div className="settings-divider">
          <ShieldCheck size={20} />
          <p>
            {demo
              ? "You’re in example mode. Changes here are temporary."
              : "Your money is saved privately to your signed-in account."}
          </p>
          <button className="button outline" onClick={onMode}>
            {demo ? "Start my own month" : "Explore sample data"}
          </button>
        </div>
      </section>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Remembered merchants</h2>
            <p>A few shortcuts for your next bank import.</p>
          </div>
          <Repeat2 size={20} />
        </div>
        <p className="muted">
          When a transaction contains this name, we’ll use the category you
          chose.
        </p>
        <div className="rules-list">
          {state.rules.map((r) => (
            <div key={r.id}>
              <span>
                <strong>{r.merchant}</strong>
                <small>{categoryName(state,r.category)}</small>
              </span>
              <button
                disabled={busy}
                className="icon-button"
                aria-label={`Forget ${r.merchant}`}
                onClick={() =>
                  void commit(
                    {
                      ...state,
                      rules: state.rules.filter((x) => x.id !== r.id),
                    },
                    "Merchant forgotten",
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!merchant.trim()) return;
            if (
              await commit(
                {
                  ...state,
                  rules: [
                    ...state.rules.filter(
                      (r) =>
                        r.merchant.toLowerCase() !==
                        merchant.trim().toLowerCase(),
                    ),
                    {
                      id: crypto.randomUUID(),
                      merchant: merchant.trim(),
                      category,
                    },
                  ],
                },
                "Merchant remembered",
              )
            )
              setMerchant("");
          }}
        >
          <Field label="Merchant name">
            <input
              required
              value={merchant}
              maxLength={200}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="e.g. Campus café"
            />
          </Field>
          <Field label="Always categorise as">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {categoryOptions(state).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <button disabled={busy} className="button outline">
            <Plus size={16} />
            Remember merchant
          </button>
        </form>
      </section>
    </div>
  );
}

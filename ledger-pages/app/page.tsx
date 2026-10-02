"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Landmark,
  ChartNoAxesCombined,
  Settings,
  Upload,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Search,
  SlidersHorizontal,
  ShoppingBasket,
  Coffee,
  TramFront,
  ShoppingBag,
  Music2,
  House,
  CircleHelp,
  PiggyBank,
  Repeat2,
  Sparkles,
  FileText,
  ShieldCheck,
  CheckCheck,
  Download,
  Trash2,
  CalendarDays,
  Layers,
  BookOpen,
  CircleAlert,
  LoaderCircle,
} from "lucide-react";
import {
  categoryOptions,
  type LedgerState,
  type Transaction,
  type Bill,
  demoState,
  currentMonth,
  money,
  shortDate,
  totals,
  today,
  billPaid,
  upgradeState,
  budgetsForMonth,
  categoryName,
  runwayEstimate,
  ensureBudgetHistory,
  planMetaForMonth,
} from "@/lib/ledger";
import { ModalContent, type Modal, SettingsPanel } from "./forms";
import ReviewPanel from "./review-panel";
import { auth, authRedirectUrl, loadWorkspace, saveWorkspace } from "@/lib/cloud-workspace";
type View =
  | "Overview"
  | "Transactions"
  | "Budget"
  | "Rent & bills"
  | "Insights"
  | "Settings";
const icons: Record<string, typeof Wallet> = {
  "Rent & Housing": House,
  Utilities: Landmark,
  "Meal Plan": Coffee,
  Entertainment: Music2,
  Health: CircleHelp,
  Groceries: ShoppingBasket,
  "Eating out": Coffee,
  Transport: TramFront,
  Shopping: ShoppingBag,
  Subscriptions: Music2,
  "Rent & bills": House,
  Other: CircleHelp,
  Income: ArrowDownLeft,
  Savings: PiggyBank,
  Transfer: Repeat2,
};
export const colours: Record<string, string> = {
  "Rent & Housing": "#2d5c49",
  Utilities: "#537b8b",
  "Meal Plan": "#b4a975",
  Entertainment: "#ae9acc",
  Health: "#c78982",
  Groceries: "#a4c873",
  "Eating out": "#e0a468",
  Transport: "#85abca",
  Shopping: "#ae9acc",
  Subscriptions: "#cca4b8",
  "Rent & bills": "#2d5c49",
  Other: "#a9b0ac",
  Income: "#2d5c49",
  Savings: "#729851",
  Transfer: "#85abca",
};
const nav: [View, typeof Wallet][] = [
  ["Overview", LayoutDashboard],
  ["Transactions", ArrowDownLeft],
  ["Budget", Wallet],
  ["Rent & bills", Landmark],
  ["Insights", ChartNoAxesCombined],
];
export function CategoryIcon({ category }: { category: string }) {
  const Icon = icons[category] || CircleHelp;
  return (
    <span
      className="category-icon"
      style={{ background: (colours[category] || "#8aa39b") + "20", color: colours[category] || "#587064" }}
    >
      <Icon size={18} />
    </span>
  );
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Wallet size={25} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Chart({ state, month }: { state: LedgerState; month: string }) {
  const d = totals(state, month);
  const days = new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  const amounts = Array.from({ length: days }, (_, i) =>
    -d.spendTx.filter(t => +t.date.slice(-2) <= i + 1).reduce((n,t) => n + t.amount, 0)
  );
  const limit = budgetsForMonth(state, month).reduce((n, b) => n + b.limit, 0);
  const max = Math.max(limit, d.spent, 100);
  const points = amounts.map(
    (v, i) => `${46 + (i / (days - 1)) * 644},${188 - (v / max) * 157}`,
  );
  const line = "M" + points.join(" L");
  return (
    <div className="chart-wrap">
      <svg
        viewBox="0 0 720 226"
        role="img"
        aria-label={`Cumulative spending: ${money(d.spent)}. Dashed line shows your plan.`}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c5d9b5" stopOpacity=".55" />
            <stop offset="100%" stopColor="#c5d9b5" stopOpacity=".05" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <g key={p}>
            <line
              x1="46"
              x2="690"
              y1={188 - p * 157}
              y2={188 - p * 157}
              stroke="#eceee9"
            />
            <text x="0" y={192 - p * 157} fill="#7a847c" fontSize="12">
              £{Math.round(p * max)}
            </text>
          </g>
        ))}
        {limit > 0 && (
          <path
            d={`M46,188 L690,${188 - (limit / max) * 157}`}
            fill="none"
            stroke="#b9c2b5"
            strokeWidth="1.5"
            strokeDasharray="5 6"
          />
        )}
        <path d={line + " L690,188 L46,188 Z"} fill="url(#chart-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#47735a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {[1, 5, 10, 15, 20, 25, days].map((day) => (
          <text
            key={day}
            x={46 + ((day - 1) / (days - 1)) * 644}
            y="215"
            textAnchor="middle"
            fill="#7a847c"
            fontSize="12"
          >
            {day}
            {day === 1
              ? " " +
                new Date(month + "-01T12:00:00").toLocaleDateString("en-GB", {
                  month: "short",
                })
              : ""}
          </text>
        ))}
      </svg>
    </div>
  );
}
export default function Ledger() {
  const [state, setState] = useState<LedgerState>(() => upgradeState(demoState()));
  const [demo, setDemo] = useState(true);
  const [live, setLive] = useState<LedgerState | null>(null);
  const revision = useRef(0);
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("Overview");
  const [month, setMonth] = useState(currentMonth());
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [authSending, setAuthSending] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [menu, setMenu] = useState(false);
  const didLoad = useRef(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const user = await auth.getUser();
      if (!user) {
        setAuthRequired(true);
        return;
      }
      setAuthRequired(false);
      const j = await loadWorkspace();
      const upgraded = upgradeState(j.state);
      setLive(upgraded);
      revision.current = j.revision;
      setState(upgraded);
      setDemo(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    void Promise.resolve().then(load);
  }, [load]);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    try { unsubscribe = auth.subscribe((event) => {
        if (event === "SIGNED_IN") {
          setAuthOpen(false);
          // Supabase advises deferring client calls from its auth callback.
          setTimeout(() => void load(), 0);
        }
        if (event === "SIGNED_OUT") {
          setLive(null);
          setState(upgradeState(demoState()));
          setDemo(true);
          setAuthRequired(true);
          revision.current = 0;
        }
    }); } catch { /* The example still works before account setup. */ }
    return () => unsubscribe?.();
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const n = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(n);
  }, [notice]);
  useEffect(() => {
    const onHash = () => {
      const v = [...nav.map(([v]) => v), "Settings"].find(
        (v) => v.toLowerCase().replaceAll(" ", "-") === location.hash.slice(1),
      );
      if (v) setView(v as View);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (v: View, f = "All") => {
    setView(v);
    setFilter(f);
    setSearch("");
    setMenu(false);
    location.hash = v.toLowerCase().replaceAll(" ", "-");
  };
  const commit = async (next: LedgerState, message: string) => {
    next = ensureBudgetHistory(next);
    if (saving.current) return false;
    setError("");
    if (demo) {
      setState(next);
      setNotice(message + " · Sample data only");
      return true;
    }
    saving.current = true;
    setBusy(true);
    try {
      revision.current = await saveWorkspace(next, revision.current);
      setState(next);
      setLive(next);
      setNotice(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const switchMode = () => {
    setError("");
    if (demo) {
      if (!live) {
        if (authRequired) setAuthOpen(true);
        else void load();
        return;
      }
      setState(live);
      setDemo(false);
      setMonth(currentMonth());
    } else {
      setState(upgradeState(demoState()));
      setDemo(true);
      setMonth(currentMonth());
    }
  };
  const sendSignInLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthSending(true);
    setAuthMessage("");
    try {
      await auth.signInWithOtp(email.trim(), authRedirectUrl(location.href));
      setAuthMessage("Check your email for a sign-in link. Return to this page after opening it.");
    } catch (e) {
      setAuthMessage((e as Error).message);
    } finally {
      setAuthSending(false);
    }
  };
  const data = totals(state, month);
  const monthMeta = planMetaForMonth(state,month);
  const planningIncome = monthMeta.income || data.earned;
  const totalReview = state.transactions.filter(t=>t.review).length;
  const monthBudgets = budgetsForMonth(state, month);
  const plan = monthBudgets.reduce((n, b) => n + b.limit, 0);
  const runway = runwayEstimate(state);
  const monthlyBills = state.bills.filter((b) => b.date.startsWith(month));
  const upcoming = state.bills
    .filter(
      (b) => !billPaid(b),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const recent = [...data.tx].sort((a, b) => b.date.localeCompare(a.date));
  const monthLabel = new Date(month + "-01T12:00:00").toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric" },
  );
  const titles: Record<View, string> = {
    Overview: "Your month, at a glance.",
    Transactions: "Every little bit adds up.",
    Budget: "Make room for what matters.",
    "Rent & bills": "Life admin, under control.",
    Insights: "Get to know your spending.",
    Settings: "A little more personal.",
  };
  const subtitles: Record<View, string> = {
    Overview: "A little clarity for your money. A little more space for life.",
    Transactions:
      "All your spending in one place. Only check the entries we’re unsure about.",
    Budget:
      "A flexible plan for the essentials, the fun stuff, and future you.",
    "Rent & bills":
      "Keep track of what’s due, and connect payments to your spending.",
    Insights: "Simple patterns that help you decide what to do next.",
    Settings: "Your preferences and shortcuts for next time.",
  };
  const moveMonth = (n: number) => {
    const d = new Date(month + "-01T12:00:00");
    d.setMonth(d.getMonth() + n);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const exportCsv = () => {
    const content =
      "Date,Description,Amount,Category\n" +
      data.tx
        .map((t) =>
          [t.date, t.merchant, t.amount.toFixed(2), t.category]
            .map((s) => '"' + String(s).replaceAll('"', '""') + '"')
            .join(","),
        )
        .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: "text/csv" }));
    a.download = `ledger-${month}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice("Transactions exported");
  };
  const txRows = (items: Transaction[], full = false) => (
    <div className="transaction-list">
      {items.map((t) => (
        <div key={t.id} className="transaction-row">
          <CategoryIcon category={t.category} />
          <button
            className="transaction-info"
            onClick={() => setModal({ type: "transaction", transaction: t })}
          >
            <strong>{t.merchant}</strong>
            <span>
              {categoryName(state,t.category)} <i>·</i> {shortDate(t.date)}
            </span>
          </button>
          {t.review && (
            <button
              className="text-button review-tag"
              onClick={() => setModal({ type: "transaction", transaction: t })}
            >
              Check category
            </button>
          )}
          <strong
            className={"transaction-amount " + (t.amount > 0 ? "positive" : "")}
          >
            {t.amount > 0 ? "+" : "−"}
            {money(Math.abs(t.amount))}
          </strong>
          {full && (
            <button
              className="icon-button delete-small"
              aria-label={`Delete ${t.merchant}`}
              onClick={() => setModal({ type: "delete", transaction: t })}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
  const budgetRows = () => (
    <div className="budget-list">
      {monthBudgets
        .filter((b) => b.category !== "Rent & bills")
        .slice(0, 4)
        .map((b) => {
          const spent = data.byCategory(b.category);
          return (
            <button
              className="budget-item"
              key={b.category}
              onClick={() => setModal({ type: "budget", category: b.category })}
            >
              <div className="budget-item-head">
                <span>
                  <i
                    className="swatch"
                    style={{ background: colours[b.category] || "#8aa39b" }}
                  />
                  {categoryName(state,b.category)}
                </span>
                <span>
                  <strong>{money(spent, 0)}</strong>
                  <small> / {money(b.limit, 0)}</small>
                </span>
              </div>
              <div className="progress">
                <span
                  style={{
                    width: `${Math.min(b.limit ? (spent / b.limit) * 100 : 0, 100)}%`,
                    background:
                      spent > b.limit ? "#c58365" : colours[b.category] || "#8aa39b",
                  }}
                />
              </div>
            </button>
          );
        })}
    </div>
  );
  const billRows = (items: Bill[]) => (
    <div className="bill-list">
      {items.map((b) => {
        const paid = billPaid(b);
        return (
          <div className="bill-row" key={b.id}>
            <span className="date-tile">
              <small>
                {new Date(b.date + "T12:00:00").toLocaleDateString("en-GB", {
                  month: "short",
                })}
              </small>
              <strong>{+b.date.slice(-2)}</strong>
            </span>
            <button
              className="transaction-info"
              onClick={() => setModal({ type: "bill", bill: b })}
            >
              <strong>{b.name}</strong>
              <span>
                {b.recurrence === "once"
                  ? "One-off"
                  : b.recurrence.charAt(0).toUpperCase() +
                    b.recurrence.slice(1)}
                {!paid && b.date < today() ? " · Overdue" : ""}
              </span>
            </button>
            <div className="bill-amount">
              <strong>{money(b.amount)}</strong>
              {paid ? (
                <span className="pill">
                  <Check size={12} />
                  Paid
                </span>
              ) : (
                <button
                  className="text-button"
                  onClick={() => setModal({ type: "payment", bill: b })}
                >
                  Record payment
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
  const filtered = recent.filter(
    (t) =>
      (!search || t.merchant.toLowerCase().includes(search.toLowerCase())) &&
      (filter === "All" ||
        (filter === "To check" && t.review) ||
        (filter === "Money in" && t.amount > 0) ||
        (filter === "Money out" && t.amount < 0)),
  );
  return (
    <div className="app">
      <aside className={"sidebar " + (menu ? "mobile-open" : "")}>
        <button className="brand" onClick={() => go("Overview")}>
          <span className="brand-mark">
            <Layers size={24} />
          </span>
          ledger<span className="brand-dot">.</span>
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">
            {state.name?.charAt(0) || "Y"}
          </span>
          <span>
            Your personal space<small>One less thing to worry about</small>
          </span>
        </div>
        <div className="nav-caption">YOUR MONEY</div>
        <nav>
          {nav.map(([v, Icon]) => (
            <button
              key={v}
              onClick={() => go(v)}
              className={view === v ? "active" : ""}
            >
              <Icon size={19} />
              <span>{v}</span>
              {v === "Transactions" && totalReview > 0 && (
                <span className="nav-count">{totalReview}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <BookOpen size={21} />
            </span>
            <strong>A good place to start</strong>
            <p>Your first month doesn’t have to be perfect.</p>
            <button onClick={() => setModal({ type: "setup" })}>
              Set up your month <Plus size={15} />
            </button>
          </div>
          <button
            className={"side-link " + (view === "Settings" ? "active" : "")}
            onClick={() => go("Settings")}
          >
            <Settings size={18} /> Settings
          </button>
          <button
            className="side-link"
            onClick={() => setModal({ type: "help" })}
          >
            <CircleHelp size={18} /> A little help
          </button>
          <div className="profile">
            <span className="profile-avatar">
              {state.name?.charAt(0) || "Y"}
            </span>
            <div>
              <strong>{state.name || "Your account"}</strong>
              <small>{demo ? "Exploring Ledger" : "Personal account"}</small>
            </div>
            <button
              className="icon-button"
              aria-label="Account settings"
              onClick={() => go("Settings")}
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              onClick={() => setMenu(!menu)}
              aria-label="Toggle navigation"
            >
              <Layers size={22} />
            </button>
            <span>Your money</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span className="sample-label">
              {demo ? "Sample data" : "Your money"}
            </span>
            <button
              className="mode-button"
              onClick={switchMode}
              disabled={loading}
            >
              {loading ? (
                <LoaderCircle size={14} className="spin" />
              ) : demo ? (
                "Use my own money"
              ) : (
                "Explore example"
              )}
              {!loading && <ChevronRight size={14} />}
            </button>
            {!demo && <button className="text-button" onClick={() => void auth.signOut().catch(e => setError((e as Error).message))}>Sign out</button>}
            <button
              className="top-avatar"
              onClick={() => go("Settings")}
              aria-label="Open your settings"
            >
              {state.name?.charAt(0) || "Y"}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {view === "Overview"
                  ? `LET’S CHECK IN${state.name ? ", " + state.name.toUpperCase() : ""}`
                  : "YOUR " + view.toUpperCase()}
              </p>
              <h1>{titles[view]}</h1>
              <p className="page-subtitle">{subtitles[view]}</p>
            </div>
            <div className="heading-actions">
              {view !== "Settings" && (
                <div className="month-picker">
                  <button
                    aria-label="Previous month"
                    onClick={() => moveMonth(-1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <input
                    aria-label="Choose month"
                    type="month"
                    value={month}
                    onChange={(e) => e.target.value && setMonth(e.target.value)}
                  />
                  <button aria-label="Next month" onClick={() => moveMonth(1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
              <button
                className="button primary"
                onClick={() =>
                  setModal(
                    view === "Rent & bills"
                      ? { type: "bill" }
                      : { type: "import" },
                  )
                }
              >
                {view === "Rent & bills" ? (
                  <Plus size={16} />
                ) : (
                  <Upload size={16} />
                )}{" "}
                {view === "Rent & bills" ? "Add a bill" : "Import transactions"}
              </button>
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <CircleAlert size={18} />
              <span>{error}</span>
              <button onClick={() => void load()}>Try loading again</button>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {demo && (
            <div className="demo-notice">
              <span>
                <Sparkles size={15} /> You’re exploring an example month. Try
                things out — these aren’t your bank transactions.
              </span>
              <button onClick={switchMode} disabled={loading}>
                Start your own month
              </button>
            </div>
          )}
          {!state.setup && (
            <div className="setup-banner">
              <span className="setup-symbol">
                <PiggyBank size={28} />
              </span>
              <div>
                <strong>Start small. Get a clear picture.</strong>
                <p>
                  Import a bank CSV to see where your money went. Make a spending plan whenever you’re ready.
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => setModal({ type: "import" })}
              >
                Import spending
              </button>
            </div>
          )}
          {view === "Overview" && (
            <>
              <section className="summary-grid">
                <div className="metric main-metric">
                  <div className="metric-label">
                    <span>Monthly planning estimate</span>
                    <Wallet size={18} />
                  </div>
                  <div className="metric-number">{money(data.available)}</div>
                  <div className="metric-detail">
                    <span className="check-circle">
                      <Check size={12} />
                    </span>
                    {data.available >= 0
                      ? "Based on imported or expected monthly income"
                      : "Spending and planned bills exceed this estimate"}
                  </div>
                  <div className="metric-footer">
                    <span>After {money(data.unpaid, 0)} in upcoming bills</span>
                    <button
                      aria-label="Understand available money"
                      onClick={() => setModal({ type: "help" })}
                    >
                      <CircleHelp size={15} />
                    </button>
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-label">
                    <span>Spent so far</span>
                    <ArrowUpRight size={19} />
                  </div>
                  <div className="metric-number">{money(data.spent)}</div>
                  <div className="metric-detail muted">
                    of {money(plan, 0)} planned this month
                  </div>
                  <div className="metric-progress">
                    <span
                      style={{
                        width: `${Math.min(plan ? (data.spent / plan) * 100 : 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="metric">
                  <div className="metric-label">
                    <span>Set aside for future you</span>
                    <PiggyBank size={20} />
                  </div>
                  <div className="metric-number">{money(data.saved)}</div>
                  <div className="metric-detail">
                    <span className="pill">
                      <Check size={12} />
                      {monthMeta.savings
                        ? `${Math.round((data.saved / monthMeta.savings) * 100)}% of your goal`
                        : "Choose a savings goal"}
                    </span>
                  </div>
                  <div className="metric-footer muted">
                    {money(monthMeta.savings, 0)} monthly savings goal
                  </div>
                </div>
              </section>
              <section className="card runway-card"><div className="card-heading"><div><h2>Until your next payment</h2><p>{runway ? `About ${money(runway.weekly,0)} per week until ${shortDate(state.runway!.nextPaymentDate)}` : "Set a payment date to see a weekly planning estimate."}</p></div><button className="button outline" onClick={()=>setModal({type:"runway"})}>{runway ? "Update estimate" : "Plan ahead"}</button></div>{runway && <p className="muted">{money(runway.available,0)} after {money(runway.bills,0)} in unpaid bills and {money(runway.remainingSavings,0)} still to set aside. {state.runway?.mode==="estimate" ? `Rough estimate from imported activity since ${shortDate(runway.start)}; opening balances or other accounts may be missing.` : "Based on the spending-account money you entered, not a live bank balance."}</p>}</section>
              {totalReview > 0 && (
                <div className="attention-banner">
                  <span className="attention-symbol">
                    <CheckCheck size={19} />
                  </span>
                  <div>
                    <strong>
                      Just {totalReview}{" "}
                      {totalReview === 1
                        ? "transaction needs"
                        : "transactions need"}{" "}
                      a quick check.
                    </strong>
                    <p>
                      Everything else has been sorted into categories for you.
                    </p>
                  </div>
                  <button
                    className="button outline small"
                    onClick={() => go("Transactions", "To check")}
                  >
                    Take a look{" "}
                    <span className="count-small">{totalReview}</span>
                  </button>
                </div>
              )}
              <div className="dashboard-grid">
                <section className="card spending-card">
                  <div className="card-heading">
                    <div>
                      <h2>Spending this month</h2>
                      <p>Your spending, with a little perspective.</p>
                    </div>
                    <span className="mini-select">
                      {monthLabel.split(" ")[0]} <CalendarDays size={14} />
                    </span>
                  </div>
                  <div className="chart-key">
                    <span>
                      <i className="solid-key" />
                      Your spending
                    </span>
                    <span>
                      <i className="dashed-key" />
                      Your plan
                    </span>
                  </div>
                  {data.tx.length ? (
                    <Chart state={state} month={month} />
                  ) : (
                    <Empty
                      title="Your month starts here"
                      body="Import a bank CSV to see how your spending adds up."
                      action={
                        <button
                          className="button outline"
                          onClick={() => setModal({ type: "import" })}
                        >
                          Import a CSV
                        </button>
                      }
                    />
                  )}
                  <div className="chart-foot">
                    <span className="light-icon">
                      <Sparkles size={15} />
                    </span>
                    <p>
                      {plan
                        ? `${money(Math.max(0, plan - data.spent), 0)} left in your spending plan. A little breathing room.`
                        : "Set a simple spending plan to give your month some direction."}
                    </p>
                  </div>
                </section>
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Your spending plan</h2>
                      <p>A little balance goes a long way.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => go("Budget")}
                    >
                      View all
                    </button>
                  </div>
                  {monthBudgets.length ? (
                    budgetRows()
                  ) : (
                    <Empty
                      title="Give every pound a purpose"
                      body="Start with everyday essentials and a little room for fun."
                      action={
                        <button
                          className="button outline"
                          onClick={() => setModal({ type: "setup" })}
                        >
                          Make a plan
                        </button>
                      }
                    />
                  )}
                  <button
                    className="card-bottom-link"
                    onClick={() => go("Budget")}
                  >
                    <SlidersHorizontal size={15} /> Adjust your plan
                  </button>
                </section>
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Recent transactions</h2>
                      <p>The little things, all in one place.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => go("Transactions")}
                    >
                      View all
                    </button>
                  </div>
                  {recent.length ? (
                    txRows(recent.slice(0, 4))
                  ) : (
                    <Empty
                      title="Nothing here yet"
                      body="Import your spending, or add your first transaction."
                      action={
                        <button
                          className="button outline"
                          onClick={() => setModal({ type: "transaction" })}
                        >
                          Add transaction
                        </button>
                      }
                    />
                  )}
                </section>
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Coming up</h2>
                      <p>Keep the important things on your radar.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => go("Rent & bills")}
                    >
                      View all
                    </button>
                  </div>
                  {upcoming.length ? (
                    billRows(upcoming.slice(0, 3))
                  ) : (
                    <Empty
                      title="All clear for now"
                      body="Add rent or a regular bill so it doesn’t sneak up on you."
                      action={
                        <button
                          className="text-button"
                          onClick={() => setModal({ type: "bill" })}
                        >
                          Add a bill
                        </button>
                      }
                    />
                  )}
                  <div className="bill-note">
                    <ShieldCheck size={15} />
                <span>Bills due this month are already set aside above.</span>
                  </div>
                </section>
              </div>
              <footer className="page-footer">
                <span>
                  <Layers size={14} /> A little less money stress.
                </span>
                <span>One month at a time.</span>
              </footer>
            </>
          )}
          {view === "Transactions" && (
            <>
              <div className="toolbar">
                <div className="tabs">
                  {["All", "To check", "Money in", "Money out"].map((f) => (
                    <button
                      key={f}
                      className={filter === f ? "selected" : ""}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                      {f === "To check" && <span>{totalReview}</span>}
                    </button>
                  ))}
                </div>
                <div className="toolbar-actions">
                  <label className="search">
                    <Search size={17} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Find a transaction"
                      aria-label="Search transactions"
                    />
                  </label>
                  <button
                    className="button outline"
                    onClick={() => setModal({ type: "transaction" })}
                  >
                    <Plus size={16} />
                    Add
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Export this month as CSV"
                    onClick={exportCsv}
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
              {filter === "To check" ? <ReviewPanel state={state} busy={busy} commit={commit} /> : <>
              <section className="card transactions-card">
                <div className="table-caption">
                  <span>{monthLabel}</span>
                  <span>{filtered.length} transactions</span>
                </div>
                {filtered.length ? (
                  txRows(filtered, true)
                ) : (
                  <Empty
                    title={
                      filter === "To check"
                        ? "You’re all caught up"
                        : "No transactions found"
                    }
                    body={
                      search
                        ? "Try a different merchant name."
                        : "Import a bank CSV or choose another month."
                    }
                    action={
                      !search && filter !== "To check" ? (
                        <button
                          className="button primary"
                          onClick={() => setModal({ type: "import" })}
                        >
                          Import transactions
                        </button>
                      ) : undefined
                    }
                  />
                )}
              </section>
              </>}
              <section className="card history-card">
                <div className="card-heading">
                  <div>
                    <h2>Your imports</h2>
                    <p>A clear record of what you’ve added.</p>
                  </div>
                </div>
                {state.imports.length ? (
                  state.imports.map((i) => (
                    <div className="history-row" key={i.id}>
                      <FileText size={20} />
                      <div>
                        <strong>{i.name}</strong>
                        <small>
                          {shortDate(i.date)} · {i.count} added · {i.duplicates}{" "}
                          duplicates skipped
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={() =>
                          setModal({ type: "undo", importId: i.id })
                        }
                      >
                        Undo import
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="muted">No bank CSVs imported yet.</p>
                )}
              </section>
            </>
          )}
          {view === "Budget" && (
            <>
              <section className="plan-summary">
                <div>
                  <p>{monthMeta.income ? "Expected monthly money" : "Imported income so far"}</p>
                  <strong>{money(planningIncome, 0)}</strong>
                </div>
                <span>−</span>
                <div>
                  <p>Spending plan</p>
                  <strong>{money(plan, 0)}</strong>
                </div>
                <span>−</span>
                <div>
                  <p>Savings goal</p>
                  <strong>{money(monthMeta.savings, 0)}</strong>
                </div>
                <span>=</span>
                <div>
                  <p>Room to spare</p>
                  <strong
                    className={
                      planningIncome - plan - monthMeta.savings < 0
                        ? "negative"
                        : "positive"
                    }
                  >
                    {money(
                      planningIncome - plan - monthMeta.savings,
                      0,
                    )}
                  </strong>
                </div>
                <button
                  className="button outline"
                  onClick={() => setModal({ type: "setup" })}
                >
                  Edit monthly money
                </button>
              </section>
              <div className="budget-page-grid">
                {["Essentials", "Everyday life"].map((group) => (
                  <section className="card" key={group}>
                    <div className="card-heading">
                      <div>
                        <h2>{group}</h2>
                        <p>
                          {group === "Essentials"
                            ? "The things you need to cover."
                            : "Good food, friends, and a little fun."}
                        </p>
                      </div>
                      {group === "Essentials" ? (
                        <House size={21} />
                      ) : (
                        <Coffee size={21} />
                      )}
                    </div>
                    {monthBudgets
                      .filter(
                        (b) =>
                          ["Groceries", "Meal Plan", "Transport", "Rent & bills", "Rent & Housing", "Utilities", "Health"].includes(
                            b.category,
                          ) ===
                          (group === "Essentials"),
                      )
                      .map((b) => {
                        const spent = data.byCategory(b.category);
                        return (
                          <button
                            className="budget-tile"
                            key={b.category}
                            onClick={() =>
                              setModal({ type: "budget", category: b.category })
                            }
                          >
                            <div>
                              <CategoryIcon category={b.category} />
                              <strong>{categoryName(state,b.category)}</strong>
                              <span className="text-button">Edit</span>
                            </div>
                            <p>
                              <strong>{money(spent)}</strong>
                              <span> of {money(b.limit)} planned</span>
                            </p>
                            <div className="progress">
                              <span
                                style={{
                                  width: `${Math.min(b.limit ? (spent / b.limit) * 100 : 0, 100)}%`,
                                  background:
                                    spent > b.limit
                                      ? "#c58365"
                                      : colours[b.category] || "#8aa39b",
                                }}
                              />
                            </div>
                            <small>
                              {money(Math.abs(b.limit - spent))}{" "}
                              {spent > b.limit ? "over your plan" : "left"}
                            </small>
                          </button>
                        );
                      })}
                  </section>
                ))}
              </div>
              <button
                className="button outline add-category"
                onClick={() => setModal({ type: "budget" })}
              >
                <Plus size={17} />
                Add a category to your plan
              </button>
              <div className="plain-note">
                <CircleHelp size={17} />
                Your plan is a guide, not a grade. Adjust it whenever life
                changes.
              </div>
            </>
          )}
          {view === "Rent & bills" && (
            <>
              <section className="summary-grid">
                <div className="metric">
                  <div className="metric-label">
                    Due this month <Landmark size={18} />
                  </div>
                  <div className="metric-number">
                    {money(monthlyBills.reduce((n, b) => n + b.amount, 0))}
                  </div>
                  <p className="muted">
                    {monthlyBills.length} regular payments
                  </p>
                </div>
                <div className="metric">
                  <div className="metric-label">
                    Still to pay <CalendarDays size={18} />
                  </div>
                  <div className="metric-number">{money(data.unpaid)}</div>
                  <p className="muted">Reserved in your monthly overview</p>
                </div>
                <div className="metric">
                  <div className="metric-label">
                    Paid this month <CheckCheck size={18} />
                  </div>
                  <div className="metric-number">
                    {
                      monthlyBills.filter((b) =>
                        b.payments.some((p) => p.date.slice(0, 7) === month),
                      ).length
                    }
                  </div>
                  <p className="muted">Confirmed against a spending entry</p>
                </div>
              </section>
              <div className="plain-note">
                <ShieldCheck size={19} />A bill is a reminder. Recording its
                payment links an existing transaction or adds one new spending
                entry.
              </div>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Your rent & bills</h2>
                    <p>Click a bill to edit it or see its payment history.</p>
                  </div>
                </div>
                {state.bills.length ? (
                  billRows(
                    [...state.bills].sort((a, b) =>
                      a.date.localeCompare(b.date),
                    ),
                  )
                ) : (
                  <Empty
                    title="Give life admin a home"
                    body="Add rent, utilities, or another regular payment."
                    action={
                      <button
                        className="button primary"
                        onClick={() => setModal({ type: "bill" })}
                      >
                        Add your first bill
                      </button>
                    }
                  />
                )}
              </section>
            </>
          )}
          {view === "Insights" && (
            <>
              <div className="insights-grid">
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>Where your money went</h2>
                      <p>Spending by category in {monthLabel}.</p>
                    </div>
                  </div>
                  {data.spent > 0 ? (
                    <div className="category-breakdown">
                      <div
                        className="donut"
                        style={{
                          background: `conic-gradient(${(() => {
                            let p = 0;
                            return categoryOptions(state).map(c=>c.id)
                              .filter((c) => data.byCategory(c) > 0)
                              .map((c) => {
                                const start = p;
                                p += (data.byCategory(c) / data.spent) * 100;
                                return `${colours[c] || "#8aa39b"} ${start}% ${p}%`;
                              })
                              .join(",");
                          })()})`,
                        }}
                      >
                        <div>
                          <span>Total spent</span>
                          <strong>{money(data.spent, 0)}</strong>
                        </div>
                      </div>
                      <div className="breakdown-list">
                        {categoryOptions(state).map(c=>c.id)
                          .filter((c) => data.byCategory(c) > 0)
                          .sort(
                            (a, b) => data.byCategory(b) - data.byCategory(a),
                          )
                          .map((c) => (
                            <div key={c}>
                              <span>
                                <i style={{ background: colours[c] || "#8aa39b" }} />
                                {categoryName(state,c)}
                              </span>
                              <strong>{money(data.byCategory(c))}</strong>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <Empty
                      title="A picture is on its way"
                      body="Add transactions to see where your money goes."
                    />
                  )}
                </section>
                <section className="card">
                  <div className="card-heading">
                    <div>
                      <h2>A few things to notice</h2>
                      <p>Small observations. Useful next steps.</p>
                    </div>
                    <Sparkles size={20} />
                  </div>
                  {data.spent > 0 ? (
                    <div className="insight-list">
                      <div>
                        <span className="light-icon">
                          <Wallet size={20} />
                        </span>
                        <h3>
                          {money(data.available, 0)} left after bills and
                          savings
                        </h3>
                        <p>
                          {data.available >= 0
                            ? "Your fixed commitments are accounted for. This is what’s left from your monthly money."
                            : "Spending and commitments are greater than your monthly money. Take a look at your plan."}
                        </p>
                        <button
                          className="text-button"
                          onClick={() => go("Budget")}
                        >
                          See your plan
                        </button>
                      </div>
                      {monthBudgets
                        .filter((b) => data.byCategory(b.category) > b.limit)
                        .map((b) => (
                          <div key={b.category}>
                            <h3>
                              {categoryName(state,b.category)} is{" "}
                              {money(data.byCategory(b.category) - b.limit, 0)}{" "}
                              over
                            </h3>
                            <p>
                              You can move a little money in your plan or slow
                              this category down.
                            </p>
                            <button
                              className="text-button"
                              onClick={() =>
                                setModal({
                                  type: "budget",
                                  category: b.category,
                                })
                              }
                            >
                              Adjust {b.category.toLowerCase()}
                            </button>
                          </div>
                        ))}
                      <div>
                        <h3>
                          {data.review
                            ? "A quick check will make this clearer"
                            : "Your categories are up to date"}
                        </h3>
                        <p>
                          {data.review
                            ? `${data.review} entries still need a category check. The totals include those entries.`
                            : "All this month’s transactions have a confirmed category."}
                        </p>
                        {data.review > 0 && (
                          <button
                            className="text-button"
                            onClick={() => go("Transactions", "To check")}
                          >
                            Check transactions
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Empty
                      title="Let’s get some perspective"
                      body="Insights appear after you add some spending."
                    />
                  )}
                </section>
              </div>
              <section className="card history-card">
                <div className="card-heading">
                  <h2>Spending across the month</h2>
                </div>
                <Chart state={state} month={month} />
              </section>
            </>
          )}
          {view === "Settings" && (
            <SettingsPanel
              key={String(demo)}
              state={state}
              commit={commit}
              busy={busy}
              demo={demo}
              onMode={switchMode}
            />
          )}
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <Dialog
          title={
            modal.type === "import"
              ? "Bring your spending together"
              : modal.type === "setup"
                ? "A fresh start for your month"
                : modal.type === "runway"
                  ? "Plan until your next payment"
                : modal.type === "transaction"
                  ? modal.transaction
                    ? "Check this transaction"
                    : "Add a transaction"
                  : modal.type === "bill"
                    ? modal.bill
                      ? "Your bill details"
                      : "Add rent or a bill"
                    : modal.type === "payment"
                      ? "Record a bill payment"
                      : modal.type === "budget"
                        ? "A little room in your plan"
                        : modal.type === "delete"
                          ? "Delete this transaction?"
                          : modal.type === "undo"
                            ? "Undo this import?"
                            : "A little help with Ledger"
          }
          close={() => {
            if (!busy) setModal(null);
          }}
        >
          {error && (
            <div className="dialog-error" role="alert">
              <p>{error}</p>
              <button className="text-button" onClick={() => void load()}>
                Refresh saved data & keep this form
              </button>
            </div>
          )}
          <ModalContent
            modal={modal}
            state={state}
            busy={busy}
            commit={commit}
            close={() => setModal(null)}
            onImport={(m) => {
              setMonth(m);
              go("Transactions", "To check");
            }}
            month={month}
          />
        </Dialog>
      )}
      {authOpen && (
        <Dialog title="Your private Ledger" close={() => setAuthOpen(false)}>
          <div className="ledger-auth">
            <p>Enter your email and we’ll send a sign-in link. Your transactions and plans will be saved to your own account.</p>
            <form onSubmit={(event) => void sendSignInLink(event)}>
              <label htmlFor="ledger-email">Email address</label>
              <input id="ledger-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              <button className="button primary" type="submit" disabled={authSending}>{authSending ? "Sending…" : "Email me a sign-in link"}</button>
            </form>
            {authMessage && <p role="status">{authMessage}</p>}
          </div>
        </Dialog>
      )}
    </div>
  );
}

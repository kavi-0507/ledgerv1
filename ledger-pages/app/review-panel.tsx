"use client";
import { useState } from "react";
import { type LedgerState, type Transaction, applyGroupCategory, categoryName, categoryOptions, money, reviewGroups, shortDate } from "@/lib/ledger";

type Props = { state: LedgerState; busy: boolean; commit: (next: LedgerState, message: string) => Promise<boolean> };

function GroupCard({ state, group, busy, commit }: Props & { group: ReturnType<typeof reviewGroups>[number] }) {
  const [category, setCategory] = useState(group.transactions[0].category);
  const [remember, setRemember] = useState(true);
  return <article className="card review-group">
    <div className="card-heading"><div><h2>{group.transactions[0].merchant}</h2><p>{group.transactions.length} payment{group.transactions.length === 1 ? "" : "s"} · {money(group.transactions.reduce((n,t) => n + Math.abs(t.amount),0))} total</p></div></div>
    <p className="muted">{group.transactions.slice(0,3).map(t => `${shortDate(t.date)} ${money(t.amount)}`).join(" · ")}{group.transactions.length > 3 ? " · …" : ""}</p>
    <div className="review-actions"><label>Category <select value={category} onChange={e => setCategory(e.target.value)}>{categoryOptions(state).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="checkbox-label"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/><span>Use this for future payments from this merchant</span></label>
    <button className="button primary" disabled={busy} onClick={() => void commit(applyGroupCategory(state,group.key,category,remember),`${group.transactions.length} payments checked`)}>Confirm {group.transactions.length}</button></div>
  </article>;
}

function ExceptionCard({ state, transaction, busy, commit }: Props & { transaction: Transaction }) {
  const [category,setCategory] = useState(transaction.category);
  const reasons = transaction.reviewReasons || ["category"];
  const duplicate = reasons.includes("possible_duplicate");
  const refund = reasons.includes("refund");
  const title = duplicate ? "Possible duplicate" : refund ? "Possible refund or reversal" : "Check this entry";
  const resolve = async (remove: boolean) => {
    const linked = state.bills.some(b => b.payments.some(p => p.transactionId === transaction.id));
    if (remove && linked) return;
    const next = remove ? { ...state, transactions: state.transactions.filter(t => t.id !== transaction.id) } : { ...state, transactions: state.transactions.map(t => t.id === transaction.id ? { ...t, category, review: false, reviewReasons: [] } : t) };
    await commit(next, remove ? "Duplicate removed" : "Entry confirmed");
  };
  return <article className="card review-group"><h2>{title}</h2><p>{shortDate(transaction.date)} · {transaction.merchant} · {money(transaction.amount)} · {categoryName(state,transaction.category)}</p>
    <p className="muted">{duplicate ? "A similar amount appears near this date. Check whether this is a separate payment." : "Refunds and reversals can change your totals. Check the entry before confirming."}</p>
    <div className="review-actions"><label>Category <select value={category} onChange={e=>setCategory(e.target.value)}>{categoryOptions(state).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><button className="button outline" disabled={busy} onClick={() => void resolve(false)}>{duplicate ? "Keep this payment" : "Confirm this entry"}</button>{duplicate && <button className="button outline" disabled={busy || state.bills.some(b => b.payments.some(p => p.transactionId === transaction.id))} onClick={() => void resolve(true)}>Remove duplicate</button>}</div>
  </article>;
}

export default function ReviewPanel(p: Props) {
  const groups = reviewGroups(p.state);
  const exceptions = p.state.transactions.filter(t => t.review && (t.reviewReasons || []).some(r => r !== "category"));
  return <div className="review-list"><div className="plain-note">One category choice can sort a whole merchant group. Previously confirmed payments stay as they are.</div>
    {groups.map(g => <GroupCard key={g.key} {...p} group={g}/>)}
    {exceptions.map(t => <ExceptionCard key={t.id} {...p} transaction={t}/>)}
    {!groups.length && !exceptions.length && <div className="card empty-review"><h2>All caught up</h2><p>There’s nothing to check right now.</p></div>}
  </div>;
}

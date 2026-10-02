"use client";
import { useState } from "react";
import { type LedgerState, type Budget, budgetsForMonth, categoryName, currentMonth, money, planMetaForMonth, saveMonthBudgets, suggestBudgets } from "@/lib/ledger";
import { Field, type FormProps } from "./forms";

export default function PlanSetup({ state, busy, commit, close, month }: FormProps & {month: string}) {
  const suggestion = suggestBudgets(state, month);
  const existing = budgetsForMonth(state,month);
  const meta = planMetaForMonth(state,month);
  const [budgets,setBudgets] = useState<Budget[]>(existing.length ? existing : suggestion.budgets);
  const [name,setName] = useState(state.name);
  const [income,setIncome] = useState(String(meta.income || ""));
  const [savings,setSavings] = useState(String(meta.savings || ""));
  const [error,setError] = useState("");
  const save = async () => {
    if (budgets.some(b => !Number.isFinite(b.limit) || b.limit < 0) || +income < 0 || +savings < 0 || !Number.isFinite(+income) || !Number.isFinite(+savings)) { setError("Check your amounts and try again."); return; }
    const updateOngoing = month >= currentMonth();
    const base: LedgerState = { ...state, name: name.trim(), income: updateOngoing ? (+income || 0) : state.income, savings: updateOngoing ? (+savings || 0) : state.savings, setup: true };
    const next = saveMonthBudgets(base,month,budgets,+income||0,+savings||0);
    if (await commit(next,"Monthly plan saved")) close();
  };
  return <div>
    <p className="dialog-description">Your spending already appears without a budget. These limits are optional and can be changed for this month without rewriting earlier months.</p>
    <Field label="Your first name"><input maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></Field>
    <div className="form-grid"><Field label="Expected monthly money (£, optional)"><input type="number" min="0" max="1000000000" value={income} onChange={e=>setIncome(e.target.value)}/></Field><Field label="Monthly savings goal (£, optional)"><input type="number" min="0" max="1000000000" value={savings} onChange={e=>setSavings(e.target.value)}/></Field></div>
    <div className="plain-note"><span>{suggestion.basis}</span><button className="text-button" type="button" onClick={()=>setBudgets(suggestion.budgets.map(b=>({...b})))}>Use these suggested amounts</button></div>
    <div className="setup-plan">{budgets.map(b=><Field key={b.category} label={categoryName(state,b.category)}><div className="currency-input"><span>£</span><input type="number" min="0" max="1000000000" step="1" value={b.limit} onChange={e=>setBudgets(budgets.map(x=>x.category===b.category?{...x,limit:+e.target.value}:x))}/></div></Field>)}</div>
    {income && <p className="muted">{money(+income-(+savings||0)-budgets.reduce((n,b)=>n+b.limit,0),0)} not assigned to these limits. This is a planning comparison, not your bank balance.</p>}
    {error && <p className="dialog-error">{error}</p>}
    <div className="dialog-actions"><button className="button outline" type="button" onClick={close}>Maybe later</button><button className="button primary" type="button" disabled={busy} onClick={()=>void save()}>Save this month’s plan</button></div>
  </div>;
}

"use client";
import { useState } from "react";
import { today, type Runway } from "@/lib/ledger";
import { Field, type FormProps } from "./forms";

export default function RunwayForm({state,busy,commit,close}:FormProps) {
  const [mode,setMode]=useState<Runway["mode"]>(state.runway?.mode || "manual");
  const [available,setAvailable]=useState(String(state.runway?.availableNow ?? ""));
  const [next,setNext]=useState(state.runway?.nextPaymentDate || "");
  const [start,setStart]=useState(state.runway?.estimateFrom || today().slice(0,7)+"-01");
  const [error,setError]=useState("");
  const save=async()=>{
    if(next<=today()){setError("Choose a future payment date.");return;}
    if(mode==="manual" && (!Number.isFinite(+available)||+available<0||available==="")){setError("Enter the money in your spending account today.");return;}
    if(mode==="estimate" && (start>today() || !state.transactions.some(t=>t.date>=start && t.date<=today() && t.amount>0 && t.category==="Income"))){setError("Choose a start date with imported income, or enter your balance manually.");return;}
    const runway:Runway={mode,nextPaymentDate:next,...(mode==="manual"?{availableNow:+available,recordedAt:today()}:{estimateFrom:start})};
    if(await commit({...state,runway},"Payment plan saved"))close();
  };
  return <div><p className="dialog-description">See a weekly planning estimate until your next payment. You can change it whenever your situation changes.</p>
    <div className="segmented"><button type="button" className={mode==="manual"?"selected":""} onClick={()=>setMode("manual")}>Enter manually</button><button type="button" className={mode==="estimate"?"selected":""} onClick={()=>setMode("estimate")}>Rough estimate</button></div>
    {mode==="manual"?<Field label="Money in your spending account today (£)" hint="Include money you can spend now, before upcoming bills. Savings already set aside elsewhere should not be included."><input type="number" min="0" max="1000000000" step="0.01" value={available} onChange={e=>setAvailable(e.target.value)}/></Field>:<><Field label="Count imported transactions from"><input type="date" value={start} onInput={e=>setStart(e.currentTarget.value)} onChange={e=>setStart(e.target.value)}/></Field><p className="plain-note">This adds imported income and subtracts imported spending since the chosen date. It may miss an opening balance, cash or other accounts. Treat it as a rough guide.</p></>}
    <Field label="Next payment date"><input type="date" value={next} onInput={e=>setNext(e.currentTarget.value)} onChange={e=>setNext(e.target.value)}/></Field>
    {error && <p className="dialog-error">{error}</p>}
    <div className="dialog-actions"><button type="button" className="button outline" onClick={close}>Cancel</button><button type="button" className="button primary" disabled={busy} onClick={()=>void save()}>Show my weekly estimate</button></div>
  </div>;
}

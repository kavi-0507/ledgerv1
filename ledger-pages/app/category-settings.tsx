"use client";
import { useState, type FormEvent } from "react";
import { categories, categoryOptions, type LedgerState } from "@/lib/ledger";
import { Field, type FormProps } from "./forms";

export default function CategorySettings({state,busy,commit}:Omit<FormProps,"close">) {
  const [name,setName]=useState("");
  const [replacement,setReplacement]=useState("Other");
  const [error,setError]=useState("");
  const [editing,setEditing]=useState<string|null>(null);
  const [editName,setEditName]=useState("");
  const add=async(e:FormEvent)=>{e.preventDefault();const value=name.trim();if(!value)return;
    if(categoryOptions(state).some(c=>c.name.toLowerCase()===value.toLowerCase())){setError("That category already exists.");return;}
    if(await commit({...state,categoryDefs:[...(state.categoryDefs||[]),{id:crypto.randomUUID(),name:value,custom:true}]},"Category added")){setName("");setError("");}
  };
  const rename=async(id:string,oldName:string)=>{const value=editName.trim();if(!value||value===oldName){setEditing(null);return;}
    if(categoryOptions(state).some(c=>c.id!==id&&c.name.toLowerCase()===value.toLowerCase())){setError("That category already exists.");return;}
    if(await commit({...state,categoryDefs:(state.categoryDefs||[]).map(c=>c.id===id?{...c,name:value}:c)},"Category renamed")){setEditing(null);setError("");}
  };
  const remove=async(id:string)=>{if(replacement===id){setError("Choose another category to receive these entries.");return;}
    const remap=(category:string)=>category===id?replacement:category;
    const merge=(budgets:LedgerState["budgets"])=>{const totals=new Map<string,number>();for(const b of budgets)totals.set(remap(b.category),(totals.get(remap(b.category))||0)+b.limit);return [...totals].map(([category,limit])=>({category,limit}));};
    await commit({...state,categoryDefs:(state.categoryDefs||[]).filter(c=>c.id!==id),transactions:state.transactions.map(t=>({...t,category:remap(t.category)})),rules:state.rules.map(r=>({...r,category:remap(r.category)})),budgets:merge(state.budgets),budgetMonths:(state.budgetMonths||[]).map(m=>({...m,budgets:merge(m.budgets)}))},"Category removed; entries moved to replacement");
  };
  return <section className="card"><div className="card-heading"><div><h2>Spending categories</h2><p>Details stay available without requiring a budget for each one.</p></div></div>
    <p className="muted">{categories.length} starter categories. Your own categories can be renamed or moved into another category later.</p>
    <div className="rules-list">{(state.categoryDefs||[]).map(c=><div key={c.id}>{editing===c.id?<><input aria-label={`Rename ${c.name}`} maxLength={60} value={editName} onChange={e=>setEditName(e.target.value)}/><button className="text-button" disabled={busy} onClick={()=>void rename(c.id,c.name)}>Save name</button><button className="text-button" onClick={()=>setEditing(null)}>Cancel</button></>:<><strong>{c.name}</strong><span><button className="text-button" disabled={busy} onClick={()=>{setEditing(c.id);setEditName(c.name);}}>Rename</button> <button className="text-button" disabled={busy} onClick={()=>void remove(c.id)}>Move & remove</button></span></>}</div>)}</div>
    {!!state.categoryDefs?.length && <Field label="Move entries to this category when removing one"><select value={replacement} onChange={e=>setReplacement(e.target.value)}>{categoryOptions(state).map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></Field>}
    <form onSubmit={add}><Field label="New category"><input maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Books and course costs"/></Field>{error&&<p className="dialog-error">{error}</p>}<button className="button outline" disabled={busy}>Add category</button></form>
  </section>;
}

export const defaults = ['Rent','Eating out','Groceries','Monthly bills','Dates','Gas'].map((name,i)=>({id:`cat-${i}`,name,limit:0,recurring:0}));
export const empty = () => ({months:{},entries:{}});
export const monthNow = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
export function shiftMonth(m,n) { const [y,mo]=m.split('-').map(Number), d=new Date(y,mo-1+n,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
export function monthLabel(m) { return new Date(`${m}-15T12:00:00`).toLocaleDateString('en-US',{month:'long',year:'numeric'}); }
export function apply(state,op) {
 const s=structuredClone(state);
 if(op.type==='month') { if(!s.months[op.month]) s.months[op.month]={categories:structuredClone(op.categories)}; }
 if(op.type==='category') {
  for(const m of Object.keys(s.months).filter(m=>m>=op.month)) {
   const cats=s.months[m].categories, i=cats.findIndex(c=>c.id===op.category.id);
   if(i<0) cats.push(structuredClone(op.category)); else cats[i]={...cats[i],...op.category};
  }
 }
 if(op.type==='archive') for(const m of Object.keys(s.months).filter(m=>m>=op.month)) { const c=s.months[m].categories.find(c=>c.id===op.id); if(c)c.archived=true; }
 if(op.type==='entry') s.entries[op.entry.id]=structuredClone(op.entry);
 if(op.type==='delete') delete s.entries[op.id];
 if(op.type==='category-order') s.categoryOrder=[...new Set([...op.ids,...(s.categoryOrder||[])])];
 return s;
}
export function monthOps(s,month) {
 const ops=[];
 if(!s.months[month]) {
  const prev=Object.keys(s.months).filter(m=>m<month).sort().at(-1);
  ops.push({type:'month',month,categories:structuredClone(prev?s.months[prev].categories:defaults)});
  s=apply(s,ops[0]);
 }
 if(month<=monthNow()) for(const c of s.months[month].categories) {
  const id=`auto-${month}-${c.id}`;
  if(!c.archived && c.recurring>0 && !s.entries[id]) ops.push({type:'entry',entry:{id,month,category:c.id,amount:c.recurring,kind:'expense',auto:true,created:`${month}-01T12:00:00`}});
 }
 return ops;
}
export function totals(s,m) {
 const cats=orderCategories(s.months[m]?.categories||[],s.categoryOrder), entries=Object.values(s.entries).filter(e=>e.month===m && !e.deleted);
 return {limit:cats.filter(c=>!c.archived).reduce((n,c)=>n+c.limit,0),spent:entries.filter(e=>e.kind==='expense').reduce((n,e)=>n+e.amount,0),income:entries.filter(e=>e.kind==='income').reduce((n,e)=>n+e.amount,0),entries,cats};
}
export function cents(v) { const raw=String(v).trim(),n=Number(raw); if(!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(raw)||!Number.isFinite(n)||n<0||n>99999999) throw Error('Enter an amount with up to two decimal places.'); return Math.round(n*100); }

export function entryUndo(state,entry){
 const previous=state.entries[entry.id];
 return {type:'entry',entry:previous?structuredClone(previous):{...entry,deleted:true}};
}
export function recentEntries(entries,limit=Infinity){
 return [...entries].reverse().sort((a,b)=>(b.recordedAt||b.created).localeCompare(a.recordedAt||a.created)).slice(0,limit);
}
export function orderCategories(categories,ids=[]){
 const rank=new Map(ids.map((id,i)=>[id,i]));
 return [...categories].sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));
}
export function formatMoney(amount,summary=false){
 return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:summary&&amount%100===0?0:2,maximumFractionDigits:2}).format(amount/100);
}

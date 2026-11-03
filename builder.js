import {totals,cents,apply,categoriesForMonth} from './core.js?v=1.4.0';

const KEY='budget-builder-draft-v1';
export function createBuilder(state,month){
 const categories=totals(state,month,true).cats.filter(c=>!c.archived);
 return {month,categories,index:0,stage:categories.length?'category':'review',limits:Object.fromEntries(categories.map(c=>[c.id,String(c.limit/100)])),added:[],returnStage:'review',editAdded:null,addDraft:{name:'',amount:'0'}};
}
export function builderRows(builder){
 return [...builder.categories.map(c=>({...c,limit:cents(builder.limits[c.id])})),...builder.added.map(c=>({...c,limit:cents(c.amount)}))];
}
export function builderTotal(builder){return builderRows(builder).reduce((sum,c)=>sum+c.limit,0);}
export function budgetOperations(state,builder){
 const current=new Map(totals(state,builder.month,true).cats.map(c=>[c.id,c]));
 return builderRows(builder).filter(c=>!current.get(c.id)?.archived).map(c=>{
  if(builder.added.some(added=>added.id===c.id))return {type:'category',month:builder.month,category:{id:c.id,name:c.name,limit:c.limit,recurring:0,archived:false}};
  return {type:'category-limit',month:builder.month,category:current.get(c.id)||c,limit:c.limit};
 });
}
export function projectBuilder(state,builder){
 let projected=state;
 if(!state.months[builder.month])projected=apply(projected,{type:'month',month:builder.month,categories:categoriesForMonth(state,builder.month)});
 for(const operation of budgetOperations(state,builder))projected=apply(projected,operation);
 return totals(projected,builder.month);
}
export function readBuilder(storage=localStorage){
 try{
  const value=JSON.parse(storage.getItem(KEY)||'null');
  if(!value||!/^\d{4}-(0[1-9]|1[0-2])$/.test(value.month)||!Array.isArray(value.categories)||!Array.isArray(value.added)||!value.limits||!['category','add','review'].includes(value.stage))return null;
  if(value.categories.length>1000||value.added.length>1000)return null;
  return value;
 }catch{return null;}
}
export function persistBuilder(value,storage=localStorage){try{storage.setItem(KEY,JSON.stringify(value));}catch{}}
export function clearBuilder(storage=localStorage){try{storage.removeItem(KEY);}catch{}}

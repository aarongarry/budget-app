import {test} from 'node:test';
import assert from 'node:assert/strict';
import {empty,apply,entryUndo,recentEntries,totals,monthOps,orderCategories,formatMoney,cents} from '../core.js';

test('Deletion Undo restores the expense and preserves unrelated offline additions',()=>{
 const expense={id:'new',month:'2026-01',kind:'expense',amount:2500,description:'Lunch'};
 let state=apply(empty(),{type:'entry',entry:expense});
 const deletion={...expense,deleted:true},inverse=entryUndo(state,deletion);
 state=apply(state,{type:'entry',entry:deletion});
 state=apply(state,{type:'entry',entry:{...expense,id:'other',amount:700}});
 state=apply(state,inverse);
 assert.equal(totals(state,'2026-01').spent,3200);
 assert.deepEqual(state.entries.new,expense);
});
test('Undo deletion restores recurring details without generating a duplicate',()=>{
 const entry={id:'auto-2026-01-rent',month:'2026-01',kind:'expense',category:'rent',amount:10000,auto:true,description:'Rent'};
 let state={months:{'2026-01':{categories:[{id:'rent',recurring:10000,limit:10000}]}},entries:{[entry.id]:entry}};
 const inverse=entryUndo(state,{...entry,deleted:true});
 state=apply(apply(state,{type:'entry',entry:{...entry,deleted:true}}),inverse);
 assert.deepEqual(state.entries[entry.id],entry);
 assert.equal(monthOps(state,'2026-01').length,0);
});
test('Activity shows the newest five entries, including tied older timestamps',()=>{
 const entries=Array.from({length:7},(_,i)=>({id:String(i),created:'2026-01-01T12:00:00'}));
 assert.deepEqual(recentEntries(entries,5).map(e=>e.id),['6','5','4','3','2']);
 entries[0].recordedAt='2026-01-02T12:00:00';
 assert.equal(recentEntries(entries,5)[0].id,'0');
 assert.equal(entries.length,7);
});

test('Shared category ordering preserves month snapshots and appends new categories',()=>{
 const cats=[{id:'rent',name:'Rent',limit:1000},{id:'food',name:'Food',limit:500},{id:'gas',name:'Gas',limit:300}];
 const state={months:{'2026-01':{categories:cats},'2026-02':{categories:structuredClone(cats)}},entries:{},categoryOrder:['rent','food']};
 const updated=apply(state,{type:'category-order',ids:['food','rent']});
 assert.deepEqual(totals(updated,'2026-01').cats.map(c=>c.id),['food','rent','gas']);
 assert.equal(totals(updated,'2026-02').limit,1800);
 assert.deepEqual(cats.map(c=>c.id),['rent','food','gas']);
 assert.deepEqual(orderCategories(cats,['unknown','gas']).map(c=>c.id),['gas','rent','food']);
});

test('Summary money hides only zero cents and preserves fractional precision',()=>{
 assert.equal(formatMoney(10000,true),'$100');
 assert.equal(formatMoney(10010,true),'$100.10');
 assert.equal(formatMoney(10001,true),'$100.01');
 assert.equal(formatMoney(10000),'$100.00');
 assert.equal(formatMoney(0,true),'$0');
});

test('The decimal amount field accepts cents and rejects ambiguous or overprecise input',()=>{
 assert.equal(cents('.50'),50);
 assert.equal(cents('12.'),1200);
 assert.equal(cents('12.34'),1234);
 for(const input of ['1.234','1e3','12,34','', '.', '-1'])assert.throws(()=>cents(input));
});

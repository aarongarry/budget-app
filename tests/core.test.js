import {test} from 'node:test';
import assert from 'node:assert/strict';
import {empty,apply,monthOps,totals,shiftMonth,cents} from '../core.js';
test('new months copy limits without spending or income rollover',()=>{
 let s=empty();s=apply(s,{type:'month',month:'2026-01',categories:[{id:'rent',name:'Rent',limit:100000,recurring:0}]});
 s=apply(s,{type:'entry',entry:{id:'a',month:'2026-01',kind:'expense',category:'rent',amount:50000}});
 for(const op of monthOps(s,'2026-02'))s=apply(s,op);
 assert.equal(totals(s,'2026-02').limit,100000);assert.equal(totals(s,'2026-02').spent,0);
 assert.equal(totals(s,'2026-01').spent,50000);
});
test('category edits preserve history and apply forward',()=>{
 let s={months:{'2026-01':{categories:[{id:'a',name:'Food',limit:100}]},'2026-02':{categories:[{id:'a',name:'Food',limit:100}]},'2026-03':{categories:[{id:'a',name:'Food',limit:100}]}},entries:{}};
 s=apply(s,{type:'category',month:'2026-02',category:{id:'a',name:'Groceries',limit:200}});
 assert.equal(s.months['2026-01'].categories[0].name,'Food');assert.equal(s.months['2026-03'].categories[0].limit,200);
});
test('recurring entries are idempotent and deleting one does not recreate it',()=>{
 let s=apply(empty(),{type:'month',month:'2026-01',categories:[{id:'rent',name:'Rent',limit:100000,recurring:100000}]});
 const ops=monthOps(s,'2026-01');for(const op of ops)s=apply(s,op);
 assert.equal(ops.length,1);assert.equal(monthOps(s,'2026-01').length,0);
 s=apply(s,{type:'entry',entry:{...s.entries['auto-2026-01-rent'],deleted:true}});
 assert.equal(monthOps(s,'2026-01').length,0);assert.equal(totals(s,'2026-01').spent,0);
});
test('offline replay merges different expenses over a newer server state',()=>{
 const a={type:'entry',entry:{id:'a',month:'2026-01',kind:'expense',amount:100}},b={type:'entry',entry:{id:'b',month:'2026-01',kind:'expense',amount:200}};
 assert.equal(totals(apply(apply(empty(),a),b),'2026-01').spent,300);
 assert.equal(totals(apply(apply(empty(),a),a),'2026-01').spent,100);
});
test('income never changes spending totals and values use integer cents',()=>{
 let s=apply(empty(),{type:'entry',entry:{id:'i',month:'2026-01',kind:'income',amount:12345}});
 assert.equal(totals(s,'2026-01').spent,0);assert.equal(totals(s,'2026-01').income,12345);
 assert.equal(cents('10.99'),1099);assert.throws(()=>cents('-1'));assert.throws(()=>cents('abc'));
 assert.equal(shiftMonth('2026-01',-1),'2025-12');
});

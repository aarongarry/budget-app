import {test} from 'node:test';
import assert from 'node:assert/strict';
import {empty,apply,entryUndo,recentEntries,totals,monthOps} from '../core.js';

test('Undo removes a new expense and preserves unrelated offline additions',()=>{
 const expense={id:'new',month:'2026-01',kind:'expense',amount:2500,description:'Lunch'};
 const inverse=entryUndo(empty(),expense);
 let state=apply(empty(),{type:'entry',entry:expense});
 state=apply(state,{type:'entry',entry:{...expense,id:'other',amount:700}});
 state=apply(state,inverse);
 assert.equal(totals(state,'2026-01').spent,700);
 assert.equal(state.entries.new.deleted,true);
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

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historyMonths,categoriesForMonth,monthsToCatchUp,totals} from '../core.js';

test('Past months excludes the current month and all future months across a year boundary',()=>{
 const state={months:Object.fromEntries(['2026-10','2026-11','2026-12','2027-01','2027-02'].map(m=>[m,{categories:[]}])),entries:{}};
 assert.deepEqual(historyMonths(state,'2026-11'),['2026-10']);
 assert.deepEqual(historyMonths(state,'2027-02'),['2027-01','2026-12','2026-11','2026-10']);
 assert.ok(state.months['2027-02']);
});

test('Browsing a future month previews inherited limits without creating a saved month',()=>{
 const state={months:{'2026-11':{categories:[{id:'food',name:'Food',limit:10000,recurring:0}]}},entries:{}};
 const before=structuredClone(state),preview=categoriesForMonth(state,'2027-01');
 assert.equal(totals(state,'2027-01').limit,10000);
 preview[0].limit=20000;
 assert.deepEqual(state,before);
 assert.equal(state.months['2027-01'],undefined);
});

test('Saved future plans retain their own category limits',()=>{
 const state={months:{'2026-11':{categories:[{id:'rent',limit:10000}]},'2027-01':{categories:[{id:'rent',limit:20000}]}},entries:{}};
 assert.equal(totals(state,'2027-01').limit,20000);
 assert.deepEqual(historyMonths(state,'2026-11'),[]);
});

test('Future plans cannot prevent missing elapsed months from being initialized',()=>{
 const state={months:{'2026-10':{categories:[]},'2027-02':{categories:[]}},entries:{}};
 assert.deepEqual(monthsToCatchUp(state,'2026-12'),['2026-11','2026-12']);
 assert.deepEqual(monthsToCatchUp({months:{'2027-02':{categories:[]}},entries:{}},'2026-11'),['2026-11']);
});

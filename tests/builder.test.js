import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBuilder,budgetOperations,projectBuilder,persistBuilder,readBuilder,clearBuilder} from '../builder.js';
import {apply,totals} from '../core.js';

function sample(){return {months:{'2026-10':{categories:[{id:'rent',name:'Rent',limit:90000,recurring:90000}]},'2026-11':{categories:[{id:'rent',name:'Rent',limit:100000,recurring:100000},{id:'food',name:'Groceries',limit:20000,recurring:0}]},'2026-12':{categories:[{id:'rent',name:'Future rent',limit:110000,recurring:105000},{id:'food',name:'Groceries',limit:25000,recurring:0}]}},entries:{}};}

test('Builder changes are staged and saving preserves recurring amounts and earlier months',()=>{
 const state=sample(),before=structuredClone(state),builder=createBuilder(state,'2026-11');
 builder.limits.rent='1200';builder.limits.food='300';builder.added.push({id:'dates',name:'Dates',amount:'75.50'});
 assert.deepEqual(state,before);
 const review=projectBuilder(state,builder);
 assert.equal(review.limit,157550);
 assert.deepEqual(state,before);
 const result=budgetOperations(state,builder).reduce(apply,state);
 assert.equal(totals(result,'2026-11').limit,157550);
 assert.equal(result.months['2026-10'].categories[0].limit,90000);
 assert.equal(result.months['2026-12'].categories[0].name,'Future rent');
 assert.equal(result.months['2026-12'].categories[0].recurring,105000);
 assert.equal(result.months['2026-12'].categories[0].limit,120000);
});

test('Review includes categories added elsewhere and does not revive archived categories',()=>{
 const state=sample(),builder=createBuilder(state,'2026-11');
 state.months['2026-11'].categories[0].archived=true;
 state.months['2026-11'].categories.push({id:'gas',name:'Gas',limit:5000,recurring:0});
 assert.equal(projectBuilder(state,builder).limit,25000);
 assert.equal(budgetOperations(state,builder).some(op=>op.category.id==='rent'),false);
});

test('Builder can preview and save new future limits without mutating a stored plan',()=>{
 const state=sample(),builder=createBuilder(state,'2027-01');builder.limits.rent='1300';
 assert.equal(projectBuilder(state,builder).limit,155000);
 assert.equal(state.months['2027-01'],undefined);
 assert.equal(state.months['2026-12'].categories[0].limit,110000);
});

test('A budget-building draft can be resumed and cleared independently of financial data',()=>{
 const values=new Map([['budget-v1','existing-budget']]),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const builder=createBuilder(sample(),'2026-11');builder.index=1;builder.limits.food='42.';
 persistBuilder(builder,storage);
 assert.equal(readBuilder(storage).limits.food,'42.');
 assert.equal(readBuilder(storage).index,1);
 clearBuilder(storage);assert.equal(readBuilder(storage),null);assert.equal(storage.getItem('budget-v1'),'existing-budget');
});

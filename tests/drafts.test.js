import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDraft,readDraft,writeDraft,clearDraft} from '../drafts.js';

function storage(){const values=new Map([['budget-v1','shared-budget-and-session']]);return {values,getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}

test('Draft recovery preserves incomplete input, its month and category',()=>{
 const store=storage();
 writeDraft({kind:'expense',month:'2026-02',amount:'12.',category:'food',description:'Lunch'},store);
 assert.deepEqual(readDraft(store),{kind:'expense',month:'2026-02',id:'',amount:'12.',category:'food',description:'Lunch'});
 clearDraft(store);
 assert.equal(readDraft(store),null);
 assert.equal(store.getItem('budget-v1'),'shared-budget-and-session');
});

test('Draft validation handles malformed storage and rejects invalid dates',()=>{
 assert.equal(normalizeDraft({kind:'expense',month:'2026-13',amount:'10'}),null);
 assert.equal(normalizeDraft({kind:'expense',month:'2026-01'}),null);
 assert.equal(readDraft({getItem:()=>'{invalid json'}),null);
 assert.doesNotThrow(()=>writeDraft({kind:'income',month:'2026-01',amount:'100'},{setItem:()=>{throw Error('Storage unavailable')}}));
});

test('Editing drafts retain their entry identity',()=>{
 const draft=normalizeDraft({kind:'expense',month:'2026-01',id:'entry-12',amount:'34.50',description:'Edited note'});
 assert.equal(draft.id,'entry-12');assert.equal(draft.amount,'34.50');
});

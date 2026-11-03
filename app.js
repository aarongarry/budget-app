import {enableCategoryReorder} from './reorder.js?v=1.4.3';
import './gestures.js?v=1.4.3';
import {readDraft,writeDraft,clearDraft} from './drafts.js?v=1.4.3';
import {createBuilder,projectBuilder,budgetOperations,readBuilder,persistBuilder,clearBuilder} from './builder.js?v=1.4.3';
import {config} from './config.js?v=1.4.3';
import {renderHTML} from './dom.js?v=1.4.3';
import {VERSION,updateState,initializeUpdates,checkForUpdates,applyUpdate} from './updates.js?v=1.4.3';
import {empty,apply,monthOps,monthNow,shiftMonth,monthLabel,totals,cents,entryUndo,recentEntries,formatMoney,categoriesForMonth,historyMonths,monthsToCatchUp} from './core.js?v=1.4.3';
const $=s=>document.querySelector(s), root=$('#app'), modal=$('#modal');
const money=n=>formatMoney(n), summaryMoney=n=>formatMoney(n,true);
const systemTheme=matchMedia('(prefers-color-scheme: dark)');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const storageKey='budget-v1'; let saved={}; try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')}catch{}
let token=saved.token||'', base=saved.base||empty(), pending=saved.pending||[], state=base, month=monthNow(), tab='budget', status='', syncing=false, installPrompt;
let undoAction=null, detailView=null, builder=null;
let prefs={theme:'light',textSize:'normal',accent:'#527562',chart:'bars',...saved.prefs};
const rebuild=()=>{state=pending.reduce(apply,base)}; rebuild();
function persist(){localStorage.setItem(storageKey,JSON.stringify({token,base,pending,prefs}));}
function theme(){const mode=prefs.theme==='system'?(systemTheme.matches?'dark':'light'):prefs.theme;document.documentElement.dataset.theme=mode;document.documentElement.dataset.textSize=prefs.textSize;document.documentElement.style.setProperty('--accent',prefs.accent);document.querySelector('meta[name=theme-color]').content=mode==='dark'?'#151614':'#f8f8f6';}theme();
 systemTheme.addEventListener('change',()=>{if(prefs.theme==='system')theme();});

function toast(t,undo=null){
 const box=$('#toast');box.replaceChildren(document.createTextNode(t));undoAction=undo;
 if(undo){const button=document.createElement('button');button.type='button';button.dataset.action='undo';button.textContent='Undo';box.append(button);}
 box.style.display='flex';clearTimeout(toast.timer);toast.timer=setTimeout(()=>{box.style.display='none';undoAction=null;},undo?8000:1800);
}
function saveEntry(entry,message){const reverse=entry.deleted&&entry.kind==='expense'?entryUndo(state,entry):null;change({type:'entry',entry});if(reverse)toast(message,()=>{change(reverse);toast('Undone.');refreshDetail();});else toast(message);}

async function rpc(name,args){const r=await fetch(`${config.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.key},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok)throw Error(data.message||'Unable to connect.');return data;}
function queue(op){pending.push({...op,opId:crypto.randomUUID()});rebuild();persist();}
function ensure(m){if(m>monthNow())return;for(const op of monthOps(state,m))queue(op);}
function ensureThroughCurrent(){for(const m of monthsToCatchUp(state))ensure(m);ensure(month);}
function changeBatch(operations){for(const op of operations){const target=op.type==='entry'?op.entry.month:op.month;if(target&&!state.months[target])queue({type:'month',month:target,categories:categoriesForMonth(state,target)});queue(op);}render();sync();}
function change(op){changeBatch([op]);}
async function sync(){if(syncing||!token)return;syncing=true;const previousState=JSON.stringify(state);status=navigator.onLine?'Syncing…':'Offline';updateStatus();try{
 if(!navigator.onLine)throw Error('offline');
 const data=await rpc('budget_read',{session_token:token});
 if(data.unauthorized){status='Sign in to sync';toast('Your session expired. Sign in again; offline changes are saved.');saveDraft();if(modal.open)modal.close();token='';persist();render();return;}
 base=data.state;rebuild();ensureThroughCurrent();let revision=data.revision;
 for(let tries=0;pending.length && tries<6;tries++){
  const batch=pending.slice(), next=batch.reduce(apply,base);
  const res=await rpc('budget_write',{session_token:token,expected_revision:revision,next_state:next});
  if(res.unauthorized)throw Error('Sign in to sync');
  if(res.conflict){base=res.state;revision=res.revision;rebuild();continue;}
  const ids=new Set(batch.map(o=>o.opId));pending=pending.filter(o=>!ids.has(o.opId));base=next;revision=res.revision;rebuild();persist();
 }
 status=pending.length?'Changes waiting to sync':'Synced';persist();
 }catch(e){status=!navigator.onLine?'Offline · saved on device':(e.message==='Sign in to sync'?e.message:'Connection unavailable · saved on device');}finally{syncing=false;updateStatus();if(previousState!==JSON.stringify(state)){if(!modal.open)render();else refreshDetail();}}}
function updateStatus(){const e=$('#sync');if(e)e.textContent=status||'Saved on device';}
function header(){return `<header class="top"><div class="word">Budget</div></header><nav class="tabs" aria-label="Main navigation">${['budget','history','settings'].map(t=>`<button data-tab="${t}" class="${tab===t?'active':''}" aria-current="${tab===t?'page':'false'}">${t[0].toUpperCase()+t.slice(1)}</button>`).join('')}</nav>`;}
function monthHead(action=true){return `<div class="month-head"><div class="month-nav"><button aria-label="Previous month" data-action="previous">‹</button><h1>${monthLabel(month)}</h1><button aria-label="Next month" data-action="next" ${tab==='history'&&month>=monthNow()?'disabled':''}>›</button><input aria-label="Choose month" type="month" id="month-picker" value="${month}" min="2000-01" max="${tab==='history'?monthNow():'2100-12'}"></div>${action?'<button class="primary desktop-add" data-action="expense">+ Add expense</button>':''}</div>`;}
function budget(){const t=totals(state,month,true);return `${monthHead()}<section class="stats" aria-label="Monthly totals"><div><div class="eyebrow">Spent this month</div><div class="stat-value">${summaryMoney(t.spent)}</div></div><div><div class="eyebrow">Monthly budget</div><div class="stat-value">${summaryMoney(t.limit)}</div><div class="stat-note">Total of category limits</div></div><div><div class="eyebrow">${t.spent>t.limit?'Over budget':'Remaining'}</div><div class="stat-value ${t.spent>t.limit?'negative':''}">${summaryMoney(Math.abs(t.limit-t.spent))}</div></div></section><section><div class="section-head"><h2>Categories</h2><button class="quiet" data-action="category">+ New category</button></div>${t.cats.filter(c=>!c.archived || t.entries.some(e=>e.category===c.id)).map(c=>{
const spent=t.entries.filter(e=>e.kind==='expense'&&e.category===c.id).reduce((n,e)=>n+e.amount,0), over=spent>c.limit;return `<div class="category" data-key="cat-${esc(c.id)}"><button class="category-summary" data-category-view="${esc(c.id)}" aria-label="Add expense to ${esc(c.name)}"><span><span class="category-name">${esc(c.name)}${c.archived?' <span class="muted">(archived)</span>':''}</span><span class="track"><span style="width:${c.limit?Math.min(spent/c.limit*100,100):(spent?100:0)}%;${over?'background:var(--danger)':''}"></span></span></span><span class="num">${summaryMoney(spent)}<small>of ${summaryMoney(c.limit)}</small></span><span class="num ${over?'negative':''}">${summaryMoney(Math.abs(c.limit-spent))}<small>${over?'over':'left'}</small></span></button><button data-category="${esc(c.id)}" aria-label="Edit ${esc(c.name)}">···</button></div>`}).join('')||'<p class="empty">Add a category to start your budget.</p>'}</section><section class="income-strip"><div><div class="eyebrow">Income this month</div><div class="hint">For reference</div></div><div class="income-actions"><strong>${summaryMoney(t.income)}</strong><button data-action="income">+ Add income</button></div></section><section><div class="section-head"><h2>Activity</h2><span class="muted">${t.entries.length} ${t.entries.length===1?'entry':'entries'}</span></div>${activity(t,5)}${t.entries.length>5?'<button class="quiet view-all" data-action="all-activity">View all activity</button>':''}</section>`;}
function activity(t,limit=Infinity){return recentEntries(t.entries,limit).map(e=>`<div class="entry" data-key="entry-${esc(e.id)}"><div>${e.kind==='income'?'Income':esc(t.cats.find(c=>c.id===e.category)?.name||'Category')}<small>${e.description?esc(e.description)+' · ':''}${e.auto?'Recurring · ':''}${new Date(e.created).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small></div><button data-entry="${esc(e.id)}" aria-label="Edit ${e.kind} ${money(e.amount)}">${e.kind==='income'?'+':''}${money(e.amount)} <span class="muted">↗</span></button></div>`).join('')||'<p class="empty">No entries this month.</p>';}
function history(){const a=totals(state,month),prev=shiftMonth(month,-1),b=totals(state,prev),max=Math.max(a.spent,b.spent,1);const categories=[...new Map([...a.cats,...b.cats].map(c=>[c.id,c])).values()], sum=(t,c)=>t.entries.filter(e=>e.kind==='expense'&&e.category===c).reduce((n,e)=>n+e.amount,0);return `${monthHead(false)}<div class="stats"><div><div class="eyebrow">${month===monthNow()?'This month':'Selected month'}</div><div class="stat-value">${summaryMoney(a.spent)}</div></div><div><div class="eyebrow">Previous month</div><div class="stat-value">${summaryMoney(b.spent)}</div></div><div><div class="eyebrow">${a.spent>=b.spent?'More spending':'Less spending'}</div><div class="stat-value">${summaryMoney(Math.abs(a.spent-b.spent))}</div></div></div><div class="section-head"><h2>Month comparison</h2><select id="chart-type" aria-label="Chart style" style="width:130px;font-size:12px;min-height:36px">${[['bars','Bars'],['table','Table'],['off','Charts off']].map(([v,l])=>`<option value="${v}" ${prefs.chart===v?'selected':''}>${l}</option>`).join('')}</select></div><p class="hint">${monthLabel(month)} and ${monthLabel(prev)} · full month totals${!state.months[prev]?' · No entries recorded for the previous month.':''}</p>${prefs.chart==='bars'?`<div class="chart-area"><div class="chart-legend"><span><i class="key"></i>${monthLabel(month)}</span><span><i class="key previous"></i>${monthLabel(prev)}</span></div>${[{name:'Total spending',id:null},...categories].map(c=>{const x=c.id?sum(a,c.id):a.spent,y=c.id?sum(b,c.id):b.spent;return `<div class="bar-row"><span>${esc(c.name)}</span><div class="bars"><i style="width:${x/max*100}%"></i><i class="prev" style="width:${y/max*100}%"></i></div><span class="num">${summaryMoney(x)}<br><span class="muted">${summaryMoney(y)}</span></span></div>`}).join('')}</div>`:prefs.chart==='table'?`<table class="chart-table"><thead><tr><th>Category</th><th>This month</th><th>Previous</th></tr></thead><tbody>${categories.map(c=>`<tr><td>${esc(c.name)}</td><td>${summaryMoney(sum(a,c.id))}</td><td>${summaryMoney(sum(b,c.id))}</td></tr>`).join('')}</tbody></table>`:''}<div class="section-head"><h2>Past months</h2></div>${historyMonths(state).map(m=>`<div class="entry"><button class="quiet" data-month="${m}">${monthLabel(m)}</button><span>${summaryMoney(totals(state,m).spent)}</span></div>`).join('')||'<p class="empty">No past months yet.</p>'}`;}
function categoryOrderSettings(){const cats=totals(state,month,true).cats.filter(c=>!c.archived);return `<section class="setting"><h2>Category order</h2><p>Drag the handles to reorder. This order is used throughout your budget.</p><div class="category-order" role="list">${cats.map(c=>`<div class="order-row" role="listitem" data-order-id="${esc(c.id)}" data-key="order-${esc(c.id)}"><span>${esc(c.name)}</span><button class="drag-handle" data-drag-category="${esc(c.id)}" aria-label="Reorder ${esc(c.name)}" aria-description="Drag to reorder, or use the up and down arrow keys." aria-pressed="false"><span aria-hidden="true">⠿</span></button></div>`).join('')}</div></section>`;}

function settings(){return `<div class="month-head"><h1>Settings</h1></div><div class="settings"><section class="setting"><h2>Appearance</h2><p>Choose a theme, or follow your device.</p><div class="segmented" role="group" aria-label="Theme">${[['light','Light'],['dark','Dark'],['system','Auto']].map(([t,label])=>`<button data-theme-choice="${t}" class="${prefs.theme===t?'active':''}" aria-pressed="${prefs.theme===t}">${label}</button>`).join('')}</div></section><section class="setting"><h2>Text size</h2><p>Choose what feels comfortable.</p><div class="segmented" role="group" aria-label="Text size">${[['normal','Normal'],['large','Larger']].map(([t,label])=>`<button data-text-size="${t}" class="${prefs.textSize===t?'active':''}" aria-pressed="${prefs.textSize===t}">${label}</button>`).join('')}</div></section><section class="setting"><h2>Accent color</h2><p>A small touch of color for progress and charts.</p><div class="swatches">${[['#527562','Sage'],['#667ea1','Blue'],['#ab8054','Sand'],['#9680a6','Lavender'],['#858585','Gray']].map(([v,l])=>`<button class="swatch ${prefs.accent===v?'active':''}" style="background:${v}" data-accent="${v}" aria-label="${l}" aria-pressed="${prefs.accent===v}"></button>`).join('')}</div></section><section class="setting"><h2>Monthly budget</h2><p>Set limits for ${monthLabel(month)}, one category at a time.</p><button data-action="build-budget">Build budget</button></section>${categoryOrderSettings()}<section class="setting"><h2>Recurring spending</h2><p>Set an automatic amount in a category’s settings. It posts once on the first of each month. Missed months are filled in when you next open the app.</p></section><section class="setting"><h2>Your data</h2><p>Changes are saved on this device and synced to your shared budget when online.</p><p id="sync" role="status">${esc(status||'Saved on device')}</p><div class="data-actions"><button data-action="export">Export backup</button><button data-action="sync">Sync now</button></div></section><section class="setting"><h2>App updates</h2><p>Version ${VERSION}</p><p id="update-message" role="status">${esc(updateState.message)}</p><div class="data-actions"><button data-action="check-updates" ${updateState.checking?'disabled':''}>Check for updates</button><button class="primary" data-action="apply-update" ${updateState.available?'':'hidden'} ${updateState.applying?'disabled':''}>Update app</button></div></section><section class="setting"><h2>Install Budget</h2><p>Keep it on your home screen or Mac dock.</p><button data-action="install">Install app</button></section><section class="setting"><button data-action="logout">Sign out</button><p>This removes this device’s local copy after all changes have synced.</p></section></div>`;}
function render(){theme();document.body.dataset.page=token?tab:'login';if(!token){renderHTML(root,`<main class="login"><h1>Budget</h1><form id="login"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required autocapitalize="none" spellcheck="false"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required><button class="primary" type="submit">Sign in</button><p class="error" id="login-error" role="alert"></p></form></main>`);return;}
 renderHTML(root,`<div class="shell">${header()}<main data-key="page-${tab}">${tab==='budget'?budget():tab==='history'?history():settings()}</main><footer class="foot"><span>USD · Shared budget</span></footer>${tab==='budget'?'<div class="mobile-actions"><button class="primary" data-action="expense">+ Add expense</button></div>':''}</div>`);}
let lockedScroll=null;
function lockPage(){
 if(lockedScroll!==null)return;
 lockedScroll={x:window.scrollX,y:window.scrollY};
 document.documentElement.dataset.modalLocked='true';
 document.body.style.top=-lockedScroll.y+'px';
}
function unlockPage(){
 if(lockedScroll===null)return;
 const position=lockedScroll;lockedScroll=null;
 delete document.documentElement.dataset.modalLocked;document.body.style.top='';
 window.scrollTo({left:position.x,top:position.y,behavior:'instant'});
}
function dialog(title,body,view=null,stable=false){
 lockPage();
 document.body.dataset.modalOpen='true';detailView=view;
 const html=`<div class="dialog-head"><h2>${title}</h2><button class="quiet" data-action="close" aria-label="Close">×</button></div>${body}`;
 if(stable)renderHTML(modal,html);else modal.innerHTML=html;
 const entry=Boolean(modal.querySelector('#entry-form')),building=Boolean(modal.querySelector('#budget-builder-form'));
 modal.classList.toggle('entry-dialog',entry);modal.classList.toggle('builder-dialog',building);modal.classList.toggle('flow-dialog',entry||building);document.documentElement.dataset.flowOpen=String(entry||building);
 if(stable)for(const input of modal.querySelectorAll('input'))input.value=input.getAttribute('value')||'';
 if(!modal.open)modal.showModal();
 const focus=modal.querySelector('input')||modal.querySelector('button');focus?.focus({preventScroll:true});
 if(focus?.matches('.amount-input'))focus.setSelectionRange(focus.value.length,focus.value.length);
}

function categoryDetails(id){
 const t=totals(state,month,true),cat=t.cats.find(c=>c.id===id);if(!cat)return;
 const entries=t.entries.filter(e=>e.kind==='expense'&&e.category===id),spent=entries.reduce((n,e)=>n+e.amount,0);
 dialog(esc(cat.name),`<p class="hint">${monthLabel(month)}</p><div class="detail-total">${summaryMoney(spent)} <small>of ${summaryMoney(cat.limit)}</small></div>${activity({...t,entries})}<div class="form-actions"><button data-category="${esc(id)}">Edit category</button><button class="primary" data-action="category-expense" data-id="${esc(id)}">+ Add expense</button></div>`,{type:'category',id});
}
function allActivity(){const t=totals(state,month,true);dialog('Activity',`<p class="hint">${monthLabel(month)} · ${t.entries.length} entries</p>${activity(t)}`,{type:'activity'});}
function refreshDetail(){if(!modal.open||!detailView)return;const scroll=modal.scrollTop;if(detailView.type==='category')categoryDetails(detailView.id);else allActivity();modal.scrollTop=scroll;}
function updateUpdateUI(){const message=$('#update-message');if(message)message.textContent=updateState.message;const check=$('[data-action="check-updates"]');if(check)check.disabled=updateState.checking||updateState.applying;const action=$('[data-action="apply-update"]');if(action){action.hidden=!updateState.available;action.disabled=updateState.applying;}}
function updateAmountDisplay(){const input=modal.querySelector('.amount-input');if(!input||!modal.open)return;const chars=Math.max(1,(input.value||'0').length)+.25,available=input.parentElement.clientWidth-92,max=prefs.textSize==='large'?88:80;input.style.fontSize=Math.max(28,Math.min(max,available/(chars*.64)))+'px';input.style.width=chars+'ch';}
function updateVisibleViewport(){const viewport=window.visualViewport;document.documentElement.style.setProperty('--visual-height',(viewport?.height||window.innerHeight)+'px');document.documentElement.style.setProperty('--visual-top',(viewport?.offsetTop||0)+'px');document.documentElement.dataset.shortViewport=(viewport?.height||window.innerHeight)<600?'true':'false';updateAmountDisplay();}
window.visualViewport?.addEventListener('resize',updateVisibleViewport);window.visualViewport?.addEventListener('scroll',updateVisibleViewport);window.addEventListener('resize',updateVisibleViewport);updateVisibleViewport();
function saveDraft(){const f=$('#entry-form');if(!modal.open||!f||f.dataset.dirty!=='true')return;const d=new FormData(f);writeDraft({id:f.dataset.id,kind:f.dataset.kind,month:f.dataset.month,amount:d.get('amount'),category:d.get('category'),description:d.get('description')});}
function clearFormDraft(){const f=$('#entry-form'),draft=readDraft();if(f&&draft&&draft.id===f.dataset.id&&draft.kind===f.dataset.kind)clearDraft();}
function usableDraft(){const draft=readDraft();if(draft?.id&&(!state.entries[draft.id]||state.entries[draft.id].deleted)){clearDraft();return null;}return draft;}
function restoreDraft(){const draft=usableDraft();if(!draft||!token||modal.open)return;month=draft.month;ensure(month);tab='budget';render();entryDialog(draft.kind,draft.id||null,null,draft);toast('Draft restored.');}
function entryDialog(kind,id,selectedCategory=null,resume=null){
 const draft=resume||(!id&&!selectedCategory&&usableDraft()?.kind===kind?usableDraft():null);
 if(draft){month=draft.month;ensure(month);id=draft.id||null;render();}
 const existing=id?state.entries[id]:null,cats=totals(state,month,true).cats.filter(c=>!c.archived||c.id===existing?.category);
 if(kind==='expense'&&!cats.length){toast('Add a category first.');return;}
 const selected=draft?.category||existing?.category||selectedCategory, amount=draft?draft.amount:(existing?existing.amount/100:''),description=draft?draft.description:(existing?.description||'');
 const note=kind==='expense'?`<div class="entry-note"><label for="description">Description <span class="muted">(optional)</span></label><input id="description" name="description" type="text" maxlength="120" value="${esc(description)}" autocomplete="off"></div>`:'';
 dialog(`${existing?'Edit '+kind:'Add '+kind}<span class="flow-month">${monthLabel(month)}</span>`,`<form id="entry-form" data-id="${id||''}" data-kind="${kind}" data-month="${month}" data-dirty="false"><div class="flow-body"><div class="entry-main"><label class="sr-only" for="amount">Amount</label><div class="amount-entry"><span class="currency-prefix" aria-hidden="true">$</span><input class="amount-input" id="amount" name="amount" inputmode="decimal" type="text" maxlength="12" enterkeyhint="done" autocomplete="off" spellcheck="false" value="${esc(amount||'0')}" required><button type="button" class="amount-clear" data-action="clear-amount" aria-label="Clear amount"><span aria-hidden="true">×</span></button></div>${kind==='expense'?`<fieldset class="category-choices"><legend>Category</legend><div class="category-pills">${cats.map(c=>`<label class="category-pill"><input type="radio" name="category" value="${esc(c.id)}" ${selected===c.id?'checked':''} required><span>${esc(c.name)}</span></label>`).join('')}</div></fieldset>`:''}${existing?'<button type="button" class="quiet discard-changes" data-action="discard-draft">Discard changes</button>':''}</div></div><div class="flow-actions">${note}<p class="error" role="alert"></p><div class="form-actions">${existing?'<button type="button" class="danger" data-action="delete-entry" data-id="'+id+'">Delete</button>':'<button type="button" class="quiet" data-action="discard-draft">Discard</button>'}<button class="primary" type="submit">${existing?'Save changes':'Add '+kind}</button></div></div></form>`);updateAmountDisplay();

}

function openBuilder(){const saved=readBuilder();builder=saved?.month===month?saved:createBuilder(state,month);persistBuilder(builder);showBuilder();}
function builderInput(){const f=$('#budget-builder-form');if(!builder||!f)return;const d=new FormData(f);if(builder.stage==='category'){const c=builder.categories[builder.index];if(c)builder.limits[c.id]=String(d.get('amount')||'');}if(builder.stage==='add')builder.addDraft={name:String(d.get('name')||''),amount:String(d.get('amount')||'')};persistBuilder(builder);}
function builderAmount(value){return `<label class="sr-only" for="builder-amount">Monthly limit</label><div class="amount-entry" data-key="builder-amount-wrap"><span class="currency-prefix" aria-hidden="true">$</span><input class="amount-input" id="builder-amount" name="amount" type="text" inputmode="decimal" maxlength="12" autocomplete="off" enterkeyhint="done" value="${esc(value||'0')}" required><button type="button" class="amount-clear" data-action="clear-amount" aria-label="Clear amount"><span aria-hidden="true">×</span></button></div>`;}
function showBuilder(){
 if(!builder)return;let body='',actions='',projection=null;
 if(builder.stage==='category'){
  const c=builder.categories[builder.index];if(!c){builder.stage='review';return showBuilder();}
  body=`<div class="entry-main"><p class="builder-progress">${monthLabel(builder.month)} · ${builder.index+1} of ${builder.categories.length}</p><h3 class="builder-category">${esc(c.name)}</h3>${builderAmount(builder.limits[c.id])}<button type="button" class="quiet builder-add" data-action="builder-add">+ Add category</button></div>`;
  actions=`<button type="button" class="quiet" data-action="builder-back" ${builder.index===0&&!builder.returnToReview?'disabled':''}>Back</button><button class="primary" type="submit">${builder.returnToReview||builder.index===builder.categories.length-1?'Review':'Next'}</button>`;
 }else if(builder.stage==='add'){
  body=`<div class="entry-main"><p class="builder-progress">${monthLabel(builder.month)}</p><label for="builder-name">Category name</label><input id="builder-name" name="name" type="text" maxlength="50" value="${esc(builder.addDraft?.name||'')}" required><p class="hint builder-limit-label">Monthly limit</p>${builderAmount(builder.addDraft?.amount||'0')}</div>`;
  actions='<button type="button" class="quiet" data-action="builder-back">Back</button><button class="primary" type="submit">'+(builder.editAdded?'Save category':'Add category')+'</button>';
 }else{
  projection=projectBuilder(state,builder);const rows=projection.cats.filter(c=>!c.archived);
  body=`<div class="builder-review"><p class="builder-progress">${monthLabel(builder.month)}</p><h3>Review your budget</h3>${rows.map(c=>`<div class="builder-row" data-key="build-${esc(c.id)}"><button type="button" data-builder-edit="${esc(c.id)}"><span>${esc(c.name)}</span><strong>${summaryMoney(c.limit)}</strong></button>${builder.added.some(a=>a.id===c.id)?`<button type="button" class="quiet" data-builder-remove="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">×</button>`:''}</div>`).join('')}<button type="button" class="quiet builder-add" data-action="builder-add">+ Add category</button><p class="hint">Limits apply to this month and later months. Recurring spending stays as set.</p></div>`;
  actions=`<button type="button" class="quiet" data-action="builder-back" ${builder.categories.length?'':'disabled'}>Back</button><button class="primary" type="submit" ${rows.length?'':'disabled'}>Save budget</button>`;
 }
 const total=builder.stage==='review'?`<div class="builder-total"><span>Monthly budget</span><strong>${summaryMoney(projection.limit)}</strong></div>`:'';
 dialog(builder.stage==='add'?(builder.editAdded?'Edit category':'Add category'):'Build budget',`<form id="budget-builder-form" data-stage="${builder.stage}"><div class="flow-body">${body}</div><div class="flow-actions">${total}<p class="error" role="alert"></p><div class="form-actions">${actions}</div></div></form>`,null,true);updateAmountDisplay();
}
function builderAdd(){builderInput();if(builder.stage==='category')cents(builder.limits[builder.categories[builder.index].id]);builder.returnStage=builder.stage;builder.stage='add';builder.editAdded=null;builder.addDraft={name:'',amount:'0'};persistBuilder(builder);showBuilder();}
function builderBack(){builderInput();if(builder.stage==='category')cents(builder.limits[builder.categories[builder.index].id]);if(builder.stage==='add'){builder.stage=builder.returnStage||'review';builder.editAdded=null;}else if(builder.stage==='review'){builder.stage='category';builder.index=Math.max(0,builder.categories.length-1);}else if(builder.returnToReview){builder.stage='review';builder.returnToReview=false;}else builder.index=Math.max(0,builder.index-1);persistBuilder(builder);showBuilder();}
function submitBuilder(){
 builderInput();
 if(builder.stage==='category'){
  cents(builder.limits[builder.categories[builder.index].id]);
  if(builder.returnToReview){builder.stage='review';builder.returnToReview=false;}else if(builder.index+1<builder.categories.length)builder.index++;else builder.stage='review';
 }else if(builder.stage==='add'){
  const name=builder.addDraft.name.trim(),amount=builder.addDraft.amount;if(!name)throw Error('Enter a category name.');cents(amount);
  if([...builder.categories,...builder.added].some(c=>c.id!==builder.editAdded&&c.name.toLowerCase()===name.toLowerCase()))throw Error('A category with that name already exists.');
  const c={id:builder.editAdded||crypto.randomUUID(),name,amount},i=builder.added.findIndex(a=>a.id===c.id);if(i>=0)builder.added[i]=c;else builder.added.push(c);
  builder.stage=builder.returnStage||'review';builder.editAdded=null;
 }else{
  const operations=budgetOperations(state,builder),target=builder.month;changeBatch(operations);clearBuilder();builder=null;month=target;tab='budget';modal.close();render();window.scrollTo(0,0);toast('Budget saved.');return;
 }
 persistBuilder(builder);showBuilder();
}
function categoryDialog(id){const c=totals(state,month,true).cats.find(c=>c.id===id);dialog(c?'Edit category':'New category',`<form id="category-form" data-id="${id||''}"><label for="cat-name">Name</label><input id="cat-name" name="name" maxlength="50" value="${esc(c?.name||'')}" required><label for="limit">Monthly limit</label><input id="limit" name="limit" type="number" inputmode="decimal" min="0" max="99999999" step="0.01" value="${(c?.limit||0)/100}" required><label for="recurring">Automatic spending on the 1st</label><input id="recurring" name="recurring" type="number" inputmode="decimal" min="0" max="99999999" step="0.01" value="${(c?.recurring||0)/100}" required><p class="hint">Set to 0 for none. Changes apply to ${monthLabel(month)} and later months. Past months stay as they were.</p><p class="error" role="alert"></p>${c?'<button type="button" class="quiet category-history-link" data-category-history="'+esc(c.id)+'">View expenses</button>':''}<div class="form-actions">${c&&!c.archived?'<button type="button" class="danger" data-action="archive" data-id="'+id+'">Archive</button>':''}<button class="primary" type="submit">Save category</button></div></form>`);}
async function install(){if(installPrompt){await installPrompt.prompt();installPrompt=null;return;}dialog('Install Budget',`<p>Add Budget to your device for quick access and offline use.</p><ol class="install-steps"><li><strong>iPhone:</strong> Open this site in Safari, tap Share, then <strong>Add to Home Screen</strong>. Tap Add.</li><li><strong>Mac Chrome:</strong> Open Chrome’s menu, choose <strong>Cast, save, and share → Install page as app</strong>, or use the install icon in the address bar.</li></ol><p class="hint">Open and sign in once while online before using it offline.</p><button class="primary" data-action="close" style="width:100%;margin-top:15px">Done</button>`);}
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
 if(b.dataset.tab){tab=b.dataset.tab;if(tab==='history'&&month>monthNow())month=monthNow();render();}
 if(b.dataset.month){month=b.dataset.month;ensure(month);tab='budget';render();sync();}
 if(b.dataset.categoryView)entryDialog('expense',null,b.dataset.categoryView);
 if(b.dataset.categoryHistory)categoryDetails(b.dataset.categoryHistory);
 if(b.dataset.category)categoryDialog(b.dataset.category);
 if(b.dataset.entry){const en=state.entries[b.dataset.entry];entryDialog(en.kind,en.id);}
 if(b.dataset.textSize){prefs.textSize=b.dataset.textSize;persist();render();}

 if(b.dataset.themeChoice){prefs.theme=b.dataset.themeChoice;persist();render();}
 if(b.dataset.accent){prefs.accent=b.dataset.accent;persist();render();}
 if(b.dataset.builderEdit){const i=builder.categories.findIndex(c=>c.id===b.dataset.builderEdit);if(i>=0){builder.index=i;builder.stage='category';builder.returnToReview=true;}else{const c=builder.added.find(c=>c.id===b.dataset.builderEdit);if(!c){const current=totals(state,builder.month,true).cats.find(c=>c.id===b.dataset.builderEdit);builder.categories.push(current);builder.limits[current.id]=String(current.limit/100);builder.index=builder.categories.length-1;builder.stage='category';builder.returnToReview=true;persistBuilder(builder);showBuilder();return;}builder.editAdded=c.id;builder.addDraft={name:c.name,amount:c.amount};builder.returnStage='review';builder.stage='add';}persistBuilder(builder);showBuilder();}
 if(b.dataset.builderRemove){builder.added=builder.added.filter(c=>c.id!==b.dataset.builderRemove);persistBuilder(builder);showBuilder();}
 const act=b.dataset.action;
 if(act==='close'){saveDraft();modal.close();}
 if(act==='discard-draft'){clearFormDraft();modal.close();}
 if(act==='undo'&&undoAction){const undo=undoAction;undoAction=null;undo();}
 if(act==='clear-amount'){const input=modal.querySelector('.amount-input');input.value='0';input.focus({preventScroll:true});input.setSelectionRange(1,1);updateAmountDisplay();const f=$('#entry-form');if(f){f.dataset.dirty='true';saveDraft();}else builderInput();}
 if(act==='build-budget')openBuilder();
 if(act==='builder-back'){try{builderBack();}catch(err){modal.querySelector('.error').textContent=err.message;}}
 if(act==='builder-add'){try{builderAdd();}catch(err){modal.querySelector('.error').textContent=err.message;}}
 if(act==='all-activity')allActivity();
 if(act==='category-expense')entryDialog('expense',null,b.dataset.id);
 if(act==='check-updates')await checkForUpdates(true);
 if(act==='apply-update')await applyUpdate();
 if(act==='install')install();
 if(act==='previous'||act==='next'){const target=shiftMonth(month,act==='next'?1:-1);month=tab==='history'&&target>monthNow()?monthNow():target;ensure(month);render();sync();}
 if(act==='expense'||act==='income')entryDialog(act);
 if(act==='category')categoryDialog();
 if(act==='sync')await sync();
 if(act==='delete-entry'){const en=state.entries[b.dataset.id];saveEntry({...en,deleted:true},'Entry deleted.');clearFormDraft();modal.close();render();}
 if(act==='archive'){change({type:'archive',month,id:b.dataset.id});modal.close();render();toast('Category archived. Existing spending is kept.');}
 if(act==='export'){const blob=new Blob([JSON.stringify({exported:new Date().toISOString(),state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`budget-${monthNow()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 if(act==='logout'){await sync();if(pending.length){toast('Connect and sync before signing out. Your changes are still saved.');return;}try{await rpc('budget_logout',{session_token:token});}catch{toast('Connect to sign out.');return;}token='';base=empty();pending=[];clearDraft();clearBuilder();rebuild();persist();render();}
});
document.addEventListener('input',e=>{if(e.target.matches('.amount-input')){const input=e.target,position=input.selectionStart,trimmed=input.value.replace(/^0+(?=\d)/,'');if(trimmed!==input.value){const removed=input.value.length-trimmed.length;input.value=trimmed;input.setSelectionRange(Math.max(0,position-removed),Math.max(0,position-removed));}updateAmountDisplay();}if(e.target.closest('#entry-form')){e.target.closest('#entry-form').dataset.dirty='true';saveDraft();}if(e.target.closest('#budget-builder-form'))builderInput();});
document.addEventListener('change',e=>{if(e.target.closest('#entry-form')){e.target.closest('#entry-form').dataset.dirty='true';saveDraft();}if(e.target.id==='month-picker'&&/^\d{4}-\d{2}$/.test(e.target.value)){month=tab==='history'&&e.target.value>monthNow()?monthNow():e.target.value;ensure(month);render();sync();}if(e.target.id==='chart-type'){prefs.chart=e.target.value;persist();render();}});
document.addEventListener('submit',async e=>{e.preventDefault();const f=e.target,d=new FormData(f);try{
 if(f.id==='budget-builder-form'){submitBuilder();return;}
 if(f.id==='login'){const b=f.querySelector('button');b.disabled=true;b.textContent='Signing in…';try{const res=await rpc('budget_login',{login_name:d.get('username').trim(),login_password:d.get('password')});if(!res.token)throw Error(res.error||'Incorrect username or password.');token=res.token;persist();ensureThroughCurrent();render();await sync();if(token)restoreDraft();}catch(err){$('#login-error').textContent=err.message;b.disabled=false;b.textContent='Sign in';}return;}
 if(f.id==='entry-form'){const old=state.entries[f.dataset.id],amount=cents(d.get('amount'));if(amount<=0)throw Error('Enter an amount greater than zero.');saveEntry({id:old?.id||crypto.randomUUID(),month,kind:f.dataset.kind,amount,category:d.get('category')||null,description:f.dataset.kind==='expense'?String(d.get('description')||'').trim().slice(0,120):'',created:old?.created||`${month}-${String(Math.min(new Date().getDate(),new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate())).padStart(2,'0')}T12:00:00`,auto:old?.auto||false,recordedAt:old?.recordedAt||new Date().toISOString()},old?'Entry updated.':'Entry added.');clearFormDraft();modal.close();render();}
 if(f.id==='category-form'){const name=d.get('name').trim();if(!name)throw Error('Enter a category name.');change({type:'category',month,category:{id:f.dataset.id||crypto.randomUUID(),name,limit:cents(d.get('limit')),recurring:cents(d.get('recurring')),archived:false}});ensure(month);persist();modal.close();render();sync();toast('Category saved.');}
 }catch(err){const out=f.querySelector('.error');if(out)out.textContent=err.message;else toast(err.message);}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
window.addEventListener('online',()=>{sync();checkForUpdates();});window.addEventListener('offline',()=>{status='Offline · saved on device';updateStatus();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)saveDraft();else{sync();checkForUpdates();}});
window.addEventListener('storage',e=>{if(e.key===storageKey){try{const other=JSON.parse(e.newValue||'{}');token=other.token||'';base=other.base||empty();pending=other.pending||[];prefs={...prefs,...other.prefs};rebuild();if(!modal.open)render();else refreshDetail();}catch{}}});
modal.addEventListener('click',e=>{if(e.target===modal){const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){saveDraft();modal.close();}}});
modal.addEventListener('cancel',saveDraft);
window.addEventListener('pagehide',saveDraft);
modal.addEventListener('close',()=>{document.body.dataset.modalOpen='false';document.documentElement.dataset.flowOpen='false';detailView=null;render();unlockPage();});
 document.addEventListener('budget-update-status',updateUpdateUI);
 initializeUpdates({sync,hasPending:()=>pending.length>0,isEditing:()=>modal.open,notify:toast});
if(token){ensureThroughCurrent();persist();}render();(async()=>{await sync();if(token)restoreDraft();})();setInterval(()=>sync(),30000);

enableCategoryReorder(root,ids=>change({type:'category-order',ids}));

let modalTouchY=0;
modal.addEventListener('touchstart',event=>{if(event.touches.length===1)modalTouchY=event.touches[0].clientY;},{passive:true});
modal.addEventListener('touchmove',event=>{
 if(event.touches.length!==1)return;
 const y=event.touches[0].clientY,dy=y-modalTouchY;modalTouchY=y;
 let element=event.target instanceof Element?event.target:null;
 while(element&&modal.contains(element)){
  const overflow=getComputedStyle(element).overflowY;
  if(/auto|scroll/.test(overflow)&&element.scrollHeight>element.clientHeight+1){
   if((dy<0&&element.scrollTop+element.clientHeight<element.scrollHeight-1)||(dy>0&&element.scrollTop>0))return;
  }
  element=element.parentElement;
 }
 if(event.cancelable)event.preventDefault();
},{passive:false});

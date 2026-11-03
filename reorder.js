// Pointer capture keeps the same drag gesture working on touch and desktop.
export function enableCategoryReorder(root, commit) {
 let drag=null, frame=0;
 const rows=list=>[...list.querySelectorAll('[data-order-id]')];
 const ids=list=>rows(list).map(row=>row.dataset.orderId);
 function place(y){
  if(!drag)return;
  const others=rows(drag.list).filter(row=>row!==drag.row);
  const next=others.find(row=>{const r=row.getBoundingClientRect();return y<r.top+r.height/2;});
  if(drag.row.nextElementSibling!==next){
   drag.list.insertBefore(drag.row,next||null);
   // Moving a captured element can release capture; restore it after the move.
   drag.handle.setPointerCapture(drag.pointer);
  }
 }
 function scroll(){
  if(!drag)return;
  const edge=72, height=window.innerHeight;
  const speed=drag.y<edge?-Math.ceil((edge-drag.y)/6):drag.y>height-edge?Math.ceil((drag.y-height+edge)/6):0;
  if(speed){window.scrollBy(0,speed);place(drag.y);}
  frame=requestAnimationFrame(scroll);
 }
 function finish(cancel=false){
  if(!drag)return;
  const current=drag;drag=null;cancelAnimationFrame(frame);
  current.row.classList.remove('dragging');
  current.handle.setAttribute('aria-pressed','false');
  if(current.handle.hasPointerCapture(current.pointer))current.handle.releasePointerCapture(current.pointer);
  if(cancel)for(const id of current.before)current.list.append(current.list.querySelector(`[data-order-id="${CSS.escape(id)}"]`));
  else {const after=ids(current.list);if(after.join()!==current.before.join())commit(after);}
 }
 root.addEventListener('pointerdown',event=>{
  const handle=event.target.closest('[data-drag-category]');if(!handle||event.button!==0)return;
  const row=handle.closest('[data-order-id]'),list=row.parentElement;
  drag={handle,row,list,pointer:event.pointerId,before:ids(list),y:event.clientY};
  handle.setPointerCapture(event.pointerId);handle.setAttribute('aria-pressed','true');row.classList.add('dragging');
  event.preventDefault();frame=requestAnimationFrame(scroll);
 });
 root.addEventListener('pointermove',event=>{if(drag&&event.pointerId===drag.pointer){drag.y=event.clientY;place(event.clientY);event.preventDefault();}});
 root.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointer)finish();});
 root.addEventListener('pointercancel',()=>finish(true));
 root.addEventListener('lostpointercapture',()=>{if(drag&&!drag.handle.hasPointerCapture(drag.pointer))finish(true);});
 root.addEventListener('keydown',event=>{
  const handle=event.target.closest('[data-drag-category]');if(!handle||!['ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();const list=handle.closest('.category-order'),order=ids(list),index=order.indexOf(handle.dataset.dragCategory),to=index+(event.key==='ArrowUp'?-1:1);
  if(to<0||to>=order.length)return;
  [order[index],order[to]]=[order[to],order[index]];commit(order);
  root.querySelector(`[data-drag-category="${CSS.escape(handle.dataset.dragCategory)}"]`)?.focus({preventScroll:true});
 });
}

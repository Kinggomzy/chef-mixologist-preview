/* Chef & Mixologist: clean sort and filter controls.
   Any .toolbar that holds [data-sort] (a <select>) or [data-filter] (a labelled <select> or a .chips group)
   gets two icon buttons: Sort opens a menu of every sort order, Filter opens one dialog with every filter.
   The original controls keep working; they are only moved into the dialog while it is open. */

const FI_SORT='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h10M4 17h5"/></svg>';
const FI_FILTER='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg>';
const FI_TICK='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let FM_OPEN=null;   // closer for whichever menu or dialog is open

function fmClose(){if(FM_OPEN){const c=FM_OPEN;FM_OPEN=null;c()}}

function fmSelects(host){return [...host.querySelectorAll('select')]}
function fmActiveCount(filters){
  let n=0;
  filters.forEach(f=>{
    if(f.classList.contains('chips')){const chips=[...f.querySelectorAll('.chip')];const on=chips.findIndex(c=>c.getAttribute('aria-pressed')==='true');if(on>0)n++}
    else fmSelects(f).forEach(s=>{if(s.selectedIndex>0)n++});
  });
  return n;
}
function fmLabel(f){
  if(f.dataset.label)return f.dataset.label;
  const t=[...f.childNodes].find(x=>x.nodeType===3&&x.textContent.trim());
  return t?t.textContent.trim():'Filter';
}

/* a search box for the page itself (desktop): filters this page's list as you type */
const PG_SEARCHES=[];
function pageSearch(view,generic){
  const l=document.createElement('label');l.className='pg-search';
  l.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" autocomplete="off" aria-label="Search this page" placeholder="'+(PG_HINT[view]||({items:'Search raw materials',moves:'Search movements'})[view])+'"><button type="button" class="pg-x" aria-label="Clear search" hidden>×</button>';
  const inp=l.querySelector('input'),x=l.querySelector('.pg-x');
  const apply=v=>{S.q=v;x.hidden=!v;if(generic)pgRedrawAll();else if(VIEWS[view])VIEWS[view]();else render()};
  inp.value=S.q||'';x.hidden=!inp.value;
  inp.addEventListener('input',()=>apply(inp.value));
  inp.addEventListener('keydown',e=>{if(e.key==='Escape'&&inp.value){e.stopPropagation();inp.value='';apply('')}});
  x.onclick=()=>{inp.value='';apply('');inp.focus()};
  PG_SEARCHES.push({view,inp,x});
  return l;
}
/* ---------- page search for the other list pages ----------
   One search row under the heading. Every paginated list on the page is filtered by the words typed: paginate() does the
   narrowing, and each list's own redraw (registered when its pager is wired) is called so nothing reloads or loses focus. */
const PG_PAGES=['inward','requests','approvals','stocktake','recipes','suppliers','sales','access','notifications'];
const PG_AWARE=new Set(['items','moves','dockets','grn']);   // these lists already read S.q themselves
const PG_HINT={inward:'Search orders and deliveries',requests:'Search requests',approvals:'Search approvals',stocktake:'Search stock-takes',recipes:'Search dishes and recipes',suppliers:'Search suppliers',sales:'Search sales imports',access:'Search access requests',notifications:'Search notifications'};
const PG_REDRAW=[];
const pgText=new WeakMap();
function pgTextOf(it,depth=0){
  if(it==null)return '';
  if(typeof it!=='object')return String(it);
  if(it.nodeType===1)return it.textContent;
  if(depth>3)return '';
  return Object.values(it).map(v=>pgTextOf(v,depth+1)).join(' ');
}
function pgMatch(it,q){
  let t=typeof it==='object'&&it?pgText.get(it):null;
  if(t==null){t=pgTextOf(it).toLowerCase();if(typeof it==='object'&&it)pgText.set(it,t)}
  return q.every(w=>t.includes(w));
}
const paginateBeforeSearch=paginate;
paginate=function(key,list,size,sig=''){
  const q=PG_AWARE.has(key)?'':String(S.q||'').toLowerCase().trim().split(/\s+/).filter(Boolean);
  if(!q||!q.length||!PG_PAGES.includes(S.view))return paginateBeforeSearch(key,list,size,sig);
  return paginateBeforeSearch(key,list.filter(it=>pgMatch(it,q)),size,sig+'|'+q.join(' '));
};
const wirePagerBeforeSearch=wirePager;
wirePager=function(root,rerender){
  const at=PG_REDRAW.findIndex(r=>r.root===root);if(at>=0)PG_REDRAW.splice(at,1);
  PG_REDRAW.push({root,rerender});
  wirePagerBeforeSearch(root,rerender);
};
function pgRedrawAll(){
  for(let i=PG_REDRAW.length-1;i>=0;i--)if(!PG_REDRAW[i].root.isConnected)PG_REDRAW.splice(i,1);
  const v=document.querySelector('.view.on');
  PG_REDRAW.filter(r=>v&&v.contains(r.root)).forEach(r=>r.rerender());
}
{const ih=document.querySelector('#v-inward .page-head');if(ih){const row=document.createElement('div');row.className='pg-bar';row.append(pageSearch('inward',true));ih.after(row)}}
const viewBeforeSearch=view;
view=function(id,...rest){
  const body=viewBeforeSearch(id,...rest);
  if(PG_PAGES.includes(id)){
    const head=body.parentElement.querySelector('.page-head'),l=pageSearch(id,true);
    const row=document.createElement('div');row.className='pg-bar';row.append(l);head.after(row);
  }
  return body;
};
/* the box always shows what the page is filtered by, and clears when you move to another page */
const goBeforePageSearch=go;
go=function(v,opts={}){if(!('q' in opts)&&v!==S.view)S.q='';goBeforePageSearch(v,opts);PG_SEARCHES.forEach(p=>{p.inp.value=S.q||'';p.x.hidden=!p.inp.value})};

function tidyBar(bar,bars=[bar]){
  const sortSel=bars.map(b=>b.querySelector('select[data-sort]')).find(Boolean)||null,filters=bars.flatMap(b=>[...b.querySelectorAll('[data-filter]')]);
  bars.forEach(b=>b.dataset.tidy='1');
  if(!sortSel&&!filters.length)return;
  const holder=document.createElement('div');holder.className='fm-holder';holder.hidden=true;
  bar.append(holder);
  const sortLabel=sortSel&&sortSel.closest('label');
  if(sortLabel)holder.append(sortLabel);
  filters.forEach(f=>holder.append(f));
  const box=document.createElement('span');box.className='fm-btns';
  box.innerHTML=(sortSel?`<button type="button" class="icon-btn" data-fm="sort" aria-haspopup="menu" aria-label="Sort" title="Sort">${FI_SORT}</button>`:'')+
    (filters.length?`<button type="button" class="icon-btn" data-fm="filter" aria-haspopup="dialog" aria-label="Filters" title="Filters">${FI_FILTER}<i class="fm-badge" hidden></i></button>`:'');
  const vid=(bar.closest('.view')||{}).id;
  if(['v-items','v-moves'].includes(vid))box.prepend(pageSearch(vid.slice(2)));
  const seg=bar.querySelector('.seg');
  seg?seg.before(box):bar.insertBefore(box,holder);
  bars.forEach(b=>{if(b!==bar&&!b.children.length)b.hidden=true});
  const badge=box.querySelector('.fm-badge'),fbtn=box.querySelector('[data-fm=filter]'),sbtn=box.querySelector('[data-fm=sort]');
  const refresh=()=>{
    if(badge){const n=fmActiveCount(filters);badge.hidden=!n;badge.textContent=n;fbtn.title=n?`Filters (${n} on)`:'Filters';fbtn.classList.toggle('on',!!n)}
    if(sbtn)sbtn.title='Sort: '+(sortSel.selectedOptions[0]?.textContent||'');
  };
  refresh();
  new MutationObserver(refresh).observe(holder,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','selected']});
  filters.forEach(f=>fmSelects(f).forEach(s=>s.addEventListener('change',refresh)));
  if(sortSel)sortSel.addEventListener('change',refresh);

  if(sbtn)sbtn.onclick=e=>{
    e.stopPropagation();
    const was=sbtn.getAttribute('aria-expanded')==='true';fmClose();if(was)return;
    const menu=document.createElement('div');menu.className='fm-menu';menu.setAttribute('role','menu');
    menu.innerHTML=[...sortSel.options].map(o=>`<button type="button" role="menuitemradio" aria-checked="${o.value===sortSel.value}" data-v="${esc(o.value)}"><span class="fm-tick">${o.value===sortSel.value?FI_TICK:''}</span>${esc(o.textContent)}</button>`).join('');
    menu.onclick=ev=>{const b=ev.target.closest('[data-v]');if(!b)return;sortSel.value=b.dataset.v;sortSel.dispatchEvent(new Event('change',{bubbles:true}));fmClose()};
    box.append(menu);sbtn.setAttribute('aria-expanded','true');
    FM_OPEN=()=>{menu.remove();sbtn.removeAttribute('aria-expanded')};
  };

  if(fbtn)fbtn.onclick=e=>{
    e.stopPropagation();fmClose();
    const back=document.createElement('div');back.className='fm-back';
    back.innerHTML='<div class="fm-dialog" role="dialog" aria-modal="true" aria-label="Filters"><div class="fm-h"><h2>Filters</h2><button type="button" class="icon-btn fm-x" aria-label="Close">×</button></div><div class="fm-body"></div><div class="fm-f"><button type="button" class="btn btn-line" data-clear>Clear all</button><button type="button" class="btn btn-primary" data-done>Done</button></div></div>';
    const body=back.querySelector('.fm-body');
    filters.forEach(f=>{const g=document.createElement('div');g.className='fm-group';
      if(f.classList.contains('chips')){g.innerHTML=`<b>${esc(fmLabel(f))}</b>`}
      else{const t=[...f.childNodes].find(x=>x.nodeType===3&&x.textContent.trim());if(t){g.innerHTML=`<b>${esc(t.textContent.trim())}</b>`;t.textContent=''}}
      g.append(f);body.append(g)});
    document.body.append(back);
    FM_OPEN=()=>{filters.forEach(f=>{const t=[...f.childNodes].find(x=>x.nodeType===3);holder.append(f)});back.remove();refresh();if(fbtn.isConnected)fbtn.focus()};
    back.addEventListener('mousedown',ev=>{if(ev.target===back)fmClose()});
    back.querySelector('[data-done]').onclick=fmClose;back.querySelector('.fm-x').onclick=fmClose;
    back.querySelector('[data-clear]').onclick=async()=>{
      for(const f of filters){
        if(f.classList.contains('chips')){const first=f.querySelector('.chip');if(first&&first.getAttribute('aria-pressed')!=='true')first.click()}
        else for(const s of fmSelects(f)){if(s.selectedIndex>0){s.selectedIndex=0;s.dispatchEvent(new Event('change',{bubbles:true}))}}
        await new Promise(r=>setTimeout(r,60));
      }
      refresh()};
    const first=back.querySelector('select,.chip');if(first)first.focus();
  };
}

function tidyAll(){
  const done=new Set();
  document.querySelectorAll('.toolbar:not([data-tidy])').forEach(b=>{
    if(done.has(b))return;
    const scope=b.closest('.view')||b.parentElement;
    const bars=[...scope.querySelectorAll('.toolbar:not([data-tidy])')].filter(x=>x.querySelector('[data-sort],[data-filter]'));
    bars.forEach(x=>done.add(x));done.add(b);
    if(!bars.length){b.dataset.tidy='1';return}
    const host=bars.find(x=>x.querySelector('.seg,.result-count'))||bars[bars.length-1];
    tidyBar(host,bars);
  });
}
/* the path is read from the event itself: a chip that re-renders its group is already detached by the time the click bubbles up here */
document.addEventListener('click',e=>{if(FM_OPEN&&!e.composedPath().some(n=>n.matches&&n.matches('.fm-menu,.fm-dialog,[data-fm]')))fmClose()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&FM_OPEN)fmClose()});
window.addEventListener('hashchange',fmClose);
let fmTimer=0;
new MutationObserver(()=>{clearTimeout(fmTimer);fmTimer=setTimeout(tidyAll,30)}).observe(document.querySelector('.page')||document.body,{childList:true,subtree:true});
tidyAll();

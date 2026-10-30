/* Chef & Mixologist: cross-links between pages.
   Any name the app shows (a supplier, an item, a purchase order, a recipe, a storage area, a category,
   a person) is written with xl(). Clicking it opens a quick view; the quick view's buttons open the
   matching page filtered to just that one record, with a bar on top to show everything again.
   Loaded last, after every screen renderer. */

/* ---------- writing links ---------- */
const XL_KIND={supplier:'Supplier',item:'Item',po:'Purchase order',recipe:'Recipe',location:'Storage area',category:'Category',person:'Person',day:'Day'};
function xl(kind,key,label){
  const text=label==null?key:label;
  if(key==null||key===''||!xlCan(kind,key))return esc(String(text??''));
  return `<a class="xl" href="#" data-xl="${kind}" data-k="${esc(String(key))}" title="${XL_KIND[kind]}: ${esc(String(text))}">${esc(String(text))}</a>`;
}
function xlCan(kind,key){
  if(kind==='item')return !!bySku[key];
  if(kind==='person')return API.live&&key!=='System';
  if(kind==='po')return POS.some(p=>p.po===key)||GRNS.some(g=>g.po===key);
  return true;
}
// a part id from a recipe line: a raw material opens its item, a prep or dish opens its recipe
function xlPart(id,name){const x=items.find(i=>i.id===id);return x?xl('item',x.sku,name):xl('recipe',id,name)}

// names from the server (wastage, returns, price alerts): link when it is one of our items
function xlItemName(name){const x=items.find(i=>i.name===name);return x?xl('item',x.sku,name):esc(String(name??''))}

document.addEventListener('click',e=>{
  const a=e.target.closest('[data-xl]');if(!a)return;
  e.preventDefault();e.stopPropagation();openXL(a.dataset.xl,a.dataset.k);
},true);

/* ---------- filtering a page down to one record ---------- */
S.focus=null;
function focusOn(view,kind,key,label,opts={}){$('#modal').classList.remove('on');closeItem();go(view,{...opts,focus:{kind,key,label:label||key}})}
function focusBar(){
  const f=S.focus;if(!f)return '';
  return `<div class="focus-bar" role="status"><span>Showing only ${XL_KIND[f.kind].toLowerCase()} <b>${esc(String(f.label))}</b></span><button type="button" class="btn btn-sm btn-line" data-unfocus>Show all</button></div>`;
}
function wireFocusBar(root){root.querySelectorAll('[data-unfocus]').forEach(b=>b.onclick=()=>{S.focus=null;go(S.view)})}
const focusIs=(kind,key)=>S.focus&&S.focus.kind===kind&&(key===undefined||String(S.focus.key)===String(key));
function showFocusBar(view){
  const v=$('#v-'+view);if(!v)return;v.querySelector(':scope > .focus-bar')?.remove();
  if(!S.focus)return;
  const at=v.querySelector('.page-head');(at||v.firstElementChild).insertAdjacentHTML(at?'afterend':'beforebegin',focusBar());wireFocusBar(v);
}
const viewBeforeLinks=view;
view=function(id,...rest){const body=viewBeforeLinks(id,...rest);showFocusBar(id);return body};
const goBeforeLinks=go;
go=function(v,opts={}){if(!('focus' in opts))S.focus=null;goBeforeLinks(v,opts)};
const renderBeforeLinks=render;
render=function(){renderBeforeLinks();if(VIEWS[S.view])setTimeout(()=>showFocusBar(S.view),0)};

/* ---------- quick views ---------- */
function peek(title,sub,body,actions=[]){
  $('#modal-box').className='modal-box';delete $('#modal-box').dataset.size;
  $('#modal-box').innerHTML=`<div class="modal-h"><div><small class="peek-kind">${sub[0]}</small><h2 id="m-title">${title}</h2><p class="muted">${sub[1]||''}</p></div><button class="icon-btn" style="background:var(--grey-soft)" id="mx" aria-label="Close">✕</button></div>
   <div class="peek-b">${body}</div>
   <div class="modal-f">${actions.map((a,i)=>`<button class="btn ${i===0?'btn-primary':'btn-line'}" type="button" data-pa="${i}">${a[0]}</button>`).join('')}</div>`;
  $('#modal').classList.add('on');
  const close=()=>$('#modal').classList.remove('on');$('#mx').onclick=close;
  $$('#modal-box [data-pa]').forEach(b=>b.onclick=()=>{close();actions[+b.dataset.pa][1]()});
  setTimeout(()=>$('#mx').focus(),30);
}
const peekRows=rows=>rows.length?`<div class="peek-list">${rows.join('')}</div>`:'<p class="muted" style="margin:0">None.</p>';
const peekSec=(t,html)=>`<section class="peek-s"><h3>${t}</h3>${html}</section>`;
const poTotal=p=>Object.entries(p.lines).reduce((a,[s,q])=>a+q*(bySku[s]?bySku[s].cost:0),0);

let SUP_CACHE=null;
async function supplierBoard(){if(!API.live||!API.can.suppliers)return null;if(!SUP_CACHE)SUP_CACHE=api('/plugin/cm/suppliers/').catch(()=>null);return SUP_CACHE}
async function recipeBook(){if(!RECIPES){try{RECIPES=await api('/plugin/cm/recipes/')}catch(e){return null}}return RECIPES}

async function openXL(kind,key){
  if(kind==='item')return openItem(key);
  if(kind==='location')return focusOn('items','location',key,key,{loc:key,cat:'All',status:'all'});
  if(kind==='category')return focusOn('items','category',key,key,{cat:key,loc:'all',status:'all'});
  if(kind==='supplier')return peekSupplier(key);
  if(kind==='po')return peekPO(key);
  if(kind==='recipe')return peekRecipe(key);
  if(kind==='person')return peekPerson(key);
}

async function peekSupplier(name){
  const mine=items.filter(x=>x.sup===name),pos=POS.filter(p=>p.sup===name),grns=GRNS.filter(g=>g.sup===name).slice(0,5);
  const money=API.can.pricing!==false;
  const board=await supplierBoard(),s=board&&board.suppliers.find(r=>r.name===name);
  const stats=s?`<div class="peek-stats num"><div><b>${s.onTimePct==null?'—':s.onTimePct+'%'}</b><small>On time</small></div><div><b>${s.fillPct==null?'—':s.fillPct+'%'}</b><small>In full</small></div><div><b>${s.receipts}</b><small>Deliveries</small></div><div><b>${s.openOrders}</b><small>Open orders</small></div></div>`:'';
  peek(esc(name),['Supplier',`${mine.length} item${mine.length===1?'':'s'} · ${pos.length} open order${pos.length===1?'':'s'}`],
    stats+
    peekSec('Items they supply',peekRows(mine.map(x=>{const c=calc(x);return `<div>${xl('item',x.sku,x.name)}<span>${fq(x.onHand)} ${esc(x.unit)} · ${sticker(c.st)}</span></div>`})))+
    peekSec('Open purchase orders',peekRows(pos.map(p=>`<div>${xl('po',p.po)}<span>${esc(p.eta)}${money?` · ${inr(poTotal(p))}`:''}</span></div>`)))+
    (grns.length?peekSec('Recent deliveries',peekRows(grns.map(g=>`<div><span>${esc(g.grn)} · ${xl('po',g.po)}</span><span>${dayLabel(g.d)} · ${esc(g.qc)}</span></div>`))):''),
    [...(!API.live||API.can.suppliers?[['Open supplier page',()=>focusOn('suppliers','supplier',name)]]:[]),
     ['Their items',()=>focusOn('items','supplier',name,name,{cat:'All',loc:'all',status:'all'})],
     ['Their orders and deliveries',()=>focusOn('inward','supplier',name)]]);
}

function peekPO(ref){
  const p=POS.find(o=>o.po===ref),g=GRNS.filter(r=>r.po===ref);
  if(!p&&!g.length)return toast('That order is no longer open');
  const sup=p?p.sup:g[0].sup,money=API.can.pricing!==false;
  const lines=p?Object.entries(p.lines).filter(([s])=>bySku[s]).map(([s,q])=>`<div>${xl('item',s,bySku[s].name)}<span>${fq(q)} ${esc(bySku[s].unit)}${money?` · ${inr(q*bySku[s].cost)}`:''}</span></div>`)
    :g[0].lines.filter(l=>bySku[l[0]]).map(l=>`<div>${xl('item',l[0],bySku[l[0]].name)}<span>${fq(l[2])} of ${fq(l[1])} ${esc(bySku[l[0]].unit)} received</span></div>`);
  const acts=[['Open in Goods inward',()=>focusOn('inward','po',ref)]];
  if(p&&API.can.purchase)acts.push(['Send on WhatsApp',()=>waSendPO(p)]);
  if(p&&p.day<=1&&(!API.live||API.can.stock))acts.unshift(['Receive goods',()=>openReceive(ref)]);
  peek(esc(ref),['Purchase order',`${xl('supplier',sup)} · ${p?esc(p.eta):'Received'}${p&&money?` · ${inr(poTotal(p))}`:''}`],
    peekSec(p?'On this order':'What arrived',peekRows(lines))+(g.length?peekSec('Deliveries',peekRows(g.map(r=>`<div><span>${esc(r.grn)}</span><span>${dayLabel(r.d)} · ${esc(r.qc)}</span></div>`))):''),acts);
}

async function peekRecipe(key){
  const d=await recipeBook();if(!d)return toast('Recipes are not available to your role');
  const r=d.recipes.find(x=>String(x.id)===String(key)||x.name===key||x.sku===key);
  if(!r)return toast('That recipe is no longer on the menu');
  const money=API.can.pricing,usedIn=d.recipes.filter(o=>o.lines.some(l=>l.part===r.id));
  peek(esc(r.name),[r.kind==='prep'?'Prep':r.kind==='beverage'?'Mocktail':'Dish',`${esc(r.sku)} · ${r.kind==='prep'?`batch makes ${num(r.batchYield)} ${esc(r.unit)}`:inr(r.price)+' before GST'}${money&&r.foodCostPct!=null?` · food cost ${r.foodCostPct}%`:''}`],
    (r.image?`<img class="peek-photo" data-auth-src="${esc(r.image)}" alt="${esc(r.name)}">`:'')+peekSec('Ingredients',peekRows(r.lines.map(l=>`<div>${xlPart(l.part,l.name)}<span>${l.useUnit?`${num(l.useQty)} ${esc(l.useUnit)}`:`${num(l.qty)} ${esc(l.unit)}`}${l.usablePct<100?` (${num(l.asBought)} ${esc(l.unit)} as bought)`:''}${money&&l.cost!=null?` · ${inr(l.cost)}`:''}</span></div>`)))+
    (usedIn.length?peekSec('Used in',peekRows(usedIn.map(o=>`<div>${xl('recipe',o.id,o.name)}<span>${esc(o.sku)}</span></div>`))):'')+
    (r.allergens.length?`<p class="muted" style="margin:0">Allergens: ${r.allergens.map(a=>esc(ALLERGEN(a))).join(', ')}</p>`:''),
    [['Open in Menu & recipes',()=>focusOn('recipes','recipe',r.id,r.name)],...(API.can.recipes?[['Edit recipe',()=>editRecipe(r)]]:[])]);
}

function peekPerson(name){
  const mv=moves.filter(m=>m.user===name);
  peek(esc(name),['Person',`${mv.length} recent stock movement${mv.length===1?'':'s'}`],
    peekSec('Recent movements',peekRows(mv.slice(0,8).map(m=>`<div>${xl('item',m.x.sku,m.x.name)}<span>${esc(m.t)} · ${dayLabel(m.d)}, ${m.time} · ${m.q>0?'+':'−'}${fq(Math.abs(m.q))} ${esc(m.x.unit)}</span></div>`))),
    [['All their movements',()=>focusOn('moves','person',name)],...(API.can.staff?[['Open in Team',()=>focusOn('team','person',name)]]:[])]);
}

/* Trimmed card titles show their full text on hover */
const TRIMMED='.sc-t h3,.sc-code,.dish h3,.jar-card h3,.biz-h h3,.chipcard b,.person-t b,.basket-h h3,.stub h4,.docket-h h3,.zr > b';
document.addEventListener('mouseover',e=>{const el=e.target.closest&&e.target.closest(TRIMMED);
  if(el&&!el.title&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1))el.title=el.textContent.trim()});

/* Phones: reference panels start folded so the working content comes first */
if(matchMedia('(max-width:860px)').matches)$$('details.formula-wrap').forEach(d=>d.open=false);

/* Balanced panel columns: each panel goes, in order, into whichever column is shorter */
function flowPanels(){
  $$('.admin-grid.flow').forEach(g=>{
    const panels=[...g.querySelectorAll(':scope > .panel, :scope > .flow-col > .panel')];
    const n=g.clientWidth>=900?2:1;
    if(g.dataset.cols===String(n)&&g.querySelector('.flow-col'))return;
    g.dataset.cols=n;g.innerHTML='';
    const cols=[...Array(n)].map(()=>g.appendChild(Object.assign(document.createElement('div'),{className:'flow-col'})));
    panels.forEach(p=>{cols.reduce((a,b)=>b.offsetHeight<a.offsetHeight?b:a).appendChild(p)});
  });
}
new MutationObserver(()=>{if($('.admin-grid.flow:not([data-cols])'))flowPanels()}).observe(document.body,{childList:true,subtree:true});
addEventListener('resize',()=>{clearTimeout(window.__flowT);window.__flowT=setTimeout(flowPanels,150)});

/* Card header notes become an info icon beside the title; the note shows only on hover or focus.
   Applies to every card on every page, including ones drawn later. Notes holding buttons or links stay as they are. */
const NOTE_SEL='.panel-h > p, .d-sec > h3 > span, .menu-h > span:not(.seg)';
const INFO_ICON='<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>';
function tipify(){
  $$(NOTE_SEL).forEach(el=>{
    const text=el.textContent.replace(/\s+/g,' ').trim();
    if(el.id||el.children.length||!text||/^[\d\s.,+−-]+$/.test(text))return;  // keep live-updated notes, controls and plain counts
    const b=document.createElement('button');b.type='button';b.className='info-tip';b.dataset.tip=text;b.setAttribute('aria-label',text);b.innerHTML=INFO_ICON;
    const title=el.parentElement.matches('h3')?el.parentElement:el.parentElement.querySelector('h2,h3');
    if(el.parentElement.matches('h3'))el.replaceWith(b);
    else if(title){title.appendChild(b);el.remove()}
  });
}
function makeTip(text){const b=document.createElement('button');b.type='button';b.className='info-tip';b.dataset.tip=text;b.setAttribute('aria-label',text);b.innerHTML=INFO_ICON;return b}
/* Helper sentences inside a card's form move into one info icon to the right of the card's buttons
   (or beside the card title when the person has no buttons). Warnings with an id stay visible. */
function tipifyForms(){
  $$('.panel form').forEach(f=>{
    if(f.closest('#modal'))return;
    const notes=[...f.children].filter(p=>p.matches('p.muted')&&!p.id&&!p.children.length&&p.textContent.trim());
    if(!notes.length)return;
    const b=makeTip(notes.map(n=>n.textContent.replace(/\s+/g,' ').trim()).join(' '));
    const row=[...f.children].reverse().find(c=>c.matches('div')&&c.querySelector(':scope > .btn, :scope > button'));
    if(row){row.classList.add('btn-row');row.appendChild(b)}
    else{const h=f.closest('.panel')?.querySelector('.panel-h h2');if(!h)return;h.appendChild(b)}
    notes.forEach(n=>n.remove());
  });
}
let tipQueued=false;
new MutationObserver(()=>{if(tipQueued)return;tipQueued=true;requestAnimationFrame(()=>{tipQueued=false;tipify();tipifyForms()})}).observe(document.body,{childList:true,subtree:true,characterData:true});
const tipBox=document.body.appendChild(Object.assign(document.createElement('div'),{id:'tipBox',role:'tooltip'}));
function showTip(b){tipBox.textContent=b.dataset.tip;tipBox.classList.add('on');
  const r=b.getBoundingClientRect(),w=tipBox.offsetWidth,h=tipBox.offsetHeight;
  let left=Math.min(Math.max(8,r.left+r.width/2-w/2),innerWidth-w-8),top=r.top-h-8;if(top<8)top=r.bottom+8;
  tipBox.style.left=left+'px';tipBox.style.top=top+'px'}
const hideTip=()=>tipBox.classList.remove('on');
document.addEventListener('mouseover',e=>{const b=e.target.closest&&e.target.closest('.info-tip');b?showTip(b):hideTip()});
document.addEventListener('focusin',e=>{const b=e.target.closest&&e.target.closest('.info-tip');if(b)showTip(b)});
document.addEventListener('focusout',hideTip);
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.info-tip');if(b){e.preventDefault();e.stopPropagation();tipBox.classList.contains('on')&&tipBox.textContent===b.dataset.tip?hideTip():showTip(b)}else hideTip()},true);
addEventListener('scroll',hideTip,true);
tipify();tipifyForms();


/* ---------- one address form for the restaurant and every supplier ---------- */
const IN_STATES=['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'];
function addressFields(a={},dis=''){
  const v=k=>esc(a[k]||'');
  return `<div class="addr-grid" style="grid-column:1/-1">
    <label class="addr-wide">Address line 1<input name="address" value="${v('address')}" ${dis} maxlength="300" autocomplete="address-line1" placeholder="House or plot number, street"></label>
    <label class="addr-wide">Address line 2<input name="address2" value="${v('address2')}" ${dis} maxlength="200" autocomplete="address-line2" placeholder="Area, landmark (optional)"></label>
    <label>City<input name="city" value="${v('city')}" ${dis} maxlength="80" autocomplete="address-level2"></label>
    <label>State<input name="state" value="${v('state')}" ${dis} maxlength="80" list="inStates" autocomplete="address-level1"></label>
    <label>PIN code<input name="pin" value="${v('pin')}" ${dis} maxlength="12" inputmode="numeric" autocomplete="postal-code" placeholder="700089"></label>
    <label>Country<input name="country" value="${esc(a.country==null?'India':a.country)}" ${dis} maxlength="80" autocomplete="country-name"></label>
    <datalist id="inStates">${IN_STATES.map(s=>`<option value="${esc(s)}">`).join('')}</datalist></div>`;
}

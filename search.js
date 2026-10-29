/* Chef & Mixologist: menu search.
   Typing in "Search the menu" filters the menu at once and lists matching pages, sections inside pages
   (e.g. Approval limits in Organisation settings), items, suppliers, purchase orders, recipes and people,
   each with where it lives. Arrow keys move, Enter opens, Escape closes. */

// sections inside pages: [view, card title, extra words people might type]
const SECTIONS=[
  ['org','Restaurant details','name address phone gstin fssai website timezone outlet tagline'],['org','Logo','brand image upload'],
  ['org','Kitchen targets','food cost target stock-out protection service level'],['org','Colour palette','theme colours brand'],
  ['org','Stock costing & reordering','fifo lifo moving average costing method order cost holding rate eoq'],
  ['org','Approval limits','wastage purchase order count limit approve'],['org','WhatsApp orders','whatsapp desktop web prices'],
  ['org','Sign-in security','mfa two-step authenticator 2fa'],
  ['profile','Personal details','first name last name phone job title'],['profile','Account security','password two-step authenticator'],
  ['profile','Signed-in devices','sessions sign out devices'],['prefs','Notification preferences','alerts push email'],
  ['setup','Suppliers','add supplier gstin whatsapp number contact'],['setup','Storage areas','locations walk-in chiller dry store'],
  ['setup','Item categories','category'],['setup','Import items from a spreadsheet','csv excel import template upload'],
  ['setup','Supplier price lists','price list excel template import rates'],['setup','Archived','restore deleted'],
  ['stocktake','Differences found','shrinkage missing extra variance report'],['prep','Wastage','waste thrown away reasons'],
  ['reports','Supplier price changes','price alerts'],['reports','Where waste happened','wastage top items'],
  ['permissions','Roles & access','permissions grid role'],['install','Install app','pwa offline phone'],
];
const pathOf=v=>{const n=NAV.find(x=>x[0]===v);const i=NAV.findIndex(x=>x[0]===v),grp=NAV.slice(0,i).reverse().find(x=>x[0].startsWith('_'));
  return (grp?grp[1]:'Daily work')+' › '+(n?n[1]:v==='profile'?'My profile':v==='prefs'?'Notification preferences':v)};
const canSee=v=>{const n=NAV.find(x=>x[0]===v);return v==='profile'||(n&&(!n[3]||n[3]()))};

let MQ_HITS=[],MQ_SEL=0;
function menuResults(q){
  q=q.trim().toLowerCase();if(q.length<2)return [];
  const re=new RegExp('(^|[^a-z0-9])'+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i');
  // 3 = starts with the words typed, 2 = a word starts with them, 1 = found inside a word (names and codes only)
  const score=s=>{s=String(s||'').toLowerCase();return s.startsWith(q)?3:re.test(s)?2:s.includes(q)?1:0};
  const has=s=>score(s)>0,word=s=>score(s)>=2,out=[];
  NAV.filter(n=>!n[0].startsWith('_')&&canSee(n[0])&&has(n[1])).forEach(n=>out.push({kind:'Page',label:n[1],where:pathOf(n[0]),go:()=>go(n[0])}));
  if(canSee('profile')&&has('my profile'))out.push({kind:'Page',label:'My profile',where:'You',go:()=>go('profile')});
  SECTIONS.filter(([v,t,w])=>canSee(v)&&(word(t)||word(w))).forEach(([v,t])=>out.push({kind:'Section',label:t,where:pathOf(v),go:()=>jumpToSection(v,t)}));
  items.filter(x=>has(x.name)||has(x.sku)).slice(0,8).forEach(x=>out.push({kind:'Item',label:x.name,where:`Raw materials · ${x.sku} · ${x.loc}`,go:()=>openItem(x.sku)}));
  (META&&META.suppliers||[]).filter(s=>has(s.name)).slice(0,5).forEach(s=>out.push({kind:'Supplier',label:s.name,where:'Suppliers',go:()=>openXL('supplier',s.name)}));
  POS.filter(p=>has(p.po)||has(p.sup)).slice(0,5).forEach(p=>out.push({kind:'Order',label:`${p.po} · ${p.sup}`,where:`Goods inward · ${p.eta}`,go:()=>openXL('po',p.po)}));
  if(RECIPES)RECIPES.recipes.filter(r=>has(r.name)||has(r.sku)).slice(0,5).forEach(r=>out.push({kind:'Recipe',label:r.name,where:`Menu & recipes · ${r.sku}`,go:()=>openXL('recipe',r.id)}));
  [...new Set(moves.map(m=>m.user))].filter(u=>has(u)).slice(0,3).forEach(u=>out.push({kind:'Person',label:u,where:'Stock movements',go:()=>openXL('person',u)}));
  out.forEach((h,i)=>{h.s=score(h.label)*10-i/100});  // best label matches first, otherwise keep the group order
  return out.sort((a,b)=>b.s-a.s).slice(0,14);
}
async function jumpToSection(v,title){
  go(v);
  for(let i=0;i<30;i++){  // pages that load from the server draw their cards a moment later
    const h=[...$$(`#v-${v} .panel-h h2, #v-${v} .menu-h h2`)].find(x=>x.childNodes[0]&&x.childNodes[0].textContent.trim().toLowerCase()===title.toLowerCase());
    if(h){const card=h.closest('.panel')||h.closest('.menu-h');card.scrollIntoView({behavior:'smooth',block:'start'});card.classList.add('flash');setTimeout(()=>card.classList.remove('flash'),1800);return}
    await new Promise(r=>setTimeout(r,100));
  }
}
const mqBox=document.body.appendChild(Object.assign(document.createElement('div'),{id:'mqBox',role:'listbox',hidden:true}));
function drawMenuResults(){
  const input=$('#menuQ');MQ_HITS=menuResults(input.value);MQ_SEL=0;
  if(!MQ_HITS.length||!input.value.trim()){mqBox.hidden=true;return}
  const r=input.getBoundingClientRect();
  mqBox.style.left=Math.min(r.right+12,innerWidth-340)+'px';mqBox.style.top=Math.max(8,r.top-4)+'px';
  if(innerWidth<=860){mqBox.style.left='12px';mqBox.style.top=(r.bottom+6)+'px'}
  mqBox.innerHTML=MQ_HITS.map((h,i)=>`<button type="button" role="option" data-i="${i}" aria-selected="${i===0}"><span class="mq-k">${h.kind}</span><b>${esc(h.label)}</b><small>${esc(h.where)}</small></button>`).join('');
  mqBox.hidden=false;
  mqBox.querySelectorAll('[data-i]').forEach(b=>b.onmousedown=e=>{e.preventDefault();pickMenuResult(+b.dataset.i)});
}
function pickMenuResult(i){const h=MQ_HITS[i];if(!h)return;$('#menuQ').value='';filterMenu();mqBox.hidden=true;$('#menuQ').blur();if(typeof setNav==='function')setNav(false);h.go()}
$('#menuQ').oninput=()=>{filterMenu();drawMenuResults()};
$('#menuQ').onkeydown=e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){if(!MQ_HITS.length)return;e.preventDefault();MQ_SEL=(MQ_SEL+(e.key==='ArrowDown'?1:-1)+MQ_HITS.length)%MQ_HITS.length;
    mqBox.querySelectorAll('[data-i]').forEach(b=>b.setAttribute('aria-selected',+b.dataset.i===MQ_SEL));mqBox.querySelector(`[data-i="${MQ_SEL}"]`).scrollIntoView({block:'nearest'})}
  else if(e.key==='Enter'){e.preventDefault();if(MQ_HITS.length)pickMenuResult(MQ_SEL);else{const b=$('#menu button[data-v]:not([hidden])');if(b){b.click();e.target.value='';filterMenu()}}}
  else if(e.key==='Escape'){e.target.value='';filterMenu();mqBox.hidden=true}
};
$('#menuQ').addEventListener('blur',()=>setTimeout(()=>mqBox.hidden=true,150));
$('#menuQ').addEventListener('focus',drawMenuResults);
addEventListener('resize',()=>{if(!mqBox.hidden)drawMenuResults()});

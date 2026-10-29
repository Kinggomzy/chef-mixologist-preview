/* Chef & Mixologist: month-end close.
   Each ended month can be closed once: closing stock is frozen at its value on the month's last day, and
   opening + purchases - closing gives what the month used. Closed months can be reopened with a reason. */

let CLOSE_SEL=null;

VIEWS.closing=async function(){
  const body=view('closing','Month-end close','Freeze each month\'s closing stock at its value. Opening + purchases − closing shows what the month used.');
  const d=await load(body,'/plugin/cm/closing/');if(!d)return;
  const card=m=>{const c=m.close;
    return `<button class="mclose ${c?'closed':''}" data-m="${m.month}"><span class="sticker ${c?'lime':m.current?'soft':m.canClose?'turmeric':'soft'}">${c?'Closed':m.current?'Running':m.canClose?'Ready to close':/records/.test(m.why||'')?'No records':'Open'}</span>
      <h3>${esc(m.label)}</h3>
      <dl class="num"><dt>Closing stock</dt><dd>${c?inr(c.closing):'—'}</dd><dt>Used</dt><dd>${c?inr(c.usage):'—'}</dd></dl>
      <small>${c?`Closed by ${esc(c.closedBy)} · ${new Date(c.closedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}`:m.current?'Closes after the month ends':esc(m.why||'Not closed yet')}</small></button>`};
  body.innerHTML=`<div class="mcloses">${d.months.map(card).join('')}</div><div id="closeDetail" style="margin-top:22px"></div>
    ${d.reopened.length?panel('Reopened closes','Kept for the record',table(['Month','>Closing stock','Reopened by','Reason'],d.reopened.map(p=>`<tr><td>${esc(p.label)}</td><td class="r num">${inr(p.closing)}</td><td>${esc(p.reopenedBy)} · ${new Date(p.reopenedAt).toLocaleDateString('en-IN')}</td><td>${esc(p.reopenReason)}</td></tr>`))):''}`;
  body.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{CLOSE_SEL=b.dataset.m;showMonth(d)});
  if(!CLOSE_SEL){const first=d.months.find(m=>m.close)||d.months.find(m=>m.canClose);CLOSE_SEL=first&&first.month}
  if(CLOSE_SEL)showMonth(d);
};

function catTable(cats){
  const rows=Object.entries(cats).sort((a,b)=>b[1].usage-a[1].usage);
  const sum=k=>rows.reduce((a,[,r])=>a+r[k],0);
  return table(['Category','>Opening','>Purchases','>Closing','>Used'],[...rows.map(([c,r])=>`<tr><td>${xl('category',c)}</td><td class="r num">${inr(r.opening)}</td><td class="r num">${inr(r.purchases)}</td><td class="r num">${inr(r.closing)}</td><td class="r num"><b>${inr(r.usage)}</b></td></tr>`),
    `<tr class="total"><td><b>Total</b></td><td class="r num"><b>${inr(sum('opening'))}</b></td><td class="r num"><b>${inr(sum('purchases'))}</b></td><td class="r num"><b>${inr(sum('closing'))}</b></td><td class="r num"><b>${inr(sum('usage'))}</b></td></tr>`],'No stock or purchases this month');
}
const closeTiles=f=>`<div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px">
  <div class="tile info"><span class="lbl">Opening</span><span class="val num">${inrK(f.opening)}</span><span class="sub">Last month's closing stock</span></div>
  <div class="tile info"><span class="lbl">Purchases</span><span class="val num">${inrK(f.purchases)}</span><span class="sub">Goods received, at billed prices</span></div>
  <div class="tile good"><span class="lbl">Closing</span><span class="val num">${inrK(f.closing)}</span><span class="sub">On hand at month end</span></div>
  <div class="tile warn"><span class="lbl">Used</span><span class="val num">${inrK(f.usage)}</span><span class="sub">Opening + purchases − closing</span></div></div>`;

async function showMonth(d){
  const box=$('#closeDetail'),m=d.months.find(x=>x.month===CLOSE_SEL);if(!box||!m)return;
  $$('#v-closing [data-m]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.m===CLOSE_SEL));
  const METHOD={fifo:'FIFO',lifo:'LIFO',avg:'moving average'};
  if(m.close){
    let p;try{p=await api(`/plugin/cm/closing/${m.close.id}/`)}catch(e){return fail(e)}
    box.innerHTML=`<div class="menu-h"><h2>${esc(p.label)}</h2><span>Closed · valued at ${METHOD[p.method]||p.method}${p.note?` · ${esc(p.note)}`:''}</span>
       <span style="margin-left:auto;display:flex;gap:8px"><button class="btn btn-sm btn-line" id="clCsv">Download closing stock (CSV)</button>${d.canReopen?'<button class="btn btn-sm btn-line" id="clReopen">Reopen month</button>':''}</span></div>
      ${closeTiles(p)}<div class="admin-grid">${panel('By category','',catTable(p.categories))}
      ${panel('Closing stock by item','Highest value first',table(['Item','>Quantity','>Value'],p.items.slice(0,20).map(i=>`<tr><td>${xlItemName(i.name)}</td><td class="r num">${fq(i.qty)} ${esc(i.unit)}</td><td class="r num">${inr(i.value)}</td></tr>`)))}</div>`;
    $('#clCsv').onclick=()=>{const rows=[['SKU','Item','Category','Quantity','Unit','Unit cost','Value'],...p.items.map(i=>[i.sku,i.name,i.category,i.qty,i.unit,i.unitCost??'',i.value])];
      const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:`closing-stock-${p.month.slice(0,7)}.csv`});a.click()};
    if($('#clReopen'))$('#clReopen').onclick=()=>formModal(`Reopen ${esc(p.label)}?`,'The closed figures are kept in the history and the month can be closed again',
      `<label>Reason<input name="why" required maxlength="200" placeholder="e.g. A supplier bill for the 30th arrived late"></label>`,'Reopen month',async(f,close)=>{
        await api(`/plugin/cm/closing/${p.id}/reopen/`,{method:'POST',json:{reason:f.get('why')}});close();toast(`${esc(p.label)} reopened`);VIEWS.closing()});
    return;
  }
  if(!m.canClose){box.innerHTML=`<div class="panel empty"><b>${esc(m.label)}</b>${esc(m.why||'Not ready to close')}</div>`;return}
  let f;try{f=await api(`/plugin/cm/closing/preview/?month=${m.month.slice(0,7)}`)}catch(e){box.innerHTML='';return}
  box.innerHTML=`<div class="menu-h"><h2>${esc(m.label)}</h2><span>Preview · valued at ${METHOD[f.method]||f.method}${f.previousClosed?'':' · no earlier close, so opening is 0'}</span>
     ${d.canClose?'<span style="margin-left:auto"><button class="btn btn-primary" id="clDo">Close '+esc(m.label)+'</button></span>':''}</div>
    ${closeTiles(f)}${panel('By category',`${f.items} items in stock at month end`,catTable(f.categories))}`;
  if($('#clDo'))$('#clDo').onclick=()=>formModal(`Close ${esc(m.label)}?`,`Closing stock of ${inr(f.closing)} is frozen. Only someone allowed to reopen months can change it.`,
    `<label>Note<input name="note" maxlength="200" placeholder="Optional, e.g. After the 31st stock-take"></label>`,'Close month',async(fm,close)=>{
      await api('/plugin/cm/closing/',{method:'POST',json:{month:m.month.slice(0,7),note:fm.get('note')}});close();toast(`${esc(m.label)} closed`);VIEWS.closing()});
}

NAV.splice(NAV.findIndex(n=>n[0]==='reports')+1,0,['closing','Month-end close','<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M9 15l2 2 4-4"/>',()=>API.live&&API.can.closing]);

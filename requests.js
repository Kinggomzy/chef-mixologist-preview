/* Chef & Mixologist: kitchen requests.
   The kitchen or bar asks the store for stock; the store issues each line in full or in part,
   or refuses it with a reason. Issued stock leaves the store's areas as an issue to that station. */

const REQ_TONE={open:'turmeric',partial:'soft',done:'lime',cancelled:'soft'};
const reqQty=(v,u)=>`${(+v).toLocaleString('en-IN',{maximumFractionDigits:3})} ${esc(u)}`;
const whenTxt=iso=>{if(!iso)return 'No time given';const d=new Date(iso),today=new Date();
  const day=d.toDateString()===today.toDateString()?'Today':d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
  return `${day}, ${d.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})}`};

VIEWS.requests=async function(){
  const body=view('requests','Kitchen requests','The kitchen and bar ask the store for stock. The store issues it, in full or in part, or says why not.');
  const d=await load(body,'/plugin/cm/requests/');if(!d)return;
  const head=$('#v-requests .page-head > div:last-child');
  if(d.canAsk&&head)head.innerHTML='<button class="btn btn-primary" id="reqNew">New request</button>';
  if($('#reqNew'))$('#reqNew').onclick=()=>newRequest(d);
  const card=r=>{const late=r.neededBy&&new Date(r.neededBy)<new Date()&&['open','partial'].includes(r.status);
    const done=r.lines.filter(l=>l.status!=='open').length;
    return `<button class="req edge edge-${late?'bad':EDGE_OF[REQ_TONE[r.status]]}" data-req="${r.id}"><span class="req-top">${edgeTip(late?r.statusLabel+' · late':r.statusLabel)}<small>${esc(r.ref)}</small></span>
      <h3>${esc(r.stationLabel)}</h3><small class="${late?'late':''}">Needed ${esc(whenTxt(r.neededBy))}${late?' · late':''}</small>
      <ul>${r.lines.slice(0,3).map(l=>`<li><span>${esc(l.name)}</span><b class="num">${reqQty(l.requested,l.unit)}</b></li>`).join('')}</ul>
      <small class="req-more">${r.lines.length>3?`+${r.lines.length-3} more · `:''}asked by ${esc(r.requestedBy)}</small>
      <div class="take-bar"><i style="width:${r.lines.length?done/r.lines.length*100:0}%"></i></div></button>`};
  body.innerHTML=(d.open.length?`<div class="menu-h"><h2>Waiting</h2><span>${d.open.length}</span></div><div class="reqs">${d.open.map(card).join('')}</div>`
      :`<div class="panel empty"><b>No requests waiting</b>${d.canAsk?'Ask the store for what the kitchen or bar needs with New request.':'New requests from the kitchen and bar appear here.'}</div>`)+
    (d.recent.length?`<div class="menu-h" style="margin-top:22px"><h2>Last 14 days</h2><span>${d.recent.length}</span></div><div class="reqs">${d.recent.map(card).join('')}</div>`:'');
  const all=[...d.open,...d.recent];
  body.querySelectorAll('[data-req]').forEach(b=>b.onclick=()=>openRequest(all.find(r=>r.id===+b.dataset.req),d));
};

function newRequest(d){
  const opts=items.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const row=()=>{const x=opts[0];return `<div class="reqrow"><label>Item<select name="rp">${opts.map(i=>`<option value="${i.sku}">${esc(i.name)} · ${fq(i.onHand)} ${esc(i.unit)} in stock</option>`).join('')}</select></label>
    <label>Quantity<input name="rq" type="number" min="0" step="any" required></label><label>Unit${unitPick(x,'ru')}</label><button type="button" class="icon-btn rdel" aria-label="Remove">✕</button></div>`};
  const mine=d.myStations.length?d.myStations:d.stations.map(s=>s.key);
  const soon=new Date(Date.now()+2*3600e3);soon.setMinutes(0,0,0);
  const local=new Date(soon.getTime()-soon.getTimezoneOffset()*6e4).toISOString().slice(0,16);
  formModal('New request','The store is told straight away',`
    <div class="two"><label>For<select name="st">${d.stations.filter(s=>mine.includes(s.key)).map(s=>`<option value="${s.key}">${esc(s.label)}</option>`).join('')}</select></label>
    <label>Needed by<input name="nb" type="datetime-local" value="${local}"></label></div>
    <div id="reqrows" style="display:grid;gap:8px">${row()}</div>
    <button type="button" class="btn btn-sm btn-line" id="reqadd" style="justify-self:start">+ Item</button>
    <label>Note<input name="note" maxlength="200" placeholder="e.g. For the 40-cover lunch booking"></label>`,'Send request',async(f,close)=>{
      const lines=$$('#reqrows .reqrow').map(r=>({part:bySku[r.querySelector('[name=rp]').value].id,quantity:r.querySelector('[name=rq]').value,unit:r.querySelector('[name=ru]')?.value||''})).filter(l=>+l.quantity>0);
      if(!lines.length)throw new Error('Add a quantity for at least one item');
      const nb=f.get('nb');
      const r=await api('/plugin/cm/requests/',{method:'POST',json:{station:f.get('st'),lines,needed_by:nb?new Date(nb).toISOString():null,note:f.get('note')}});
      close();toast(`${esc(r.ref)} sent to the store`);VIEWS.requests()});
  const wire=()=>{$$('#reqrows .rdel').forEach(b=>b.onclick=()=>{if($$('#reqrows .reqrow').length>1)b.closest('.reqrow').remove()});
    $$('#reqrows [name=rp]').forEach(s=>s.onchange=()=>{const lab=s.closest('.reqrow').querySelector('[name=ru]').closest('label');lab.innerHTML='Unit'+unitPick(bySku[s.value],'ru')})};
  $('#reqadd').onclick=()=>{$('#reqrows').insertAdjacentHTML('beforeend',row());wire()};wire();
}

function openRequest(r,d){
  const live=['open','partial'].includes(r.status),issue=live&&d.canIssue,mine=r.requestedById===PROFILE?.id;
  const lineRow=l=>{const left=Math.max(0,l.requested-l.issued),open=l.status==='open';
    return `<tr data-line="${l.id}"><td>${xlItemName(l.name)}<br><small class="muted">${esc(l.sku)}${l.reason?` · ${esc(l.reason)}`:''}</small></td>
      <td class="r num">${reqQty(l.requested,l.unit)}</td><td class="r num">${l.issued?reqQty(l.issued,l.unit):'—'}</td>
      <td class="r">${issue&&open?`<span class="qty-unit"><input class="ri-q" type="number" min="0" step="any" value="${+left.toFixed(3)}" aria-label="Issue ${esc(l.name)}">${unitPick(l,'riu')}</span>
        <label class="ri-done"><input type="checkbox" class="ri-short"> Close if short</label>`:`<span class="sticker ${l.status==='done'?'lime':l.status==='refused'?'melon':'turmeric'}">${esc(l.statusLabel)}</span>`}</td>
      ${issue?`<td>${open?'<button type="button" class="btn btn-sm btn-line ri-refuse">Refuse</button>':''}</td>`:''}</tr>`};
  formModal(`${esc(r.stationLabel)} · ${esc(r.ref)}`,`Asked by ${esc(r.requestedBy)} · needed ${esc(whenTxt(r.neededBy))}${r.note?` · ${esc(r.note)}`:''}`,
    `<div class="tablewrap"><table class="t"><thead><tr><th>Item</th><th class="r">Asked</th><th class="r">Issued</th><th class="r">${issue?'Issue now':'Status'}</th>${issue?'<th></th>':''}</tr></thead>
      <tbody>${r.lines.map(lineRow).join('')}</tbody></table></div>
     ${issue?'<p class="muted" style="margin:0;font-size:var(--fs-xs)">Stock comes out of your areas, oldest use-by first, as an issue to this station.</p>':''}`,
    issue?'Issue stock':live&&mine?'Cancel request':'Close',async(f,close)=>{
      if(issue){const lines=$$('#mform tr[data-line]').filter(tr=>tr.querySelector('.ri-q')).map(tr=>({line:+tr.dataset.line,quantity:tr.querySelector('.ri-q').value||0,
          unit:tr.querySelector('[name=riu]')?.value||'',done:tr.querySelector('.ri-short').checked,reason:'Issued short'}));
        const res=await api(`/plugin/cm/requests/${r.id}/issue/`,{method:'POST',json:{lines}});close();toast(`${esc(res.ref)} · ${esc(res.statusLabel.toLowerCase())}`);await reload();VIEWS.requests();return}
      if(live&&mine){await api(`/plugin/cm/requests/${r.id}/cancel/`,{method:'POST',json:{}});close();toast(`${esc(r.ref)} cancelled`);VIEWS.requests();return}
      close()});
  if(!issue&&!(live&&mine))$('#mc').hidden=true;  // a finished request only needs Close
  $$('#mform .ri-refuse').forEach(b=>b.onclick=()=>{const id=+b.closest('tr').dataset.line,l=r.lines.find(x=>x.id===id);
    formModal(`Refuse ${esc(l.name)}?`,`${esc(r.ref)} · the kitchen is told why`,`<label>Reason<input name="why" required maxlength="120" placeholder="e.g. Out of stock until tomorrow's delivery"></label>`,'Refuse line',async(f,close)=>{
      await api(`/plugin/cm/requests/${r.id}/refuse/`,{method:'POST',json:{line:id,reason:f.get('why')}});close();toast('Line refused');VIEWS.requests()})});
}

NAV.splice(NAV.findIndex(n=>n[0]==='moves')+1,0,['requests','Kitchen requests','<path d="M4 6h16M4 12h10M4 18h7"/><path d="m15 16 2 2 4-4"/>',()=>API.live&&API.can.requests]);

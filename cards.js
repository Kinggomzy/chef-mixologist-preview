/* Card views that replace tables where a card reads better. Loaded last. */

/* ================= goods inward: purchase orders as kitchen dockets ================= */
const tableInward=VIEWS.inward;
function renderInwardDockets(){
  tableInward();
  const wrap=$('#expected').closest('.tablewrap');
  wrap.hidden=true;
  let box=$('#dockets');
  if(!box){box=Object.assign(document.createElement('div'),{id:'dockets',className:'dockets'});box.style.padding='16px 18px 20px';wrap.after(box)}
  const list=POS.filter(p=>!S.focus||(S.focus.kind==='supplier'?p.sup===S.focus.key:S.focus.kind==='po'?p.po===S.focus.key:true));
  if(!list.length){box.innerHTML=`<p class="muted">${S.focus?'No open purchase orders for this.':'No open purchase orders. Raise one from Replenishment.'}</p>`;return}
  box.innerHTML=list.map(p=>{
    const lines=Object.entries(p.lines),tot=lines.reduce((a,[s,q])=>a+q*(bySku[s]?bySku[s].cost:0),0);
    return `<article class="docket" style="--hole:var(--surface)" aria-label="Purchase order ${esc(p.po)}">
      <div class="docket-h"><div><h3>${esc(p.po)}</h3><small>${xl('supplier',p.sup)}</small></div><span class="docket-eta ${p.late?'late':p.day===0?'today':''}">${esc(p.eta)}</span></div>
      <ol>${lines.map(([s,q])=>{const x=bySku[s];return x?`<li>${img(x)}<span>${xl('item',x.sku,x.name)}</span><b>${fq(q)} ${esc(x.unit)}</b></li>`:''}).join('')}</ol>
      <div class="docket-f"><span class="total">${inr(tot)}</span>
        <button class="btn btn-sm btn-wa" data-wapo="${esc(p.po)}" title="Send this order to ${esc(p.sup)} on WhatsApp" aria-label="Send ${esc(p.po)} on WhatsApp">${WA_ICON}</button>
        ${p.day<=1?`<button class="btn btn-sm ${p.day===0?'btn-primary':'btn-line'}" data-recv="${esc(p.po)}">Receive</button>`:''}
        ${API.live&&API.can.poCancel?`<button class="btn btn-sm btn-line" data-pocancel="${p.id}" style="color:var(--red)">Cancel</button>`:''}</div>
    </article>`}).join('');
  box.querySelectorAll('[data-recv]').forEach(b=>b.onclick=()=>openReceive(b.dataset.recv));
  box.querySelectorAll('[data-wapo]').forEach(b=>b.onclick=()=>waSendPO(b.dataset.wapo));
  box.querySelectorAll('[data-pocancel]').forEach(b=>b.onclick=()=>{const p=POS.find(o=>o.id===+b.dataset.pocancel);
    formModal(`Cancel ${esc(p.po)}?`,`${esc(p.sup)}. Only possible before anything is received.`,`<label>Reason<input name="r" required maxlength="200"></label>`,'Cancel order',async(f,close)=>{
      await api(`/plugin/cm/po/${p.id}/cancel/`,{method:'POST',json:{reason:f.get('r')}});close();toast(`${esc(p.po)} cancelled`);await reload()})});
}
VIEWS.inward=renderInwardDockets;

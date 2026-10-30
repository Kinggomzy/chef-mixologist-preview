/* Chef & Mixologist: approval limits.
   Wastage, count corrections and purchase orders over the limits in Organisation settings wait here.
   Approving carries out the original request; rejecting needs a reason. Approvers are never held back. */

function limitsPanel(o,dis,can){
  const L=o.limits||{},v=k=>L[k]==null?'':L[k];
  return panel('Approval limits','Bigger changes wait for an owner or manager. Leave a box empty for no limit.',`<form id="limF" class="calc" style="display:grid;gap:12px">
   <div class="two"><label>Wastage worth more than (₹)<input name="limitWastage" type="number" min="0" step="1" value="${v('limitWastage')}" placeholder="No limit" ${dis}></label>
   <label>Purchase order worth more than (₹)<input name="limitPo" type="number" min="0" step="1" value="${v('limitPo')}" placeholder="No limit" ${dis}></label>
   <label>Count changing stock by more than (%)<input name="limitCountPct" type="number" min="0" max="100" step="0.5" value="${v('limitCountPct')}" placeholder="No limit" ${dis}></label>
   <label>… or by more than (₹)<input name="limitCountValue" type="number" min="0" step="1" value="${v('limitCountValue')}" placeholder="No limit" ${dis}></label></div>
   <p class="muted" style="margin:0">Nothing changes stock or reaches a supplier until it is approved. Owners and managers are not held back. Stock-takes always need approval.</p>
   ${can?'<div><button class="btn btn-primary">Save limits</button></div>':''}</form>`);
}

VIEWS.approvals=async function(){
  const body=view('approvals','Approvals','Wastage, count corrections and purchase orders over the limits wait here until an owner or manager decides.');
  const d=await load(body,'/plugin/cm/approvals/');if(!d)return;
  const L=d.limits,none=Object.values(L).every(v=>v==null);
  const limitTxt=[L.wastage!=null?`wastage over ${inr(L.wastage)}`:'',L.po!=null?`orders over ${inr(L.po)}`:'',
    L.countPct!=null||L.countValue!=null?`counts off by more than ${[L.countPct!=null?L.countPct+'%':'',L.countValue!=null?inr(L.countValue):''].filter(Boolean).join(' or ')}`:''].filter(Boolean).join(', ');
  const card=a=>`<article class="appr edge edge-${a.status==='pending'?'warn':a.status==='approved'?'ok':'bad'}"><div class="appr-top">${edgeTip(a.statusLabel)}<small>${esc(a.kindLabel)}</small></div>
    <h3 title="${esc(a.summary)}">${esc(a.summary)}</h3><div class="val num">${a.value==null?'':inr(a.value)}</div>
    <small>Asked by ${esc(a.requestedBy)} · ${new Date(a.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}${a.decidedBy?` · ${a.status==='approved'?'approved':'turned down'} by ${esc(a.decidedBy)}`:''}${a.reason?` · ${esc(a.reason)}`:''}${a.result?` · ${esc(a.result)}`:''}</small>
    <div class="card-f">${a.status==='pending'&&d.canApprove&&a.requestedById!==PROFILE?.id?`<div class="appr-act"><button class="btn btn-sm btn-primary" data-ok="${a.id}">Approve</button><button class="btn btn-sm btn-line" data-no="${a.id}">Reject</button></div>`:''}${phBtn('approval',a.id,a.summary)}</div></article>`;
  const pgP=paginate('appr-pending',d.pending,fitSize(260,16,3),String(d.pending.length)),pgD=paginate('appr-recent',d.recent,fitSize(260,16,3),String(d.recent.length));
  body.innerHTML=`<div class="panel" style="margin-bottom:16px"><div class="panel-b"><p style="margin:0">${none?'No approval limits are set, so nothing waits here. Set them in Organisation settings.':`Waiting for approval: ${esc(limitTxt)}.`}</p></div></div>`+
    (d.pending.length?`<div class="menu-h"><h2>Waiting</h2><span>${d.pending.length}</span></div><div class="reqs">${pgP.rows.map(card).join('')}</div>${pgP.html}`:'<div class="panel empty"><b>Nothing waiting</b>Changes over a limit appear here.</div>')+
    (d.recent.length?`<div class="menu-h" style="margin-top:22px"><h2>Decided</h2><span>${d.recent.length}</span></div><div class="reqs">${pgD.rows.map(card).join('')}</div>${pgD.html}`:'');
  wirePager(body,()=>VIEWS.approvals());
  body.querySelectorAll('[data-ok]').forEach(b=>b.onclick=async()=>{b.disabled=true;
    try{const a=await api(`/plugin/cm/approvals/${b.dataset.ok}/approve/`,{method:'POST',json:{}});toast(`Approved${a.result?` · ${esc(a.result)} raised`:''}`);await reload();VIEWS.approvals()}catch(e){fail(e);b.disabled=false}});
  body.querySelectorAll('[data-no]').forEach(b=>b.onclick=()=>formModal('Reject this change?','The person who asked is told why',
    `<label>Reason<input name="why" required maxlength="200" placeholder="e.g. Recount the back shelf first"></label>`,'Reject',async(f,close)=>{
      await api(`/plugin/cm/approvals/${b.dataset.no}/reject/`,{method:'POST',json:{reason:f.get('why')}});close();toast('Rejected');VIEWS.approvals()}));
};

NAV.splice(NAV.findIndex(n=>n[0]==='requests')+1,0,['approvals','Approvals','<path d="M9 12l2 2 4-4"/><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>',()=>API.live]);

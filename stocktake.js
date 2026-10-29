/* Chef & Mixologist: stock-takes.
   Count a whole storage area. Counters don't see the system figure (blind count); an approver reviews
   the differences and posts them, or sends lines back for a recount. Below the list, the differences
   report sums up what posted stock-takes found missing or extra. */

let TAKE=null,DIFF_DAYS=90;
const TAKE_TONE={counting:'turmeric',review:'soft',posted:'lime',cancelled:'soft'};
// exact figures on a count sheet: up to 3 decimals, never rounded to whole numbers
const stq=v=>(+v).toLocaleString('en-IN',{maximumFractionDigits:3});
const signedQty=(q,u)=>`${q>0?'+':q<0?'−':''}${stq(Math.abs(q))} ${esc(u)}`;
const signedInr=v=>v==null?'—':`${v>0?'+':v<0?'−':''}${inr(Math.abs(v))}`;

VIEWS.stocktake=async function(){
  if(TAKE)return renderTakeSheet(TAKE);
  const body=view('stocktake','Stock-takes','Count a whole storage area. Counters don\'t see the system figure; an approver checks the differences before anything changes.');
  const d=await load(body,'/plugin/cm/stocktakes/');if(!d)return;
  const head=$('#v-stocktake .page-head > div:last-child');
  if(d.canStart.length&&head)head.innerHTML='<button class="btn btn-primary" id="stStart">Start a stock-take</button>';
  if($('#stStart'))$('#stStart').onclick=()=>formModal('Start a stock-take','Everything kept in the area goes on the count sheet',
    `<label>Storage area<select name="loc">${d.canStart.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></label>
     <label style="flex-direction:row;display:flex;gap:8px;align-items:center"><input type="checkbox" name="blind" checked>Blind count: counters don't see the system quantity</label>
     <label>Note<input name="note" maxlength="200" placeholder="e.g. Month-end count"></label>`,'Start counting',async(f,close)=>{
      const t=await api('/plugin/cm/stocktakes/',{method:'POST',json:{location:+f.get('loc'),blind:!!f.get('blind'),note:f.get('note')}});
      close();toast(`${esc(t.ref)} started`);TAKE=t.id;VIEWS.stocktake()});
  const money=API.can.pricing;
  const card=t=>`<button class="take" data-take="${t.id}"><span class="sticker ${TAKE_TONE[t.status]}">${esc(t.statusLabel)}</span>
    <h3>${esc(t.location)}</h3><small>${esc(t.ref)} · started ${new Date(t.startedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} by ${esc(t.startedBy)}</small>
    <div class="take-bar"><i style="width:${t.total?t.counted/t.total*100:0}%"></i></div>
    <small class="num">${t.counted} of ${t.total} counted${t.blind?' · blind':''}</small>
    <b class="take-v num">${t.status==='posted'&&money&&t.valueDiff!=null?signedInr(t.valueDiff):''}</b></button>`;
  const open=d.takes.filter(t=>['counting','review'].includes(t.status)),done=d.takes.filter(t=>!['counting','review'].includes(t.status));
  body.innerHTML=(open.length?`<div class="menu-h"><h2>In progress</h2><span>${open.length}</span></div><div class="takes">${open.map(card).join('')}</div>`:
      `<div class="panel empty"><b>No stock-take in progress</b>${d.canStart.length?'Start one for a storage area to count everything kept there.':'Your role can view stock-takes but not start one.'}</div>`)+
    (done.length?`<div class="menu-h" style="margin-top:22px"><h2>Finished</h2><span>${done.length}</span></div><div class="takes">${done.slice(0,12).map(card).join('')}</div>`:'')+
    '<div id="stDiff" style="margin-top:22px"></div>';
  body.querySelectorAll('[data-take]').forEach(b=>b.onclick=()=>{TAKE=+b.dataset.take;VIEWS.stocktake()});
  renderDifferences();
};

async function renderDifferences(){
  const box=$('#stDiff');if(!box)return;
  let r;try{r=await api(`/plugin/cm/stocktakes/differences/?days=${DIFF_DAYS}`)}catch(e){box.innerHTML='';return}
  const money=API.can.pricing;
  box.innerHTML=`<div class="menu-h"><h2>Differences found</h2><span class="seg">${[30,90,365].map(n=>`<button data-dd="${n}" aria-pressed="${DIFF_DAYS===n}">${n===365?'1 year':n+' days'}</button>`).join('')}</span></div>
   ${r.lines?`<div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:16px">
     <div class="tile bad"><span class="lbl">Missing</span><span class="val num">${money?inrK(Math.abs(r.lost)):'—'}</span><span class="sub">Counted less than the system held</span></div>
     <div class="tile good"><span class="lbl">Extra</span><span class="val num">${money?inrK(r.found):'—'}</span><span class="sub">Counted more than the system held</span></div>
     <div class="tile ${r.net<0?'warn':'info'}"><span class="lbl">Net</span><span class="val num">${money?signedInr(r.net):'—'}</span><span class="sub">${r.pctOfStock!=null?`${r.pctOfStock}% of the stock counted`:''}</span></div>
     <div class="tile info"><span class="lbl">Lines off</span><span class="val num">${r.offLines}</span><span class="sub">of ${r.lines} counted</span></div></div>
    <div class="admin-grid">${panel('By item','Biggest losses first',table(['Item','>Difference',...(money?['>Value']:[]),'>Counts'],
      r.items.slice(0,15).map(i=>`<tr><td>${xlItemName(i.name)}</td><td class="r num">${signedQty(i.qty,i.unit)}</td>${money?`<td class="r num ${i.value<0?'neg':''}">${signedInr(i.value)}</td>`:''}<td class="r num">${i.takes}</td></tr>`),'Everything matched'))}
     ${panel('By storage area','',table(['Area','>Lines off',...(money?['>Value']:[])],r.areas.map(a=>`<tr><td>${xl('location',a.area)}</td><td class="r num">${a.off} of ${a.lines}</td>${money?`<td class="r num ${a.value<0?'neg':''}">${signedInr(a.value)}</td>`:''}</tr>`)))}</div>`
   :'<div class="panel empty"><b>No posted stock-takes in this period</b>Differences appear here once a stock-take is approved.</div>'}`;
  box.querySelectorAll('[data-dd]').forEach(b=>b.onclick=()=>{DIFF_DAYS=+b.dataset.dd;renderDifferences()});
}

async function renderTakeSheet(id){
  const body=view('stocktake','Stock-take','');
  const t=await load(body,`/plugin/cm/stocktakes/${id}/`);if(!t){TAKE=null;return}
  const money=API.can.pricing,counting=t.status==='counting',review=t.status==='review',posted=t.status==='posted';
  $('#v-stocktake .page-head h1').textContent=`${t.location} · ${t.ref}`;
  $('#v-stocktake .page-head p').textContent=counting?(t.blind?'Count everything you find. The system quantity is hidden until the sheet is submitted.':'Count everything you find. Each line saves as you go.')
    :review?'Check the differences. Approve to post them, or send lines back for a recount.':posted?`Posted by ${t.decidedBy}. Only the differences were applied to stock.`:'Cancelled. Nothing was posted.';
  const acts=[];
  if(counting&&t.canCount)acts.push('<button class="btn btn-primary" id="stSubmit">Submit for approval</button>');
  if(review&&t.canApprove)acts.push('<button class="btn btn-primary" id="stApprove">Approve and post</button><button class="btn btn-line" id="stRecount">Send back for recount</button>');
  if((counting||review)&&t.canApprove)acts.push('<button class="btn btn-line" id="stCancel">Cancel stock-take</button>');
  $('#v-stocktake .page-head > div:last-child').innerHTML=`<button class="btn btn-line" id="stBack">All stock-takes</button>${acts.join('')}`;
  $('#stBack').onclick=()=>{TAKE=null;VIEWS.stocktake()};
  const cats=[...new Set(t.lines.map(l=>l.category))];
  const left=t.lines.filter(l=>l.counted==null).length;
  const tot=t.lines.reduce((a,l)=>a+(l.value||0),0);
  const showExp=t.lines.some(l=>l.expected!=null);
  const row=l=>{
    const off=l.diff!=null&&Math.abs(l.diff)>1e-9,big=off&&(Math.abs(l.diffPct||0)>=5||Math.abs(l.value||0)>=500);
    const countCell=counting&&t.canCount?`<span class="qty-unit"><input class="st-in" type="number" min="0" step="any" value="${l.counted??''}" aria-label="Counted ${esc(l.name)}" data-part="${l.part}">${unitPick(l,'su')}</span>`
      :`<b class="num">${l.counted==null?'—':stq(l.counted)+' '+esc(l.unit)}</b>`;
    return `<tr class="${big?'st-big':''}" data-part="${l.part}">${review&&t.canApprove?`<td><input type="checkbox" class="check st-re" aria-label="Recount ${esc(l.name)}"></td>`:''}
      <td>${xlItemName(l.name)}<br><small class="muted">${esc(l.sku)}${l.countedBy?` · ${esc(l.countedBy)}`:''}</small></td>
      ${showExp?`<td class="r num">${l.expected==null?'—':stq(l.expected)+' '+esc(l.unit)}</td>`:''}<td class="r">${countCell}</td>
      ${showExp?`<td class="r num ${off?(l.diff<0?'neg':'pos'):''}">${l.diff==null?'—':off?signedQty(l.diff,l.unit):'Matches'}${l.diffPct!=null&&off?` <small>(${l.diffPct>0?'+':''}${l.diffPct}%)</small>`:''}</td>`:''}
      ${showExp&&money?`<td class="r num ${l.value<0?'neg':''}">${l.value==null||!off?'—':signedInr(l.value)}</td>`:''}<td class="st-ok" aria-live="polite"></td></tr>`};
  const head=`<tr>${review&&t.canApprove?'<th></th>':''}<th>Item</th>${showExp?'<th class="r">System</th>':''}<th class="r">Counted</th>${showExp?'<th class="r">Difference</th>':''}${showExp&&money?'<th class="r">Value</th>':''}<th></th></tr>`;
  body.innerHTML=`<div class="st-sum panel"><div class="panel-b">
     <div><small>Counted</small><b class="num">${t.lines.length-left} of ${t.lines.length}</b></div>
     ${showExp?`<div><small>Lines off</small><b class="num">${t.lines.filter(l=>l.diff&&Math.abs(l.diff)>1e-9).length}</b></div>`:''}
     ${showExp&&money?`<div><small>Value difference</small><b class="num ${tot<0?'neg':''}">${signedInr(posted&&t.valueDiff!=null?t.valueDiff:tot)}</b></div>`:''}
     <div><small>Counting</small><b>${t.blind?'Blind':'Open'}</b></div>
     ${counting?'<label class="field st-find">Find<input id="stQ" placeholder="Item or code"></label>':''}</div></div>
    ${cats.map(c=>`<div class="panel st-cat"><div class="panel-h"><h2>${esc(c||'Other')}</h2></div><div class="panel-b" style="padding-top:4px"><div class="tablewrap"><table class="t st-t"><thead>${head}</thead><tbody>${t.lines.filter(l=>l.category===c).map(row).join('')}</tbody></table></div></div></div>`).join('')}`;
  // each count saves on its own
  body.querySelectorAll('.st-in').forEach(inp=>{
    const save=async()=>{const tr=inp.closest('tr'),ok=tr.querySelector('.st-ok'),unit=tr.querySelector('[name=su]')?.value||'';
      ok.textContent='Saving…';
      try{await api(`/plugin/cm/stocktakes/${t.id}/count/`,{method:'POST',json:{part:+inp.dataset.part,counted:inp.value===''?null:inp.value,unit}});ok.textContent=inp.value===''?'':'Saved'}
      catch(e){ok.textContent='Not saved';fail(e)}};
    inp.onchange=save;const sel=inp.closest('tr').querySelector('[name=su]');if(sel&&sel.tagName==='SELECT')sel.onchange=()=>{if(inp.value!=='')save()};
    inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const all=$$('.st-in'),i=all.indexOf(inp);(all[i+1]||inp).focus()}}});
  if($('#stQ'))$('#stQ').oninput=e=>{const q=e.target.value.toLowerCase();body.querySelectorAll('tbody tr').forEach(tr=>tr.hidden=!!q&&!tr.textContent.toLowerCase().includes(q))};
  const act=async(a,json={})=>{try{await api(`/plugin/cm/stocktakes/${t.id}/${a}/`,{method:'POST',json});return true}catch(e){fail(e);return false}};
  if($('#stSubmit'))$('#stSubmit').onclick=async()=>{if(await act('submit')){toast(`${esc(t.ref)} submitted for approval`);VIEWS.stocktake()}};
  if($('#stApprove'))$('#stApprove').onclick=()=>confirmModal(`Approve ${esc(t.ref)}?`,`The differences are posted to ${esc(t.location)} stock${money?`, worth ${signedInr(tot)}`:''}. This cannot be undone.`,'Approve and post',
    async()=>{if(await act('approve')){toast(`${esc(t.ref)} posted`);await reload();VIEWS.stocktake()}});
  if($('#stRecount'))$('#stRecount').onclick=async()=>{const parts=$$('.st-re').filter(c=>c.checked).map(c=>+c.closest('tr').dataset.part);
    if(!parts.length)return toast('Tick the lines to count again');if(await act('recount',{parts})){toast(`${parts.length} line${parts.length>1?'s':''} sent back`);VIEWS.stocktake()}};
  if($('#stCancel'))$('#stCancel').onclick=()=>confirmModal(`Cancel ${esc(t.ref)}?`,'Nothing is posted. Counts entered so far are kept on the sheet for reference.','Cancel stock-take',
    async()=>{if(await act('cancel')){toast(`${esc(t.ref)} cancelled`);TAKE=null;VIEWS.stocktake()}});
}

NAV.splice(NAV.findIndex(n=>n[0]==='moves')+1,0,['stocktake','Stock-takes','<path d="M9 4h6v3H9zM7 5H5v16h14V5h-2"/><path d="m9 13 2 2 4-4"/>',()=>API.live&&API.can.stocktake]);
const goBeforeTake=go;
go=function(v,opts={}){if(v==='stocktake'&&S.view!=='stocktake')TAKE=null;goBeforeTake(v,opts)};

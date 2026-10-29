/* Chef & Mixologist: stock levels and costing on the item drawer, and the costing settings.
   Levels are worked out on the server (planning.py); anything set by hand wins over the suggestion. */

const LEVELS=[
  ['ss','Safety stock','Buffer for busy days and late deliveries','safety_stock'],
  ['rop','Reorder point','Order when stock plus what is on order falls to this','reorder_point'],
  ['q','Order quantity','How much to buy each time','order_qty'],
  ['max','Maximum level','The most worth holding at once','max_level'],
];
const PROTECTION={1.28:'90%',1.65:'95%',2.33:'99%'};
const COST_METHODS={
  fifo:['FIFO','First in, first out','Use is charged at the oldest prices still in stock, so what is left is valued at recent prices. Matches how a kitchen rotates stock.'],
  lifo:['LIFO','Last in, first out','Use is charged at the newest prices, so food cost follows the market quickly. Not accepted for statutory accounts under Indian standards (AS 2 / Ind AS 2); use it for management reporting only.'],
  avg:['Moving average','Weighted average','Every delivery re-averages the price of what is in stock. Smooths out price swings.'],
};

function renderLevels(x){
  const P=x.plan,I=P.inputs,u=esc(x.unit),el=$('#d-levels');if(!el)return;
  const dTxt=I.dSource==='history'?'measured over the last 30 days':'planned figure (real use replaces it after 14 days of history)';
  const lTxt=I.leadSource==='history'?`measured from ${I.receipts} deliveries`:'planned figure (measured once there are 3 deliveries)';
  const qTxt={eoq:`Economic order quantity: √(2 × ${fq(I.d*365)} ${u} a year × ₹${fq(I.orderCost)} per order ÷ ${I.holdingPerUnit!=null?'₹'+fq(I.holdingPerUnit):'holding cost'} per ${u} a year)`,
    shelf:`Capped at ${x.shelf} days of use so nothing spoils before it is used`,week:'One week of use (add a price to use the economic order quantity)'}[I.qBasis];
  el.innerHTML=`<div class="panel-b d-sec"><h3>Stock levels <span>${API.can.part?'<button class="btn btn-sm btn-line" id="lv-edit">Set levels</button>':''}</span></h3>
   <div class="lv-grid num">${LEVELS.map(([k,label,help])=>{const v=P[k];return `<div class="lv ${v.manual?'manual':''}"><small>${label}</small><b>${fq(v.value)} <span>${u}</span></b>
     <em>${v.manual?`Set by hand · suggested ${fq(v.suggested)}`:'Suggested'}</em><p>${help}</p></div>`}).join('')}</div>
   <details class="lv-how"><summary>How these are worked out</summary><dl>
     <dt>Daily use</dt><dd>${fq(I.d)} ${u} a day, ${dTxt}; varies by ±${fq(I.sdD)} ${u}</dd>
     <dt>Lead time</dt><dd>${fq(I.lead)} days${I.sdLead?` ± ${fq(I.sdLead)}`:''}, ${lTxt}</dd>
     <dt>Protection</dt><dd>${PROTECTION[I.z]||I.z} chance of not running out (z = ${I.z}), set in Organisation settings</dd>
     <dt>Safety stock</dt><dd>z × √(lead time × use spread² + daily use² × lead-time spread²) = ${fq(P.ss.suggested)} ${u}</dd>
     <dt>Reorder point</dt><dd>daily use × lead time + safety stock = ${fq(I.d)} × ${fq(I.lead)} + ${fq(P.ss.value)} = ${fq(P.rop.suggested)} ${u}</dd>
     <dt>Order quantity</dt><dd>${qTxt}, in packs of ${fq(I.pack)} ${u} = ${fq(P.q.suggested)} ${u}</dd>
     <dt>Maximum level</dt><dd>safety stock + order quantity = ${fq(P.max.suggested)} ${u}</dd></dl></details></div>`;
  if($('#lv-edit'))$('#lv-edit').onclick=()=>editLevels(x);
}

function editLevels(x){
  const P=x.plan,u=esc(x.unit),p=x.profile||{};
  formModal(`Stock levels · ${esc(x.name)}`,'Leave a box empty to use the suggested figure',`
   <div class="two">${LEVELS.map(([k,label,,field])=>`<label>${label} (${u})<input name="${field}" type="number" min="0" step="any" value="${P[k].manual?P[k].value:''}" placeholder="Suggested ${fq(P[k].suggested)}"></label>`).join('')}</div>
   <p class="muted" style="margin:0">Planned figures are used until the app has measured enough history.</p>
   <div class="two"><label>Planned daily use (${u})<input name="avg_daily_use" type="number" min="0" step="any" value="${p.avgDaily??''}" placeholder="${P.inputs.dSource==='history'?'Measured: '+fq(P.inputs.d):''}"></label>
   <label>Planned lead time (days)<input name="lead_time_days" type="number" min="0" step="1" value="${p.leadDays??''}" placeholder="${P.inputs.leadSource==='history'?'Measured: '+fq(P.inputs.lead):''}"></label></div>`,
  'Save levels',async(f,close)=>{
    const body={};for(const [,,,field] of LEVELS)body[field]=f.get(field)===''?null:f.get(field);
    body.avg_daily_use=f.get('avg_daily_use')===''?null:f.get('avg_daily_use');body.lead_time_days=f.get('lead_time_days')===''?null:f.get('lead_time_days');
    await api(`/plugin/cm/item/${x.id}/profile/`,{method:'PATCH',json:body});close();toast('Stock levels saved');await reload();if(bySku[x.sku])openItem(x.sku)});
}

async function renderCosting(x){
  const el=$('#d-cost');if(!el||!API.can.pricing)return;
  let d;try{d=(await api(`/plugin/cm/item/${x.id}/costing/`)).costing}catch(e){return}
  if(!d||$('#drawer').dataset.sku!==x.sku)return;
  const u=esc(x.unit),M=COST_METHODS;
  el.style.display='';
  el.innerHTML=`<div class="panel-b d-sec"><h3>Cost of stock <span>${M[d.method][0]} · change in Organisation settings</span></h3>
   <div class="lv-grid three num">${['fifo','lifo','avg'].map(m=>{const r=d.methods[m];return `<div class="lv ${m===d.method?'chosen':''}"><small>${M[m][0]}</small><b>${r?inr(r.value):'—'}</b><em>${r&&r.unit!=null?inr(r.unit)+' / '+u+' next use':'No purchases yet'}</em></div>`}).join('')}</div>
   ${d.layers.length?`<table class="t"><thead><tr><th>Prices still in stock</th><th class="r">Qty</th><th class="r">Price / ${u}</th></tr></thead><tbody>
     ${d.layers.map((l,i)=>`<tr><td>${d.method==='avg'?'Batch '+(i+1):i===0&&d.method==='fifo'||i===d.layers.length-1&&d.method==='lifo'?'<b>Used next</b>':'Batch '+(i+1)}</td><td class="r">${fq(l.qty)} ${u}</td><td class="r">${inr(l.cost)}</td></tr>`).join('')}</tbody></table>`:''}
   ${d.purchases.length?`<table class="t"><thead><tr><th>Recent purchases</th><th class="r">Qty</th><th class="r">Price / ${u}</th></tr></thead><tbody>
     ${d.purchases.map(r=>`<tr><td>${esc(r.at)} · ${esc(r.ref||r.kind)}</td><td class="r">${fq(r.qty)} ${u}</td><td class="r">${inr(r.cost)}</td></tr>`).join('')}</tbody></table>`:''}</div>`;
}

function costingPanel(o,dis,can){
  return panel('Stock costing &amp; reordering','How stock is valued and how much to buy',`<form id="costF" class="calc" style="display:grid;gap:12px">
   <div class="method-pick">${Object.entries(COST_METHODS).map(([k,[n,sub,desc]])=>`<label class="method ${o.costingMethod===k?'on':''}"><input type="radio" name="costingMethod" value="${k}" ${o.costingMethod===k?'checked':''} ${dis}><b>${n}</b><small>${sub}</small><p>${desc}</p></label>`).join('')}</div>
   <p class="muted" style="margin:0">Each purchase keeps the price on its bill. Changing the method re-values stock and recipe costs straight away; nothing is lost.</p>
   <div class="two"><label>Cost of placing one order (₹)<input name="orderCost" type="number" min="0" step="1" value="${o.orderCost}" ${dis}></label>
   <label>Yearly cost of holding stock (% of value)<input name="holdingRate" type="number" min="1" max="200" step="0.5" value="${o.holdingRate}" ${dis}></label></div>
   <p class="muted" style="margin:0">Used for the economic order quantity: time and delivery cost per order, against storage, spoilage risk and money tied up.</p>
   ${can?'<div><button class="btn btn-primary">Save costing</button></div>':''}</form>`);
}

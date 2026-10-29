/* Chef & Mixologist ERP screens beyond the core inventory views.
   Loaded after index.html's main script; reuses its helpers ($, api, formModal, toast, esc, inr …). */

/* ================= module 1: item master extras ================= */
const STORAGE_LABEL={ambient:'Ambient',chilled:'Chilled',frozen:'Frozen'};
function profileHtml(x){
  const p=x.profile;if(!API.live)return '';
  const al=p&&p.allergens&&p.allergens.length?p.allergens.map(a=>esc((META&&META.allergens[a])||a)).join(', '):'None recorded';
  const row=(k,v)=>`<div><small>${k}</small><b>${v}</b></div>`;
  return `<div class="panel-b d-sec"><h3>Food safety &amp; compliance <span>${API.can.part?'<button class="btn btn-sm btn-line" id="p-edit">Edit</button>':''}</span></h3>
   <div class="d-stats" style="grid-template-columns:repeat(3,1fr)">
    ${row('Shelf life',x.shelf<999?x.shelf+' days':'—')}${row('Storage',p&&p.storage?STORAGE_LABEL[p.storage]:'—')}${row('Jain-friendly',p&&p.jain!=null?(p.jain?'Yes':'No'):'—')}
    ${row('Allergens',al)}${row('HSN / GST',`${p&&p.hsn?esc(p.hsn):'—'} · ${p&&p.gst!=null?p.gst+'%':'—'}`)}${row('Brand · count',`${p&&p.brand?esc(p.brand):'—'} · ${p&&p.countFrequency?esc(p.countFrequency):'—'}`)}
   </div></div>`;
}
function editProfile(x){
  const p=x.profile||{},m=META;
  const opt=(o,v)=>Object.entries(o).map(([k,l])=>`<option value="${k}" ${k===v?'selected':''}>${esc(l)}</option>`).join('');
  formModal(`Edit ${esc(x.name)}`,'All fields optional',`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <label>Shelf life (days)<input name="shelf" type="number" min="1" value="${x.shelf<999?x.shelf:''}"></label>
    <label>Storage<select name="storage"><option value="">—</option>${opt(m.storage,p.storage)}</select></label>
    <label>Jain-friendly<select name="jain"><option value="">Not set</option><option value="true" ${p.jain===true?'selected':''}>Yes</option><option value="false" ${p.jain===false?'selected':''}>No</option></select></label>
    <label>Count frequency<select name="cf"><option value="">—</option>${opt(m.countFrequency,p.countFrequency)}</select></label>
    <label>HSN code<input name="hsn" inputmode="numeric" pattern="\\d{4}(\\d{2}){0,2}" value="${esc(p.hsn||'')}"></label>
    <label>GST rate<select name="gst"><option value="">—</option>${m.gstRates.map(r=>`<option value="${r}" ${p.gst===r?'selected':''}>${r}%</option>`).join('')}</select></label>
    <label>Brand<input name="brand" maxlength="100" value="${esc(p.brand||'')}"></label>
    <label>FSSAI note<input name="fssai" maxlength="200" value="${esc(p.fssai||'')}"></label></div>
    <fieldset style="border:1px solid var(--line);border-radius:10px;padding:10px"><legend>Allergens</legend><div style="display:flex;flex-wrap:wrap;gap:10px">
    ${Object.entries(m.allergens).map(([k,l])=>`<label style="flex-direction:row;align-items:center;gap:6px;display:flex"><input type="checkbox" name="al" value="${k}" ${(p.allergens||[]).includes(k)?'checked':''}>${esc(l)}</label>`).join('')}</div></fieldset>`,
  'Save',async(f,close)=>{
    const body={shelf_life_days:f.get('shelf')||null,storage:f.get('storage'),jain_friendly:f.get('jain')===''?null:f.get('jain')==='true',
      count_frequency:f.get('cf'),hsn_code:f.get('hsn'),gst_rate:f.get('gst')||null,brand:f.get('brand'),fssai_note:f.get('fssai'),allergens:f.getAll('al')};
    await api(`/plugin/cm/item/${x.id}/profile/`,{method:'PATCH',json:body});close();toast('Item details saved');await reload()});
}
async function saveReplenishment(x){
  try{await api(`/plugin/cm/item/${x.id}/profile/`,{method:'PATCH',json:{avg_daily_use:$('#c-avg').value||null,usage_sd:$('#c-sd').value||null,lead_time_days:$('#c-lead').value||null}});
    toast('Planned figures saved');await reload()}catch(e){fail(e)}
}
function newItem(){
  if(!needLive('partAdd'))return;const m=META;
  const opts=l=>l.map(o=>`<option value="${o.id}">${esc(o.name)}</option>`).join('');
  formModal('New raw material','Creates the item, its supplier link and price',`
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <label>Name<input name="name" required maxlength="100"></label><label>SKU<input name="sku" required pattern="[A-Za-z0-9-]{2,20}" placeholder="e.g. PR-214"></label>
    <label>Category<select name="category">${opts(m.categories)}</select></label><label>Unit<select name="unit">${m.units.map(u=>`<option>${esc(u)}</option>`).join('')}</select></label>
    <label>Storage location<select name="location">${opts(m.locations)}</select></label><label>Supplier<select name="supplier">${opts(m.suppliers)}</select></label>
    <label>Cost per unit (₹)<input name="cost" type="number" min="0" step="0.01"></label><label>Supplier pack size<input name="pack" type="number" min="1" value="1"></label>
    <label>Shelf life (days)<input name="shelf" type="number" min="1"></label><label>Lead time (days)<input name="lead" type="number" min="0" value="1"></label>
    <label>Planned daily use<input name="avg" type="number" min="0" step="any"></label><label>Storage<select name="storage"><option value="">—</option>${Object.entries(m.storage).map(([k,l])=>`<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
   </div>`,'Create item',async(f,close)=>{
    const n=k=>f.get(k)===''?null:f.get(k);
    const r=await api('/plugin/cm/item/',{method:'POST',json:{name:f.get('name'),sku:f.get('sku'),category:+f.get('category'),unit:f.get('unit'),location:+f.get('location'),
      supplier:+f.get('supplier'),cost:n('cost'),pack:+f.get('pack')||1,shelf_life_days:n('shelf'),lead_time_days:n('lead'),avg_daily_use:n('avg'),storage:f.get('storage')}});
    close();toast(`${esc(r.sku)} created — add a photo from its card`);await reload()});
}
function exportMoves(){
  const q=S.q.toLowerCase();
  const L=moves.filter(m=>(S.mv==='All'||m.t===S.mv)&&(!q||`${m.x.name} ${m.x.sku} ${m.ref} ${m.user}`.toLowerCase().includes(q)));
  const cell=v=>{v=String(v??'');return /[",\n]/.test(v)||/^[=+\-@]/.test(v)?`"${(/^[=+\-@]/.test(v)?"'":'')+v.replace(/"/g,'""')}"`:v};
  const day=d=>new Date(TODAY-d*864e5).toISOString().slice(0,10);
  const rows=[['Date','Time','SKU','Item','Type','Quantity','Unit','Reference','By'],...L.map(m=>[day(m.d),m.time,m.x.sku,m.x.name,m.t,m.q,m.x.unit,m.ref,m.user])];
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv'})),download:`movements-${TODAY.toISOString().slice(0,10)}.csv`});
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('#newItem').onclick=newItem;
$('#exportCsv').onclick=exportMoves;

/* store requisition: move stock to another area */
const baseItemAction=itemAction;
itemAction=function(x,act){
  if(act!=='transfer')return baseItemAction(x,act);
  if(!needLive('stock'))return;
  const locs=META.locations.filter(l=>l.name!=='Event liquor store');
  formModal(`Transfer ${esc(x.name)}`,'From your areas, oldest lot first',`
    ${qtyField('Quantity',x)}
    <label>To<select name="to">${locs.map(l=>`<option value="${l.id}">${esc(l.name)}</option>`).join('')}</select></label>`,'Transfer',async(f,close)=>{
    await api(`/plugin/cm/item/${x.id}/transfer/`,{method:'POST',json:{quantity:f.get('q'),unit:f.get('qUnit'),location:+f.get('to')}});close();toast('Stock transferred');await reload()});
};

/* ================= shared helpers for module screens ================= */
const pct=v=>v==null?'—':`${v}%`;
const num=v=>v==null?'—':(+v).toLocaleString('en-IN',{maximumFractionDigits:2});
const kpi=(label,value,sub,color)=>`<div class="kpi" style="--k:${color||'var(--night)'};cursor:default"><div class="lbl">${label}</div><div class="val num">${value}</div><div class="sub">${sub||''}</div></div>`;
const signed=(v,goodWhenUp=true)=>v==null?'':`<span style="color:${(v>=0)===goodWhenUp?'var(--green)':'var(--red)'};font-weight:600">${v>0?'+':''}${v}%</span>`;
function view(id,title,sub,actions=''){
  let sec=$('#v-'+id);
  if(!sec){sec=Object.assign(document.createElement('section'),{className:'view',id:'v-'+id});$('.page').appendChild(sec)}
  sec.classList.add('on');
  sec.innerHTML=`<div class="page-head"><div><h1>${title}</h1><p>${sub}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div><div class="vbody"><div class="panel empty">Loading…</div></div>`;
  return sec.querySelector('.vbody');
}
async function load(body,path){
  if(!API.live){body.innerHTML='<div class="panel empty"><b>Sign in to see this</b>This screen reads live data from the server.</div>';return null}
  try{return await api(path)}catch(e){body.innerHTML=`<div class="panel empty"><b>Could not load</b>${esc(e.message)}</div>`;if(e.auth)showLogin(e.message);return null}
}
const table=(head,rows,empty='Nothing yet')=>`<div class="tablewrap"><table class="t"><thead><tr>${head.map(h=>`<th class="${h.startsWith('>')?'r':''}">${h.replace(/^>/,'')}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${head.length}" class="muted">${empty}</td></tr>`}</tbody></table></div>`;
const panel=(title,sub,inner)=>`<div class="panel" style="margin-bottom:16px"><div class="panel-h"><h2>${title}</h2><p>${sub||''}</p></div><div class="panel-b" style="padding-top:8px">${inner}</div></div>`;
const ALLERGEN=k=>(META&&META.allergens[k])||k;
const NAV_ICON={recipes:'<path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  prep:'<path d="M6 3v7a6 6 0 0 0 12 0V3"/><path d="M4 21h16"/>',suppliers:'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  events:'<path d="M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v6M8 21h8"/>',sales:'<path d="M4 4h16v16H4z"/><path d="M8 15l3-3 2 2 4-5"/>',reports:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'};

/* ================= module 2: menu & recipes ================= */
let RECIPES=null;
async function renderRecipes(){
  const body=view('recipes','Menu & recipes','Plate cost and food cost % from live ingredient prices. Allergens and Jain status roll up from every ingredient.',
    API.live&&API.can.recipes?'<button class="btn btn-primary" id="newRecipe">+ New recipe</button>':'');
  if($('#newRecipe'))$('#newRecipe').onclick=()=>editRecipe(null);
  const d=await load(body,'/plugin/cm/recipes/');if(!d)return;RECIPES=d;
  const money=API.can.pricing;
  const row=r=>{const fc=r.foodCostPct,over=fc!=null&&fc>r.target;
    return `<tr class="click" data-rid="${r.id}"><td><b>${esc(r.name)}</b><br><small class="muted">${esc(r.sku)} · ${esc(r.kind==='prep'?`makes ${r.batchYield} ${r.unit}`:r.category)}</small></td>
    <td>${r.kind==='prep'?'—':inr(r.price)}</td>${money?`<td class="r num">${r.cost==null?'—':inr(r.cost)}${r.kind==='prep'?`<br><small class="muted">per ${esc(r.unit)}</small>`:''}</td><td class="r">${fc==null?'—':`<span class="tag ${over?'s-crit':'s-ok'}">${fc}%</span>`}<br><small class="muted">target ${r.target}%</small></td>`:''}
    <td>${r.allergens.length?r.allergens.map(a=>`<span class="tag s-reorder" style="margin:1px">${esc(ALLERGEN(a))}</span>`).join(''):'<span class="muted">None</span>'}</td>
    <td>${r.jain===true?'<span class="tag s-ok">Jain</span>':r.jain===false?'<span class="muted">No</span>':'<span class="muted">Unknown</span>'}</td>
    <td>${r.missingCosts.length&&money?`<small style="color:var(--red)">No price: ${r.missingCosts.map(esc).join(', ')}</small>`:''}</td></tr>`};
  const head=['Item','Price',...(money?['>Plate cost','>Food cost']:[]),'Allergens','Jain',''];
  const groups=[['Dishes',r=>r.kind==='dish'],['Mocktails & beverages',r=>r.kind==='beverage'],['Preps / sub-recipes',r=>r.kind==='prep']];
  body.innerHTML=groups.map(([t,f])=>panel(t,`${d.recipes.filter(f).length} recipes`,table(head,d.recipes.filter(f).map(row)))).join('');
  body.querySelectorAll('[data-rid]').forEach(tr=>tr.onclick=()=>showRecipe(+tr.dataset.rid));
}
function showRecipe(id){
  const r=RECIPES.recipes.find(x=>x.id===id),money=API.can.pricing;
  formModal(esc(r.name),`${esc(r.sku)} · ${r.kind==='prep'?`batch makes ${r.batchYield} ${esc(r.unit)}${r.shelfHours?` · use within ${r.shelfHours} h`:''}`:`${inr(r.price)} before GST`}`,
    table(['Ingredient','>Quantity',...(money?['>Cost']:[])],r.lines.map(l=>`<tr><td>${xlPart(l.part,l.name)}</td><td class="r num">${l.useUnit?`${num(l.useQty)} ${esc(l.useUnit)}`:`${num(l.qty)} ${esc(l.unit)}`}${l.usablePct<100?`<br><small class="muted">${num(l.asBought)} ${esc(l.unit)} as bought (${num(l.usablePct)}% usable)</small>`:''}</td>${money?`<td class="r num">${l.cost==null?'—':inr(l.cost)}</td>`:''}</tr>`))+
    (r.method?`<p style="white-space:pre-wrap">${esc(r.method)}</p>`:'')+(money&&r.cost!=null?`<p><b>Total ${inr(r.cost)}</b>${r.foodCostPct!=null?` · food cost ${r.foodCostPct}% (target ${r.target}%)`:''}</p>`:''),
    API.can.recipes?'Edit recipe':'Close',async(f,close)=>{close();if(API.can.recipes)editRecipe(r)});
}
function editRecipe(r){
  const d=RECIPES,isNew=!r;r=r||{kind:'dish',lines:[],station:'kitchen',target:30,batchYield:1,onMenu:true};
  const ingOpts=sel=>d.ingredients.filter(i=>!r.id||i.id!==r.id).map(i=>`<option value="${i.id}" ${i.id===sel?'selected':''}>${esc(i.name)}${i.prep?' (prep)':''} · ${esc(i.unit)}</option>`).join('');
  const ingOf=id=>{const i=d.ingredients.find(o=>o.id===+id)||{};return items.find(x=>x.id===i.id)||{unit:i.unit}};
  const lineRow=l=>{const first=l?l.part:(d.ingredients.find(i=>!r.id||i.id!==r.id)||{}).id;
    return `<div class="rline" style="display:grid;grid-template-columns:1fr 90px 120px 32px;gap:8px;align-items:end"><label>Ingredient<select name="lp">${ingOpts(first)}</select></label><label>Qty<input name="lq" type="number" min="0" step="any" value="${l?(l.useQty??l.qty):''}" required></label><label>Unit${unitPick(ingOf(first),'lu',l&&l.useUnit)}</label><button type="button" class="icon-btn rdel" aria-label="Remove">✕</button></div>`};
  formModal(isNew?'New recipe':`Edit ${esc(r.name)}`,'Quantities are per portion (or per batch for preps), as used after trimming',`${isNew?'':photoBlock(r.image,r.name)}
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <label>Name<input name="name" required maxlength="100" value="${esc(r.name||'')}"></label>
    ${isNew?'<label>SKU<input name="sku" required pattern="[A-Za-z0-9-]{2,20}" placeholder="e.g. MN-810"></label>':`<label>SKU<input value="${esc(r.sku)}" disabled></label>`}
    <label>Type<select name="kind">${[['dish','Dish'],['beverage','Beverage'],['prep','Prep / sub-recipe']].map(([k,l])=>`<option value="${k}" ${r.kind===k?'selected':''}>${l}</option>`).join('')}</select></label>
    <label>Menu section<select name="category">${d.categories.map(c=>`<option ${r.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
    <label>Station<select name="station"><option value="kitchen" ${r.station==='kitchen'?'selected':''}>Kitchen</option><option value="beverage" ${r.station==='beverage'?'selected':''}>Beverage station</option></select></label>
    <label>Menu price before GST (₹)<input name="price" type="number" min="0" step="0.01" value="${r.price??''}"></label>
    <label>Target food cost %<input name="target" type="number" min="0" max="100" step="0.5" value="${r.target}"></label>
    <label>Prep: batch makes / unit<span style="display:flex;gap:6px"><input name="yield" type="number" min="0" step="any" value="${r.batchYield}"><input name="unit" style="width:70px" value="${esc(r.unit||'')}" placeholder="kg"></span></label>
    <label>Prep: use within (hours)<input name="shelf" type="number" min="1" value="${r.shelfHours??''}"></label>
   </div>
   <div id="rlines" style="display:grid;gap:8px">${(r.lines.length?r.lines:[null]).map(lineRow).join('')}</div>
   <button type="button" class="btn btn-sm btn-line" id="raddl" style="justify-self:start">+ Ingredient</button>
   <label>Method<textarea name="method" rows="3" maxlength="4000">${esc(r.method||'')}</textarea></label>`,'Save recipe',async(f,close)=>{
    const lines=$$('#rlines .rline').map(el=>({part:+el.querySelector('[name=lp]').value,qty:el.querySelector('[name=lq]').value,unit:el.querySelector('[name=lu]')?.value||''}));
    const kind=f.get('kind'),body={name:f.get('name'),kind,category:f.get('category'),station:f.get('station'),price:kind==='prep'?null:(f.get('price')||null),
      target:f.get('target')||null,batch_yield:f.get('yield')||1,unit:kind==='prep'?f.get('unit'):'',shelf_hours:kind==='prep'?(f.get('shelf')||null):null,method:f.get('method'),lines};
    if(isNew)body.sku=f.get('sku');
    await api(isNew?'/plugin/cm/recipes/':`/plugin/cm/recipes/${r.id}/`,{method:isNew?'POST':'PUT',json:body});close();toast('Recipe saved');renderRecipes()});
  const wire=()=>{$$('#rlines .rdel').forEach(b=>b.onclick=()=>{if($$('#rlines .rline').length>1)b.parentElement.remove()});
    $$('#rlines [name=lp]').forEach(s=>s.onchange=()=>{const lab=s.closest('.rline').querySelector('[name=lu]').closest('label');lab.innerHTML='Unit'+unitPick(ingOf(s.value),'lu')})};
  $('#raddl').onclick=()=>{$('#rlines').insertAdjacentHTML('beforeend',lineRow(null));wire()};wire();
  if(!isNew)wirePhotoBlock(`/plugin/cm/recipes/${r.id}/photo/`,()=>{RECIPES=null;if(S.view==='recipes')renderRecipes()});
}

/* ================= module 3: prep & wastage ================= */
let WASTE_DAYS=30;
async function renderPrep(){
  const body=view('prep','Prep & wastage','Make prep batches from your own area\'s stock, and see where waste happens.');
  const [p,w]=await Promise.all([load(body,'/plugin/cm/prep/'),API.live?api(`/plugin/cm/wastage/?days=${WASTE_DAYS}`).catch(()=>null):null]);if(!p)return;
  const money=API.can.pricing;
  const prepRows=p.preps.map(x=>`<tr><td><b>${esc(x.name)}</b><br><small class="muted">${x.station==='beverage'?'Beverage station':'Kitchen'} · batch ${num(x.batchYield)} ${esc(x.unit)}${x.shelfHours?` · use within ${x.shelfHours} h`:''}</small></td>
    <td class="r num"><b>${num(x.onHand)}</b> ${esc(x.unit)}</td><td>${x.lots.map(l=>`<small>${esc(l.lot)} · ${num(l.qty)} ${esc(x.unit)} · ${l.exp==null?'no use-by':l.exp<=0?'<b style="color:var(--red)">use today</b>':`${l.exp} d`}</small>`).join('<br>')||'<span class="muted">None in stock</span>'}</td>
    ${money?`<td class="r num">${x.unitCost==null?'—':inr(x.unitCost)}/${esc(x.unit)}</td>`:''}<td class="r">${API.can.prep?`<button class="btn btn-sm btn-primary" data-make="${x.id}">Make batch</button>`:''}</td></tr>`);
  const batchRows=p.batches.map(b=>`<tr><td>${esc(b.at)}</td><td><b>${esc(b.name)}</b><br><small class="muted">${esc(b.code)}</small></td><td class="r num">${num(b.qty)} ${esc(b.unit)}</td>${money?`<td class="r num">${inr(b.cost)}</td>`:''}<td class="muted">${esc(b.by)}</td></tr>`);
  let waste='';
  if(w){const bar=(rows,key)=>{const max=Math.max(...rows.map(r=>r.value||0),1);return rows.slice(0,6).map(r=>`<div style="display:grid;grid-template-columns:140px 1fr 80px;gap:8px;align-items:center;margin:4px 0"><span>${esc(r[key])}</span><span style="height:10px;border-radius:5px;background:var(--red);opacity:.75;width:${(r.value||0)/max*100}%"></span><b class="num" style="text-align:right">${r.value==null?'—':inr(r.value)}</b></div>`).join('')||'<p class="muted">No wastage recorded.</p>'};
    waste=panel(`Wastage · ${money&&w.total!=null?inr(w.total):''}`,`<span class="seg">${[7,30,90].map(d=>`<button data-wd="${d}" aria-pressed="${WASTE_DAYS===d}">${d} days</button>`).join('')}</span>`,
      `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px"><div><h3 style="margin:0 0 6px">By reason</h3>${bar(w.byReason,'reason')}</div><div><h3 style="margin:0 0 6px">By area</h3>${bar(w.byArea,'area')}</div></div>
      <h3 style="margin:14px 0 6px">Items</h3>${table(['Item','>Quantity',...(money?['>Value']:[])],w.byItem.slice(0,10).map(r=>`<tr><td>${esc(r.item)}</td><td class="r num">${num(r.qty)}</td>${money?`<td class="r num">${inr(r.value)}</td>`:''}</tr>`))}`)}
  body.innerHTML=panel('Preps','Stock of prepared items',table(['Prep','>On hand','Lots',...(money?['>Cost']:[]),''],prepRows))+panel('Recent batches','',table(['Made','Batch','>Quantity',...(money?['>Cost']:[]),'By'],batchRows))+waste;
  body.querySelectorAll('[data-make]').forEach(b=>b.onclick=()=>{const x=p.preps.find(q=>q.id===+b.dataset.make);
    formModal(`Make ${esc(x.name)}`,`Ingredients come out of your area, oldest lot first`,`<label>Quantity to make (${esc(x.unit)})<input name="q" type="number" min="0" step="any" value="${x.batchYield}" required></label>`,'Make batch',async(f,close)=>{
      const r=await api(`/plugin/cm/prep/${x.id}/make/`,{method:'POST',json:{quantity:f.get('q')}});close();toast(`${esc(r.code)} made${r.cost!=null?` · ${inr(r.cost)}`:''}`);renderPrep();reload()})});
  body.querySelectorAll('[data-wd]').forEach(b=>b.onclick=()=>{WASTE_DAYS=+b.dataset.wd;renderPrep()});
}

/* ================= module 4: suppliers ================= */
async function renderSuppliers(){
  const body=view('suppliers','Suppliers','Delivery reliability from goods receipts, price changes from purchase orders, and returns.',
    API.live&&API.can.stock?'<button class="btn btn-line" id="newReturn">Return to supplier</button>':'');
  const d=await load(body,'/plugin/cm/suppliers/');if(!d)return;
  const metric=(l,v,good)=>`<div><small class="muted">${l}</small><br><b class="num" style="color:${v==null?'inherit':good(v)?'var(--green)':'var(--red)'}">${pct(v)}</b></div>`;
  body.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-bottom:16px">${d.suppliers.map(s=>`<div class="panel"><div class="panel-b">
    <h2 style="margin:0 0 4px;font-size:17px">${esc(s.name)}</h2><p class="muted" style="margin:0 0 10px">${s.items.length} items · ${s.openOrders} open PO · ${s.receipts} receipts</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">${metric('On time',s.onTimePct,v=>v>=90)}${metric('Fill rate',s.fillPct,v=>v>=95)}${metric('Rejected',s.rejectPct,v=>v<=2)}</div>
    ${s.priceAlerts.length?`<div style="margin-top:10px">${s.priceAlerts.map(a=>`<div>${esc(a.name)} ${signed(a.change,false)} · now ${inr(a.price)}/${esc(a.unit)}</div>`).join('')}</div>`:''}
    <details style="margin-top:8px"><summary class="muted">Price list</summary>${s.items.map(i=>`<div style="display:flex;justify-content:space-between"><span>${esc(i.name)}</span><span class="num">${i.price==null?'—':inr(i.price)}/${esc(i.unit)}</span></div>`).join('')}</details>
   </div></div>`).join('')}</div>`+panel('Returns','Stock sent back after receipt',table(['Ref','Supplier','Item','>Qty','>Value','Reason','Date'],d.returns.map(r=>`<tr><td><b>${esc(r.ref)}</b></td><td>${esc(r.supplier)}</td><td>${esc(r.item)}</td><td class="r num">${num(r.qty)} ${esc(r.unit)}</td><td class="r num">${inr(r.value)}</td><td>${esc(r.reason)}</td><td>${esc(r.at)}</td></tr>`)));
  if($('#newReturn'))$('#newReturn').onclick=()=>formModal('Return to supplier','From your areas, oldest lot first',`
    <label>Item<select name="item">${items.map(x=>`<option value="${x.id}">${esc(x.name)} · ${esc(x.sup)}</option>`).join('')}</select></label>
    <label>Quantity<input name="q" type="number" min="0" step="any" required></label><label>Reason<input name="r" required maxlength="200" placeholder="e.g. Found mouldy when opened"></label>`,'Send back',async(f,close)=>{
    const x=items.find(i=>i.id===+f.get('item'));
    const r=await api('/plugin/cm/supplier-return/',{method:'POST',json:{part:x.id,supplier:x.supId,quantity:f.get('q'),reason:f.get('r')}});close();toast(`${esc(r.reference)} recorded`);renderSuppliers();reload()});
}

/* ================= module 5: event nights (liquor) ================= */
// Barcode bars derived from the licence number, so every pass looks different
function barcode(code){
  const bars=[];[...String(code)].forEach((ch,i)=>{const n=ch.charCodeAt(0);bars.push(1+n%3,1+(n>>2)%2,2+(n+i)%3)});
  return `<div class="barcode" aria-hidden="true">${bars.slice(0,48).map((w,i)=>`<i style="width:${w}px;opacity:${i%3===1?0:1}"></i>`).join('')}</div><div class="barcode-no">${esc(code)}</div>`;
}
async function renderEvents(){
  const body=view('events','Event nights','Liquor is served only under a one-day licence. It stays in the locked event store until a manager issues it during the licence window.',
    '<button class="btn btn-primary" id="newEvent" hidden>+ New event</button>');
  const d=await load(body,'/plugin/cm/events/');if(!d)return;
  if(d.canManage){$('#newEvent').hidden=false;$('#newEvent').onclick=newEvent}
  const stock=table(['Liquor','>In store'],d.stock.map(s=>`<tr><td>${esc(s.name)}</td><td class="r num"><b>${num(s.onHand)}</b> ${esc(s.unit)}${s.bottles!=null?` <small class="muted">(${s.bottles} btl)</small>`:''}</td></tr>`));
  const stTag={planned:'s-onorder',open:'s-ok',closed:'s-over'};
  const ev=e=>`<div class="ev-row">
    <article class="pass st-${e.status} edge edge-${{planned:'info',open:'ok',closed:'mute'}[e.status]||'mute'}" aria-label="Event pass for ${esc(e.name)}">
      <div class="pass-band"></div>
      <h2>${esc(e.name)}</h2>
      <span class="status">${esc(e.statusLabel)}${e.inWindow&&e.status!=='closed'?', licence valid now':''}</span>
      <dl><dt>Date</dt><dd>${esc(e.date)}</dd><dt>Licence</dt><dd>${esc(e.licence)}</dd><dt>From</dt><dd>${esc(e.from)}</dd><dt>Until</dt><dd>${esc(e.until)}</dd>${e.guests?`<dt>Guests</dt><dd>${e.guests}</dd>`:''}</dl>
      ${barcode(e.licence)}
      ${d.canManage&&e.status!=='closed'?`<div class="actions">
        ${e.status==='planned'?`<button class="btn btn-sm btn-primary" data-ev="open" data-id="${e.id}" ${e.inWindow?'':'disabled title="Opens only inside the licence window"'}>Open service</button>`:''}
        <button class="btn btn-sm btn-line" data-ev="receive" data-id="${e.id}">Receive liquor</button>
        ${e.status==='open'?`<button class="btn btn-sm btn-line" data-ev="issue" data-id="${e.id}">Issue</button><button class="btn btn-sm btn-line" data-ev="return" data-id="${e.id}">Return unused</button><button class="btn btn-sm btn-line" data-ev="close" data-id="${e.id}">Close event</button>`:''}</div>`:''}
    </article>
    <div class="panel ev-reg"><div class="panel-h"><h2>Excise register</h2><p>${e.notes?esc(e.notes):'Issued, returned and consumed for this licence'}</p></div><div class="panel-b">
    ${table(['Liquor','>Issued','>Returned','>Consumed','>Pegs (30 ml)',...(API.can.pricing?['>Value']:[])],e.register.map(l=>`<tr><td>${esc(l.item)}</td><td class="r num">${num(l.issued)}</td><td class="r num">${num(l.returned)}</td><td class="r num"><b>${num(l.consumed)}</b> ${esc(l.unit)}</td><td class="r num">${num(l.pegs)}</td>${API.can.pricing?`<td class="r num">${l.value==null?'—':inr(l.value)}</td>`:''}</tr>`),'No liquor issued yet')}
    </div></div></div>`;
  body.innerHTML=`${d.events.map(ev).join('')||'<div class="panel empty"><b>No events yet</b>Create one when a one-day licence is granted.</div>'}<div style="max-width:560px">${panel('Event liquor store','Locked, managers only',stock)}</div>`;
  const liquorOpts=d.stock.map(s=>`<option value="${s.id}">${esc(s.name)} · ${num(s.onHand)} ${esc(s.unit)} in store</option>`).join('');
  body.querySelectorAll('[data-ev]').forEach(b=>b.onclick=async()=>{const id=b.dataset.id,act=b.dataset.ev;
    if(act==='open'||act==='close'){try{await api(`/plugin/cm/events/${id}/${act}/`,{method:'POST',json:{}});toast(act==='open'?'Service opened':'Event closed — register is final');renderEvents()}catch(e){fail(e)}return}
    formModal({receive:'Receive liquor',issue:'Issue to service',return:'Return unused'}[act],act==='receive'?'Bought under this event\'s permit':'Quantities in mL (one bottle = 750 mL)',
      `<label>Liquor<select name="p">${liquorOpts}</select></label><label>Quantity (mL)<input name="q" type="number" min="1" step="1" required></label>${act==='receive'?'<label>Bill / transport pass no.<input name="ref" required maxlength="60"></label>':''}`,
      'Save',async(f,close)=>{await api(`/plugin/cm/events/${id}/${act}/`,{method:'POST',json:{part:+f.get('p'),quantity:f.get('q'),reference:f.get('ref')||''}});close();toast('Register updated');renderEvents()})});
}
function newEvent(){
  const dt=v=>v?new Date(v).toISOString():null;
  formModal('New event night','Enter the one-day licence exactly as issued',`
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <label>Event name<input name="n" required maxlength="120"></label><label>Date<input name="d" type="date" required></label>
    <label>Licence number<input name="l" required maxlength="60"></label><label>Issuing authority<input name="a" value="West Bengal Excise Directorate" maxlength="120"></label>
    <label>Licence valid from<input name="f" type="datetime-local" required></label><label>Valid until<input name="u" type="datetime-local" required></label>
    <label>Expected guests<input name="g" type="number" min="0"></label><label>Notes<input name="no" maxlength="300"></label></div>`,'Create event',async(f,close)=>{
    await api('/plugin/cm/events/',{method:'POST',json:{name:f.get('n'),event_date:f.get('d'),licence_number:f.get('l'),licence_authority:f.get('a'),valid_from:dt(f.get('f')),valid_until:dt(f.get('u')),expected_guests:f.get('g')||null,notes:f.get('no')}});
    close();toast('Event created');renderEvents()});
}

/* ================= module 6: sales import ================= */
async function renderSales(){
  const body=view('sales','Sales','Import sales from the POS (CSV export or API). Each portion sold takes its recipe\'s ingredients out of stock.',
    API.live&&API.can.salesAdd?'<button class="btn btn-primary" id="importSales">Import sales</button>':'');
  const d=await load(body,'/plugin/cm/sales/');if(!d)return;
  if($('#importSales'))$('#importSales').onclick=()=>importSales(d);
  body.innerHTML=panel('Imports','Latest first',table(['Date','Reference','>Portions','>Covers','>Revenue',...(API.can.pricing?['>Recipe cost']:[]),'Stock shortfalls'],d.batches.map(b=>`<tr><td>${esc(b.date)}</td><td><b>${esc(b.reference)}</b><br><small class="muted">${esc(b.source)}</small></td><td class="r num">${num(b.items)}</td><td class="r num">${num(b.covers)}</td><td class="r num">${inr(b.revenue)}</td>${API.can.pricing?`<td class="r num">${inr(b.cost)}</td>`:''}<td>${b.shortfalls.length?b.shortfalls.map(s=>`<small style="color:var(--red)">${esc(s.item)} ${num(s.qty)} ${esc(s.unit)}</small>`).join('<br>'):'<span class="muted">None</span>'}</td></tr>`)))+
    panel('Top sellers','By revenue',table(['Item','>Portions','>Revenue'],d.top.map(t=>`<tr><td>${esc(t.item)}</td><td class="r num">${num(t.qty)}</td><td class="r num">${inr(t.revenue)}</td></tr>`)));
}
function importSales(d){
  formModal('Import sales','Paste or choose the POS CSV export: columns item (menu SKU) and quantity, optional price',`
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <label>Business date<input name="date" type="date" required value="${TODAY.toISOString().slice(0,10)}"></label><label>Covers (guests)<input name="covers" type="number" min="0"></label>
    <label>Source<input name="source" value="pos" pattern="[A-Za-z0-9 _.-]{1,40}" required></label><label>Reference (bill range or Z-report no.)<input name="ref" required maxlength="80"></label></div>
   <label>CSV file<input type="file" accept=".csv,text/csv" id="csvFile"></label>
   <label>or paste CSV<textarea name="csv" rows="6" placeholder="item,quantity&#10;MN-801,6&#10;MK-901,9">${'item,quantity\n'}</textarea></label>
   <details><summary class="muted">Menu SKUs</summary>${d.menu.map(m=>`<div><code>${esc(m.sku)}</code> ${esc(m.name)}</div>`).join('')}</details>`,'Import',async(f,close)=>{
    const r=await api('/plugin/cm/sales/',{method:'POST',json:{source:f.get('source'),reference:f.get('ref'),business_date:f.get('date'),covers:f.get('covers')||null,csv:f.get('csv')}});
    close();toast(`Imported · ${inr(r.revenue)}${r.shortfalls?` · ${r.shortfalls} shortfall(s) to check`:''}`);renderSales();reload()});
  $('#csvFile').onchange=async e=>{const file=e.target.files[0];if(file){if(file.size>500000)return toast('CSV is too large');$('#mform [name=csv]').value=await file.text()}};
}

/* ================= module 7: owner & partner report ================= */
let REPORT_PERIOD='month';
async function renderReports(){
  const body=view('reports','Reports and Analytics','Sales, food cost, margin, waste and supplier prices. Food cost uses recipe cost of what was sold; actual usage shows what really left the stores.',
    `<span class="seg">${[['month','This month'],['last_month','Last month'],['quarter','Quarter']].map(([k,l])=>`<button data-rp="${k}" aria-pressed="${REPORT_PERIOD===k}">${l}</button>`).join('')}</span>`);
  $$('[data-rp]').forEach(b=>b.onclick=()=>{REPORT_PERIOD=b.dataset.rp;renderReports()});
  const r=await load(body,`/plugin/cm/reports/overview/?period=${REPORT_PERIOD}`);if(!r)return;
  const fcOver=r.foodCostPct!=null&&r.foodCostPct>r.targetFoodCostPct;
  const max=Math.max(...r.weeks.map(w=>Math.max(w.sales,w.spend)),1),W=560,H=200,bw=30,x=i=>40+i*((W-60)/r.weeks.length),y=v=>H-24-(v/max)*(H-40);
  let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly sales and ingredient spend">`;
  r.weeks.forEach((w,i)=>{svg+=`<rect x="${x(i)}" y="${y(w.sales)}" width="${bw}" height="${H-24-y(w.sales)}" rx="5" style="fill:var(--night)"><title>Week of ${w.label}: sales ${inr(w.sales)}</title></rect><rect x="${x(i)+bw+4}" y="${y(w.spend)}" width="${bw}" height="${H-24-y(w.spend)}" rx="5" style="fill:var(--turmeric)"><title>Week of ${w.label}: spend ${inr(w.spend)}</title></rect><text x="${x(i)+bw}" y="${H-6}" text-anchor="middle" font-size="11" style="fill:var(--text-3)">${w.label}</text>`});
  svg+='</svg><div class="legend"><span><i style="background:var(--night);height:10px;width:10px"></i>Sales</span><span><i style="background:var(--turmeric);height:10px;width:10px"></i>Ingredient spend</span></div>';
  body.innerHTML=`<div class="panel" style="margin-bottom:16px"><div class="panel-b"><p style="font-size:17px;margin:0">${r.foodCostPct==null?'No sales imported for this period yet.':`Food cost is <b>${r.foodCostPct}%</b> ${fcOver?'— over':'— within'} the ${r.targetFoodCostPct}% target.`}${r.priceAlerts.length?` ${esc(r.priceAlerts[0].name)} is ${r.priceAlerts[0].change>0?'up':'down'} ${Math.abs(r.priceAlerts[0].change)}% at ${esc(r.priceAlerts[0].supplier)}.`:''}</p></div></div>
   <div class="kpis bento b9">${kpi('Sales',inrK(r.sales),r.salesChange==null?'No earlier period to compare':signed(r.salesChange)+' vs previous period')}${kpi('Food cost (recipes)',pct(r.foodCostPct),`target ${r.targetFoodCostPct}%`,fcOver?'var(--melon-ink)':'var(--lime-ink)')}${kpi('Actual usage',pct(r.actualFoodCostPct),`${inrK(r.actualUsageValue)} left the stores`,'var(--turmeric-ink)')}
     ${kpi('Gross margin',pct(r.grossMarginPct),r.grossMarginChange==null?'':`${r.grossMarginChange>0?'+':''}${r.grossMarginChange} pts`)}${kpi('Guests',num(r.covers),signed(r.coversChange))}${kpi('Average bill',r.avgBill==null?'—':inr(r.avgBill),signed(r.avgBillChange))}
     ${kpi('Ingredient spend',inrK(r.spend),signed(r.spendChange,false),'var(--turmeric)')}${kpi('Waste',inrK(r.waste||0),'this period','var(--melon-ink)')}${kpi('Stock on hand',inrK(r.stockValue),'at current prices','var(--night-3)')}</div>
   <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;margin-top:16px">
    ${panel('Sales vs ingredient spend','Weekly',`<div class="chart">${svg}</div>`)}
    ${panel('Where waste happened','Top items',table(['Item','>Value'],r.wasteTop.map(w=>`<tr><td>${xlItemName(w.item)}</td><td class="r num">${inr(w.value)}</td></tr>`),'No waste recorded'))}
    ${panel('Supplier price changes','5% or more since the last order',table(['Item','Supplier','>Change'],r.priceAlerts.map(a=>`<tr><td>${xlItemName(a.name)}</td><td>${xl('supplier',a.supplier)}</td><td class="r">${signed(a.change,false)}</td></tr>`),'No big price moves'))}
   </div>
   `;
}

/* ================= register screens ================= */
Object.assign(VIEWS,{recipes:renderRecipes,prep:renderPrep,suppliers:renderSuppliers,events:renderEvents,sales:renderSales,reports:renderReports});
const live=k=>()=>API.live&&(!k||API.can[k]);
NAV.push(['recipes','Menu & recipes',NAV_ICON.recipes],['prep','Prep & wastage',NAV_ICON.prep,live('prepView')],
  ['suppliers','Suppliers',NAV_ICON.suppliers,live('pricing')],['events','Event nights',NAV_ICON.events,live()],
  ['sales','Sales',NAV_ICON.sales,live('sales')],['reports','Reports and Analytics',NAV_ICON.reports,live('pricing')]);

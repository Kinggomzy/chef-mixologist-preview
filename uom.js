/* Chef & Mixologist: units of measure in forms.
   Each item keeps stock in one unit; forms let people type a quantity in any unit the item has
   (g for a kg item, a supplier pack, a sack, a piece) and the server converts it. */

const METRIC_UNITS={kg:[['g',0.001]],g:[['kg',1000]],l:[['mL',0.001]],ml:[['L',1000]]};
function unitList(x){
  if(x&&x.units&&x.units.length)return x.units;
  const u=(x&&x.unit)||'pcs';
  return [{name:u,factor:1,kind:'stock'},...(METRIC_UNITS[u.toLowerCase()]||[]).map(([n,f])=>({name:n,factor:f,kind:'metric'}))];
}
const unitLabel=(u,stock)=>u.kind==='stock'||u.kind==='metric'?u.name:`${u.name} (${fq(u.factor)} ${stock})`;
function unitPick(x,name='unit',sel){
  const L=unitList(x),st=L[0].name;
  if(L.length<2)return `<input type="hidden" name="${name}" value="${esc(st)}"><span class="unit-fixed">${esc(st)}</span>`;
  return `<select name="${name}" class="unit-sel" aria-label="Unit">${L.map(u=>`<option value="${esc(u.name)}" ${u.name===sel?'selected':''}>${esc(unitLabel(u,st))}</option>`).join('')}</select>`;
}
// a quantity box with its unit picker; the form sends name and name+'Unit'
function qtyField(label,x,{name='q',value='',min=0,step='any',required=true}={}){
  return `<label>${label}<span class="qty-unit"><input name="${name}" type="number" min="${min}" step="${step}" value="${value}" ${required?'required':''}>${unitPick(x,name+'Unit')}</span></label>`;
}
const toStockQty=(x,q,unit)=>{const u=unitList(x).find(o=>o.name===unit);return (+q||0)*(u?u.factor:1)};

/* ---------- item drawer: the units this item comes in ---------- */
const openItemBeforeUnits=openItem;
openItem=function(sku){
  openItemBeforeUnits(sku);
  const x=bySku[sku];if(!x)return;
  const L=unitList(x),st=L[0].name,own=L.filter(u=>u.kind==='item');
  const at=$('#drawer #d-profile');if(!at)return;
  at.insertAdjacentHTML('beforebegin',`<div class="panel" id="d-units"><div class="panel-b d-sec"><h3>Units <span>${API.live&&API.can.part?'<button class="btn btn-sm btn-line" id="u-edit">Set units</button>':''}</span></h3>
    <p class="muted" style="margin:0 0 8px">Stock is kept in <b>${esc(st)}</b>. Buy, count and use it in any of these; the app converts.</p>
    <div class="unit-chips">${L.map(u=>`<span class="sticker ${u.kind==='stock'?'lime':'soft'}">${u.kind==='stock'?esc(u.name):`1 ${esc(u.name)} = ${fq(u.factor)} ${esc(st)}`}</span>`).join('')}</div>
    ${own.length?'':'<p class="muted" style="margin:8px 0 0;font-size:var(--fs-xs)">Add your own, for example a 25 kg sack, a case of 24 bottles or a piece.</p>'}
    <div class="yield-row"><div><small>Usable after trimming</small><b>${usablePct(x)}%</b><span class="muted">${usablePct(x)<100?`1 ${esc(st)} bought gives ${fq(usablePct(x)/100)} ${esc(st)} to cook with`:'No trim loss recorded'}</span></div>
      ${API.live&&API.can.part?'<button class="btn btn-sm btn-line" id="y-edit">Set usable %</button>':''}</div></div></div>`);
  if($('#u-edit'))$('#u-edit').onclick=()=>editUnits(x);
  if($('#y-edit'))$('#y-edit').onclick=()=>editYield(x);
};
function editUnits(x){
  const st=unitList(x)[0].name,own=unitList(x).filter(u=>u.kind==='item');
  const row=u=>`<div class="urow"><label>Unit name<input name="un" maxlength="20" value="${esc(u?u.name:'')}" placeholder="e.g. sack"></label><label>Holds (${esc(st)})<input name="uf" type="number" min="0" step="any" value="${u?u.factor:''}" placeholder="e.g. 25"></label><button type="button" class="icon-btn udel" aria-label="Remove">✕</button></div>`;
  formModal(`Units · ${esc(x.name)}`,`Stock stays in ${esc(st)}. Remove a row to delete that unit.`,
    `<div id="urows" style="display:grid;gap:8px">${(own.length?own:[null]).map(row).join('')}</div><button type="button" class="btn btn-sm btn-line" id="uadd" style="justify-self:start">+ Unit</button>`,
    'Save units',async(f,close)=>{
      const units=$$('#urows .urow').map(r=>({name:r.querySelector('[name=un]').value.trim(),factor:r.querySelector('[name=uf]').value})).filter(u=>u.name);
      await api(`/plugin/cm/item/${x.id}/units/`,{method:'PUT',json:{units}});close();toast('Units saved');await reload();openItem(x.sku)});
  const wire=()=>$$('#urows .udel').forEach(b=>b.onclick=()=>b.parentElement.remove());
  $('#uadd').onclick=()=>{$('#urows').insertAdjacentHTML('beforeend',row(null));wire()};wire();
}

/* ---------- yield: how much of what is bought ends up usable ---------- */
const usablePct=x=>x.profile&&x.profile.usablePct!=null?x.profile.usablePct:100;
function editYield(x){
  const st=unitList(x)[0].name;
  formModal(`Usable after trimming · ${esc(x.name)}`,'Recipes list what is used; cost and stock taken out are scaled up by this',
    `<label>Usable share (%)<input name="pct" type="number" min="1" max="100" step="0.5" value="${usablePct(x)}" required></label>
     <fieldset class="yield-test"><legend>Or weigh it</legend><div class="two"><label>As bought (${esc(st)})<input name="w1" type="number" min="0" step="any" placeholder="e.g. 5"></label>
       <label>After trimming (${esc(st)})<input name="w2" type="number" min="0" step="any" placeholder="e.g. 4.25"></label></div>
       <p class="muted" style="margin:0;font-size:var(--fs-xs)">Weigh a typical batch before and after peeling or cleaning; the share is filled in for you.</p></fieldset>`,
    'Save',async(f,close)=>{
      const pct=+f.get('pct');
      await api(`/plugin/cm/item/${x.id}/profile/`,{method:'PATCH',json:{usable_pct:pct>=100?null:pct}});close();toast('Usable share saved');await reload();openItem(x.sku)});
  const calc=()=>{const a=+$('#mform [name=w1]').value,b=+$('#mform [name=w2]').value;if(a>0&&b>0&&b<=a)$('#mform [name=pct]').value=(b/a*100).toFixed(1)};
  $$('#mform [name=w1],#mform [name=w2]').forEach(i=>i.oninput=calc);
}

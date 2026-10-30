/* Chef & Mixologist: supplier price lists from an Excel template (Setup → Supplier price lists). */

function priceListPanel(suppliers){
  if(!API.can.suppliersEdit||!API.can.pricing)return '';
  return panel('Supplier price lists','Download the Excel template with current prices, fill in the new ones, upload it back. You see every change before it is saved.',
   `<div class="pl-bar"><label class="field"><select id="plSup" aria-label="Supplier"><option value="">All suppliers</option>${suppliers.filter(s=>s.active).map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
     <button type="button" class="btn btn-line" id="plTpl">Download Excel template</button>
     <label class="btn btn-primary">Upload filled-in file<input type="file" id="plFile" accept=".xlsx,.csv" hidden></label></div>
    <div id="plOut"></div>`);
}
function wirePriceList(){
  if(!$('#plTpl'))return;
  $('#plTpl').onclick=async()=>{
    const sup=$('#plSup').value;
    try{const r=await fetch(`${API.base}/plugin/cm/import/prices/template/${sup?`?supplier=${sup}`:''}`,{headers:{Authorization:'Token '+API.token}});
      if(!r.ok)throw new Error('Could not make the template');
      const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(await r.blob()),download:'supplier-price-list.xlsx'});a.click()}catch(e){fail(e)}};
  $('#plFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
    if(!/\.(xlsx|csv)$/i.test(f.name))return toast('Upload the Excel template (.xlsx) or a .csv file');
    const fd=new FormData();fd.append('file',f);
    try{const d=await api('/plugin/cm/import/prices/',{method:'POST',body:fd});showPricePreview(d.rows,f)}catch(err){fail(err)}};
}
function showPricePreview(rows,file){
  const ok=rows.filter(r=>!r.problem&&['Update price','Add to supplier'].includes(r.action)),bad=rows.filter(r=>r.problem);
  const tone=r=>r.problem?'melon':r.action==='No change'?'soft':r.action==='Add to supplier'?'turmeric':'lime';
  $('#plOut').innerHTML=`<p style="margin:12px 0 8px"><b>${ok.length}</b> price${ok.length===1?'':'s'} to save${bad.length?`, <b style="color:var(--bad-ink)">${bad.length}</b> row${bad.length===1?'':'s'} with problems (skipped)`:''}.</p>
    ${rows.length-ok.length-bad.length?`<p class="muted" style="margin:0 0 8px">${rows.length-ok.length-bad.length} row${rows.length-ok.length-bad.length===1?'':'s'} without a new price are left as they are.</p>`:''}
    ${table(['Line','Supplier','Item','>Now','>New','>Change','What happens'],rows.filter(r=>r.problem||r.action!=='No change').map(r=>`<tr><td class="num">${r.line}</td><td>${esc(r.supplier)}</td><td>${r.item?xlItemName(r.item):esc(r.sku)}</td>
      <td class="r num">${r.old==null?'—':inr(r.old)}</td><td class="r num">${r.new==null?'—':inr(r.new)}</td>
      <td class="r num ${r.change>0?'neg':r.change<0?'pos':''}">${r.change==null?'':`${r.change>0?'+':''}${r.change}%`}</td>
      <td><span class="sticker ${tone(r)}">${esc(r.problem||r.action)}</span></td></tr>`),'No new prices in this file')}
    <div class="btn-row" style="margin-top:12px">${ok.length?`<button class="btn btn-primary" id="plApply">Save ${ok.length} price${ok.length===1?'':'s'}</button>`:''}<button class="btn btn-line" id="plCancel">Cancel</button></div>`;
  $('#plCancel').onclick=()=>$('#plOut').innerHTML='';
  if($('#plApply'))$('#plApply').onclick=async e=>{e.currentTarget.disabled=true;const fd=new FormData();fd.append('file',file);fd.append('apply','1');
    try{const d=await api('/plugin/cm/import/prices/',{method:'POST',body:fd});toast(`${d.applied} price${d.applied===1?'':'s'} saved`);$('#plOut').innerHTML='';await reload()}catch(err){fail(err);e.currentTarget.disabled=false}};
}

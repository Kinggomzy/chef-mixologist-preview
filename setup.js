/* Chef & Mixologist: data the restaurant maintains itself.
   Setup screen (suppliers, storage areas, categories, spreadsheet import, archive)
   plus edit / archive / delete / cancel / void buttons on the other screens.
   Loaded after erp.js. Every button is also permission-checked by the server. */

/* ---------- shared ---------- */
async function act(method,path,body,done){
  try{const r=await api(path,{method,json:body});if(done)toast(done);return r||true}catch(e){fail(e);return null}
}
function confirmModal(title,text,okText,onOk){
  formModal(title,'',`<p>${text}</p>`,okText,async(f,close)=>{await onOk();close()});
}
const btn=(label,attrs,kind='btn-line')=>`<button type="button" class="btn btn-sm ${kind}" ${attrs}>${label}</button>`;
const danger='style="color:var(--red)"';

/* ================= Setup screen ================= */
let SETUP=null;
const SETUP_UI={sup:{q:'',sort:'az',flt:''},loc:{q:'',sort:'az',flt:''},cat:{q:'',sort:'az',flt:''}};
async function renderSetup(){
  const body=view('setup','Setup','Suppliers, storage areas, categories and bulk item import. Archived records are kept and can be restored; delete only works for records nothing refers to yet.');
  const d=await load(body,'/plugin/cm/setup/');if(!d)return;SETUP=d;const c=d.can;await Promise.all([phIndex('area'),phIndex('category')]);
  const thumb=(u,t='')=>u?`<img class="row-ph" data-auth-src="${esc(u)}" alt="${esc(t)}">`:'';
  const supRow=s=>`<tr><td><div class="with-ph">${thumb(s.image,s.name)}<span><b>${xl('supplier',s.name)}</b><br><small class="muted">${esc(s.contact)} ${esc(s.phone)} ${esc(s.email)}</small>${s.gstin?`<small class="gst-inline muted">GSTIN ${esc(s.gstin)}</small>`:''}</span></div></td><td class="gst">${esc(s.gstin)||'—'}</td><td class="r num">${s.items}</td>
    <td class="r">${c.supplier.change?btn('Edit',`data-sup-edit="${s.id}"`)+' '+btn('Archive',`data-arch="supplier:${s.id}"`):''} ${c.supplier.delete?btn('Delete',`data-del="supplier:${s.id}:${esc(s.name)}" ${danger}`):''}</td></tr>`;
  const supAll=d.suppliers.filter(s=>s.active),locAll=d.locations.filter(l=>!d.archived.locations.some(a=>a.id===l.id)),catAll=d.categories.filter(k=>!d.archived.categories.some(a=>a.id===k.id));
  const locRow=l=>`<tr><td><div class="with-ph">${thumb(PH.idx.area?.covers?.[l.id],l.name)}<b>${xl('location',l.name)}</b></div></td><td>${esc(l.owner||'Anyone with stock access')}</td><td class="r num">${l.items}</td>
    <td class="r">${c.location.change?btn('Edit',`data-loc-edit="${l.id}"`)+' '+btn('Archive',`data-arch="location:${l.id}"`):''} ${c.location.delete?btn('Delete',`data-del="location:${l.id}:${esc(l.name)}" ${danger}`):''}</td></tr>`;
  const catRow=k=>`<tr><td><div class="with-ph">${thumb(PH.idx.category?.covers?.[k.id],k.name)}<b>${xl('category',k.name)}</b></div></td><td class="r num">${k.items}</td>
    <td class="r">${c.category.change?btn('Rename',`data-cat-edit="${k.id}"`)+' '+btn('Archive',`data-arch="category:${k.id}"`):''} ${c.category.delete?btn('Delete',`data-del="category:${k.id}:${esc(k.name)}" ${danger}`):''}</td></tr>`;
  const ownerOf=l=>l.owner||'Anyone with stock access';
  const SECS={
    sup:{all:supAll,row:supRow,head:['Supplier','GSTIN','>Items',''],noun:'supplier',hint:'Search suppliers',text:s=>`${s.name} ${s.contact||''} ${s.phone||''} ${s.email||''} ${s.gstin||''}`,
      sorts:[['az','Name A to Z'],['za','Name Z to A'],['most','Most items'],['least','Fewest items']],fl:'GSTIN',opts:[['yes','Has GSTIN'],['no','No GSTIN']],pass:(s,v)=>v==='yes'?!!s.gstin:!s.gstin,n:s=>s.items},
    loc:{all:locAll,row:locRow,head:['Area','Owned by','>Lots',''],noun:'area',hint:'Search storage areas',text:l=>`${l.name} ${ownerOf(l)}`,
      sorts:[['az','Name A to Z'],['za','Name Z to A'],['most','Most lots'],['least','Fewest lots']],fl:'Owned by',opts:[...new Set(locAll.map(ownerOf))].sort().map(o=>[o,o]),pass:(l,v)=>ownerOf(l)===v,n:l=>l.items},
    cat:{all:catAll,row:catRow,head:['Category','>Items',''],noun:'category',hint:'Search categories',text:k=>k.name,
      sorts:[['az','Name A to Z'],['za','Name Z to A'],['most','Most items'],['least','Fewest items']],fl:'Contents',opts:[['has','Has items'],['empty','Empty']],pass:(k,v)=>v==='has'?k.items>0:!k.items,n:k=>k.items}};
  /* search, sort and filter for one section; the table redraws, the controls stay put */
  const secTools=k=>{const m=SECS[k],u=SETUP_UI[k];return `<div class="toolbar"><span class="result-count" id="${k}Count"></span>
    <label class="field">Search<input id="${k}Q" value="${esc(u.q)}" placeholder="${m.hint}" autocomplete="off"></label>
    <label class="field">Sort<select id="${k}Sort" data-sort>${m.sorts.map(([v,l])=>`<option value="${v}" ${u.sort===v?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="field" data-filter>${m.fl}<select id="${k}Flt"><option value="">All</option>${m.opts.map(([v,l])=>`<option value="${esc(v)}" ${u.flt===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label></div><div id="${k}Box"></div>`};
  const drawSec=k=>{const m=SECS[k],u=SETUP_UI[k],box=$('#'+k+'Box');if(!box)return;
    const q=u.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const L=m.all.filter(r=>(!u.flt||m.pass(r,u.flt))&&q.every(w=>m.text(r).toLowerCase().includes(w)))
      .sort((a,b)=>u.sort==='za'?b.name.localeCompare(a.name):u.sort==='most'?m.n(b)-m.n(a)||a.name.localeCompare(b.name):u.sort==='least'?m.n(a)-m.n(b)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
    box.innerHTML=table(m.head,L.map(m.row),m.all.length?`No ${m.noun} matches`:`No ${m.noun}s yet`);
    const cnt=$('#'+k+'Count');if(cnt)cnt.textContent=`${L.length} of ${m.all.length}`;
    box.querySelectorAll('[data-sup-edit]').forEach(b=>b.onclick=()=>supplierForm(SETUP.suppliers.find(s=>s.id===+b.dataset.supEdit)));
    box.querySelectorAll('[data-loc-edit]').forEach(b=>b.onclick=()=>locationForm(SETUP.locations.find(s=>s.id===+b.dataset.locEdit)));
    box.querySelectorAll('[data-cat-edit]').forEach(b=>b.onclick=()=>categoryForm(SETUP.categories.find(s=>s.id===+b.dataset.catEdit)));
    box.querySelectorAll('[data-arch]').forEach(b=>b.onclick=async()=>{const [t,id]=b.dataset.arch.split(':');if(await act('POST',`/plugin/cm/${t}/${id}/archive/`,{},'Archived')){renderSetup();reload()}});
    wireRestoreDel(box)};
  const A=d.archived,arch=[...A.items.map(i=>[`item`,i.id,`${i.name} (${i.sku})`,i.kind==='recipe'?'Recipe':'Item',i.kind==='recipe'?c.recipe:c.item]),
    ...A.suppliers.map(s=>['supplier',s.id,s.name,'Supplier',c.supplier]),...A.locations.map(l=>['location',l.id,l.name,'Storage area',c.location]),...A.categories.map(k=>['category',k.id,k.name,'Category',c.category])];
  const archRow=([t,id,name,label,p])=>`<tr><td>${esc(name)}</td><td class="muted">${label}</td><td class="r">${p.change?btn('Restore',`data-restore="${t}:${id}"`,'btn-primary'):''} ${p.delete||(t==='item'&&c.item.delete)?btn('Delete',`data-del="${t}:${id}:${esc(name)}" ${danger}`):''}</td></tr>`;
  body.innerHTML=
    panel('Suppliers',c.supplier.add?btn('+ Add supplier','id="supAdd"','btn-primary'):'',secTools('sup'))+
    `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(440px,100%),1fr));gap:16px">`+
    panel('Storage areas',c.location.add?btn('+ Add area','id="locAdd"','btn-primary'):'',secTools('loc'))+
    panel('Item categories',c.category.add?btn('+ Add category','id="catAdd"','btn-primary'):'',secTools('cat'))+`</div>`+
    `<div class="setup-pair">`+(c.item.add?panel('Import items from a spreadsheet','Save your sheet as CSV. Existing SKUs are updated; nothing is saved if any row has an error.',
      `<div style="margin-bottom:10px"><input type="file" accept=".csv,text/csv" id="impFile"></div>
       <div class="imp-foot">${btn('Download template','id="impTpl"')}<details><summary class="muted">Columns</summary><p class="muted">${d.importColumns.map(x=>`<code>${x}</code>`).join(' ')} — required: sku, name, category, unit, location, supplier. Allergens separated by <code>;</code> (${Object.keys(META.allergens).join(', ')}). jain: yes/no. Dates YYYY-MM-DD.</p></details></div>
       <div id="impOut"></div>`):'')+
    priceListPanel(d.suppliers)+`</div>`+
    panel('Archived','Hidden from daily screens',arch.length?`<div class="toolbar"><label class="field">Search<input id="archQ" placeholder="Search archived records" autocomplete="off"></label><label class="field">Sort<select id="archSort" data-sort><option value="az">Name A to Z</option><option value="za">Name Z to A</option><option value="type">Type</option></select></label>
      <label class="field" data-filter>Type<select id="archType"><option value="">All types</option>${[...new Set(arch.map(r=>r[3]))].sort().map(t=>`<option>${t}</option>`).join('')}</select></label><span class="result-count" id="archCount"></span></div><div id="archBox"></div>`:table(['Record','Type',''],[],'Nothing archived'));
  wireSetup();
  ['sup','loc','cat'].forEach(k=>{drawSec(k);const u=SETUP_UI[k];
    $('#'+k+'Q').oninput=e=>{u.q=e.target.value;drawSec(k)};$('#'+k+'Sort').onchange=e=>{u.sort=e.target.value;drawSec(k)};$('#'+k+'Flt').onchange=e=>{u.flt=e.target.value;drawSec(k)}});
  const drawArch=()=>{const box=$('#archBox');if(!box)return;const ty=$('#archType').value,so=$('#archSort').value,aq=($('#archQ').value||'').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const L=arch.filter(r=>(!ty||r[3]===ty)&&aq.every(w=>`${r[2]} ${r[3]}`.toLowerCase().includes(w))).sort((x,y)=>so==='type'?x[3].localeCompare(y[3])||x[2].localeCompare(y[2]):so==='za'?y[2].localeCompare(x[2]):x[2].localeCompare(y[2]));
    box.innerHTML=table(['Record','Type',''],L.map(archRow),'Nothing matches');$('#archCount').textContent=`${L.length} of ${arch.length}`;
    wireRestoreDel(box);pageDom(box.querySelector('tbody'),'tr','setup-arch',12)};
  if($('#archBox')){$('#archQ').oninput=drawArch;$('#archSort').onchange=drawArch;$('#archType').onchange=drawArch;drawArch()}
}
/* a supplier can be edited from Setup or from the Suppliers page: redraw whichever one is showing */
function afterSupplier(){SUP_CACHE=null;if(S.view==='suppliers'&&VIEWS.suppliers)VIEWS.suppliers();else renderSetup()}
async function editSupplierById(id){
  try{if(!SETUP)SETUP=await api('/plugin/cm/setup/');const s=SETUP.suppliers.find(x=>x.id===id);if(!s)return toast('That supplier is no longer here');supplierForm(s)}catch(e){fail(e)}
}
function supplierForm(s){
  s=s||{};
  formModal(s.id?`Edit ${esc(s.name)}`:'Add supplier','',`${s.id?photoBlock(s.image,s.name):pendingPhotoBlock()}<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <label>Name<input name="name" required maxlength="100" value="${esc(s.name||'')}"></label><label>Contact person<input name="contact" maxlength="100" value="${esc(s.contact||'')}"></label>
    <label>Phone<input name="phone" maxlength="50" value="${esc(s.phone||'')}"></label><label>WhatsApp number<input name="whatsapp" maxlength="20" inputmode="tel" value="${esc(s.whatsapp||'')}" placeholder="Same as phone if a mobile"></label>
    <label>Email<input name="email" type="email" value="${esc(s.email||'')}"></label>
    <label>GSTIN<input name="gstin" maxlength="15" value="${esc(s.gstin||'')}" placeholder="19ABCDE1234F1Z5"></label><label>FSSAI licence<input name="fssai" maxlength="20" value="${esc(s.fssai||'')}"></label></div>
    ${addressFields(s)}<label>Notes<input name="notes" maxlength="250" value="${esc(s.notes||'')}"></label>`,'Save',async(f,close)=>{
    const body=Object.fromEntries(['name','contact','phone','whatsapp','email','gstin','fssai','address','address2','city','state','pin','country','notes'].map(k=>[k,f.get(k)]));
    const r=await api(s.id?`/plugin/cm/supplier/${s.id}/`:'/plugin/cm/supplier/',{method:s.id?'PATCH':'POST',json:body});if(!s.id&&r&&r.id)await commitPendingPhoto(`/plugin/cm/supplier/${r.id}/photo/`);close();toast('Supplier saved');afterSupplier();reload()});
  if(s.id)wirePhotoBlock(`/plugin/cm/supplier/${s.id}/photo/`,afterSupplier);else wirePendingPhoto();
}
function locationForm(l){
  l=l||{};
  formModal(l.id?`Edit ${esc(l.name)}`:'Add storage area','Only the owning team can change stock kept here',`${l.id?photoBlock(PH.idx.area?.covers?.[l.id],l.name):pendingPhotoBlock()}
    <label>Name<input name="name" required maxlength="100" value="${esc(l.name||'')}"></label>
    <label>Owned by<select name="owner">${SETUP.groups.map(g=>`<option value="${g.id}" ${l.ownerGroup===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>`,'Save',async(f,close)=>{
    const r=await api(l.id?`/plugin/cm/location/${l.id}/`:'/plugin/cm/location/',{method:l.id?'PATCH':'POST',json:{name:f.get('name'),owner_group:+f.get('owner')}});if(!l.id&&r&&r.id)await commitPendingPhoto(`/plugin/cm/photos/area/${r.id}/`,'area');close();toast('Storage area saved');renderSetup();reload()});
  if(l.id)wirePhotoBlock(`/plugin/cm/photos/area/${l.id}/`,async()=>{await phIndex('area',true);renderSetup()});else wirePendingPhoto();
}
function categoryForm(k){
  k=k||{};
  formModal(k.id?`Rename ${esc(k.name)}`:'Add category','',`${k.id?photoBlock(PH.idx.category?.covers?.[k.id],k.name):pendingPhotoBlock()}<label>Name<input name="name" required maxlength="100" value="${esc(k.name||'')}"></label>`,'Save',async(f,close)=>{
    const r=await api(k.id?`/plugin/cm/category/${k.id}/`:'/plugin/cm/category/',{method:k.id?'PATCH':'POST',json:{name:f.get('name')}});if(!k.id&&r&&r.id)await commitPendingPhoto(`/plugin/cm/photos/category/${r.id}/`,'category');close();toast('Category saved');renderSetup();reload()});
  if(k.id)wirePhotoBlock(`/plugin/cm/photos/category/${k.id}/`,async()=>{await phIndex('category',true);renderSetup()});else wirePendingPhoto();
}
function wireRestoreDel(root){
  root.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{const [t,id]=b.dataset.restore.split(':');if(await act('POST',`/plugin/cm/${t}/${id}/restore/`,{},'Restored')){renderSetup();reload()}});
  root.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{const [t,id,...n]=b.dataset.del.split(':');
    confirmModal(`Delete ${esc(n.join(':'))}?`,'This cannot be undone. If anything still refers to it, you will be asked to archive it instead.','Delete',async()=>{
      await api(`/plugin/cm/${t}/${id}/`,{method:'DELETE'});toast('Deleted');renderSetup();reload()})});
}
function wireSetup(){
  wirePriceList();
  const on=(sel,fn)=>{const el=$(sel);if(el)el.onclick=fn};
  on('#supAdd',()=>supplierForm());on('#locAdd',()=>locationForm());on('#catAdd',()=>categoryForm());
  $$('[data-sup-edit]').forEach(b=>b.onclick=()=>supplierForm(SETUP.suppliers.find(s=>s.id===+b.dataset.supEdit)));
  $$('[data-loc-edit]').forEach(b=>b.onclick=()=>locationForm(SETUP.locations.find(s=>s.id===+b.dataset.locEdit)));
  $$('[data-cat-edit]').forEach(b=>b.onclick=()=>categoryForm(SETUP.categories.find(s=>s.id===+b.dataset.catEdit)));
  $$('[data-arch]').forEach(b=>b.onclick=async()=>{const [t,id]=b.dataset.arch.split(':');if(await act('POST',`/plugin/cm/${t}/${id}/archive/`,{},'Archived')){renderSetup();reload()}});
  wireRestoreDel(document);
  on('#impTpl',async()=>{const r=await act('GET','/plugin/cm/import/items/');if(!r)return;
    const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([r.template],{type:'text/csv'})),download:'items-template.csv'});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});
  const f=$('#impFile');if(f)f.onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>2e6)return toast('File is too large');previewImport(await file.text())};
}
async function previewImport(text){
  const out=$('#impOut');out.innerHTML='<p class="muted">Checking…</p>';
  let r;try{r=await api('/plugin/cm/import/items/',{method:'POST',json:{csv:text,commit:false}})}catch(e){out.innerHTML=`<p style="color:var(--red)">${esc(e.message)}</p>`;return}
  const bad=r.rows.filter(x=>x.errors.length).length;
  out.innerHTML=`<p><b>${r.rows.length} rows</b> · ${r.created} new · ${r.updated} updates${bad?` · <b style="color:var(--red)">${bad} with errors — fix them in the sheet and choose the file again</b>`:''}</p>`+
    table(['Line','SKU','Name','Action','Problems / notes'],r.rows.map(x=>`<tr><td class="num">${x.line}</td><td>${esc(x.sku)}</td><td>${esc(x.name)}</td><td>${x.action?esc(x.action):'—'}</td><td>${x.errors.map(e=>`<div style="color:var(--red)">${esc(e)}</div>`).join('')}${x.notes.map(n=>`<div class="muted">${esc(n)}</div>`).join('')}</td></tr>`))+
    (r.ok?`<div style="margin-top:10px">${btn(`Import ${r.rows.length} rows`,'id="impGo"','btn-primary')}</div>`:'');
  if($('#impGo'))$('#impGo').onclick=async()=>{const res=await act('POST','/plugin/cm/import/items/',{csv:text,commit:true});
    if(res&&res.committed){toast(`Imported · ${res.created} new, ${res.updated} updated`);renderSetup();reload()}else if(res)previewImport(text)};
}

/* ================= item drawer: edit / archive / delete / opening stock ================= */
const baseOpenItem=openItem;
openItem=function(sku){
  baseOpenItem(sku);
  const x=bySku[sku];if(!API.live||!x)return;
  /* the manage actions live in the "More" menu of the action bar at the top of the item */
  const items=[];
  if(API.can.part)items.push(['edit','Edit item']);
  if(API.can.stockAdd&&!x.onHand)items.push(['opening','Add opening stock']);
  if(API.can.part)items.push(['archive','Archive']);
  if(API.can.partDelete)items.push(['delete','Delete',true]);
  const more=$('#dMore'),menu=$('#dMoreMenu');if(!items.length||!more||!menu)return;
  menu.innerHTML=items.map(([k,l,danger])=>`${danger?'<hr>':''}<button type="button" role="menuitem" data-adm="${k}"${danger?' class="danger"':''}>${l}</button>`).join('');
  more.hidden=false;
  const close=()=>{menu.hidden=true;more.setAttribute('aria-expanded','false')};
  more.onclick=e=>{e.stopPropagation();const open=menu.hidden;menu.hidden=!open;more.setAttribute('aria-expanded',String(open));if(open)menu.querySelector('button').focus()};
  menu.onclick=e=>{const b=e.target.closest('[data-adm]');if(!b)return;close();itemAdmin(x,b.dataset.adm)};
  menu.onkeydown=e=>{if(e.key==='Escape'){close();more.focus()}};
  $('#drawer').addEventListener('click',e=>{if(!e.target.closest('#dMore,#dMoreMenu'))close()},{once:false});
};
function itemAdmin(x,what){
  const m=META;
  if(what==='edit'){formModal(`Edit ${esc(x.name)}`,'The unit can only change while nothing is in stock',`${photoBlock(x.img,x.name)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
     <label>Name<input name="name" required maxlength="100" value="${esc(x.name)}"></label>
     <label>Category<select name="category">${m.categories.map(c=>`<option value="${c.id}" ${c.name===x.cat?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>
     <label>Unit<select name="unit">${[...new Set([x.unit,...m.units])].map(u=>`<option ${u===x.unit?'selected':''}>${esc(u)}</option>`).join('')}</select></label>
     <label>Storage area<select name="location">${m.locations.map(l=>`<option value="${l.id}" ${l.name===x.loc?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
     <label>Preferred supplier<select name="supplier">${m.suppliers.map(s=>`<option value="${s.id}" ${s.id===x.supId?'selected':''}>${esc(s.name)}</option>`).join('')}</select></label>
     ${API.can.pricing?`<label>Cost per ${esc(x.unit)} (₹)<input name="cost" type="number" min="0" step="0.01" value="${x.cost}"></label>`:''}
     <label>Supplier pack size<input name="pack" type="number" min="1" value="${x.pack}"></label></div>`,'Save',async(f,close)=>{
    const body={name:f.get('name'),category:+f.get('category'),location:+f.get('location'),supplier:+f.get('supplier'),pack:+f.get('pack')||1};
    if(f.get('unit')!==x.unit)body.unit=f.get('unit');if(f.has('cost'))body.cost=f.get('cost')||null;
    await api(`/plugin/cm/item/${x.id}/`,{method:'PATCH',json:body});close();toast('Item saved');await reload()});
    wirePhotoBlock(`/plugin/cm/item/${x.id}/photo/`,async()=>{await reload()});return}
  if(what==='opening')return formModal(`Opening stock · ${esc(x.name)}`,`Goes into ${esc(x.loc)}`,`
    ${qtyField('Quantity',x)}<label>Lot / batch<input name="b" maxlength="100"></label><label>Use by<input name="e" type="date"></label>`,'Add stock',async(f,close)=>{
    await api(`/plugin/cm/item/${x.id}/opening-stock/`,{method:'POST',json:{quantity:f.get('q'),unit:f.get('qUnit'),batch:f.get('b'),expiry_date:f.get('e')||null}});close();toast('Stock added');await reload()});
  if(what==='archive')return confirmModal(`Archive ${esc(x.name)}?`,'It disappears from daily screens and can be restored from Setup. Stock must be zero first.','Archive',async()=>{
    await api(`/plugin/cm/item/${x.id}/archive/`,{method:'POST',json:{}});closeItem();toast('Archived');await reload()});
  if(what==='delete')return confirmModal(`Delete ${esc(x.name)}?`,'Only possible if it has never been stocked, ordered or used in a recipe. Otherwise archive it.','Delete',async()=>{
    await api(`/plugin/cm/item/${x.id}/`,{method:'DELETE'});closeItem();toast('Deleted');await reload()});
}

/* ================= recipes: archive / delete ================= */
const baseShowRecipe=showRecipe;
showRecipe=function(id){
  baseShowRecipe(id);
  if(!API.can.recipes)return;
  const r=RECIPES.recipes.find(x=>x.id===id);
  $('#mform').insertAdjacentHTML('beforeend',`<div style="display:flex;gap:8px">${btn('Archive recipe','id="recArch"')}${API.can.partDelete?btn('Delete recipe','id="recDel" '+danger):''}</div>`);
  $('#recArch').onclick=async()=>{if(await act('POST',`/plugin/cm/item/${r.id}/archive/`,{},'Recipe archived — restore it from Setup')){$('#modal').classList.remove('on');renderRecipes()}};
  if($('#recDel'))$('#recDel').onclick=async()=>{if(await act('DELETE',`/plugin/cm/item/${r.id}/`,undefined,'Recipe deleted')){$('#modal').classList.remove('on');renderRecipes()}};
};

/* ================= goods inward: cancel an order ================= */
const baseRenderInward=renderInward;
renderInward=function(){
  baseRenderInward();
  if(!API.live||!API.can.poCancel)return;
  $$('#expected tbody tr').forEach(tr=>{const ref=tr.querySelector('td b')?.textContent;const p=POS.find(o=>o.po===ref);if(!p)return;
    tr.lastElementChild.insertAdjacentHTML('beforeend',' '+btn('Cancel',`data-cancel="${p.id}" ${danger}`))});
  $$('[data-cancel]').forEach(b=>b.onclick=()=>{const p=POS.find(o=>o.id===+b.dataset.cancel);
    formModal(`Cancel ${esc(p.po)}?`,`${esc(p.sup)} · only possible before anything is received`,`<label>Reason<input name="r" required maxlength="200"></label>`,'Cancel order',async(f,close)=>{
      await api(`/plugin/cm/po/${p.id}/cancel/`,{method:'POST',json:{reason:f.get('r')}});close();toast(`${esc(p.po)} cancelled`);await reload()})});
};
VIEWS.inward=renderInward;

/* ================= sales: void an import ================= */
const baseRenderSales=renderSales;
renderSales=async function(){
  await baseRenderSales();
  if(!API.live||!API.can.salesVoid)return;
  const d=await api('/plugin/cm/sales/').catch(()=>null);if(!d)return;
  const rows=$$('#v-sales .panel:first-child tbody tr');
  d.batches.forEach((b,i)=>{const tr=rows[i];if(!tr||b.source.startsWith('void:'))return;
    tr.lastElementChild.insertAdjacentHTML('beforeend',`<div>${btn('Void',`data-void="${b.id}" ${danger}`)}</div>`)});
  $$('[data-void]').forEach(btnEl=>btnEl.onclick=()=>{const b=d.batches.find(x=>x.id===+btnEl.dataset.void);
    formModal(`Void ${esc(b.reference)}?`,'Puts every ingredient this import took back into stock and removes its revenue',`<label>Reason<input name="r" required maxlength="200"></label>`,'Void import',async(f,close)=>{
      await api(`/plugin/cm/sales/${b.id}/void/`,{method:'POST',json:{reason:f.get('r')}});close();toast('Import voided');renderSales();reload()})});
};
VIEWS.sales=renderSales;

/* ================= event nights: edit / delete planned events, add liquor items ================= */
const baseRenderEvents=renderEvents;
renderEvents=async function(){
  await baseRenderEvents();
  if(!API.live)return;
  const d=await api('/plugin/cm/events/').catch(()=>null);if(!d||!d.canManage)return;
  const store=$$('#v-events > .vbody > div > .panel').pop()||$$('#v-events .panel').pop();
  store.querySelector('.panel-h').insertAdjacentHTML('beforeend',btn('+ Liquor item','id="lqAdd"','btn-primary'));
  $('#lqAdd').onclick=()=>formModal('Add event liquor','Stock is counted in mL',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <label>Name<input name="n" required maxlength="100" placeholder="e.g. Single malt, 750 ml"></label><label>SKU<input name="s" required pattern="[A-Za-z0-9\\-]{2,20}" placeholder="LQ-605"></label>
    <label>Bottle size (mL)<input name="b" type="number" min="1" value="750"></label><label>Cost per bottle (₹)<input name="c" type="number" min="0" step="0.01"></label></div>`,'Add',async(f,close)=>{
    await api('/plugin/cm/liquor-item/',{method:'POST',json:{name:f.get('n'),sku:f.get('s'),bottle_ml:f.get('b'),cost_per_bottle:f.get('c')||null}});close();toast('Liquor item added');renderEvents()});
  d.events.filter(e=>e.status==='planned').forEach(e=>{const b=$(`#v-events [data-ev="open"][data-id="${e.id}"]`);if(!b)return;
    b.insertAdjacentHTML('afterend',btn('Edit',`data-evedit="${e.id}"`)+btn('Delete',`data-evdel="${e.id}" ${danger}`))});
  $$('[data-evdel]').forEach(b=>b.onclick=()=>confirmModal('Delete this planned event?','Only possible before any liquor is booked against it.','Delete',async()=>{
    await api(`/plugin/cm/events/${b.dataset.evdel}/`,{method:'DELETE'});toast('Event deleted');renderEvents()}));
  $$('[data-evedit]').forEach(b=>b.onclick=()=>{const e=d.events.find(x=>x.id===+b.dataset.evedit);
    formModal(`Edit ${esc(e.name)}`,'Planned events only',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <label>Name<input name="n" required maxlength="120" value="${esc(e.name)}"></label><label>Licence number<input name="l" required maxlength="60" value="${esc(e.licence)}"></label>
      <label>Valid from<input name="f" type="datetime-local"></label><label>Valid until<input name="u" type="datetime-local"></label>
      <label>Expected guests<input name="g" type="number" min="0" value="${e.guests??''}"></label><label>Notes<input name="no" maxlength="300" value="${esc(e.notes)}"></label></div>
      <p class="muted">Leave the dates empty to keep ${esc(e.from)} → ${esc(e.until)}.</p>`,'Save',async(f,close)=>{
      const body={name:f.get('n'),licence_number:f.get('l'),expected_guests:f.get('g')||null,notes:f.get('no')};
      if(f.get('f'))body.valid_from=new Date(f.get('f')).toISOString();if(f.get('u'))body.valid_until=new Date(f.get('u')).toISOString();
      await api(`/plugin/cm/events/${e.id}/`,{method:'PATCH',json:body});close();toast('Event saved');renderEvents()})});
};
VIEWS.events=renderEvents;

/* ================= register ================= */
VIEWS.setup=renderSetup;
NAV.push(['setup','Setup','<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',()=>API.live]);

/* Chef & Mixologist: purchase orders on WhatsApp.
   One click records the order and opens WhatsApp (desktop app or WhatsApp Web, set in Organisation settings)
   to the supplier's number with the whole order typed out. The person reviews it in WhatsApp and presses send. */

const WA_ICON='<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>';

const waSupplier=(supId,name)=>(META&&META.suppliers||[]).find(s=>s.id===supId||s.name===name)||{name:name||'the supplier',whatsapp:''};
const waConfig=()=>(META&&META.whatsapp)||{target:'app',prices:true};
const waQty=v=>(+v).toLocaleString('en-IN',{maximumFractionDigits:3});

/* lines: [{name, qty, unit, pack, price}] in stock units */
function waOrderText({ref,eta,lines}){
  const showPrices=waConfig().prices&&API.can.pricing&&lines.some(l=>l.price);
  const org=(BRAND&&BRAND.name)||'Chef & Mixologist',outlet=BRAND&&BRAND.outlet;
  const rows=lines.map((l,i)=>{const packs=l.pack>1?` (${waQty(l.qty/l.pack)} pack${l.qty/l.pack===1?'':'s'} of ${waQty(l.pack)} ${l.unit})`:'';
    return `${i+1}. ${l.name}: *${waQty(l.qty)} ${l.unit}*${packs}${showPrices&&l.price?` @ ₹${waQty(l.price)}/${l.unit}`:''}`});
  const total=lines.reduce((a,l)=>a+(l.price||0)*l.qty,0);
  const who=PROFILE?(PROFILE.firstName?`${PROFILE.firstName} ${PROFILE.lastName||''}`.trim():PROFILE.username):'';
  return [`*Purchase order ${ref}*`,`${org}${outlet?', '+outlet:''}`,eta?`Please deliver by ${eta}.`:'','',...rows,
    showPrices&&total?`\nEstimated total: *₹${total.toLocaleString('en-IN',{maximumFractionDigits:0})}*`:'',
    '','Please confirm availability and price. Thank you.',who?`— ${who}`:''].filter((x,i,a)=>!(x===''&&a[i-1]==='')).join('\n').trim();
}

/* For WhatsApp Web the tab must be opened inside the click, before any waiting, or the browser blocks it */
function waPrepare(){return waConfig().target==='web'?window.open('about:blank','_blank'):null}
function waOpen(number,text,win){
  const enc=encodeURIComponent(text);
  if(waConfig().target==='web'){
    const url=`https://web.whatsapp.com/send?phone=${number}&text=${enc}`;
    if(win&&!win.closed)win.location.href=url;else window.open(url,'_blank');
  }else{
    location.href=`whatsapp://send?phone=${number}&text=${enc}`;
    toast(`Opening WhatsApp… <a href="https://web.whatsapp.com/send?phone=${number}&text=${enc}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Use WhatsApp Web instead</a>`);
  }
}
function waMissing(name){
  toast(`No WhatsApp number for ${esc(name)}. Add it in Setup → Suppliers.`);
}

/* an existing open order (Goods inward docket, order quick view) */
function waSendPO(po){
  const p=typeof po==='string'?POS.find(o=>o.po===po):po;if(!p)return toast('That order is no longer open');
  const sup=waSupplier(p.supId,p.sup);if(!sup.whatsapp)return waMissing(p.sup);
  const lines=Object.entries(p.lines).filter(([s])=>bySku[s]).map(([s,q])=>{const x=bySku[s];return {name:x.name,qty:q,unit:x.unit,pack:x.pack,price:(p.prices||{})[s]??x.listPrice}});
  waOpen(sup.whatsapp,waOrderText({ref:p.po,eta:p.eta,lines}),waPrepare());
}

/* raise an order and send it in one click: lines = [{part, quantity, unit_cost?}] in stock units */
async function waRaiseAndSend(supId,supName,lines,btn){
  const sup=waSupplier(supId,supName);if(!sup.whatsapp)return waMissing(supName);
  if(!needLive('purchase'))return;
  const win=waPrepare();if(btn)btn.disabled=true;
  try{
    const r=await api('/plugin/cm/po/',{method:'POST',json:{supplier:supId,lines}});
    if(r.pending){if(win)win.close();toast(`${esc(r.message)}. Send it on WhatsApp from Goods inward once approved.`);await reload();return}
    const text=waOrderText({ref:r.reference,eta:waEta(lines),lines:lines.map(l=>{const x=items.find(i=>i.id===l.part);
      return {name:x.name,qty:+l.quantity,unit:x.unit,pack:x.pack,price:l.unit_cost!=null?+l.unit_cost:x.listPrice}})});
    waOpen(sup.whatsapp,text,win);await reload();
  }catch(e){if(win)win.close();fail(e)}finally{if(btn)btn.disabled=false}
}
const waEta=lines=>{const lead=Math.max(1,...lines.map(l=>(items.find(i=>i.id===l.part)||{}).lead||1));
  return new Date(Date.now()+lead*864e5).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})};

/* Organisation settings panel */
function whatsappPanel(o,dis,can){
  return panel('WhatsApp orders','Orders open in WhatsApp with the items typed out, ready to send to the supplier',`<form id="waF" class="calc" style="display:grid;gap:12px">
   <label>Open orders in<select name="whatsappTarget" ${dis}><option value="app" ${o.whatsappTarget==='app'?'selected':''}>WhatsApp desktop app</option><option value="web" ${o.whatsappTarget==='web'?'selected':''}>WhatsApp Web (browser)</option></select></label>
   <label style="flex-direction:row;display:flex;gap:8px;align-items:center"><input type="checkbox" name="whatsappPrices" ${o.whatsappPrices?'checked':''} ${dis}>Show our expected prices and total in the message</label>
   <p class="muted" style="margin:0">Each supplier's WhatsApp number is set in Setup → Suppliers; their phone number is used when it is a mobile.</p>
   ${can?'<div><button class="btn btn-primary">Save WhatsApp settings</button></div>':''}</form>`);
}

/* Kolkata Kitchen Bento: screen renderers. Each screen uses the card style that
   fits its content. Loaded last; reuses helpers from index.html, erp.js, setup.js
   and cards.js. Every action still goes through the same permission-checked API. */

const hashHue=s=>[...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,7);
const initials=s=>String(s).split(/[\s,&]+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('');
const STATUS_STICKER={out:['melon','Out of stock'],crit:['melon','Below safety'],reorder:['turmeric','Reorder'],onorder:['soft','On order'],ok:['lime','Healthy'],over:['soft','Overstocked']};
const sticker=st=>`<span class="sticker ${STATUS_STICKER[st][0]}">${STATUS_STICKER[st][1]}</span>`;

/* ================= overview: bento tiles + needs-action rail ================= */
const baseOverview=VIEWS.overview;
VIEWS.overview=function(){
  baseOverview();
  const C=items.map(x=>({x,c:calc(x)})),cnt=k=>C.filter(o=>o.c.st===k).length;
  const val=C.reduce((a,o)=>a+o.c.value,0),below=C.filter(o=>['crit','reorder','out'].includes(o.c.st)).length;
  const todayPOs=POS.filter(p=>p.day===0),inbound=todayPOs.reduce((a,p)=>a+Object.keys(p.lines).length,0);
  const expSoon=C.filter(o=>o.c.expiry<=2&&o.x.onHand>0).length;
  const covers=C.map(o=>o.c.cover).filter(c=>c<99).sort((a,b)=>a-b),med=covers.length?covers[Math.floor(covers.length/2)]:0;
  const use=FLOW&&FLOW.out&&FLOW.out.some(v=>v>0)?FLOW.out:null;
  const spark=use?(()=>{const m=Math.max(...use,.01),W=300,H=70;return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="M0 ${H} ${use.map((v,i)=>`L${i*W/(use.length-1)} ${H-4-v/m*(H-10)}`).join(' ')} L${W} ${H}Z"/><path class="line" d="${use.map((v,i)=>`${i?'L':'M'}${i*W/(use.length-1)} ${H-4-v/m*(H-10)}`).join(' ')}" fill="none" stroke-width="3" stroke-linejoin="round"/></svg>`})():'';
  const T=[
    ['hero','Inventory value',inrK(val),`${items.length} items · median ${med.toFixed(1)} days of cover${use?' · usage, last 14 days':''}`,'items',{status:'all'}],
    ['warn','Below reorder point',below,'Need a purchase order','replenish',{}],
    ['bad','Below safety stock',cnt('crit')+cnt('out'),`${cnt('out')} completely out`,'items',{status:'risk'}],
    ['info','Arriving today',inbound,`lines on ${todayPOs.length} order${todayPOs.length===1?'':'s'}`,'inward',{}],
    ['warn','Use within 48 h',expSoon,'Lots near their use-by date','items',{sort:'expiry',status:'all'}],
  ];
  const box=$('#kpis');box.className='tiles';box.style.marginBottom='18px';
  box.innerHTML=T.map(([c,l,v,s],i)=>`<button class="tile ${c}" data-t="${i}"><span class="lbl">${l}</span><span class="val num">${v}</span><span class="sub">${s}</span>${c==='hero'?spark:''}</button>`).join('');
  box.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{const t=T[+b.dataset.t];go(t[4],t[5])});
  const att=C.filter(o=>['out','crit','reorder'].includes(o.c.st)||(o.c.expiry<=1&&o.x.onHand>0)).sort((a,b)=>ST[a.c.st][2]-ST[b.c.st][2]||a.c.cover-b.c.cover);
  const rail=$('#att');rail.className='panel-b';
  const drawAtt=()=>{const pg=paginate('att',att,6,String(att.length));
  rail.innerHTML=(pg.rows.length?`<div class="act-grid">${pg.rows.map(({x,c})=>`<button class="chipcard" data-sku="${x.sku}">${img(x)}<span><b>${esc(x.name)}</b><small>${fq(x.onHand)} ${esc(x.unit)} left · ${coverTxt(c.cover)}</small>${c.expiry<=1&&!['out','crit','reorder'].includes(c.st)?'<span class="sticker melon">Use within 24 h</span>':sticker(c.st)}${c.inc.q?` <span class="sticker soft">+${fq(c.inc.q)} ${esc(x.unit)} coming</span>`:''}</span></button>`).join('')}</div>`:'<p class="muted">Nothing needs action right now.</p>')+pg.html;
  rail.querySelectorAll('[data-sku]').forEach(r=>r.onclick=()=>openItem(r.dataset.sku));wirePager(rail,drawAtt)};drawAtt();
};

/* ================= goods inward: GRNs as receipt stubs ================= */
const docketInward=VIEWS.inward;
VIEWS.inward=function(){
  docketInward();
  const wrap=$('#grns').closest('.tablewrap');wrap.hidden=true;
  let box=$('#stubs');if(!box){box=Object.assign(document.createElement('div'),{id:'stubs'});wrap.after(box)}
  const stampCls={Accepted:'good','Short delivery':'warn','Partly rejected':'bad'};
  const G=GRNS.filter(g=>!S.focus||(S.focus.kind==='supplier'?g.sup===S.focus.key:S.focus.kind==='po'?g.po===S.focus.key:true));
  const drawStubs=()=>{const pg=paginate('grn',G,8,JSON.stringify([G.length,S.focus]));
  box.innerHTML=`<div class="stubs">${pg.rows.map(g=>{const o=g.lines.reduce((a,l)=>a+l[1],0),r=g.lines.reduce((a,l)=>a+l[2],0);
    return `<article class="stub edge edge-${{Accepted:'ok','Short delivery':'warn','Partly rejected':'bad'}[g.qc]||'mute'}">${edgeTip(g.qc)}<h4>${esc(g.grn)}</h4><small>${xl('supplier',g.sup)}</small><small>${dayLabel(g.d)} · against ${xl('po',g.po)}</small>
      <div class="pct num ${r<o?'bad':''}">${o?Math.round(r/o*100):0}% <small>received</small></div>${g.note?`<small>${esc(g.note)}</small>`:''}</article>`}).join('')||'<p class="muted">No goods received yet.</p>'}</div>${pg.html?`<div style="padding:0 18px 16px">${pg.html}</div>`:''}`;wirePager(box,drawStubs)};drawStubs();
};

/* ================= replenishment: supplier baskets ================= */
VIEWS.replenish=function(){
  $$('[data-sl]').forEach(b=>b.setAttribute('aria-pressed',+b.dataset.sl===SL));
  const L=items.map(x=>({x,c:calc(x)})).filter(o=>o.c.sugg>0),groups={};
  L.forEach(o=>(groups[o.x.sup]=groups[o.x.sup]||[]).push(o));
  const out=$('#repl');
  if(!L.length){out.innerHTML='<div class="panel empty"><b>Nothing to reorder</b>Every item is above its reorder point.</div>';return}
  out.innerHTML=`<div class="baskets">${Object.entries(groups).map(([sup,list])=>{const lead=Math.max(...list.map(o=>o.x.lead));
    return `<article class="basket edge edge-${list.some(o=>['out','crit'].includes(o.c.st))?'bad':list.some(o=>o.c.st==='reorder')?'warn':'info'}" data-sup="${esc(sup)}"><div class="basket-h"><span class="mono">${esc(initials(sup))}</span><div><h3>${xl('supplier',sup)}</h3><small>${list.length} item${list.length>1?'s':''} · arrives by ${new Date(TODAY.getTime()+lead*864e5).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})}</small></div></div>
    <ul>${list.sort((a,b)=>ST[a.c.st][2]-ST[b.c.st][2]).map(({x,c})=>`<li data-sku="${x.sku}" data-cost="${x.listPrice??x.cost}" data-pack="${x.pack}"><input type="checkbox" class="check" checked aria-label="Include ${esc(x.name)}">${img(x)}
      <div><b>${xl('item',x.sku,x.name)}</b><small>${fq(x.onHand)} on hand${c.inc.q?`, ${fq(c.inc.q)} on order`:''} · pack ${x.pack} ${esc(x.unit)}</small><div style="margin-top:4px">${sticker(c.st)}</div>
        ${API.can.pricing?`<label class="price-q">₹<input class="price-in" type="number" min="0" step="0.01" value="${x.listPrice??''}" placeholder="price" aria-label="Price per ${esc(x.unit)} for ${esc(x.name)}"><span>/ ${esc(x.unit)}</span></label>`:''}</div>
      <span class="stepper"><button type="button" data-step="-1" aria-label="Fewer">−</button><input class="qty-in" type="number" min="0" step="${x.pack}" value="${c.sugg}" aria-label="Order quantity in ${esc(x.unit)}"><button type="button" data-step="1" aria-label="More">+</button></span></li>`).join('')}</ul>
    <div class="basket-f"><div><span class="total num" data-tot></span><small>Order value</small></div><span class="basket-acts"><button class="btn btn-wa" data-wa title="Records the order and opens WhatsApp to ${esc(sup)} with the items typed out">${WA_ICON}Order on WhatsApp</button><button class="btn btn-primary" data-raise>Raise purchase order</button></span></div></article>`}).join('')}</div>`;
  out.querySelectorAll('.basket').forEach(b=>{
    const upd=()=>{let t=0;b.querySelectorAll('li').forEach(li=>{const on=li.querySelector('.check').checked;li.classList.toggle('off',!on);const pi=li.querySelector('.price-in');if(on)t+=(+li.querySelector('.qty-in').value||0)*(pi&&pi.value!==''?+pi.value:+li.dataset.cost)});b.querySelector('[data-tot]').textContent=inr(t)};
    b.querySelectorAll('input').forEach(i=>i.oninput=upd);
    b.querySelectorAll('[data-step]').forEach(s=>s.onclick=()=>{const li=s.closest('li'),inp=li.querySelector('.qty-in'),p=+li.dataset.pack||1;inp.value=Math.max(0,(+inp.value||0)+p*(+s.dataset.step));upd()});
    b.querySelector('[data-raise]').onclick=async e=>{
      if(!needLive('purchase'))return;
      const lines=[...b.querySelectorAll('li')].filter(li=>li.querySelector('.check').checked).map(li=>{const x=bySku[li.dataset.sku],pi=li.querySelector('.price-in'),l={part:x.id,quantity:li.querySelector('.qty-in').value};
        if(pi&&pi.value!==''&&+pi.value!==x.listPrice)l.unit_cost=pi.value;return l}).filter(l=>+l.quantity>0);
      if(!lines.length)return toast('Tick at least one item with a quantity');
      e.currentTarget.disabled=true;
      try{const r=await api('/plugin/cm/po/',{method:'POST',json:{supplier:bySku[b.querySelector('li').dataset.sku].supId,lines}});toast(r.pending?esc(r.message):`${esc(r.reference)} raised for ${esc(b.dataset.sup)}`);await reload()}catch(err){fail(err);e.currentTarget.disabled=false}};
    b.querySelector('[data-wa]').onclick=e=>{
      const lines=basketLines(b);if(!lines.length)return toast('Tick at least one item with a quantity');
      waRaiseAndSend(bySku[b.querySelector('li').dataset.sku].supId,b.dataset.sup,lines,e.currentTarget)};
    upd()});
};
/* the ticked lines of a reorder basket, with any price typed in */
function basketLines(b){
  return [...b.querySelectorAll('li')].filter(li=>li.querySelector('.check').checked).map(li=>{const x=bySku[li.dataset.sku],pi=li.querySelector('.price-in'),l={part:x.id,quantity:li.querySelector('.qty-in').value};
    if(pi&&pi.value!==''&&+pi.value!==x.listPrice)l.unit_cost=pi.value;return l}).filter(l=>+l.quantity>0);
}

/* ================= movements: activity feed ================= */
const MV={Receipt:['good','M12 4v11m0 0-4-4m4 4 4-4M5 19h14'],'Issue to kitchen':['info','M5 12h11m0 0-4-4m4 4-4 4M19 5v14'],'Issue to beverage':['info','M5 12h11m0 0-4-4m4 4-4 4M19 5v14'],
  Wastage:['bad','M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12'],Transfer:['info','M4 9h13l-3-3M20 15H7l3 3'],Adjustment:['warn','M5 8h14M5 16h14M9 5v6M15 13v6'],
  Sale:['good','M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6'],Prep:['warn','M5 10h14v4a7 7 0 0 1-14 0zM8 3v4M12 3v4M16 3v4'],'Supplier return':['bad','M20 12H7m0 0 4-4m-4 4 4 4M4 5v14']};
VIEWS.moves=function(){
  const types=['All','Receipt','Issue to kitchen','Issue to beverage','Transfer','Wastage','Adjustment','Sale','Prep'];
  // chip counts follow the search and any person / item / order filter, so they match the list below
  const F0=S.focus,q0=S.q.toLowerCase(),scoped=moves.filter(m=>(!q0||`${m.x.name} ${m.x.sku} ${m.ref} ${m.user}`.toLowerCase().includes(q0))&&
    (!F0||(F0.kind==='person'?m.user===F0.key:F0.kind==='item'?m.x.sku===F0.key:F0.kind==='po'?(m.ref||'').includes(F0.key):true)));
  $('#mv-types').innerHTML=types.map(t=>`<button class="chip" data-mv="${t}" aria-pressed="${S.mv===t}">${t}<em>${t==='All'?scoped.length:scoped.filter(m=>m.t===t).length}</em></button>`).join('');
  $$('[data-mv]').forEach(b=>b.onclick=()=>{S.mv=b.dataset.mv;VIEWS.moves()});
  const F=S.focus,q=S.q.toLowerCase(),L=moves.filter(m=>(S.mv==='All'||m.t===S.mv)&&(!q||`${m.x.name} ${m.x.sku} ${m.ref} ${m.user}`.toLowerCase().includes(q))&&
    (!F||(F.kind==='person'?m.user===F.key:F.kind==='item'?m.x.sku===F.key:F.kind==='po'?(m.ref||'').includes(F.key):true)));
  const panelEl=$('#moves').closest('.panel');panelEl.hidden=true;
  let box=$('#feed');if(!box){box=Object.assign(document.createElement('div'),{id:'feed'});panelEl.after(box)}
  const pg=paginate('moves',L,25,JSON.stringify([S.mv,S.q,S.focus])),days=[...new Set(pg.rows.map(m=>m.d))];
  box.innerHTML=days.map(d=>`<section class="feed-day"><h3>${dayLabel(d)}</h3><div class="feed">${pg.rows.filter(m=>m.d===d).map(m=>{const [c,p]=MV[m.t]||MV.Adjustment;
    return `<div class="feed-row" data-sku="${m.x.sku}" tabindex="0"><span class="bubble ${c}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg></span>
      <div><b>${esc(m.x.name)}</b><small>${esc(m.t)} · ${m.time} · ${xl('person',m.user)}${m.ref?` · ${xlCan('po',m.ref)?xl('po',m.ref):esc(m.ref)}`:''}</small></div><span class="qty-pill num ${m.q>0?'in':''}">${m.q>0?'+':'−'}${fq(Math.abs(m.q))} ${esc(m.x.unit)}</span></div>`}).join('')}</div></section>`).join('')||'<div class="panel empty"><b>No movements found</b>Try another type or search.</div>';
  box.insertAdjacentHTML('beforeend',pg.html);wirePager(box,VIEWS.moves);
  box.querySelectorAll('[data-sku]').forEach(r=>{r.onclick=()=>openItem(r.dataset.sku);r.onkeydown=e=>{if(e.key==='Enter')openItem(r.dataset.sku)}});
};

/* ================= menu & recipes: dish, glass and jar cards ================= */
VIEWS.recipes=async function(){
  const body=view('recipes','Menu & recipes','Plate cost and food cost come from today\'s supplier prices. Allergens and Jain status roll up from every ingredient.',
    API.live&&API.can.recipes?'<button class="btn btn-primary" id="newRecipe">+ New recipe</button>':'');
  if($('#newRecipe'))$('#newRecipe').onclick=()=>editRecipe(null);
  const d=await load(body,'/plugin/cm/recipes/');if(!d)return;RECIPES=d;
  const money=API.can.pricing;
  const card=(r,style)=>{const fc=r.foodCostPct,over=fc!=null&&fc>r.target;
    const donut=r.kind==='prep'?`<div class="donut prep" style="--p:100"><span>${r.batchYield}<small>${esc(r.unit)}</small></span></div>`:
      `<div class="donut ${over?'bad':''}" style="--p:${money&&fc!=null?Math.min(fc,100):0}"><span>${money&&fc!=null?fc+'%':'—'}<small>food cost</small></span></div>`;
    return `<button class="dish ${style}${r.jain===true?' jain':''}${r.image?' has-photo':''}" data-rid="${r.id}">${r.image?`<img class="dish-photo" data-auth-src="${esc(r.image)}" alt="">`:''}${r.jain===true?`<span class="info-tip jain-tip" role="img" tabindex="0" data-tip="Jain-friendly: every ingredient is free of root vegetables, onion and garlic" aria-label="Jain-friendly">${INFO_ICON}</span>`:''}
      <div class="dish-top">${donut}<div><h3>${esc(r.name)}</h3><div class="price num">${r.kind==='prep'?(money&&r.cost!=null?`${inr(r.cost)}<small class="muted" style="font-size:13px"> / ${esc(r.unit)}</small>`:'Prep'):inr(r.price)}</div>${money&&r.cost!=null&&r.kind!=='prep'?`<small class="muted">costs ${inr(r.cost)} to plate</small>`:''}</div></div>
      <div class="row">${r.allergens.map(a=>`<span class="sticker soft">${esc(ALLERGEN(a))}</span>`).join('')||'<span class="muted" style="font-size:12.5px">No listed allergens</span>'}</div>
      ${money&&r.missingCosts.length?`<div class="warn">No price yet for ${r.missingCosts.map(esc).join(', ')}</div>`:''}</button>`};
  const one=S.focus&&S.focus.kind==='recipe'?d.recipes.filter(r=>String(r.id)===String(S.focus.key)):null;
  const sec=(t,list,style)=>{if(one)list=list.filter(r=>one.includes(r));if(!list.length)return '';const pg=paginate('rec-'+t,list,9,String(list.length));return `<div class="menu-h"><h2>${t}</h2><span>${list.length}</span></div><div class="menu-grid" style="margin-bottom:0">${pg.rows.map(r=>card(r,style)).join('')}</div>${pg.html}<div style="height:26px"></div>`};
  const draw=()=>{body.innerHTML=sec('Dishes',d.recipes.filter(r=>r.kind==='dish'),'')+sec('Mocktails & coolers',d.recipes.filter(r=>r.kind==='beverage'),'glass')+sec('Preps',d.recipes.filter(r=>r.kind==='prep'),'jar')||'<div class="panel empty"><b>No recipes yet</b>Add the first dish with New recipe.</div>';
  body.querySelectorAll('[data-rid]').forEach(b=>b.onclick=()=>showRecipe(+b.dataset.rid));wirePager(body,draw)};draw();
};
renderRecipes=VIEWS.recipes;

/* ================= prep & wastage: jars + waste donut ================= */
VIEWS.prep=async function(){
  const body=view('prep','Prep & wastage','Make batches from your own area\'s stock. Each jar shows what\'s left against one batch.');
  const [p,w]=await Promise.all([load(body,'/plugin/cm/prep/'),API.live?api(`/plugin/cm/wastage/?days=${WASTE_DAYS}`).catch(()=>null):null]);if(!p)return;
  const money=API.can.pricing;
  const jars=p.preps.map(x=>{const lvl=Math.max(4,Math.min(100,x.onHand/(x.batchYield||1)*100)),soon=x.lots.some(l=>l.exp!=null&&l.exp<=0),next=x.lots.filter(l=>l.exp!=null).sort((a,b)=>a.exp-b.exp)[0];
    return `<article class="jar-card edge edge-${soon?'bad':x.onHand?'ok':'mute'}"><div class="jar ${x.station==='beverage'?'lime':''}" style="--lvl:${x.onHand?lvl:0}">${x.onHand?'<div class="fill"></div>':''}</div>
      <div><h3>${xl('recipe',x.id,x.name)}</h3><div class="big num">${num(x.onHand)} <small style="font-size:14px">${esc(x.unit)}</small></div>
      <span class="timer ${soon?'soon':''}">${next?(next.exp<=0?'Use today':`Use within ${next.exp} day${next.exp>1?'s':''}`):x.onHand?'No use-by':'None made'}</span>
      <p class="muted" style="font-size:12.5px;margin:8px 0">${x.station==='beverage'?'Beverage station':'Kitchen'} · batch ${num(x.batchYield)} ${esc(x.unit)}${money&&x.unitCost!=null?` · ${inr(x.unitCost)}/${esc(x.unit)}`:''}</p>
      ${API.can.prep?`<button class="btn btn-sm btn-primary" data-make="${x.id}">Make batch</button>`:''}</div></article>`});
  let waste='';
  if(w){const cols=['var(--melon)','var(--turmeric)','var(--lime)','var(--night-3)','var(--text-3)','var(--line-2)'];const tot=w.byReason.reduce((a,r)=>a+(r.value||0),0);let acc=0;
    const grad=w.byReason.map((r,i)=>{const s=acc;acc+=tot?(r.value||0)/tot*100:0;return `${cols[i%cols.length]} ${s}% ${acc}%`}).join(',')||'var(--surface-2) 0 100%';
    const maxI=Math.max(...w.byItem.map(r=>r.value||r.qty||0),1);
    waste=`<div class="menu-h" style="margin-top:12px"><h2>Wastage</h2><span class="seg">${[7,30,90].map(d=>`<button data-wd="${d}" aria-pressed="${WASTE_DAYS===d}">${d} days</button>`).join('')}</span></div>
     <div class="waste-grid"><div class="panel"><div class="panel-b"><div class="bigdonut" style="background:conic-gradient(${grad})"><div><b class="num">${money&&w.total!=null?inrK(w.total):w.byItem.length}</b><small class="muted">${money?'thrown away':'items wasted'}</small></div></div>
      <div class="keys">${w.byReason.map((r,i)=>`<span><i style="background:${cols[i%cols.length]}"></i>${esc(r.reason)}${money&&r.value!=null?` · ${inr(r.value)}`:''}</span>`).join('')||'<span class="muted">No wastage recorded</span>'}</div></div></div>
      <div class="panel"><div class="panel-h"><h2>What was wasted</h2><p>${w.byArea.map(a=>esc(a.area)).join(', ')}</p></div><div class="panel-b"><div class="bars">${w.byItem.slice(0,8).map((r,i)=>`<div><span>${xlItemName(r.item)} <small class="muted">${num(r.qty)}</small></span><b class="num" style="text-align:right">${r.value==null?'':inr(r.value)}</b><em><i style="width:${(r.value||r.qty)/maxI*100}%"></i></em></div>`).join('')||'<p class="muted">Nothing wasted in this period.</p>'}</div></div></div></div>`}
  body.innerHTML=`<div class="jars">${jars.join('')||'<div class="panel empty"><b>No preps yet</b>Add one under Menu & recipes.</div>'}</div>`+
    (p.batches.length?`<div class="menu-h" style="margin-top:22px"><h2>Recent batches</h2></div><div class="feed">${p.batches.slice(0,8).map(b=>`<div class="feed-row" style="cursor:default"><span class="bubble warn">${esc(initials(b.name))}</span><div><b>${xl('recipe',b.name)}</b><small>${esc(b.code)} · ${esc(b.at)} · ${xl('person',b.by)}</small></div><span class="qty-pill in num">+${num(b.qty)} ${esc(b.unit)}</span></div>`).join('')}</div>`:'')+waste;
  body.querySelectorAll('[data-make]').forEach(b=>b.onclick=()=>{const x=p.preps.find(q=>q.id===+b.dataset.make);
    formModal(`Make ${esc(x.name)}`,'Ingredients come out of your area, oldest lot first',qtyField('Quantity to make',{unit:x.unit},{value:x.batchYield}),'Make batch',async(f,close)=>{
      const r=await api(`/plugin/cm/prep/${x.id}/make/`,{method:'POST',json:{quantity:f.get('q'),unit:f.get('qUnit')}});close();toast(`${esc(r.code)} made${r.cost!=null?` · ${inr(r.cost)}`:''}`);VIEWS.prep();reload()})});
  body.querySelectorAll('[data-wd]').forEach(b=>b.onclick=()=>{WASTE_DAYS=+b.dataset.wd;VIEWS.prep()});
};

/* ================= suppliers: business cards ================= */
VIEWS.suppliers=async function(){
  const body=view('suppliers','Suppliers','How each supplier delivers: on time, in full, and in good condition. Price moves of 5% or more are flagged.',
    API.live&&API.can.stock?'<button class="btn btn-primary" id="newReturn">Return to supplier</button>':'');
  const d=await load(body,'/plugin/cm/suppliers/');if(!d)return;
  const ring=(v,label,good)=>`<div><div class="ring ${v==null?'none':good(v)?'':'bad'}" style="--p:${v??0}"><b>${v==null?'—':v+'%'}</b></div><small>${label}</small></div>`;
  const SUPS=focusIs('supplier')?d.suppliers.filter(s=>s.name===S.focus.key):d.suppliers,RETS=focusIs('supplier')?d.returns.filter(r=>r.supplier===S.focus.key):d.returns;
  const draw=()=>{const pg=paginate('sup',SUPS,9,JSON.stringify([SUPS.length,S.focus]));
  body.innerHTML=`<div class="bizcards">${pg.rows.map(s=>{const miss=[s.onTimePct!=null&&s.onTimePct<90,s.fillPct!=null&&s.fillPct<95,s.rejectPct!=null&&100-s.rejectPct*10<80].filter(Boolean).length;
    return `<article class="biz edge edge-${miss>=2?'bad':miss===1?'warn':'ok'}"><div class="biz-h">${s.image?`<img class="mono photo" data-auth-src="${esc(s.image)}" alt="">`:`<span class="mono">${esc(initials(s.name))}</span>`}<div><h3>${esc(s.name)}</h3><small>${s.items.length} item${s.items.length===1?'':'s'} · ${s.openOrders} open order${s.openOrders===1?'':'s'} · ${s.receipts} deliver${s.receipts===1?'y':'ies'}</small></div></div>
    <div class="rings">${ring(s.onTimePct,'On time',v=>v>=90)}${ring(s.fillPct,'In full',v=>v>=95)}${ring(s.rejectPct==null?null:Math.max(0,100-s.rejectPct*10),'Quality',v=>v>=80)}</div>
    ${s.priceAlerts.length?`<div class="row" style="display:flex;flex-wrap:wrap;gap:6px">${s.priceAlerts.map(a=>`<span class="sticker ${a.change>0?'melon':'lime'}">${xlItemName(a.name)} ${a.change>0?'+':''}${a.change}%</span>`).join('')}</div>`:''}
    <button type="button" class="btn btn-sm btn-line biz-pl" data-pl="${esc(s.name)}">Price list (${s.items.length})</button></article>`}).join('')}</div>${pg.html}`+
    (RETS.length?`<div class="menu-h" style="margin-top:22px"><h2>Returns</h2></div><div class="feed">${RETS.map(r=>`<div class="feed-row" style="cursor:default"><span class="bubble bad">${esc(initials(r.supplier))}</span><div><b>${xlItemName(r.item)} · ${num(r.qty)} ${esc(r.unit)}</b><small>${esc(r.ref)} · ${xl('supplier',r.supplier)} · ${esc(r.reason)} · ${esc(r.at)}</small></div><span class="qty-pill num">${inr(r.value)}</span></div>`).join('')}</div>`:'');wirePager(body,draw);
  body.querySelectorAll('[data-pl]').forEach(b=>b.onclick=()=>{const s=d.suppliers.find(x=>x.name===b.dataset.pl);if(!s)return;
    peek(esc(s.name),['Price list',`${s.items.length} item${s.items.length===1?'':'s'}${s.priceAlerts.length?` · ${s.priceAlerts.length} price move${s.priceAlerts.length===1?'':'s'} of 5% or more`:''}`],
      peekSec('Current prices',peekRows(s.items.map(i=>`<div>${xlItemName(i.name)}<span class="num">${i.price==null?'—':inr(i.price)}/${esc(i.unit)}</span></div>`))),
      [['Open supplier details',()=>peekSupplier(s.name)]])})};draw();
  if($('#newReturn'))$('#newReturn').onclick=()=>formModal('Return to supplier','From your areas, oldest lot first',`
    <label>Item<select name="item">${items.map(x=>`<option value="${x.id}">${esc(x.name)} · ${esc(x.sup)}</option>`).join('')}</select></label>
    <label>Quantity<input name="q" type="number" min="0" step="any" required></label><label>Reason<input name="r" required maxlength="200" placeholder="e.g. Found mouldy when opened"></label>`,'Send back',async(f,close)=>{
    const x=items.find(i=>i.id===+f.get('item'));
    const r=await api('/plugin/cm/supplier-return/',{method:'POST',json:{part:x.id,supplier:x.supId,quantity:f.get('q'),reason:f.get('r')}});close();toast(`${esc(r.reference)} recorded`);VIEWS.suppliers();reload()});
};

/* ================= sales: Z-report receipts + leaderboard ================= */
VIEWS.sales=async function(){
  const body=view('sales','Sales','Each import is one Z-report from the POS. Portions sold take their recipe\'s ingredients out of stock.',
    API.live&&API.can.salesAdd?'<button class="btn btn-primary" id="importSales">Import sales</button>':'');
  const d=await load(body,'/plugin/cm/sales/');if(!d)return;
  if($('#importSales'))$('#importSales').onclick=()=>importSales(d);
  const max=Math.max(...d.top.map(t=>t.revenue),1);
  const draw=()=>{const pg=paginate('sales',d.batches,9,String(d.batches.length));
  body.innerHTML=`<div class="waste-grid" style="grid-template-columns:minmax(0,1fr) minmax(0,340px)"><div><div class="zreports">${pg.rows.map(b=>{const v=b.source.startsWith('void:');
    return `<article class="zr edge edge-${v?'mute':b.shortfalls.length?'warn':'ok'} ${v?'void':''}">${v?edgeTip('Void'):b.shortfalls.length?edgeTip('Check stock: an ingredient ran short'):''}
      <small class="muted">${esc(b.date)} · ${esc(b.source.replace(/^void:/,''))}</small><b style="font-size:15px">${esc(b.reference)}</b><div class="amt num">${inr(b.revenue)}</div>
      <dl><dt>Portions</dt><dd class="num">${num(b.items)}</dd><dt>Guests</dt><dd class="num">${num(b.covers)}</dd>${API.can.pricing?`<dt>Recipe cost</dt><dd class="num">${inr(b.cost)}</dd>`:''}</dl>
      ${b.shortfalls.length?`<div style="display:flex;flex-wrap:wrap;gap:5px">${b.shortfalls.map(s=>`<span class="sticker soft">${xlItemName(s.item)} short ${num(s.qty)} ${esc(s.unit)}</span>`).join('')}</div>`:''}
      ${!v&&API.can.salesVoid?`<button class="btn btn-sm btn-line" data-void="${b.id}" style="justify-self:start;color:var(--red)">Void</button>`:''}</article>`}).join('')||'<div class="panel empty"><b>No sales imported yet</b>Import the first Z-report.</div>'}</div>${pg.html}</div>
    <div class="panel"><div class="panel-h"><h2>Top sellers</h2><p>By revenue</p></div><div class="panel-b"><div class="leader">${d.top.map((t,i)=>`<div><span class="rank">${i+1}</span><span><b>${xl('recipe',t.item)}</b> <small class="muted">${num(t.qty)} sold</small></span><b class="num">${inr(t.revenue)}</b><em><i style="width:${t.revenue/max*100}%"></i></em></div>`).join('')||'<p class="muted">No sales yet.</p>'}</div></div></div></div>`;
  body.querySelectorAll('[data-void]').forEach(btnEl=>btnEl.onclick=()=>{const b=d.batches.find(x=>x.id===+btnEl.dataset.void);
    formModal(`Void ${esc(b.reference)}?`,'Puts every ingredient this import took back into stock and removes its revenue',`<label>Reason<input name="r" required maxlength="200"></label>`,'Void import',async(f,close)=>{
      await api(`/plugin/cm/sales/${b.id}/void/`,{method:'POST',json:{reason:f.get('r')}});close();toast('Import voided');VIEWS.sales();reload()})});wirePager(body,draw)};draw();
};
renderSales=VIEWS.sales;

/* ================= owner report: saturated bento tiles ================= */
const baseReports=VIEWS.reports;
VIEWS.reports=async function(){
  await baseReports();
  const box=$('#v-reports .kpis');if(!box)return;
  box.className='tiles';
  // meaning per tile: sales (lead), food cost, actual usage, margin, guests, average bill, spend, waste, stock value
  const meaning=['hero',null,'warn','good','info','info','warn','bad','info'];
  box.querySelectorAll('.kpi').forEach((k,i)=>{const over=k.style.getPropertyValue('--k').includes('melon');
    k.classList.remove('kpi');k.classList.add('tile',meaning[i]||(over?'bad':'good'));k.style.removeProperty('--k')});
};

/* ================= setup: drag-and-drop import ================= */
const baseSetup=VIEWS.setup;
VIEWS.setup=async function(){
  await baseSetup();
  $$('#v-setup .panel').forEach((pnl,i)=>pageDom(pnl.querySelector('tbody'),'tr','setup-'+i,8));
  const f=$('#impFile');if(!f)return;
  const zone=document.createElement('label');zone.className='dropzone';zone.innerHTML='<b>Drop your spreadsheet here</b><span class="muted">or click to choose a CSV file. You\'ll see a preview before anything is saved.</span>';
  f.before(zone);zone.appendChild(f);f.style.display='none';
  zone.ondragover=e=>{e.preventDefault();zone.classList.add('over')};zone.ondragleave=()=>zone.classList.remove('over');
  zone.ondrop=async e=>{e.preventDefault();zone.classList.remove('over');const file=e.dataTransfer.files[0];if(!file)return;if(file.size>2e6)return toast('File is too large');previewImport(await file.text())};
};

/* ================= sign-in card ================= */
const baseLogin=showLogin;
showLogin=function(msg){baseLogin(msg);const f=$('#mform');if(f&&f.querySelector('[name=u]'))f.insertAdjacentHTML('afterbegin','<div class="signin-brand"><img src="brand/mark-light.png" alt=""><b>Chef &amp; Mixologist</b><span>Resto &amp; Cafe · stores, kitchen and bar</span></div>')};

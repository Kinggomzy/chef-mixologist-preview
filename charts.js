/* Chef & Mixologist: interactive charts.
   Hover any day or week for its numbers, click one to pin it and see what sits behind it,
   switch the range, and switch a series off from its legend key. */

const CK={specs:{},sel:{}};

/* transparent hit areas drawn on top of a chart, one per day or week */
function ckLayer(id,n,slotX,slotW,H,top=4){
  let s=`<g class="ck-hits" data-ck="${id}">`;
  for(let i=0;i<n;i++)s+=`<rect class="ck-hit${CK.sel[id]===i?' sel':''}" data-i="${i}" x="${slotX(i)}" y="${top}" width="${slotW}" height="${H-top-20}" tabindex="0" role="button"/>`;
  return s+'</g>';
}

let ckTipEl=null;
function ckTip(html,e){
  if(!ckTipEl){ckTipEl=document.createElement('div');ckTipEl.id='ckTip';ckTipEl.setAttribute('role','tooltip');document.body.append(ckTipEl)}
  if(html==null){ckTipEl.classList.remove('on');return}
  ckTipEl.innerHTML=html;ckTipEl.classList.add('on');
  const w=ckTipEl.offsetWidth,h=ckTipEl.offsetHeight;
  let x=e.clientX+14,y=e.clientY-h-12;
  if(x+w>innerWidth-8)x=e.clientX-w-14;
  if(y<8)y=e.clientY+18;
  ckTipEl.style.left=Math.max(8,x)+'px';ckTipEl.style.top=y+'px';
}
function ckHit(e){const r=e.target.closest&&e.target.closest('.ck-hit');return r?{r,id:r.parentNode.dataset.ck,i:+r.dataset.i}:null}
document.addEventListener('mousemove',e=>{const h=ckHit(e);if(!h)return ckTip(null);const sp=CK.specs[h.id];if(sp)ckTip(sp.tip(h.i),e)});
document.addEventListener('mouseout',e=>{if(ckHit(e))ckTip(null)});
document.addEventListener('focusin',e=>{const h=ckHit(e);if(!h)return;const sp=CK.specs[h.id];const b=h.r.getBoundingClientRect();if(sp)ckTip(sp.tip(h.i),{clientX:b.left+b.width/2,clientY:b.top+b.height/3})});
document.addEventListener('focusout',e=>{if(ckHit(e))ckTip(null)});
document.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const h=ckHit(e);if(h){e.preventDefault();h.r.dispatchEvent(new MouseEvent('click',{bubbles:true}))}}});
document.addEventListener('click',e=>{
  const h=ckHit(e);if(!h)return;const sp=CK.specs[h.id];
  if(!sp||!sp.pick)return;
  CK.sel[h.id]=CK.sel[h.id]===h.i?null:h.i;ckTip(null);sp.pick(CK.sel[h.id]);
});

/* a legend key that switches one series on or off */
const ckKey=(id,key,label,color,on)=>`<button type="button" class="ck-key" style="--c:${color}" data-ckkey="${id}:${key}" aria-pressed="${on}"><i></i>${label}</button>`;

/* ---------- Overview: receipts vs usage, by day ---------- */
const FLOWUI={range:14,hide:{rec:false,use:false}};
const kfmt=v=>'₹'+(v<10?v.toFixed(1):Math.round(v))+'k';

function drawFlow(){
  const el=$('#flow');if(!el||!FLOWD)return;
  const n=FLOWUI.range,off=14-n,R=FLOWD.rec.slice(off),U=FLOWD.use.slice(off);
  const showR=!FLOWUI.hide.rec,showU=!FLOWUI.hide.use;
  const top=Math.max(...(showR?R:[]),...(showU?U:[]),1),step=top>40?Math.ceil(top/30)*10:top>8?10:top>2?2:0.5;
  const W=560,H=200,pl=34,pb=24,mx=step*3,slot=(W-pl-10)/(n-1),x=i=>pl+i*slot,y=v=>H-pb-(v/mx)*(H-pb-10),bw=n<=7?26:14;
  const dayOf=i=>new Date(TODAY-(n-1-i)*864e5);
  const lab=i=>dayOf(i).toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
  const sel=CK.sel.flow;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receipts and usage, last ${n} days">`;
  [0,step,step*2,step*3].forEach(v=>s+=`<line x1="${pl}" x2="${W}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${pl-8}" y="${y(v)+4}" text-anchor="end" font-size="11" style="fill:var(--text-3)">${v}</text>`);
  if(showR)R.forEach((v,i)=>s+=`<rect x="${x(i)-bw/2}" y="${y(v)}" width="${bw}" height="${y(0)-y(v)}" rx="3" style="fill:var(--night-3)" opacity="${sel==null||sel===i?.9:.35}"/>`);
  if(showU){s+=`<path d="${U.map((v,i)=>(i?'L':'M')+x(i)+' '+y(v)).join(' ')}" fill="none" style="stroke:var(--turmeric-ink)" stroke-width="2.5" stroke-linejoin="round"/>`;
    U.forEach((v,i)=>s+=`<circle cx="${x(i)}" cy="${y(v)}" r="${sel===i?5:3}" fill="#fff" style="stroke:var(--turmeric-ink)" stroke-width="2"/>`)}
  [...new Set([0,Math.floor((n-1)/2),n-1])].forEach(i=>s+=`<text x="${x(i)}" y="${H-6}" text-anchor="middle" font-size="11" style="fill:var(--text-3)">${dayOf(i).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</text>`);
  CK.specs.flow={
    tip:i=>`<b>${lab(i)}</b><br>${showR?`Received ${kfmt(R[i])}<br>`:''}${showU?`Consumed ${kfmt(U[i])}`:''}`,
    pick:()=>drawFlow()};
  s+=ckLayer('flow',n,i=>x(i)-slot/2,slot,H,4)+'</svg>';
  const sum=a=>a.reduce((p,v)=>p+v,0);
  const detail=sel==null?'<p class="muted" style="font-size:12.5px;margin:8px 0 0">Click a day to pin it and see what moved.</p>'
    :`<div class="ck-detail"><b>${lab(sel)}</b><span>Received ${kfmt(R[sel])}</span><span>Consumed ${kfmt(U[sel])}</span><span>Net ${R[sel]-U[sel]>=0?'+':'−'}${kfmt(Math.abs(R[sel]-U[sel]))}</span>
       <button type="button" class="btn btn-sm btn-line" data-flow-open>See that day's movements</button></div>`;
  el.innerHTML=`<div class="ck-bar"><span class="seg">${[7,14].map(d=>`<button type="button" data-flow-range="${d}" aria-pressed="${n===d}">${d} days</button>`).join('')}</span>
      ${ckKey('flow','rec','Goods received','var(--night-3)',showR)}${ckKey('flow','use','Consumed','var(--turmeric-ink)',showU)}</div>
    <p class="ck-sum">${showR?`Received <b>${kfmt(sum(R))}</b>`:''}${showR&&showU?' · ':''}${showU?`Consumed <b>${kfmt(sum(U))}</b>`:''} over ${n} days</p>`+s+detail;
  el.querySelectorAll('[data-flow-range]').forEach(b=>b.onclick=()=>{FLOWUI.range=+b.dataset.flowRange;CK.sel.flow=null;drawFlow()});
  el.querySelectorAll('[data-ckkey="flow:rec"]').forEach(b=>b.onclick=()=>{FLOWUI.hide.rec=!FLOWUI.hide.rec;if(FLOWUI.hide.rec&&FLOWUI.hide.use)FLOWUI.hide.use=false;drawFlow()});
  el.querySelectorAll('[data-ckkey="flow:use"]').forEach(b=>b.onclick=()=>{FLOWUI.hide.use=!FLOWUI.hide.use;if(FLOWUI.hide.rec&&FLOWUI.hide.use)FLOWUI.hide.rec=false;drawFlow()});
  const open=el.querySelector('[data-flow-open]');
  if(open)open.onclick=()=>focusOn('moves','day',n-1-sel,lab(sel));
}

/* ---------- Reports: sales vs ingredient spend, by week ---------- */
const WEEKUI={hide:{sales:false,spend:false}};
function drawWeeks(){
  const el=$('#weeksChart'),r=REPORTD;if(!el||!r)return;
  const wk=r.weeks,showS=!WEEKUI.hide.sales,showP=!WEEKUI.hide.spend;
  const max=Math.max(...wk.map(w=>Math.max(showS?w.sales:0,showP?w.spend:0)),1),W=560,H=200,bw=30,slot=(W-60)/Math.max(wk.length,1);
  const x=i=>40+i*slot,y=v=>H-24-(v/max)*(H-40),sel=CK.sel.weeks;
  let s=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly sales and ingredient spend">`;
  wk.forEach((w,i)=>{const o=sel==null||sel===i?1:.35;
    if(showS)s+=`<rect x="${x(i)}" y="${y(w.sales)}" width="${bw}" height="${H-24-y(w.sales)}" rx="5" style="fill:var(--night)" opacity="${o}"/>`;
    if(showP)s+=`<rect x="${x(i)+(showS?bw+4:0)}" y="${y(w.spend)}" width="${bw}" height="${H-24-y(w.spend)}" rx="5" style="fill:var(--turmeric)" opacity="${o}"/>`;
    s+=`<text x="${x(i)+bw}" y="${H-6}" text-anchor="middle" font-size="11" style="fill:var(--text-3)">${esc(w.label)}</text>`});
  CK.specs.weeks={
    tip:i=>`<b>Week of ${esc(wk[i].label)}</b><br>${showS?`Sales ${inr(wk[i].sales)}<br>`:''}${showP?`Ingredient spend ${inr(wk[i].spend)}`:''}`,
    pick:()=>drawWeeks()};
  s+=ckLayer('weeks',wk.length,i=>x(i)-slot/2+bw,slot,H,4)+'</svg>';
  const w=sel==null?null:wk[sel];
  const detail=w?`<div class="ck-detail"><b>Week of ${esc(w.label)}</b><span>Sales ${inr(w.sales)}</span><span>Spend ${inr(w.spend)}</span><span>${w.sales?`Spend was ${Math.round(w.spend/w.sales*100)}% of sales`:'No sales this week'}</span></div>`
    :'<p class="muted" style="font-size:12.5px;margin:8px 0 0">Click a week to pin it.</p>';
  el.innerHTML=`<div class="ck-bar">${ckKey('weeks','sales','Sales','var(--night)',showS)}${ckKey('weeks','spend','Ingredient spend','var(--turmeric)',showP)}</div>`+s+detail;
  el.querySelectorAll('[data-ckkey="weeks:sales"]').forEach(b=>b.onclick=()=>{WEEKUI.hide.sales=!WEEKUI.hide.sales;if(WEEKUI.hide.sales&&WEEKUI.hide.spend)WEEKUI.hide.spend=false;drawWeeks()});
  el.querySelectorAll('[data-ckkey="weeks:spend"]').forEach(b=>b.onclick=()=>{WEEKUI.hide.spend=!WEEKUI.hide.spend;if(WEEKUI.hide.sales&&WEEKUI.hide.spend)WEEKUI.hide.sales=false;drawWeeks()});
}

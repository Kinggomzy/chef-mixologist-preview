/* Pagination for long lists, plus the raw-materials stock card.
   Loaded after cards.js and before screens.js. */

/* ---------- pagination ---------- */
const PAGES={};
// Slice `list` for page state `key`. The page resets to 1 when `sig` (the filters) changes.
function paginate(key,list,size,sig=''){
  const st=PAGES[key]||(PAGES[key]={p:1,sig});
  if(st.sig!==sig){st.p=1;st.sig=sig}
  const pages=Math.max(1,Math.ceil(list.length/size));
  st.p=Math.min(Math.max(1,st.p),pages);
  const from=(st.p-1)*size;
  return {rows:list.slice(from,from+size),offset:from,html:pages>1?pagerHtml(key,st.p,pages,list.length,from,size):''};
}
function pagerHtml(key,p,pages,total,from,size){
  const nums=[...new Set([1,p-1,p,p+1,pages])].filter(n=>n>=1&&n<=pages).sort((a,b)=>a-b);
  let prev=0,btns='';
  nums.forEach(n=>{if(n-prev>1)btns+='<span class="pg-gap">…</span>';btns+=`<button type="button" data-pg="${key}:${n}" ${n===p?'aria-current="page"':''} aria-label="Page ${n}">${n}</button>`;prev=n});
  return `<nav class="pager" aria-label="Pages"><span class="pg-info num">${from+1}–${Math.min(from+size,total)} of ${total}</span>
    <button type="button" data-pg="${key}:${p-1}" ${p===1?'disabled':''} aria-label="Previous page">‹</button>${btns}<button type="button" data-pg="${key}:${p+1}" ${p===pages?'disabled':''} aria-label="Next page">›</button></nav>`;
}
// Wire pager buttons inside `root`; `rerender` redraws the list for the new page.
function wirePager(root,rerender){
  root.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{
    const [k,n]=b.dataset.pg.split(':');PAGES[k].p=+n;rerender();
    const top=root.getBoundingClientRect().top;if(top<0)window.scrollBy({top:top-90,behavior:'smooth'});
  });
}
// For lists already rendered as DOM rows (setup tables): show one page, hide the rest.
function pageDom(container,rowSel,key,size){
  if(!container)return;
  const rows=[...container.querySelectorAll(rowSel)];
  const anchor=container.closest('table')||container;  // the pager sits after the table, never inside it
  const old=anchor.parentElement.querySelector(`.pager[data-for="${key}"]`);if(old)old.remove();
  if(rows.length<=size)return;
  const draw=()=>{const pg=paginate(key,rows,size,String(rows.length));rows.forEach((r,i)=>r.hidden=i<pg.offset||i>=pg.offset+size);
    const ex=anchor.parentElement.querySelector(`.pager[data-for="${key}"]`);if(ex)ex.remove();
    anchor.insertAdjacentHTML('afterend',pg.html.replace('<nav class="pager"',`<nav class="pager" data-for="${key}"`));
    wirePager(anchor.parentElement.querySelector(`.pager[data-for="${key}"]`),draw)};
  draw();
}

/* ---------- raw materials: stock cards ---------- */
const RING_TONE={out:'bad',crit:'bad',reorder:'warn',onorder:'info',ok:'',over:'info'};
const STICK={out:['melon','Out of stock'],crit:['melon','Below safety'],reorder:['turmeric','Reorder'],onorder:['soft','On order'],ok:['lime','Healthy'],over:['soft','Overstocked']};
function coverShort(c){return c>=99?'—':c<1?`${Math.round(c*24)}h`:`${c.toFixed(c<10?1:0)}d`}
function stockCard(x,c,n){
  const lots=x.lots.length,pct=c.max?Math.min(100,x.onHand/c.max*100):0;
  const foot=c.inc.q?['info',`+${fq(c.inc.q)} ${esc(x.unit)} arriving ${esc(c.inc.po.eta)}`]
    :c.sugg?['warn',`Order ${fq(c.sugg)} ${esc(x.unit)}${API.can.pricing!==false?`, ${inr(c.sugg*x.cost)}`:''}`]
    :['',API.live?(x.lastRecv==null?'Not received yet':x.lastRecv===0?'Received today':`Last received ${x.lastRecv} day${x.lastRecv>1?'s':''} ago`):'Stock is healthy'];
  const tip=[x.name,`${x.sku} · ${x.loc}`,x.cat,x.sup?`Supplier: ${x.sup}`:'',`${fq(x.onHand)} ${x.unit} on hand · ${STICK[c.st][1]}`].filter(Boolean).join('\n');
  return `<article class="sc sc-st-${c.st}" tabindex="0" data-sku="${x.sku}" style="--i:${Math.min(n,14)}" title="${esc(tip)}" aria-label="${esc(x.name)}, ${STICK[c.st][1]}">
    <div class="sc-h">${x.img?img(x,'sc-img'):'<div class="noimg sc-img" title="No photo yet"></div>'}<div class="sc-t"><h3>${esc(x.name)}</h3></div><span class="info-tip sc-tip" role="img" tabindex="0" data-tip="${esc(STICK[c.st][1])}" aria-label="${esc(STICK[c.st][1])}">${INFO_ICON}</span></div>
    <small class="sc-code">${esc(x.sku)} · ${xl('location',x.loc)}</small>
    <div class="sc-m"><div><b class="num">${fq(x.onHand)}</b><span>${esc(x.unit)}</span><small>on hand${lots>1?` in ${lots} lots`:''}</small></div>
      <div class="sc-ring ring ${RING_TONE[c.st]}" style="--p:${pct}" title="${Math.round(pct)}% of max level"><b>${coverShort(c.cover)}</b></div></div>
    ${gauge(x,c)}
    <div class="sc-k num"><span>Safety <b>${fq(c.ss)}</b></span><span>Reorder <b>${fq(c.rop)}</b></span><span>Max <b>${fq(c.max)}</b></span></div>
    <div class="sc-f ${foot[0]}">${foot[1]}</div></article>`;
}
const baseRenderItems=renderItems;
renderItems=function(){
  baseRenderItems();
  const L=filtered();if(!L.length)return;
  const out=$('#items-out'),cards=S.layout==='cards';
  const pg=paginate('items',L,cards?12:20,JSON.stringify([S.cat,S.status,S.loc,S.sort,S.q,S.layout,S.tsort,S.tdir]));
  if(cards){
    out.innerHTML=`<div class="stock-cards${DEALT?'':' deal'}">${pg.rows.map(({x,c},i)=>stockCard(x,c,i)).join('')}</div>${pg.html}`;DEALT=true;
    out.querySelectorAll('.sc').forEach(el=>{el.onclick=()=>openItem(el.dataset.sku);el.onkeydown=e=>{if(e.key==='Enter')openItem(el.dataset.sku)}});
  }else{
    const keep=new Set(pg.rows.map(({x})=>x.sku));
    out.querySelectorAll('tr.click').forEach(tr=>{if(!keep.has(tr.dataset.sku))tr.remove()});
    out.insertAdjacentHTML('beforeend',pg.html);
  }
  wirePager(out,renderItems);
};
VIEWS.items=renderItems;

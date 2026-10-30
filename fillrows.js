/* Chef & Mixologist: no empty cells at the end of a card grid.
   When the last row is short, its cards grow to share the whole row. */
(function(){
  const SEL='.reqs,.takes,.mcloses,.dockets,.jars,.menu-grid,.zreports,.bizcards,.stubs,.stock-cards,.people,.act-grid,.stock-grid';
  function fill(g){
    const kids=[...g.children].filter(k=>k.nodeType===1&&getComputedStyle(k).display!=='none');
    kids.forEach(k=>{if(k.dataset.fr){k.style.gridColumn='';delete k.dataset.fr}});
    const cols=getComputedStyle(g).gridTemplateColumns.split(' ').filter(x=>x&&x!=='none').length;
    if(cols<2||!kids.length)return;
    const r=kids.length%cols;if(!r)return;
    const base=Math.floor(cols/r),extra=cols%r;
    kids.slice(-r).forEach((k,i)=>{k.style.gridColumn='span '+(base+(i<extra?1:0));k.dataset.fr='1'});
  }
  function run(){document.querySelectorAll(SEL).forEach(g=>{if(g.offsetParent)fill(g)})}
  let t=0;const sched=()=>{clearTimeout(t);t=setTimeout(run,40)};
  new MutationObserver(sched).observe(document.querySelector('.page')||document.body,{childList:true,subtree:true});
  addEventListener('resize',sched);
  sched();
})();

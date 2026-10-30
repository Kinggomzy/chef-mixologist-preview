/* Chef & Mixologist: on phones and small tablets the top bar controls (search, Reorder, Receive goods)
   share one row with the page heading and its action button. The bar is parked back in its
   normal place before a page redraws, then moved into the new page heading. */
(function(){
  const mq=matchMedia('(max-width:860px)'),phone=matchMedia('(max-width:600px)'),bar=document.querySelector('.topbar'),side=document.querySelector('#side'),srch=bar&&bar.querySelector('.search');
  if(!bar)return;
  const home=bar.parentNode,next=bar.nextSibling;
  const park=()=>{if(srch&&srch.parentNode!==bar)bar.insertBefore(srch,bar.firstChild);if(bar.parentNode!==home)home.insertBefore(bar,next)};
  // (the heading's own action buttons are wrapped into .head-acts so the bar can sit beside them)
  // the search box filters Raw materials and Stock movements only, so its button shows on those pages
  const SEARCHABLE=['items','moves','inward'];
  const syncSearch=()=>{if(!srch)return;const v=document.querySelector('.view.on'),id=v?v.id.replace(/^v-/,''):'';srch.style.display=mq.matches&&!SEARCHABLE.includes(id)?'none':''};
  const place=()=>{
    syncSearch();
    iconifyRows();
    if(!mq.matches){park();iconify();return}
    if(phone.matches&&side){   // phones: Reorder and Receive live in the menu drawer; the search button stays in the heading row
      iconify();
      const head=document.querySelector('.view.on > .page-head');
      if(bar.parentNode===side&&(!head||head.contains(srch)))return;
      park();side.insertBefore(bar,side.querySelector('.menu-q'));
      if(head&&srch){
        let acts=head.querySelector(':scope > .head-acts');
        if(!acts){acts=document.createElement('div');acts.className='head-acts';[...head.children].slice(1).forEach(c=>acts.append(c));head.append(acts)}
        acts.insertBefore(srch,acts.firstChild)}
      return}
    const head=document.querySelector('.view.on > .page-head');if(!head){park();return}
    iconify();
    if(head.contains(bar))return;
    park();
    let acts=head.querySelector(':scope > .head-acts');
    if(!acts){acts=document.createElement('div');acts.className='head-acts';[...head.children].slice(1).forEach(c=>acts.append(c));head.append(acts)}
    acts.append(bar);
  };
  /* with the hamburger menu, the heading's own buttons shrink to icons: + for add, import, return, export */
  const ICO={
    add:'<path d="M12 5v14M5 12h14"/>',
    import:'<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14"/>',
    export:'<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 19h14"/>',
    ret:'<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>'};
  const kind=t=>/import|upload/i.test(t)?'import':/return/i.test(t)?'ret':/export|download/i.test(t)?'export':/^[+\s]*(new|add|start|invite|raise|record|create|request)/i.test(t)||/^\+/.test(t)?'add':null;
  function iconify(){
    document.querySelectorAll('.page-head .btn:not(.topbar .btn)').forEach(b=>{
      if(b.closest('.topbar'))return;
      if(!mq.matches){if(b.dataset.full){b.innerHTML=b.dataset.full;delete b.dataset.full;b.classList.remove('btn-ico');b.removeAttribute('aria-label');b.removeAttribute('title')}return}
      if(b.dataset.full)return;
      const t=b.textContent.trim().replace(/\s+/g,' '),k=kind(t);if(!k)return;
      b.dataset.full=b.innerHTML;b.classList.add('btn-ico');b.setAttribute('aria-label',t.replace(/^\+\s*/,''));b.title=t.replace(/^\+\s*/,'');
      b.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ICO[k]+'</svg>';
    });
  }
  /* row actions (Edit, Archive, Delete...) become small icons next to each record */
  const ROW={
    edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    archive:'<path d="M4 7h16v3H4zM6 10v9h12v-9M10 14h4"/>',
    unarchive:'<path d="M4 7h16v3H4zM6 10v9h12v-9M12 17v-5M9.5 14.5 12 12l2.5 2.5"/>',
    delete:'<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>',
    remove:'<path d="M6 6l12 12M18 6 6 18"/>'};
  const rowKind=t=>{t=t.toLowerCase();return t==='restore'?'unarchive':t==='rename'?'edit':ROW[t]?t:null};
  function iconifyRows(){
    document.querySelectorAll('.page .btn').forEach(b=>{
      if(b.closest('.page-head,.topbar'))return;
      if(!mq.matches){if(b.dataset.rfull){b.innerHTML=b.dataset.rfull;delete b.dataset.rfull;b.classList.remove('btn-row-ico');b.removeAttribute('aria-label');b.removeAttribute('title')}return}
      if(b.dataset.rfull)return;
      const t=b.textContent.trim(),k=rowKind(t);if(!k)return;
      b.dataset.rfull=b.innerHTML;b.classList.add('btn-row-ico');if(k==='delete')b.classList.add('is-delete');b.setAttribute('aria-label',t);b.title=t;
      b.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+ROW[k]+'</svg>';
    });
  }
  const baseView=view;
  view=function(...a){park();const b=baseView(...a);place();return b};
  const baseGo2=go;
  /* every page opens at its top, even when the menu was open (its scroll lock can swallow the first scroll) or the page fills in after loading */
  const toTop=()=>{window.scrollTo(0,0);if(document.scrollingElement)document.scrollingElement.scrollTop=0;document.body.scrollTop=0};
  let userScrolled=false;['wheel','touchmove','keydown'].forEach(ev=>addEventListener(ev,()=>{userScrolled=true},{passive:true}));
  go=function(...a){park();const r=baseGo2.apply(this,a);place();userScrolled=false;toTop();requestAnimationFrame(toTop);[120,400,900].forEach(ms=>setTimeout(()=>{if(!userScrolled)toTop()},ms));return r};
  mq.addEventListener('change',place);phone.addEventListener('change',place);
  bar.addEventListener('click',e=>{if(bar.parentNode===side&&e.target.closest('.btn'))setNav(false)});
  addEventListener('load',()=>setTimeout(place,0));
  addEventListener('hashchange',()=>setTimeout(place,0));
  let t=0;
  new MutationObserver(()=>{clearTimeout(t);t=setTimeout(place,30)}).observe(document.querySelector('.page'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  place();
})();

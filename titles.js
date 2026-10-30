/* Chef & Mixologist: headings use Title Case.
   Every word starts with a capital letter except short articles, conjunctions and prepositions
   (unless first or last). Page titles, panel and section headings and dialog titles are fixed up here,
   so no screen has to remember it. Record names (items, recipes, events...) are left as written. */

const TC_SMALL=new Set('a an the and but or nor for so yet as at by in of off on per to up via with from into onto over than vs'.split(' '));
const TC_SELECTOR='.page-head h1,.panel-h h2,.menu-h h2,.menu-h > b,#m-title,.fm-h h2,.fm-group > b,fieldset > legend,.colour-guide > b,.menu button,.side-sec,.side-sec > button,.side-foot b,#sideOut,.side > .topbar .btn,.side .acct-menu button';

function titleCaseText(words){
  // words: array of tokens in order; returns the same tokens, capitalised
  const last=words.length-1;
  return words.map((w,i)=>{
    const m=w.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/);if(!m||!m[2])return w;
    const [,pre,core,post]=m;
    if(/[A-Z]/.test(core.slice(1))||/\d/.test(core)&&!/[a-z]/.test(core[0]))return w;   // McDonald's, PR-210, 14: leave as written
    const small=TC_SMALL.has(core.toLowerCase());
    if(small&&i!==0&&i!==last)return pre+core.toLowerCase()+post;
    const cap=core.split('-').map(p=>p?p[0].toUpperCase()+p.slice(1):p).join('-');
    return pre+cap+post;
  });
}

function titleCaseEl(el){
  if(el.dataset.tcDone!==undefined&&el.dataset.tcDone===el.textContent)return;
  const nodes=[];const walk=n=>{n.childNodes.forEach(c=>{if(c.nodeType===3)nodes.push(c);else if(c.nodeType===1&&!/^(SCRIPT|STYLE|SVG|BUTTON)$/i.test(c.tagName)&&!c.matches('.info-tip,.ph-n,em,.badge,.dot'))walk(c)})};walk(el);
  const tokens=[];nodes.forEach((n,ni)=>n.textContent.split(/(\s+)/).forEach(t=>{if(t&&!/^\s+$/.test(t))tokens.push({ni,t})}));
  if(!tokens.length){el.dataset.tcDone=el.textContent;return}
  const out=titleCaseText(tokens.map(x=>x.t));
  const per=new Map();tokens.forEach((x,i)=>{(per.get(x.ni)||per.set(x.ni,[]).get(x.ni)).push([x.t,out[i]])});
  nodes.forEach((n,ni)=>{const list=per.get(ni);if(!list)return;let s=n.textContent;let from=0;
    list.forEach(([a,b])=>{const at=s.indexOf(a,from);if(at<0)return;s=s.slice(0,at)+b+s.slice(at+a.length);from=at+b.length});
    if(s!==n.textContent)n.textContent=s});
  el.dataset.tcDone=el.textContent;
}

let tcTimer=0;
function titleCaseAll(root=document){root.querySelectorAll(TC_SELECTOR).forEach(titleCaseEl)}
new MutationObserver(()=>{clearTimeout(tcTimer);tcTimer=setTimeout(()=>titleCaseAll(),20)}).observe(document.body,{childList:true,subtree:true,characterData:true});
titleCaseAll();

/* Chef & Mixologist: photos for recipes and suppliers.
   Photos are only served to signed-in people, so images are fetched with the sign-in token and shown from memory.
   Any <img data-auth-src="/media/..."> on the page is filled in automatically. */

async function authSrc(path){
  if(!path)return '';
  if(/^(blob|data|https?):/.test(path))return path;  // already a ready-to-show address
  if(PHOTOS[path])return PHOTOS[path];
  try{const r=await fetch(API.base+path,{headers:{Authorization:'Token '+API.token}});if(!r.ok)return '';
    return PHOTOS[path]=URL.createObjectURL(await r.blob())}catch(e){return ''}
}
function fillAuthImgs(){
  $$('img[data-auth-src]:not([data-filled])').forEach(async img=>{img.dataset.filled='1';const u=await authSrc(img.dataset.authSrc);
    if(u)img.src=u;else img.replaceWith(Object.assign(document.createElement('span'),{className:img.className+' no-photo'}))});
}
new MutationObserver(()=>fillAuthImgs()).observe(document.body,{childList:true,subtree:true});

/* pick a photo and upload it to endpoint (…/photo/); done(newPath) after saving */
function pickAndUpload(endpoint,done){
  const inp=Object.assign(document.createElement('input'),{type:'file',accept:'image/jpeg,image/png,image/webp'});
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;
    if(!/^image\/(jpeg|png|webp)$/.test(f.type))return toast('Use a JPG, PNG or WebP photo');
    if(f.size>5*1024*1024)return toast('Photo must be under 5 MB');
    const fd=new FormData();fd.append('image',f);
    try{const r=await api(endpoint,{method:'POST',body:fd});toast('Photo saved');done(r.image)}catch(e){fail(e)}};
  inp.click();
}
/* the photo block used in the recipe and supplier forms */
function photoBlock(path,label){
  return `<div class="photo-edit">${path?`<img class="photo-prev" data-auth-src="${esc(path)}" alt="${esc(label)}">`:`<span class="photo-prev no-photo" aria-hidden="true"></span>`}
    <div class="photo-acts"><b>Photo</b><small class="muted">JPG, PNG or WebP up to 5 MB</small>
    <span><button type="button" class="btn btn-sm btn-line" data-photo-up>${path?'Replace photo':'Add photo'}</button>${path?' <button type="button" class="btn btn-sm btn-line" data-photo-del>Remove</button>':''}</span></div></div>`;
}
function wirePhotoBlock(endpoint,after,root='#mform'){
  const up=$(root+' [data-photo-up]'),del=$(root+' [data-photo-del]');
  if(up)up.onclick=()=>pickAndUpload(endpoint,path=>{const box=up.closest('.photo-edit');box.outerHTML=photoBlock(path,'');wirePhotoBlock(endpoint,after,root);after()});
  if(del)del.onclick=async()=>{try{await api(endpoint,{method:'DELETE'});toast('Photo removed');const box=del.closest('.photo-edit');box.outerHTML=photoBlock(null,'');wirePhotoBlock(endpoint,after,root);after()}catch(e){fail(e)}};
}

/* ================= photos attached to any record ================= */
const PH={idx:{},loading:{}};
const PH_CAM='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

/* {covers:{ref:url},counts:{ref:n}} for one kind of record, kept until something changes */
async function phIndex(kind,force){
  if(!force&&PH.idx[kind])return PH.idx[kind];
  if(!force&&PH.loading[kind])return PH.loading[kind];
  return PH.loading[kind]=api(`/plugin/cm/photos/${kind}/`).then(d=>PH.idx[kind]=d).catch(()=>PH.idx[kind]={covers:{},counts:{}}).finally(()=>delete PH.loading[kind]);
}
/* the cover picture of a record if it has one, otherwise `fallback` (initials etc.) */
function phCover(kind,ref,fallback,cls=''){
  const u=PH.idx[kind]?.covers?.[ref];
  return u?`<img class="${cls} ph-cover" data-auth-src="${esc(u)}" alt="">`:fallback;
}
/* a small camera button that opens the photos of one record, with how many it has */
function phBtn(kind,ref,title){
  return `<button type="button" class="btn btn-sm btn-line ph-btn" data-photos="${kind}:${ref}" data-ph-title="${esc(title)}" aria-label="Photos of ${esc(title)}" title="Photos">${PH_CAM}<b class="ph-n" hidden></b></button>`;
}
async function phDecorate(root=document){
  const btns=[...root.querySelectorAll('[data-photos]:not([data-ph-done])')];
  if(!btns.length)return;
  const kinds=[...new Set(btns.map(b=>b.dataset.photos.split(':')[0]))];
  btns.forEach(b=>b.dataset.phDone='1');
  await Promise.all(kinds.map(k=>phIndex(k)));
  btns.forEach(b=>{const [k,r]=b.dataset.photos.split(':'),n=PH.idx[k]?.counts?.[r]||0,el=b.querySelector('.ph-n');
    if(el){el.textContent=n;el.hidden=!n}b.classList.toggle('has',!!n)});
}
new MutationObserver(()=>phDecorate()).observe(document.body,{childList:true,subtree:true});
document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('[data-photos]');if(!b)return;e.preventDefault();e.stopPropagation();
  const [k,r]=b.dataset.photos.split(':');photoDialog(k,+r,b.dataset.phTitle||'')},true);

function phView(url){
  const v=document.createElement('div');v.className='ph-view';v.innerHTML='<img alt="">';document.body.append(v);
  authSrc(url).then(u=>v.querySelector('img').src=u);
  const off=()=>{v.remove();document.removeEventListener('keydown',key)},key=e=>{if(e.key==='Escape')off()};
  v.onclick=off;document.addEventListener('keydown',key);
}

async function photoDialog(kind,ref,title){
  formModal(esc(title),'Photos','<div id="phBody"><p class="muted">Loading…</p></div>','Done',async(f,close)=>close());
  const draw=async()=>{
    let d;try{d=await api(`/plugin/cm/photos/${kind}/${ref}/`)}catch(e){const b=$('#phBody');if(b)b.innerHTML=`<p class="muted">${esc(e.message)}</p>`;return}
    const box=$('#phBody');if(!box)return;
    const full=!d.single&&d.photos.length>=d.max;
    box.innerHTML=(d.photos.length?`<div class="ph-grid">${d.photos.map(p=>`<figure class="ph-item"><button type="button" class="ph-open" data-ph-open="${esc(p.image)}" aria-label="View photo"><img data-auth-src="${esc(p.image)}" alt=""></button>
        <figcaption>${esc(new Date(p.at).toLocaleDateString('en-IN',{day:'numeric',month:'short'}))}${p.by?' · '+esc(p.by):''}</figcaption>
        ${d.canEdit?`<button type="button" class="btn btn-sm btn-line" data-ph-rm="${p.id}">Remove</button>`:''}</figure>`).join('')}</div>`
      :'<p class="muted">No photos yet.</p>')+
      (d.canEdit?`<p style="margin:12px 0 0"><button type="button" class="btn btn-sm btn-primary" data-ph-add ${full?'disabled':''}>${d.single&&d.photos.length?'Replace photo':'Add photo'}</button>
        <small class="muted"> JPG, PNG or WebP up to 5 MB${d.single?'':`, up to ${d.max} photos`}</small></p>`:'');
    box.querySelectorAll('[data-ph-open]').forEach(b=>b.onclick=()=>phView(b.dataset.phOpen));
    const add=box.querySelector('[data-ph-add]');
    if(add)add.onclick=()=>pickAndUpload(`/plugin/cm/photos/${kind}/${ref}/`,async()=>{await phIndex(kind,true);phRefreshBtns(kind);draw()});
    box.querySelectorAll('[data-ph-rm]').forEach(b=>b.onclick=async()=>{try{await api(`/plugin/cm/photos/${kind}/${ref}/?id=${b.dataset.phRm}`,{method:'DELETE'});toast('Photo removed');await phIndex(kind,true);phRefreshBtns(kind);draw()}catch(e){fail(e)}});
  };
  draw();
}
function phRefreshBtns(kind){document.querySelectorAll(`[data-photos^="${kind}:"]`).forEach(b=>delete b.dataset.phDone);phDecorate()}

/* photo picker for an Add form: the file is held until the record exists, then uploaded to its photo endpoint */
let PH_PENDING=null;
function pendingPhotoBlock(){
  PH_PENDING=null;
  return `<div class="photo-edit" id="phPend"><span class="photo-prev no-photo" aria-hidden="true"></span>
    <div class="photo-acts"><b>Photo</b><small class="muted">Optional · JPG, PNG or WebP up to 5 MB</small>
    <span><button type="button" class="btn btn-sm btn-line" data-ph-pick>Add photo</button> <button type="button" class="btn btn-sm btn-line" data-ph-clear hidden>Remove</button></span></div></div>`;
}
function wirePendingPhoto(){
  const box=$('#mform #phPend');if(!box)return;
  const show=()=>{const prev=box.querySelector('.photo-prev'),has=!!PH_PENDING;
    const el=has?Object.assign(document.createElement('img'),{className:'photo-prev',alt:'',src:URL.createObjectURL(PH_PENDING)}):Object.assign(document.createElement('span'),{className:'photo-prev no-photo'});
    prev.replaceWith(el);box.querySelector('[data-ph-pick]').textContent=has?'Replace photo':'Add photo';box.querySelector('[data-ph-clear]').hidden=!has};
  box.querySelector('[data-ph-pick]').onclick=()=>{
    const inp=Object.assign(document.createElement('input'),{type:'file',accept:'image/jpeg,image/png,image/webp'});
    inp.onchange=()=>{const f=inp.files[0];if(!f)return;
      if(!/^image\/(jpeg|png|webp)$/.test(f.type))return toast('Use a JPG, PNG or WebP photo');
      if(f.size>5*1024*1024)return toast('Photo must be under 5 MB');
      PH_PENDING=f;show()};inp.click()};
  box.querySelector('[data-ph-clear]').onclick=()=>{PH_PENDING=null;show()};
}
async function commitPendingPhoto(endpoint,kind){
  const f=PH_PENDING;PH_PENDING=null;if(!f)return;
  const fd=new FormData();fd.append('image',f);
  try{await api(endpoint,{method:'POST',body:fd});if(kind)await phIndex(kind,true)}catch(e){toast('Saved, but the photo was not added: '+e.message)}
}

/* a round or rounded avatar: the person's photo if they have one, otherwise their initials */
function phAvatar(kind,ref,initials,cls=''){
  const u=PH.idx[kind]?.covers?.[ref];
  return `<span class="avatar${u?' has-photo':''} ${cls}">${u?`<img class="ph-cover" data-auth-src="${esc(u)}" alt="">`:esc(initials)}</span>`;
}

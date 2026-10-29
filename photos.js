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
function wirePhotoBlock(endpoint,after){
  const up=$('#mform [data-photo-up]'),del=$('#mform [data-photo-del]');
  if(up)up.onclick=()=>pickAndUpload(endpoint,path=>{const box=up.closest('.photo-edit');box.outerHTML=photoBlock(path,'');wirePhotoBlock(endpoint,after);after()});
  if(del)del.onclick=async()=>{try{await api(endpoint,{method:'DELETE'});toast('Photo removed');const box=del.closest('.photo-edit');box.outerHTML=photoBlock(null,'');wirePhotoBlock(endpoint,after);after()}catch(e){fail(e)}};
}

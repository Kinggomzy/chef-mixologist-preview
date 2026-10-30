/* Chef & Mixologist: colour palettes chosen in Organisation settings.
   A palette is two colours: a dark brand colour (sidebar, heroes, headings) and an accent
   (buttons, links, the current menu item). Every other brand shade is worked out from them.
   Good / attention / problem colours never change, so their meaning stays the same.
   Loaded in <head> so the last palette used on this device is applied before the page draws. */

const PALETTES={
  copper:['Copper & espresso','From the original logo','#2B1710','#B4420E'],
  peacock:['Peacock & saffron','Deep teal with warm saffron','#0F3440','#C2602A'],
  emerald:['Emerald & brass','Bottle green with polished brass','#123328','#9A6B1F'],
  plum:['Royal plum & rose','Aubergine with dusky rose','#2E1530','#A8445F'],
  navy:['Midnight & amber','Ink navy with amber','#14213D','#B5601E'],
};
const THEME_VARS=['--espresso','--espresso-2','--espresso-3','--espresso-soft','--espresso-deep','--copper','--copper-light','--copper-soft','--copper-ink'];

function hexRgb(h){h=h.replace('#','');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))}
function mixHex(a,b,t){const x=hexRgb(a),y=hexRgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('')}
function luminance(h){const c=hexRgb(h).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function contrast(a,b){const [x,y]=[luminance(a),luminance(b)].sort((m,n)=>n-m);return (x+.05)/(y+.05)}

function paletteColours(t){
  if(!t||!t.theme)return null;
  if(t.theme==='custom')return /^#[0-9a-f]{6}$/i.test(t.primary||'')&&/^#[0-9a-f]{6}$/i.test(t.accent||'')?[t.primary,t.accent]:null;
  return PALETTES[t.theme]?PALETTES[t.theme].slice(2):null;
}

function applyTheme(t){
  const root=document.documentElement,cols=paletteColours(t);
  if(!cols||t.theme==='copper'){THEME_VARS.forEach(v=>root.style.removeProperty(v))}  // copper is tokens.css as written
  else{
    const [p,a]=cols;
    const set={'--espresso':p,'--espresso-2':mixHex(p,'#ffffff',.08),'--espresso-3':mixHex(p,a,.35),'--espresso-soft':mixHex(p,'#ffffff',.9),
      '--espresso-deep':mixHex(p,'#000000',.3),'--copper':a,'--copper-light':mixHex(a,'#ffffff',.35),'--copper-soft':mixHex(a,'#ffffff',.86),
      '--copper-ink':mixHex(a,'#000000',.22)};
    for(const k in set)root.style.setProperty(k,set[k]);
  }
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=cols?cols[0]:'#2B1710';
  try{localStorage.setItem('cm_theme',JSON.stringify(t||{}))}catch(e){}
}

try{applyTheme(JSON.parse(localStorage.getItem('cm_theme')||'null'))}catch(e){}

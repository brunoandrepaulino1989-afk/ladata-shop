// Product search for the header. Opens a panel, filters products as you type.
// The product list mirrors the P array in product.html (name, category, short text, price excl. VAT).
(()=>{
const P=[{"n":"Theragun PRO Plus","c":"Massage","s":"Heat, LED and vibration massage","p":649,"out":false,"slug":"theragun-pro-plus","img":null,"cover":false},
{"n":"Theragun Prime Plus","c":"Massage","s":"Heated massage gun","p":419,"out":false,"slug":"theragun-prime-plus","img":null,"cover":false},
{"n":"Theragun Prime","c":"Massage","s":"Deep tissue massage · 6th gen","p":319,"out":false,"slug":"theragun-prime","img":null,"cover":false},
{"n":"Theragun Sense","c":"Massage","s":"Guided-routine massage · 2nd gen","p":299,"out":false,"slug":"theragun-sense","img":null,"cover":false},
{"n":"Theragun Mini Plus","c":"Massage","s":"Compact heated massage gun","p":269,"out":false,"slug":"theragun-mini-plus","img":null,"cover":false},
{"n":"Theragun Mini","c":"Massage","s":"Compact massage gun · 3rd gen","p":219,"out":false,"slug":"theragun-mini","img":null,"cover":false},
{"n":"Theragun Relief","c":"Massage","s":"Gentle everyday massage","p":149,"out":false,"slug":"theragun-relief","img":null,"cover":false},
{"n":"WaveDuo","c":"Massage","s":"Vibrating roller for the neck, back and spine","p":109,"out":false,"slug":"waveduo","img":null,"cover":false},
{"n":"JetBoots PRO Plus","c":"Compression","s":"Compression, infrared LED and vibration","p":1049,"out":false,"slug":"jetboots-pro-plus","img":null,"cover":false},
{"n":"JetBoots Prime","c":"Compression","s":"Wireless compression boots","p":529,"out":false,"slug":"jetboots-prime","img":null,"cover":false},
{"n":"ThermNeck & Upper Back","c":"Hot & cold","s":"Percussion, heat and LED","p":349,"out":true,"slug":"thermneck-and-upper-back","img":null,"cover":false},
{"n":"ThermBack LED","c":"Hot & cold","s":"Lower back: heat, infrared and vibration","p":269,"out":false,"slug":"thermback-led","img":null,"cover":false},
{"n":"RecoveryTherm Cube","c":"Hot & cold","s":"Hot and cold contrast therapy","p":null,"out":true,"slug":"recoverytherm-cube","img":null,"cover":false},
{"n":"Neck & Chest LED","c":"Skin & LED","s":"Hands-free LED for neck and chest","p":399,"out":true,"slug":"neck-and-chest-led","img":null,"cover":false},
{"n":"SkinSpa PRO","c":"Skin & LED","s":"Complete anti-ageing facial system","p":399,"out":true,"slug":"skinspa-pro","img":null,"cover":false},
{"n":"TheraFace Mask Glo","c":"Skin & LED","s":"LED mask with 504 LEDs and massage","p":349,"out":false,"slug":"theraface-mask-glo","img":null,"cover":false},
{"n":"SkinSpa CryoCurrent","c":"Skin & LED","s":"Cold microcurrent to lift and depuff","p":299,"out":true,"slug":"skinspa-cryocurrent","img":null,"cover":false},
{"n":"SkinSpa ThermLED","c":"Skin & LED","s":"Facial LED with heated massage","p":199,"out":true,"slug":"skinspa-thermled","img":null,"cover":false},
{"n":"ThermFace Massage","c":"Skin & LED","s":"Heated percussive facial massage","p":199,"out":true,"slug":"thermface-massage","img":null,"cover":false},
{"n":"TheraFace Depuffing Wand","c":"Skin & LED","s":"Depuffing on the go","p":149,"out":false,"slug":"theraface-depuffing-wand","img":null,"cover":false},
{"n":"Redvion One","c":"Sleep","s":"Blue-light blocking glasses","p":59.99,"out":false,"slug":"redvion-one","img":null,"cover":false},
{"n":"SmartGoggles","c":"Sleep","s":"Eye mask with heat and vibration · 2nd gen","p":169,"out":false,"slug":"smartgoggles","img":null,"cover":false},
{"n":"Eco-Sauna Vidro","c":"Saunas","s":"Glass steam sauna for up to 6 people","p":9990,"out":false,"slug":"eco-sauna-vidro","img":"eco-sauna-vidro-r.jpg","cover":true},
{"n":"Eco-Sauna Mini Vidro","c":"Saunas","s":"Compact glass steam sauna for up to 3 people","p":6990,"out":false,"slug":"eco-sauna-mini-vidro","img":"eco-sauna-mini-vidro-r.jpg","cover":true},
{"n":"MaxPerformance Test","c":"BioMarkers Test","s":"At-home blood test · 10 biomarkers","p":125,"out":false,"slug":"maxperformance-test","img":null,"cover":true},
{"n":"Ladata Body Oil","c":"Body care","s":"Muscles & Mind Recovery","p":20,"out":false,"slug":"ladata-body-oil","img":"ladata-body-oil-w.jpg","cover":false}];
const BF_END=new Date('2026-12-01T23:59:59+00:00'),BF_ON=Date.now()<BF_END;
const eur=n=>'€'+n.toLocaleString('en-IE',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
const norm=t=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ');
P.forEach(x=>{x.k=norm(x.n+' '+x.c+' '+x.s);if(BF_ON&&x.p!=null){x.was=x.p;x.p=Math.round(x.p*85)/100}});
const css=`
.srch{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column}
.srch[hidden]{display:none}
.srch .bg{position:absolute;inset:0;background:rgba(0,0,0,.35)}
.srch .pn{position:relative;background:#fff;max-height:min(86vh,720px);display:flex;flex-direction:column;box-shadow:0 20px 40px rgba(0,0,0,.15)}
.srch .bar{max-width:1180px;width:100%;margin:0 auto;display:flex;align-items:center;gap:12px;padding:18px 16px;border-bottom:1px solid #e3e3e1}
.srch .bar svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;flex:none}
.srch input{flex:1;min-width:0;border:0;outline:0;font:inherit;font-size:clamp(18px,2.4vw,24px);letter-spacing:-.01em;padding:6px 0;background:none;color:#111}
.srch .x{border:0;background:none;cursor:pointer;padding:8px;border-radius:50%;color:#111;display:grid;place-items:center}
.srch .x:hover{background:#f3f3f1}
.srch .res{overflow:auto;max-width:1180px;width:100%;margin:0 auto;padding:12px 16px 24px}
.srch h6{margin:8px 0 10px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b6b6b;font-weight:600}
.srch ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:4px 16px}
.srch li a{display:flex;align-items:center;gap:14px;padding:8px;border-radius:12px;text-decoration:none;color:#111}
.srch li a:hover,.srch li a.on{background:#f6f1e7}
.srch li img{width:56px;height:56px;object-fit:contain;background:#f5f5f3;border-radius:10px;flex:none}
.srch li img.cover{object-fit:cover}
.srch .t{min-width:0;flex:1}
.srch .t b{display:block;font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.srch .t span{display:block;font-size:13px;color:#6b6b6b}
.srch .pr{font-size:14px;font-weight:600;white-space:nowrap;text-align:right}
.srch .pr s{display:block;font-weight:400;color:#6b6b6b;font-size:12px}
.srch .pr em{font-style:normal;font-weight:500;color:#6b6b6b;font-size:12.5px}
.srch .none{color:#6b6b6b;padding:12px 8px;margin:0}
.srch mark{background:none;color:inherit;text-decoration:underline;text-underline-offset:3px}
button.search{font:inherit;cursor:pointer}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const el=document.createElement('div');el.className='srch';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-label','Search products');
el.innerHTML='<div class="bg"></div><div class="pn"><div class="bar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="text" placeholder="Search products, e.g. massage, sauna, LED" aria-label="Search products" autocomplete="off" enterkeyhint="go"><button class="x" type="button" aria-label="Close search"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="res" aria-live="polite"></div></div>';
document.body.appendChild(el);
const inp=el.querySelector('input'),res=el.querySelector('.res');let hits=[],sel=-1;
const esc=t=>t.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const row=x=>`<li><a href="/product#${x.slug}"><img class="${x.cover?'cover':''}" src="/img/${x.img||x.slug+'.jpg'}" alt="" loading="lazy"><span class="t"><b>${esc(x.n)}</b><span>${esc(x.c)}</span></span><span class="pr">${x.out?'<em>Sold out</em>':x.p==null?'':x.was?`${eur(x.p)}<s>${eur(x.was)}</s>`:eur(x.p)}</span></a></li>`;
function draw(){const q=norm(inp.value.trim());sel=-1;
  if(!q){hits=P.filter(x=>!x.out&&x.p!=null).slice(0,6);res.innerHTML='<h6>Popular</h6><ul>'+hits.map(row).join('')+'</ul>';return}
  const w=q.split(/\s+/);hits=P.filter(x=>w.every(t=>x.k.includes(t)));
  hits.sort((a,b)=>(a.out-b.out)||(norm(b.n).startsWith(w[0])-norm(a.n).startsWith(w[0])));
  res.innerHTML=hits.length?'<h6>'+hits.length+(hits.length>1?' products':' product')+'</h6><ul>'+hits.map(row).join('')+'</ul>':'<p class="none">No products found for “'+esc(inp.value.trim())+'”. Try “massage”, “sauna” or “LED”.</p>'}
function mark(){res.querySelectorAll('li a').forEach((a,i)=>a.classList.toggle('on',i===sel));const a=res.querySelectorAll('li a')[sel];a&&a.scrollIntoView({block:'nearest'})}
function open(){el.hidden=false;document.documentElement.style.overflow='hidden';draw();setTimeout(()=>inp.focus(),0)}
function close(){el.hidden=true;document.documentElement.style.overflow='';inp.value=''}
inp.addEventListener('input',draw);
inp.addEventListener('keydown',e=>{const n=res.querySelectorAll('li a').length;
  if(e.key==='ArrowDown'&&n){e.preventDefault();sel=(sel+1)%n;mark()}
  else if(e.key==='ArrowUp'&&n){e.preventDefault();sel=(sel-1+n)%n;mark()}
  else if(e.key==='Enter'){const a=res.querySelectorAll('li a')[Math.max(sel,0)];if(a){e.preventDefault();a.click()}}});
el.querySelector('.x').onclick=close;el.querySelector('.bg').onclick=close;
res.addEventListener('click',e=>{if(e.target.closest('a'))setTimeout(close,0)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!el.hidden)close();else if(e.key==='/'&&el.hidden&&!e.target.closest('input,textarea,select')){e.preventDefault();open()}});
document.querySelectorAll('.search').forEach(b=>{if(b.tagName!=='BUTTON'){const n=document.createElement('button');n.type='button';n.className=b.className;n.innerHTML=b.innerHTML;n.setAttribute('aria-label','Search products');b.replaceWith(n);b=n}b.addEventListener('click',open)});
})();

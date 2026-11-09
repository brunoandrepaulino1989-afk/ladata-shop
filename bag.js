/* Ladata.shop bag. Shared by the homepage, shop and product pages. Checkout is handled by Stripe via /api/checkout.
   The bag is kept in localStorage, so it follows the customer across pages. */
(function(){
const KEY='ladata-cart',SHIP=9.9; // flat shipping fee on every order
const eur=n=>'€'+(+n).toLocaleString('en-IE',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let items=[];
try{items=JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(items))}catch(e){}}
const count=()=>items.reduce((a,x)=>a+x.q,0);
const sub=()=>items.reduce((a,x)=>a+(x.p||0)*x.q,0);
const was=()=>items.reduce((a,x)=>a+((x.was||x.p||0)-(x.p||0))*x.q,0);
const hasSauna=()=>items.some(x=>/sauna/.test(x.slug));
const css=`
.lb-scrim{position:fixed;inset:0;background:rgba(17,17,17,.28);z-index:60;opacity:0;transition:opacity .25s}
.lb-scrim.on{opacity:1}
.lb{position:fixed;top:0;right:0;bottom:0;width:min(440px,100%);background:#fff;color:#111;z-index:61;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s ease;font-family:"Hanken Grotesk","Helvetica Neue",Arial,sans-serif;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
.lb.on{transform:none}
.lb-h{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid #e3e3e1}
.lb-h h2{margin:0;font-size:20px;font-weight:600;letter-spacing:-.02em}
.lb-h h2 span{color:#6b6b6b;font-weight:400;font-size:15px;margin-left:6px}
.lb-x{border:0;background:transparent;cursor:pointer;padding:6px;font-size:22px;line-height:1}
.lb-ship{padding:14px 24px;border-bottom:1px solid #e3e3e1;font-size:13.5px}
.lb-bar{height:4px;background:#eee;border-radius:2px;margin-top:8px;overflow:hidden}.lb-bar i{display:block;height:100%;background:#111;transition:width .3s}
.lb-list{flex:1;overflow-y:auto;padding:0 24px}
.lb-it{display:grid;grid-template-columns:84px 1fr auto;gap:14px;padding:18px 0;border-bottom:1px solid #e3e3e1;align-items:start}
.lb-img{width:84px;height:84px;border:1px solid #e3e3e1;position:relative;overflow:hidden;background:#fff}
.lb-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;padding:6%}
.lb-nm{font-weight:600;font-size:15px}
.lb-s{color:#6b6b6b;font-size:13px;margin-top:2px}
.lb-q{display:inline-flex;align-items:center;border:1px solid #e3e3e1;border-radius:999px;margin-top:10px}
.lb-q button{border:0;background:transparent;width:32px;height:32px;cursor:pointer;font-size:16px}
.lb-q span{min-width:20px;text-align:center;font-variant-numeric:tabular-nums;font-size:14px}
.lb-rm{border:0;background:transparent;color:#6b6b6b;font-size:13px;text-decoration:underline;cursor:pointer;margin-left:12px;padding:0}
.lb-pr{text-align:right;font-variant-numeric:tabular-nums;font-size:15px;white-space:nowrap}
.lb-pr s{display:block;color:#6b6b6b;font-size:13px}.lb-pr .now{color:#c8381e}
.lb-empty{padding:56px 0;text-align:center;color:#6b6b6b}
.lb-empty b{display:block;color:#111;font-size:18px;margin-bottom:6px}
.lb-f{border-top:1px solid #e3e3e1;padding:18px 24px 22px;display:flex;flex-direction:column;gap:10px}
.lb-row{display:flex;justify-content:space-between;font-size:14.5px;font-variant-numeric:tabular-nums}
.lb-row.tot{font-size:18px;font-weight:600}
.lb-row.save{color:#c8381e}
.lb-note{font-size:12.5px;color:#6b6b6b}
.lb-btn{display:block;width:100%;border:1px solid #111;border-radius:999px;padding:15px;font:inherit;font-weight:600;font-size:16px;background:#111;color:#fff;cursor:pointer;text-align:center}
.lb-btn.line{background:#fff;color:#111}
.lb-btn[disabled]{opacity:.4;cursor:not-allowed}
.lb-pay{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.pms{display:inline-flex;gap:5px;flex-wrap:wrap;align-items:center}.pm{width:38px;height:25px;display:block;flex:0 0 auto}
.co-opt .pms{justify-content:flex-end}.co-opt .pm{width:34px;height:22px}
.stripe-by{display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:#6b6b6b}.stripe-by b{color:#635bff;font-weight:800;font-size:14px;letter-spacing:-.02em}
@media (max-width:560px){.co-opt .pms{max-width:110px}}
.lb-err{color:#c8381e;font-size:13.5px;text-align:center}
@media (prefers-reduced-motion:reduce){.lb,.lb-scrim{transition:none}}
`;

// Payment marks for the methods Stripe supports in Portugal (simplified badges).
const B=(inner,bg='#fff',bd='#d9d9d6')=>`<svg class="pm" viewBox="0 0 46 30" role="img"><rect x=".5" y=".5" width="45" height="29" rx="4" fill="${bg}" stroke="${bd}"/>${inner}</svg>`;
const T=(x,y,t,c,sz,w=800,st='normal',ff='Arial,Helvetica,sans-serif')=>`<text x="${x}" y="${y}" fill="${c}" font-family="${ff}" font-size="${sz}" font-weight="${w}" font-style="${st}" text-anchor="middle">${t}</text>`;
const LOGO={
 visa:B(T(23,19.5,'VISA','#1a1f71',12,900,'italic')),
 mastercard:B('<circle cx="18.5" cy="15" r="8" fill="#eb001b"/><circle cx="27.5" cy="15" r="8" fill="#f79e1b"/><path d="M23 8.4a8 8 0 0 1 0 13.2a8 8 0 0 1 0-13.2z" fill="#ff5f00"/>'),
 amex:B(T(23,18.5,'AMEX','#fff',10.5,900),'#016fd0','#016fd0'),
 applepay:B('<path fill="#fff" d="M13.6 10.3c.5-.6.8-1.4.7-2.2-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1.1zm.7 1.2c-1.2-.1-2.2.7-2.8.7s-1.4-.6-2.4-.6c-1.2 0-2.3.7-2.9 1.8-1.2 2.1-.3 5.3.9 7 .6.8 1.3 1.8 2.2 1.7.9 0 1.2-.6 2.3-.6s1.4.6 2.3.6c1 0 1.6-.9 2.2-1.7.7-1 1-1.9 1-2-.1 0-1.9-.7-1.9-2.8 0-1.7 1.4-2.6 1.5-2.6-.8-1.2-2.1-1.4-2.4-1.5z"/>'+T(30,19.5,'Pay','#fff',10.5,600),'#000','#000'),
 googlepay:B('<text x="8" y="19.5" font-family="Arial,sans-serif" font-size="11" font-weight="700"><tspan fill="#4285f4">G</tspan></text>'+T(29,19.5,'Pay','#5f6368',10.5,600)),
 mbway:B('<rect x="5" y="8" width="15" height="14" rx="2.5" fill="#d60511"/>'+T(12.5,18.5,'MB','#fff',7.5,900)+T(32,18.5,'WAY','#d60511',8.5,900)),
 klarna:B(T(23,19,'Klarna.','#0b051d',9.5,800),'#ffb3c7','#ffb3c7'),
 paypal:B('<text x="23" y="19.5" font-family="Verdana,Arial,sans-serif" font-size="9" font-weight="800" font-style="italic" text-anchor="middle"><tspan fill="#003087">Pay</tspan><tspan fill="#009cde">Pal</tspan></text>'),
};
const L=(...k)=>`<span class="pms">${k.map(x=>LOGO[x]).join('')}</span>`;
const STRIPE='<span class="stripe-by"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Payments processed securely by <b>stripe</b></span>';
let root,drawer,scrim;
function el(h){const d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild}
function img(x){return `<div class="lb-img"><img src="/img/${esc(x.slug)}.jpg" alt="" onerror="this.remove()"></div>`}
function price(x){return x.p==null?'<span style="color:#6b6b6b;font-size:13px">Price to be<br>confirmed</span>':x.was&&x.was>x.p?`<span class="now">${eur(x.p*x.q)}</span><s>${eur(x.was*x.q)}</s>`:eur(x.p*x.q)}
function paint(){
  document.querySelectorAll('#bagN').forEach(b=>b.textContent=count());
  if(!drawer)return;
  const n=count();
  drawer.querySelector('.lb-h h2').innerHTML=`Your bag<span>${n} ${n===1?'item':'items'}</span>`;
    drawer.querySelector('.lb-ship').hidden=true;
  drawer.querySelector('.lb-list').innerHTML=items.length?items.map((x,i)=>`<div class="lb-it">${img(x)}<div><div class="lb-nm">${esc(x.n)}</div><div class="lb-s">${esc(x.s||'')}</div><div><span class="lb-q"><button data-d="${i}" aria-label="One less">−</button><span>${x.q}</span><button data-u="${i}" aria-label="One more">+</button></span><button class="lb-rm" data-r="${i}">Remove</button></div></div><div class="lb-pr">${price(x)}</div></div>`).join(''):'<div class="lb-empty"><b>Your bag is empty</b>Find something for your recovery routine.</div>';
  const s=sub(),sv=was(),tbc=items.some(x=>x.p==null);
  drawer.querySelector('.lb-f').innerHTML=items.length?`
    ${sv>0?`<div class="lb-row save"><span>Black Friday savings</span><span>−${eur(sv)}</span></div>`:''}
    <div class="lb-row"><span>Subtotal (excl. VAT)</span><span>${eur(s)}</span></div>
    <div class="lb-row"><span>Shipping (excl. VAT)</span><span>${eur(SHIP)}</span></div>
    <div class="lb-row"><span>VAT (23%)</span><span>${eur(vat())}</span></div>
    <div class="lb-row tot"><span>Total</span><span>${eur(grand())}</span></div>
    <div class="lb-note">Prices and shipping exclude VAT. 23% VAT is added on the total.${tbc?' Items with a price to be confirmed can’t be paid online yet: remove them to check out and we will email you a quote.':''}${hasSauna()?' Sauna delivery and installation are arranged with you after the order.':''}</div>
    <p class="lb-err" role="alert" hidden></p>
    <button class="lb-btn" data-go="checkout">Checkout · ${eur(grand())}</button>
    <button class="lb-btn line" data-go="close">Continue shopping</button>
    <div class="lb-pay">${L('visa','mastercard','amex','applepay','googlepay','mbway','klarna','paypal')}</div>${STRIPE}`
    :`<button class="lb-btn" data-go="shop">Shop all products</button>`;
}
function build(){
  if(root)return;
  const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
  scrim=el('<div class="lb-scrim" hidden></div>');
  drawer=el('<aside class="lb" role="dialog" aria-modal="true" aria-label="Your bag" hidden><div class="lb-h"><h2>Your bag</h2><button class="lb-x" aria-label="Close bag">×</button></div><div class="lb-ship"></div><div class="lb-list"></div><div class="lb-f"></div></aside>');
  document.body.append(scrim,drawer);root=1;
  scrim.onclick=close;drawer.querySelector('.lb-x').onclick=close;
  drawer.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;
    if(t.dataset.u!=null){items[+t.dataset.u].q++;}
    else if(t.dataset.d!=null){const x=items[+t.dataset.d];x.q--;if(x.q<1)items.splice(+t.dataset.d,1);}
    else if(t.dataset.r!=null){items.splice(+t.dataset.r,1);}
    else if(t.dataset.go==='close'){close();return}
    else if(t.dataset.go==='shop'){const a=document.createElement('a');location.href='/shop#all';return}
    else if(t.dataset.go==='checkout'){checkout(t);return}
    else return;
    save();paint()});
  paint();
}
function open(){build();paint();scrim.hidden=drawer.hidden=false;requestAnimationFrame(()=>{scrim.classList.add('on');drawer.classList.add('on')});document.body.style.overflow='hidden';drawer.querySelector('.lb-x').focus()}
function close(){if(!drawer||drawer.hidden)return;scrim.classList.remove('on');drawer.classList.remove('on');document.body.style.overflow='';setTimeout(()=>{scrim.hidden=drawer.hidden=true},300)}
function add(x,btn){
  const f=items.find(i=>i.slug===x.slug);
  if(f)f.q++;else items.push({slug:x.slug,n:x.n,s:x.s||'',p:x.p==null?null:+x.p,was:x.was?+x.was:null,q:1});
  save();
  if(btn){const o=btn.innerHTML;btn.classList.add('ok');btn.innerHTML='Added ✓';clearTimeout(btn._t);btn._t=setTimeout(()=>{btn.classList.remove('ok');btn.innerHTML=o},1400)}
  open();
}
/* ---------- checkout: Stripe ---------- */
// Shown figures mirror the server; the server (/api/checkout) recalculates everything from its own price list.
const VAT=0.23,vat=()=>Math.round((sub()+SHIP)*VAT*100)/100,grand=()=>sub()+SHIP+vat();
let busy=false;
async function checkout(btn){
  if(busy||!items.length)return;busy=true;
  const label=btn&&btn.innerHTML,err=drawer&&drawer.querySelector('.lb-err');
  if(btn){btn.disabled=true;btn.innerHTML='Opening secure checkout…'}if(err)err.hidden=true;
  try{
    const r=await fetch('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({items:items.map(x=>({slug:x.slug,q:x.q}))})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.url)throw new Error(d.error||'We could not start the payment. Please try again.');
    location.href=d.url;
  }catch(e){
    busy=false;if(btn){btn.disabled=false;btn.innerHTML=label}
    if(err){err.textContent=e.message;err.hidden=false}else alert(e.message);
  }
}
function clear(){items=[];save();paint()}
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
function init(){
  document.querySelectorAll('header .bag').forEach(b=>{b.setAttribute('href','#');b.setAttribute('aria-label','Open bag');b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open()},true)});
  paint();
  // Back from a cancelled payment: reopen the bag.
  if(new URLSearchParams(location.search).get('bag')==='open'){history.replaceState(null,'',location.pathname+location.hash);open()}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.LadataBag={add,open,close,checkout,count,clear};
})();

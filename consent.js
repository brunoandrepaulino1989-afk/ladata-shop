/* Cookie notice + Google Analytics 4.
   Analytics only loads after the visitor clicks "Accept" (GDPR). The choice is kept in localStorage.
   To show the notice again (e.g. from the Privacy page): <a href="#" onclick="ladataCookies();return false">. */
(function(){
  var TAG_ID='GTM-T5M8TN35'; // Google tag for the GA4 property "Ladata Shop" (Google's own snippet uses gtm.js)
  var KEY='ladata-cookies';
  function get(){try{return localStorage.getItem(KEY)}catch(e){return null}}
  function set(v){try{localStorage.setItem(KEY,v)}catch(e){}}
  var loaded=false;
  function loadGA(){
    if(loaded)return;loaded=true;
    window.dataLayer=window.dataLayer||[];
    window.gtag=function(){dataLayer.push(arguments)};
    gtag('js',new Date());
    var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtm.js?id='+TAG_ID;document.head.appendChild(s);
  }
  function hide(){var b=document.getElementById('ld-cookies');if(b)b.remove()}
  function show(){
    if(document.getElementById('ld-cookies'))return;
    var css=document.createElement('style');
    css.textContent='#ld-cookies{position:fixed;left:16px;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:9999;max-width:560px;margin:0 auto;background:#111;color:#fff;font:14px/1.45 "Hanken Grotesk","Helvetica Neue",Arial,sans-serif;padding:16px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;box-shadow:0 8px 30px rgba(0,0,0,.18)}#ld-cookies p{margin:0;flex:1 1 260px}#ld-cookies a{color:#fff}#ld-cookies .b{display:flex;gap:8px}#ld-cookies button{font:inherit;font-weight:600;cursor:pointer;padding:9px 16px;border:1px solid #fff;background:transparent;color:#fff}#ld-cookies button.y{background:#fff;color:#111}';
    var d=document.createElement('div');d.id='ld-cookies';d.setAttribute('role','region');d.setAttribute('aria-label','Cookies');
    d.innerHTML='<p>We use analytics cookies to understand how the shop is used. <a href="/privacy#cookies">Privacy</a></p><div class="b"><button type="button" class="n">Decline</button><button type="button" class="y">Accept</button></div>';
    d.appendChild(css);
    d.querySelector('.y').onclick=function(){set('yes');hide();loadGA()};
    d.querySelector('.n').onclick=function(){set('no');hide()};
    document.body.appendChild(d);
  }
  window.ladataCookies=function(){
    if(get()==='yes'){ // withdrawing consent: forget the choice and remove GA cookies
      document.cookie.split(';').forEach(function(c){var n=c.split('=')[0].trim();if(/^_ga/.test(n)){['','.ladata.shop','ladata.shop'].forEach(function(dm){document.cookie=n+'=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/'+(dm?';domain='+dm:'')})}});
    }
    try{localStorage.removeItem(KEY)}catch(e){}
    show();
  };
  var c=get();
  if(c==='yes')loadGA();
  else if(c!=='no'){if(document.body)show();else document.addEventListener('DOMContentLoaded',show)}
})();

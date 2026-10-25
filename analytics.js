/* SISTA — mesure d'audience (Google Analytics 4) avec consentement RGPD.
   GA n'est chargé qu'après un clic sur "Accepter". Le choix est gardé 6 mois.
   Pour rouvrir le bandeau : window.sistaCookies() */
(function () {
  var GA_ID = 'G-W661VZPNY3';
  var KEY = 'sista_consent';
  var MAX_AGE = 1000 * 60 * 60 * 24 * 182;

  function readChoice() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || Date.now() - c.t > MAX_AGE) return null;
      return c.v;
    } catch (e) { return null; }
  }
  function saveChoice(v) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }

  var loaded = false;
  function loadGA() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    gtag('js', new Date());
    gtag('config', GA_ID, { cookie_expires: 60 * 60 * 24 * 395 });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  function clearGACookies() {
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (name.indexOf('_ga') === 0) {
        var host = location.hostname.replace(/^www\./, '');
        ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) {
          document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
        });
      }
    });
  }

  function injectStyles() {
    if (document.getElementById('sista-cc-style')) return;
    var css =
      '#sista-cc{position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:460px;margin:0 auto;' +
      'background:#EFF0E6;color:#241827;border:1.5px solid #241827;border-radius:20px;padding:18px 20px;' +
      'box-shadow:4px 4px 0 #241827;font-family:"Bricolage Grotesque","Hanken Grotesk",system-ui,sans-serif;font-size:15px;line-height:1.45}' +
      '#sista-cc p{margin:0 0 14px}' +
      '#sista-cc a{color:#2E4ED8}' +
      '#sista-cc .cc-btns{display:flex;gap:10px}' +
      '#sista-cc button{flex:1;cursor:pointer;font:inherit;font-weight:600;padding:10px 14px;border-radius:999px;border:1.5px solid #241827}' +
      '#sista-cc .cc-no{background:#fff;color:#241827}' +
      '#sista-cc .cc-yes{background:#2E4ED8;color:#fff}' +
      '#sista-cc button:focus-visible{outline:3px solid #E63C90;outline-offset:2px}';
    var st = document.createElement('style');
    st.id = 'sista-cc-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  function showBanner() {
    if (document.getElementById('sista-cc')) return;
    injectStyles();
    var box = document.createElement('div');
    box.id = 'sista-cc';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Cookies');
    box.innerHTML =
      '<p>J’aimerais savoir ce qui t’intéresse sur ce site. Tu acceptes que je mesure l’audience avec Google Analytics ? ' +
      '<a href="/politique-confidentialite.html">En savoir plus</a></p>' +
      '<div class="cc-btns"><button type="button" class="cc-no">Refuser</button>' +
      '<button type="button" class="cc-yes">Accepter</button></div>';
    box.querySelector('.cc-yes').onclick = function () { saveChoice('granted'); box.remove(); loadGA(); };
    box.querySelector('.cc-no').onclick = function () { saveChoice('denied'); box.remove(); clearGACookies(); };
    document.body.appendChild(box);
  }

  window.sistaCookies = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (loaded) { clearGACookies(); location.reload(); return; }
    showBanner();
  };

  var choice = readChoice();
  if (choice === 'granted') loadGA();
  else if (choice === null) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
    else showBanner();
  }
})();

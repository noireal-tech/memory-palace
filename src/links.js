/* Memory Palace: going between this app and Endless Clay. Installed on the Quest they are two separate apps, so the
   trip asks Android to open the other one (an intent link), with the web address as the fallback. In a plain browser
   tab it is an ordinary page change, which lets the headset carry the VR session straight across. */
(function () {
  'use strict';
  var MP = window.MP;
  var HOST = 'noireal-tech.github.io';
  var APPS = {
    clay: { pkg: 'com.noirealtech.endlessclay', path: '/index.html' },
    palace: { pkg: 'com.noirealtech.memorypalace', path: '/memory-palace/index.html' }
  };
  // Opened as the installed app? (Android apps of this kind start with an android-app:// referrer; remember it.)
  var installed = false;
  try {
    if (document.referrer.indexOf('android-app://') === 0) sessionStorage.setItem('mp.installed', '1');
    installed = sessionStorage.getItem('mp.installed') === '1' || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  } catch (e) { }

  function webUrl(app, query) {
    var a = APPS[app], base;
    if (location.hostname === HOST) base = 'https://' + HOST + a.path;
    // away from the live site (testing): Endless Clay's address can be given as ?clay=…; the palace is this page
    else base = app === 'clay' ? (MP.params.get('clay') || location.origin + '/index.html') : location.origin + location.pathname.replace(/[^/]*$/, '') + 'index.html';
    if (MP.DEBUG && query) query = 'debug&' + query;
    return base + (query ? (base.indexOf('?') >= 0 ? '&' : '?') + query : '');
  }
  function intentUrl(app, query) {
    var a = APPS[app], web = webUrl(app, query);
    return 'intent://' + HOST + a.path + (query ? '?' + query : '') + '#Intent;scheme=https;package=' + a.pkg + ';S.browser_fallback_url=' + encodeURIComponent(web) + ';end';
  }
  // Go to the other app. Returns the address used (tests read it).
  function go(app, query) {
    var url = installed ? intentUrl(app, query) : webUrl(app, query);
    MP.lastLink = url;
    if (MP.DEBUG && MP.params.has('nolinks')) return url;
    location.href = url;
    return url;
  }
  MP.Links = { go: go, webUrl: webUrl, intentUrl: intentUrl, installed: function () { return installed; }, APPS: APPS };
})();

// Shared header controls: the light/dark toggle and the keep-screen-on button. Each is optional on a page.
(function () {
  var themeBtn = document.getElementById('theme');
  if (themeBtn) {
    var theme = document.documentElement.getAttribute('data-shop-theme') === 'light' ? 'light' : 'dark';
    var applyTheme = function () {
      document.documentElement.setAttribute('data-shop-theme', theme);
      themeBtn.textContent = theme === 'dark' ? 'Light' : 'Dark';
      themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme');
    };
    applyTheme();
    themeBtn.addEventListener('click', function () {
      theme = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('shop-theme', theme); } catch (e) {}
      applyTheme();
    });
  }

  // Keep the screen on while shopping or cooking. Hidden where the browser refuses it.
  var wakeBtn = document.getElementById('wake');
  if (wakeBtn && navigator.wakeLock && navigator.wakeLock.request) {
    var lock = null;
    var wantWake = false;
    var requestWake = function () {
      return navigator.wakeLock.request('screen').then(function (l) {
        lock = l;
        l.addEventListener('release', function () { lock = null; });
      });
    };
    wakeBtn.hidden = false;
    wakeBtn.addEventListener('click', function () {
      if (wantWake) {
        wantWake = false;
        wakeBtn.setAttribute('aria-pressed', 'false');
        if (lock) { lock.release().catch(function () {}); }
        return;
      }
      requestWake().then(function () {
        wantWake = true;
        wakeBtn.setAttribute('aria-pressed', 'true');
      }, function () { wakeBtn.hidden = true; });
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && wantWake && !lock) requestWake().catch(function () {});
    });
  }
})();

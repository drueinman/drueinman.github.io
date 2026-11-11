/* index.html only: always open at the very top. Only videos.html uses #tabs. */
(function () {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function toTop() {
    window.scrollTo(0, 0);
  }

  toTop();
  document.addEventListener('DOMContentLoaded', toTop);
  window.addEventListener('load', toTop);
  window.addEventListener('pageshow', toTop);

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (href === 'index.html' || href === './index.html' || href === '/' || href === '/index.html') {
      toTop();
    }
  });
})();

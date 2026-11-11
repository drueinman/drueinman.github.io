/* On phones only, open videos.html#tabs with the nav tabs at the top of the
   screen (photo strip scrolled off above). Desktop ignores the hash so the
   brand/logo stay visible. Re-runs after images load so the landing sticks. */
(function () {
  var MQ = '(max-width: 979.98px)';

  function isNarrow() {
    return window.matchMedia && window.matchMedia(MQ).matches;
  }

  function wantsTabs() {
    return location.hash === '#tabs';
  }

  function apply() {
    if (!wantsTabs()) return;
    if (!isNarrow()) {
      window.scrollTo(0, 0);
      return;
    }
    var el = document.getElementById('tabs');
    if (el) el.scrollIntoView({ block: 'start', inline: 'nearest' });
  }

  function arm() {
    apply();
    window.addEventListener('load', apply);
    document.querySelectorAll('.gallery-strip img').forEach(function (img) {
      if (!img.complete) {
        img.addEventListener('load', apply);
        img.addEventListener('error', apply);
      }
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(apply);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm);
  } else {
    arm();
  }
})();

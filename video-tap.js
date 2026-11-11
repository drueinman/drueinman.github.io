/* Click or tap anywhere on a video to play or pause it (Update 8, Drue 111126).
   The native controls still work; taps on the bottom controls bar are left to them.
   Mouse uses click. Touch uses a quick tap (pointerup), because some mobile browsers
   keep the click for their own controls overlay. If the browser already toggled the
   video by itself, this doesn't toggle it back. */
(function () {
  var BAR_PX = 48;
  var CHECK_MS = 120;
  var TAP_MOVE_PX = 12;
  var TAP_MAX_MS = 600;

  function inBar(v, y) {
    var r = v.getBoundingClientRect();
    return v.controls && y > r.bottom - BAR_PX;
  }

  function toggleUnlessHandled(v, wasPaused, delay) {
    setTimeout(function () {
      if (v.paused !== wasPaused) return; /* browser handled it */
      if (v.paused) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        v.pause();
      }
    }, delay);
  }

  function arm(v) {
    var down = null;
    var lastTouchTap = 0;

    v.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse') return;
      down = { x: e.clientX, y: e.clientY, t: Date.now(), paused: v.paused };
    });

    v.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'mouse' || !down) return;
      var d = down; down = null;
      if (Math.abs(e.clientX - d.x) > TAP_MOVE_PX || Math.abs(e.clientY - d.y) > TAP_MOVE_PX) return; /* scroll */
      if (Date.now() - d.t > TAP_MAX_MS) return;
      if (inBar(v, e.clientY)) return;
      lastTouchTap = Date.now();
      toggleUnlessHandled(v, d.paused, CHECK_MS);
    });

    v.addEventListener('pointercancel', function () { down = null; });

    v.addEventListener('click', function (e) {
      if (Date.now() - lastTouchTap < 800) { e.preventDefault(); return; } /* already handled as a tap */
      if (inBar(v, e.clientY)) return;
      var wasPaused = v.paused;
      e.preventDefault();
      toggleUnlessHandled(v, wasPaused, 0);
    });

    v.style.cursor = 'pointer';
  }

  function init() {
    document.querySelectorAll('.home-videos video').forEach(arm);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

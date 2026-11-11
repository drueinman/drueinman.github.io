/* Gallery lightbox (Update 8, Drue 111126).
   Click a drifting photo: it flies from its exact spot to the middle of the screen,
   growing as it goes, and the background dims only after it lands.
   Close (tap anywhere, the Back button, or Esc): the dim fades first, then the photo
   shrinks back into the thumbnail it came from. The drift is paused while open, so
   the thumbnail stays put; its rect is re-read at close time anyway.
   Full-size photos live in img/gallery/full/ (same file names); falls back to the
   thumbnail if a full one is missing. Reduced motion: a simple fade. */
(function () {
  var SELECTOR = '.gallery-strip-track img, .gallery-track img';
  var OPEN_MS = 500;
  var CLOSE_MS = 450;
  var DIM_MS = 200;
  var EASE_OUT = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var EASE_IN_OUT = 'cubic-bezier(0.4, 0, 0.2, 1)';
  var MAX_W = 0.90;
  var MAX_H = 0.88;
  var FULL_WAIT_MS = 180;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function fullSrcFor(img) {
    var src = img.getAttribute('src') || '';
    var m = src.match(/^(.*img\/gallery\/)([^\/]+\.(?:jpe?g|png|webp))$/i);
    return m ? m[1] + 'full/' + m[2] : '';
  }

  function rectOf(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  function boxCss(r) {
    return { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' };
  }

  function setBox(el, r) {
    el.style.left = r.left + 'px';
    el.style.top = r.top + 'px';
    el.style.width = r.width + 'px';
    el.style.height = r.height + 'px';
  }

  function targetRect(aspect) {
    var vw = document.documentElement.clientWidth || window.innerWidth;
    var vh = window.innerHeight;
    var maxW = vw * MAX_W;
    var maxH = vh * MAX_H;
    var w = maxW;
    var h = w / aspect;
    if (h > maxH) { h = maxH; w = h * aspect; }
    return { left: (vw - w) / 2, top: (vh - h) / 2, width: w, height: h };
  }

  function animate(el, from, to, ms, easing) {
    if (!el.animate) {
      setBox(el, to);
      return Promise.resolve();
    }
    var a = el.animate([boxCss(from), boxCss(to)], { duration: ms, easing: easing, fill: 'forwards' });
    return a.finished.then(function () {
      setBox(el, to);
      a.cancel();
    }, function () { setBox(el, to); });
  }

  function fade(el, from, to, ms) {
    el.style.opacity = String(from);
    if (!el.animate || ms <= 0) {
      el.style.opacity = String(to);
      return Promise.resolve();
    }
    var a = el.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'ease', fill: 'forwards' });
    return a.finished.then(function () {
      el.style.opacity = String(to);
      a.cancel();
    }, function () { el.style.opacity = String(to); });
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () { resolve(im); };
      im.onerror = function () { resolve(null); };
      im.src = src;
    });
  }

  function timeout(ms) {
    return new Promise(function (resolve) { setTimeout(function () { resolve(null); }, ms); });
  }

  ready(function () {
    var root = document.createElement('div');
    root.className = 'lightbox';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Photo');
    root.tabIndex = -1; /* focus lands on the dialog, so no ring on Back after a click or tap */

    var backdrop = document.createElement('div');
    backdrop.className = 'lightbox-backdrop';

    var back = window.UiBack
      ? window.UiBack.make({ ariaLabel: 'Back', className: 'lightbox-back', style: 'arrow' })
      : document.createElement('button');
    if (!window.UiBack) {
      back.type = 'button';
      back.className = 'ui-back lightbox-back';
      back.setAttribute('aria-label', 'Back');
    }

    var photo = document.createElement('img');
    photo.className = 'lightbox-image';
    photo.alt = '';

    root.appendChild(backdrop);
    root.appendChild(photo);
    root.appendChild(back);
    document.body.appendChild(root);

    var state = 'closed'; /* closed | opening | open | closing */
    var thumb = null;
    var lastFocus = null;
    var wantClose = false;

    function lockScroll() {
      var sbw = window.innerWidth - document.documentElement.clientWidth;
      if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
      document.body.classList.add('lightbox-open');
    }

    function unlockScroll() {
      document.body.classList.remove('lightbox-open', 'lightbox-closing');
      document.body.style.paddingRight = '';
    }

    function openFrom(img) {
      if (state !== 'closed') return;
      state = 'opening';
      wantClose = false;
      thumb = img;
      lastFocus = document.activeElement;
      root.classList.remove('is-open');

      /* Pause the drift first, then read where the photo is right now. */
      document.body.classList.add('lightbox-paused');
      lockScroll();
      var start = rectOf(img); /* read after the scroll lock so a scrollbar shift can't move it */

      var thumbSrc = img.currentSrc || img.src;
      var fullSrc = fullSrcFor(img);

      Promise.race([loadImage(fullSrc), timeout(FULL_WAIT_MS)]).then(function (full) {
        var src = full ? full.src : thumbSrc;
        var aspect = full ? full.naturalWidth / full.naturalHeight
                          : (img.naturalWidth / img.naturalHeight) || (start.width / start.height);
        photo.src = src;
        photo.alt = img.alt || '';
        /* If the full image wasn't ready, swap it in once it is. */
        if (!full && fullSrc) {
          loadImage(fullSrc).then(function (late) {
            if (!late || thumb !== img || state === 'closed') return;
            photo.src = late.src;
            if (state === 'open') {
              var r2 = targetRect(late.naturalWidth / late.naturalHeight);
              animate(photo, rectOf(photo), r2, DIM_MS, EASE_OUT);
            }
          });
        }

        var end = targetRect(aspect);
        back.classList.remove('is-pressed');
        backdrop.style.opacity = '0';
        back.style.opacity = '0';
        setBox(photo, start);
        root.hidden = false;
        img.style.visibility = 'hidden';

        var flight;
        if (reducedMotion()) {
          setBox(photo, end);
          photo.style.opacity = '0';
          flight = Promise.all([fade(photo, 0, 1, DIM_MS), fade(backdrop, 0, 0.85, DIM_MS), fade(back, 0, 1, DIM_MS)]);
        } else {
          photo.style.opacity = '1';
          flight = animate(photo, start, end, OPEN_MS, EASE_OUT).then(function () {
            return Promise.all([fade(backdrop, 0, 0.85, DIM_MS), fade(back, 0, 1, DIM_MS)]);
          });
        }
        flight.then(function () {
          state = 'open';
          root.classList.add('is-open');
          try { root.focus({ preventScroll: true }); } catch (e) { root.focus(); }
          if (wantClose) close();
        });
      });
    }

    function close() {
      if (state === 'opening') { wantClose = true; return; }
      if (state !== 'open') return;
      state = 'closing';
      root.classList.remove('is-open');
      document.body.classList.add('lightbox-closing');
      var from = rectOf(photo);
      var seq;
      if (reducedMotion()) {
        seq = Promise.all([fade(photo, 1, 0, DIM_MS), fade(backdrop, 0.85, 0, DIM_MS)]);
      } else {
        seq = fade(backdrop, 0.85, 0, DIM_MS).then(function () {
          /* Read the thumbnail's spot now (drift is paused, so it is where it was). */
          var to = rectOf(thumb);
          return animate(photo, from, to, CLOSE_MS, EASE_IN_OUT);
        });
      }
      seq.then(finishClose);
    }

    function finishClose() {
      if (thumb) thumb.style.visibility = '';
      root.hidden = true;
      photo.removeAttribute('src');
      photo.style.opacity = '';
      back.style.opacity = '';
      back.classList.remove('is-pressed');
      document.body.classList.remove('lightbox-paused');
      unlockScroll();
      state = 'closed';
      var f = lastFocus;
      thumb = null;
      lastFocus = null;
      if (f && typeof f.focus === 'function' && f !== document.body) {
        try { f.focus({ preventScroll: true }); } catch (err) {}
      }
    }

    root.addEventListener('click', function (e) {
      if (state === 'closed' || state === 'closing') return;
      if (e.target.closest('.lightbox-back')) back.classList.add('is-pressed');
      close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && (state === 'open' || state === 'opening')) {
        e.preventDefault();
        close();
      }
    });

    document.querySelectorAll(SELECTOR).forEach(function (img) {
      img.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openFrom(img);
      });
    });

    window.GalleryLightbox = { state: function () { return state; } };
  });
})();

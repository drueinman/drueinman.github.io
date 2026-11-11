/* Gallery lightbox: open the full uncropped photo; tap anywhere or Esc to slide off. */
(function () {
  var SELECTOR = '.gallery-strip-track img, .gallery-track img';
  var CLOSE_MS = 350;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  ready(function () {
    var root = document.createElement('div');
    root.className = 'lightbox';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Photo');

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

    root.appendChild(back);
    root.appendChild(photo);
    document.body.appendChild(root);

    var lastFocus = null;
    var isOpen = false;
    var isClosing = false;

    function openFrom(img) {
      if (isOpen || isClosing) return;
      lastFocus = document.activeElement;
      photo.src = img.currentSrc || img.src;
      photo.alt = img.alt || '';
      back.classList.remove('is-pressed');
      root.classList.remove('is-closing');
      root.hidden = false;
      isOpen = true;
      document.body.classList.add('lightbox-open');
      back.focus();
    }

    function close() {
      if (!isOpen || isClosing) return;
      isClosing = true;
      document.body.classList.add('lightbox-closing');
      if (prefersReducedMotion()) {
        finishClose();
        return;
      }
      root.classList.add('is-closing');
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        root.removeEventListener('transitionend', onEnd);
        clearTimeout(failsafe);
        finishClose();
      }
      function onEnd(e) {
        if (e.target === root) finish();
      }
      root.addEventListener('transitionend', onEnd);
      var failsafe = setTimeout(finish, CLOSE_MS + 100);
    }

    function finishClose() {
      root.hidden = true;
      root.classList.remove('is-closing');
      document.body.classList.remove('lightbox-open', 'lightbox-closing');
      photo.removeAttribute('src');
      back.classList.remove('is-pressed');
      isOpen = false;
      isClosing = false;
      if (lastFocus && typeof lastFocus.focus === 'function') {
        try { lastFocus.focus(); } catch (err) {}
      }
    }

    root.addEventListener('click', function (e) {
      if (!isOpen || isClosing) return;
      if (e.target.closest('.lightbox-back')) {
        back.classList.add('is-pressed');
      } else {
        back.classList.remove('is-pressed');
      }
      close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen && !isClosing) {
        e.preventDefault();
        back.classList.remove('is-pressed');
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
  });
})();

/* Shared Back button. data-back-style="arrow" (default) or "return". */
(function () {
  var SETS = {
    arrow: {
      normal: 'img/ui/back-button.png',
      active: 'img/ui/back-button-active.png'
    },
    return: {
      normal: 'img/ui/return-button.png',
      active: 'img/ui/return-button-active.png'
    }
  };

  function applyStyle(el) {
    var name = el.getAttribute('data-back-style') || 'arrow';
    var set = SETS[name] || SETS.arrow;
    var normal = el.querySelector('.ui-back-img--normal');
    var active = el.querySelector('.ui-back-img--active');
    if (normal) normal.src = set.normal;
    if (active) active.src = set.active;
  }

  function init(root) {
    (root || document).querySelectorAll('.ui-back').forEach(applyStyle);
  }

  function isNavLink(el) {
    return el.tagName === 'A' && el.getAttribute('href') && !el.classList.contains('lightbox-back');
  }

  document.addEventListener('pointerdown', function (e) {
    var btn = e.target.closest('.ui-back');
    if (btn) btn.classList.add('is-pressed');
  });

  document.addEventListener('pointerup', function (e) {
    document.querySelectorAll('.ui-back.is-pressed').forEach(function (btn) {
      if (document.body.classList.contains('lightbox-closing')) return;
      if (btn.contains(e.target)) return;
      btn.classList.remove('is-pressed');
    });
  });

  document.addEventListener('pointercancel', function (e) {
    var btn = e.target.closest('.ui-back');
    if (!btn) return;
    if (document.body.classList.contains('lightbox-closing')) return;
    btn.classList.remove('is-pressed');
  });

  /* Keep the blue state on a Back-to-Home link through the navigation. */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a.ui-back');
    if (link && isNavLink(link)) link.classList.add('is-pressed');
  });

  function make(opts) {
    opts = opts || {};
    var style = opts.style || 'arrow';
    var label = opts.ariaLabel || 'Back';
    var tag = opts.href ? 'a' : (opts.tag || 'button');
    var el = document.createElement(tag);
    el.className = 'ui-back' + (opts.className ? ' ' + opts.className : '');
    el.setAttribute('data-back-style', style);
    el.setAttribute('aria-label', label);
    if (tag === 'button') el.type = 'button';
    if (opts.href) el.href = opts.href;
    var set = SETS[style] || SETS.arrow;
    var normal = document.createElement('img');
    normal.className = 'ui-back-img ui-back-img--normal';
    normal.src = set.normal;
    normal.alt = label;
    var active = document.createElement('img');
    active.className = 'ui-back-img ui-back-img--active';
    active.src = set.active;
    active.alt = '';
    el.appendChild(normal);
    el.appendChild(active);
    return el;
  }

  window.UiBack = { SETS: SETS, applyStyle: applyStyle, init: init, make: make };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();

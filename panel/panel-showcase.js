(function () {
  var panel = document.getElementById("panel");
  var room = document.getElementById("room");
  if (!panel || !room) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var matrixCanvas = document.getElementById("matrix");
  var tv = document.getElementById("tv");
  var tvOff = document.getElementById("tv-off");
  var tvVol = document.getElementById("tv-vol");
  var tvBezel = tv ? tv.parentElement : null;
  var fireplace = document.getElementById("fireplace");
  var gate = document.getElementById("gate");
  var gateCaption = document.getElementById("gate-caption");
  var statusEl = document.getElementById("room-status");
  var picker = document.getElementById("picker");

  var state = {
    lights: false,
    fire: false,
    gateOpen: false,
    tvOn: false,
    tvSource: null,
    volume: 40,
    muted: false,
    sourceBtn: null
  };

  var palettes = {
    roku: ["#2a0854", "#7c3aed", "#c4b5fd"],
    netflix: ["#450a0a", "#dc2626", "#1c1917"],
    youtube: ["#7f1d1d", "#ef4444", "#fafafa"],
    yttv: ["#3f0d12", "#b91c1c", "#e5e7eb"],
    prime: ["#082f49", "#0284c7", "#7dd3fc"],
    hulu: ["#052e16", "#16a34a", "#bbf7d0"],
    sling: ["#431407", "#ea580c", "#fdba74"],
    paramount: ["#0c1a3a", "#1d4ed8", "#93c5fd"],
    sirius: ["#111827", "#38bdf8", "#e5e7eb"],
    apple: ["#111827", "#9ca3af", "#f3f4f6"],
    radio: ["#1c1917", "#f59e0b", "#fde68a"]
  };

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function updateStatus() {
    var parts = [
      state.lights ? "Lights on" : "Lights off",
      state.fire ? "Fireplace on" : "Fireplace off",
      state.gateOpen ? "Gate open" : "Gate closed",
      state.tvOn ? (state.tvSource ? "TV · " + cap(state.tvSource) : "TV on") : "TV off"
    ];
    if (state.tvOn && state.muted) parts.push("Muted");
    statusEl.textContent = parts.join(" · ");
    room.setAttribute("data-lights", state.lights ? "on" : "off");
    fireplace.setAttribute("data-on", state.fire ? "true" : "false");
    gate.setAttribute("data-open", state.gateOpen ? "true" : "false");
    gateCaption.textContent = state.gateOpen ? "Front gate open" : "Front gate closed";
    if (tvBezel) tvBezel.setAttribute("data-on", state.tvOn ? "true" : "false");
  }

  function flash(btn) {
    btn.classList.add("is-pressed");
    window.setTimeout(function () {
      btn.classList.remove("is-pressed");
    }, 420);
  }

  function setSourceOn(btn) {
    var prev = panel.querySelectorAll('button[data-act="tv"].is-on');
    prev.forEach(function (b) { b.classList.remove("is-on"); });
    if (btn) btn.classList.add("is-on");
    state.sourceBtn = btn;
  }

  function allOff() {
    state.lights = false;
    state.fire = false;
    state.tvOn = false;
    state.tvSource = null;
    setSourceOn(null);
    panel.querySelectorAll("button.is-on").forEach(function (b) {
      if (b.getAttribute("data-act") !== "lock" && b.getAttribute("data-act") !== "unlock") {
        b.classList.remove("is-on");
      }
    });
    updateStatus();
  }

  function onPress(btn) {
    var act = btn.getAttribute("data-act");
    flash(btn);
    if (act === "lights") {
      state.lights = !state.lights;
      panel.querySelectorAll('button[data-act="lights"]').forEach(function (b) {
        b.classList.toggle("is-on", state.lights);
      });
    } else if (act === "climate") {
      state.fire = !state.fire;
      btn.classList.toggle("is-on", state.fire);
    } else if (act === "lock") {
      state.gateOpen = false;
      panel.querySelectorAll('button[data-act="lock"],button[data-act="unlock"]').forEach(function (b) {
        b.classList.toggle("is-on", b === btn);
      });
    } else if (act === "unlock") {
      state.gateOpen = true;
      panel.querySelectorAll('button[data-act="lock"],button[data-act="unlock"]').forEach(function (b) {
        b.classList.toggle("is-on", b === btn);
      });
    } else if (act === "home") {
      state.lights = true;
      state.fire = true;
      state.gateOpen = false;
      state.tvOn = true;
      state.tvSource = state.tvSource || "roku";
      panel.querySelectorAll('button[data-act="lights"]').forEach(function (b) {
        b.classList.add("is-on");
      });
      var climate = panel.querySelector('button[data-act="climate"]');
      if (climate) climate.classList.add("is-on");
      var lockBtn = panel.querySelector('button[data-act="lock"]');
      var unlockBtn = panel.querySelector('button[data-act="unlock"]');
      if (lockBtn) lockBtn.classList.add("is-on");
      if (unlockBtn) unlockBtn.classList.remove("is-on");
      if (!state.sourceBtn) {
        var roku = panel.querySelector('button[data-src="roku"]');
        setSourceOn(roku);
      }
    } else if (act === "away") {
      allOff();
      state.gateOpen = false;
      var lockBtn = panel.querySelector('button[data-act="lock"]');
      if (lockBtn) lockBtn.classList.add("is-on");
    } else if (act === "power") {
      allOff();
    } else if (act === "tv" || act === "radio") {
      var src = btn.getAttribute("data-src") || "radio";
      state.tvOn = true;
      state.tvSource = src;
      setSourceOn(btn);
    } else if (act === "mute") {
      state.muted = !state.muted;
      btn.classList.toggle("is-on", state.muted);
    } else if (act === "volup") {
      state.volume = Math.min(100, state.volume + 8);
      showVol();
    } else if (act === "voldown") {
      state.volume = Math.max(0, state.volume - 8);
      showVol();
    }
    updateStatus();
  }

  function showVol() {
    if (!tvVol) return;
    tvVol.hidden = false;
    tvVol.textContent = state.muted ? "Muted" : ("Vol " + state.volume);
    window.clearTimeout(showVol.tid);
    showVol.tid = window.setTimeout(function () { tvVol.hidden = true; }, 900);
  }

  panel.addEventListener("click", function (e) {
    var btn = e.target.closest("button");
    if (!btn || !panel.contains(btn)) return;
    onPress(btn);
  });

  if (picker) {
    picker.addEventListener("click", function (e) {
      var btn = e.target.closest("button");
      if (!btn) return;
      var group = btn.parentElement;
      if (!group) return;
      var kind = group.getAttribute("data-group");
      if (!kind) return;
      group.querySelectorAll("button").forEach(function (b) {
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      if (kind === "btn") {
        panel.setAttribute("data-btn", btn.getAttribute("data-btn-type"));
      } else if (kind === "font") {
        panel.style.setProperty("--font", btn.getAttribute("data-font"));
      } else if (kind === "wall") {
        panel.setAttribute("data-wall", btn.getAttribute("data-wall"));
      } else if (kind === "anim") {
        panel.setAttribute("data-anim", btn.getAttribute("data-anim"));
      } else if (kind === "icons") {
        var mode = btn.getAttribute("data-icons");
        panel.setAttribute("data-icons", mode);
        if (mode === "only") {
          panel.setAttribute("data-btn", "plain");
        }
      }
    });
  }

  /* Matrix rain — canvas stand-in matching the falling-code wallpaper */
  var matrixOn = false;
  var matrixId = 0;
  function startMatrix() {
    if (!matrixCanvas || reduced) {
      if (matrixCanvas) {
        var c = matrixCanvas.getContext("2d");
        if (c) {
          c.fillStyle = "#001400";
          c.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);
          c.fillStyle = "#16a34a";
          c.font = "12px monospace";
          c.fillText("010101  110010  100111", 16, 40);
        }
      }
      return;
    }
    if (matrixOn) return;
    matrixOn = true;
    var ctx = matrixCanvas.getContext("2d");
    var w = matrixCanvas.width;
    var h = matrixCanvas.height;
    var cols = Math.floor(w / 14);
    var drops = [];
    var i;
    for (i = 0; i < cols; i += 1) drops[i] = Math.random() * h / 14;
    var glyphs = "01アイウエオカキクケコ2489Z";
    function tick() {
      if (panel.getAttribute("data-wall") !== "matrix") {
        matrixOn = false;
        return;
      }
      ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#22c55e";
      ctx.font = "13px ui-monospace, monospace";
      for (i = 0; i < cols; i += 1) {
        var ch = glyphs.charAt(Math.floor(Math.random() * glyphs.length));
        ctx.fillText(ch, i * 14, drops[i] * 14);
        if (drops[i] * 14 > h && Math.random() > 0.975) drops[i] = 0;
        drops[i] += 1;
      }
      matrixId = window.requestAnimationFrame(tick);
    }
    tick();
  }

  var wallWatcher = new MutationObserver(function () {
    if (panel.getAttribute("data-wall") === "matrix") startMatrix();
    else {
      matrixOn = false;
      window.cancelAnimationFrame(matrixId);
    }
  });
  wallWatcher.observe(panel, { attributes: true, attributeFilter: ["data-wall"] });

  /* Simulated television — original color fields, not copyrighted clips */
  var tvT = 0;
  function drawTv() {
    if (!tv) return;
    var ctx = tv.getContext("2d");
    var w = tv.width;
    var h = tv.height;
    tvT += 0.016;
    if (!state.tvOn) {
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, w, h);
      window.requestAnimationFrame(drawTv);
      return;
    }
    var pal = palettes[state.tvSource] || palettes.roku;
    var g = ctx.createLinearGradient(
      w * (0.5 + 0.3 * Math.sin(tvT * 0.4)),
      0,
      w * (0.5 + 0.3 * Math.cos(tvT * 0.35)),
      h
    );
    g.addColorStop(0, pal[0]);
    g.addColorStop(0.5, pal[1]);
    g.addColorStop(1, pal[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    var i;
    ctx.globalAlpha = 0.18;
    for (i = 0; i < 6; i += 1) {
      ctx.fillStyle = i % 2 ? pal[2] : pal[0];
      var y = ((tvT * 18 + i * 34) % (h + 40)) - 20;
      ctx.fillRect(0, y, w, 16);
    }
    ctx.globalAlpha = 0.08;
    for (i = 0; i < 80; i += 1) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    ctx.globalAlpha = 1;
    if (state.muted) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(w - 86, 12, 74, 22);
      ctx.fillStyle = "#fff";
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillText("MUTED", w - 76, 28);
    }
    window.requestAnimationFrame(drawTv);
  }

  if (!reduced) drawTv();
  else if (tv) {
    var ctx = tv.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, tv.width, tv.height);
  }

  updateStatus();

  if (/(?:[?&]demo=1(?:&|$))|(?:#live)/.test(location.search + location.hash)) {
    var homeBtn = panel.querySelector('[data-act="home"]');
    if (homeBtn) onPress(homeBtn);
  }
})();

/* FocusRotate: Aloy earpiece squares (Drue 111426 0000 / 0002 / 0015 / 0037).
   Ellipse motion (not a plain rotate). Reversals ease to 0, hold, flip sign. Mood table in moods.json.
   Color activity (0–1 per mood): 0 = plain earpiece squares with an occasional single-square blink, traces nearly invisible;
   1 = all 27 squares cycle colors and traces are at full busyness (the previous always-on look). Blend ~1 s with the mood table.
   Rotation and reversals are independent of activity. Face effects: Off, A (cheek projection), B (circuit traces, default).
   Drop-in for the phone player and the desktop Emote App. */
'use strict';
(function (global) {
  const DEG = Math.PI / 180;
  const DEFAULT_MOODS = {
    blend_s: 1, default: 'calm',
    profiles: {
      calm:      { period_s: 24, speed_wander: 0.04, wander_hz: 0.06, reverse_min_s: 20, reverse_max_s: 40, ease_s: 1.0,  hold_s: 0.45, jitter_deg: 0,    pulse_min_s: 3.0, pulse_max_s: 6.0, pulse_speed: 0.45, activity: 0 },
      unsettled: { period_s: 18, speed_wander: 0.28, wander_hz: 0.22, reverse_min_s: 4,  reverse_max_s: 10, ease_s: 0.55, hold_s: 0.25, jitter_deg: 0.35, pulse_min_s: 0.8, pulse_max_s: 2.0, pulse_speed: 0.75, activity: 1 }
    },
    faces: {
      amused: 'calm', friendly: 'calm', happy: 'calm', 'happy-v2': 'calm', blush: 'calm', laughing: 'calm',
      focused: 'calm', relieved: 'calm', proud: 'calm', neutral: 'calm', base: 'calm', listening: 'calm',
      sleepy: 'calm', thinking: 'calm', 'thinking-up': 'calm', business: 'calm',
      worried: 'unsettled', determined: 'unsettled', annoyed: 'unsettled', surprised: 'unsettled',
      sad: 'unsettled', 'sad-tears': 'unsettled', confused: 'unsettled', skeptical: 'unsettled',
      'skeptical-up': 'unsettled', alert: 'unsettled', excited: 'unsettled', apologetic: 'unsettled',
      concerned: 'unsettled', guilty: 'unsettled', 'guilty-down': 'unsettled', furious: 'unsettled',
      'furious-hurt': 'unsettled', 'furious-mf': 'unsettled', 'hurt-holding-back': 'unsettled'
    },
    activity_default: 0,
    activity: {
      neutral: 0, base: 0, friendly: 0, focused: 0, relieved: 0, listening: 0, sleepy: 0,
      thinking: 0, 'thinking-up': 0, business: 0,
      amused: 0.3, happy: 0.3, 'happy-v2': 0.3, blush: 0.3, proud: 0.3, laughing: 0.35,
      confused: 1, skeptical: 1, 'skeptical-up': 1, apologetic: 1, concerned: 1, determined: 1,
      guilty: 1, 'guilty-down': 1, worried: 1, annoyed: 1, surprised: 1, sad: 1, 'sad-tears': 1,
      alert: 1, excited: 1, furious: 1, 'furious-hurt': 1, 'furious-mf': 1, 'hurt-holding-back': 1
    }
  };
  /* Anchors in face-canvas pixels. Endpoints sit just outside the eyeball and lips (from iris/sclera masks and mouth rows). */
  const DEFAULT_ANCHORS = {
    phone: { origin: [168, 408], temple: [196, 326], eyeOuter: [226, 378], nose: [345, 505], mouthCorner: [298, 585],
             keepEye: [231, 335, 150, 130], keepLips: [308, 555, 210, 150],
             panel: [172, 448, 78, 112] },
    '5x8': { origin: [149, 457], temple: [185, 395], eyeOuter: [246, 446], nose: [320, 540], mouthCorner: [274, 612],
             keepEye: [257, 420, 120, 65], keepLips: [282, 608, 170, 65],
             panel: [158, 478, 76, 108] },
    normalear: { origin: [148, 400], temple: [186, 334], eyeOuter: [258, 386], nose: [331, 489], mouthCorner: [258, 548],
             keepEye: [267, 368, 130, 62], keepLips: [268, 550, 200, 80],
             panel: [158, 418, 80, 112] }
  };
  const PAL = [[78,163,255],[46,224,200],[255,192,40],[255,79,192],[62,224,122]]; // blue teal amber magenta green
  const MOOD_COL = {
    calm:      { line: [130, 205, 255], pulse: [200, 235, 255], panel: [80, 170, 255], beam: [140, 210, 255] },
    unsettled: { line: [255, 150, 55],  pulse: [255, 85, 55],   panel: [255, 120, 40], beam: [255, 140, 50] }
  };

  const FR = {
    ready: false, cfg: null, on: false, period: 24, glowTint: '#408cff',
    last: 0, a: 0, dest: null, box: null, xform: null, moods: DEFAULT_MOODS,
    faceFx: 'b', frame: 'phone', anchors: DEFAULT_ANCHORS.phone,
    _sq: null, _ell: null, _sprite: null, _base: null, _glow: null, _glowTinted: null,
    _off: null, _tint: null, _cw: 1050, _ch: 1260, _scale: 1 / 3
  };

  let _rng = 0xC0FFEE;
  function seed(n) { _rng = (n >>> 0) || 0xC0FFEE; }
  function rnd() { _rng = (_rng * 1664525 + 1013904223) >>> 0; return _rng / 4294967296; }
  function rand(a, b) { return a + rnd() * (b - a); }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function smooth(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function lerp3(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
  function rgba(c, a) { return 'rgba(' + (c[0]|0) + ',' + (c[1]|0) + ',' + (c[2]|0) + ',' + a + ')'; }

  const MOT = {
    wall: 0, theta: 0, speed: 15, sign: 1,
    phase: 'cruise', phaseT: 0, easeFrom: 15, easeTo: 0,
    nextRev: 0, mood: 'amused', profName: 'calm',
    fromProf: null, toProf: 'calm', blendT: 1, blendS: 1,
    wanderPh: 0, inited: false,
    pulses: [], nextPulse: 0,
    fromAct: 0, toAct: 0,
    blinkI: -1, blinkT: 0, blinkDur: 0.8, nextBlink: 0
  };

  function lookupProf(name) {
    const faces = (FR.moods && FR.moods.faces) || {};
    const def = (FR.moods && FR.moods.default) || 'calm';
    const key = String(name || '').toLowerCase();
    return faces[key] || faces[key.replace(/-v\d+$/, '')] || def;
  }
  function lookupActivity(name) {
    const key = String(name || '').toLowerCase();
    const act = (FR.moods && FR.moods.activity) || {};
    if (act[key] != null && isFinite(+act[key])) return clamp(+act[key], 0, 1);
    const stripped = key.replace(/-v\d+$/, '');
    if (act[stripped] != null && isFinite(+act[stripped])) return clamp(+act[stripped], 0, 1);
    const prof = lookupProf(name);
    const p = rawProfile(prof);
    if (p && p.activity != null && isFinite(+p.activity)) return clamp(+p.activity, 0, 1);
    if (FR.moods && FR.moods.activity_default != null) return clamp(+FR.moods.activity_default, 0, 1);
    return prof === 'unsettled' ? 1 : 0;
  }
  function currentActivity() {
    const to = (MOT.toAct != null) ? MOT.toAct : lookupActivity(MOT.mood);
    if (MOT.fromAct == null || MOT.blendT >= MOT.blendS) return to;
    return lerp(MOT.fromAct, to, smooth(MOT.blendT / (MOT.blendS || 1)));
  }
  function rawProfile(name) {
    return (FR.moods && FR.moods.profiles && FR.moods.profiles[name]) || DEFAULT_MOODS.profiles[name] || DEFAULT_MOODS.profiles.calm;
  }
  function lerpProf(a, b, u) {
    const k = ['period_s','speed_wander','wander_hz','reverse_min_s','reverse_max_s','ease_s','hold_s','jitter_deg','pulse_min_s','pulse_max_s','pulse_speed'];
    const o = {};
    for (let i = 0; i < k.length; i++) o[k[i]] = lerp(+a[k[i]] || 0, +b[k[i]] || 0, u);
    return o;
  }
  function currentProf() {
    const to = rawProfile(MOT.toProf || 'calm');
    if (!MOT.fromProf || MOT.blendT >= MOT.blendS) return to;
    return lerpProf(rawProfile(MOT.fromProf), to, smooth(MOT.blendT / (MOT.blendS || 1)));
  }
  function moodBlend() { return (!MOT.fromProf || MOT.blendT >= MOT.blendS) ? 1 : smooth(MOT.blendT / (MOT.blendS || 1)); }
  function moodColors() {
    const u = (MOT.toProf === 'unsettled') ? moodBlend() : 1 - moodBlend();
    // when blending from A to B, u is toward toProf
    const from = MOOD_COL[MOT.fromProf || MOT.toProf || 'calm'];
    const to = MOOD_COL[MOT.toProf || 'calm'];
    const t = (!MOT.fromProf || MOT.blendT >= MOT.blendS) ? 1 : moodBlend();
    return { line: lerp3(from.line, to.line, t), pulse: lerp3(from.pulse, to.pulse, t), panel: lerp3(from.panel, to.panel, t), beam: lerp3(from.beam, to.beam, t) };
  }
  function cruiseMag(p) {
    const period = (p.period_s > 0 ? p.period_s : FR.period) || 24;
    const w = 1 + (p.speed_wander || 0) * Math.sin(MOT.wanderPh);
    return (360 / period) * Math.max(0.35, w);
  }
  function scheduleRev(wall, p) { MOT.nextRev = wall + rand(p.reverse_min_s || 20, p.reverse_max_s || 40); }

  function stepOnce(h, wall, p) {
    MOT.blendT = Math.min(MOT.blendS, MOT.blendT + h);
    MOT.wanderPh += h * 2 * Math.PI * (p.wander_hz || 0.08);
    const mag = cruiseMag(p);
    if (MOT.phase === 'cruise') {
      MOT.speed = MOT.sign * mag;
      if (wall >= MOT.nextRev) { MOT.phase = 'easeOut'; MOT.phaseT = 0; MOT.easeFrom = MOT.speed; MOT.easeTo = 0; }
    } else if (MOT.phase === 'easeOut') {
      MOT.phaseT += h;
      MOT.speed = lerp(MOT.easeFrom, 0, smooth(MOT.phaseT / Math.max(0.05, p.ease_s)));
      if (MOT.phaseT >= p.ease_s) { MOT.phase = 'hold'; MOT.phaseT = 0; MOT.speed = 0; }
    } else if (MOT.phase === 'hold') {
      MOT.speed = 0; MOT.phaseT += h;
      if (MOT.phaseT >= p.hold_s) { MOT.sign *= -1; MOT.phase = 'easeIn'; MOT.phaseT = 0; MOT.easeFrom = 0; MOT.easeTo = MOT.sign * mag; }
    } else if (MOT.phase === 'easeIn') {
      MOT.phaseT += h;
      MOT.easeTo = MOT.sign * mag;
      MOT.speed = lerp(0, MOT.easeTo, smooth(MOT.phaseT / Math.max(0.05, p.ease_s)));
      if (MOT.phaseT >= p.ease_s) { MOT.phase = 'cruise'; MOT.phaseT = 0; MOT.speed = MOT.sign * mag; scheduleRev(wall, p); }
    }
    MOT.theta += MOT.speed * h;
    stepPulses(h, wall, p);
    stepBlink(h, wall);
  }
  function stepBlink(h, wall) {
    const A = currentActivity();
    const n = (FR._sq && FR._sq.length) || 27;
    if (A >= 0.97) { MOT.blinkI = -1; return; }
    if (MOT.blinkI < 0) {
      if (!MOT.nextBlink) MOT.nextBlink = wall + rand(lerp(3.2, 1.4, A), lerp(6.5, 2.8, A));
      if (wall >= MOT.nextBlink) {
        MOT.blinkI = Math.floor(rnd() * n);
        MOT.blinkT = 0;
        MOT.blinkDur = 0.65 + rnd() * 0.55;
      }
    } else {
      MOT.blinkT += h;
      if (MOT.blinkT >= MOT.blinkDur) {
        MOT.blinkI = -1;
        MOT.nextBlink = wall + rand(lerp(3.2, 1.4, A), lerp(6.5, 2.8, A));
      }
    }
  }
  function squareTint(i, wall) {
    const A = currentActivity();
    let a = A;
    if (MOT.blinkI === i && MOT.blinkDur > 0) {
      const u = clamp(MOT.blinkT / MOT.blinkDur, 0, 1);
      const env = (u < 0.5 ? u * 2 : (1 - u) * 2);
      a = Math.max(a, env);
    }
    return clamp(a, 0, 1);
  }
  function integrate(wall) {
    const p0 = currentProf();
    if (!MOT.inited) {
      MOT.inited = true; MOT.wall = wall; MOT.sign = 1; MOT.speed = cruiseMag(p0); MOT.phase = 'cruise';
      scheduleRev(wall, p0); MOT.nextPulse = wall + rand(0.4, 1.6); return;
    }
    if (wall < MOT.wall - 0.25) { MOT.wall = wall; return; }
    let dt = wall - MOT.wall;
    const step = 1 / 30, maxCatch = 8;
    if (dt > maxCatch) { MOT.wall = wall - maxCatch; dt = maxCatch; }
    while (dt > 1e-5) { const h = Math.min(step, dt); MOT.wall += h; stepOnce(h, MOT.wall, currentProf()); dt -= h; }
    MOT.wall = wall;
  }
  function jitterOffset(wall, p) {
    const a = p.jitter_deg || 0;
    if (a <= 0) return 0;
    return a * (0.65 * Math.sin(wall * 13.7) + 0.35 * Math.sin(wall * 7.3 + 1.1));
  }

  /* ---------- square palette ---------- */
  function squareColor(i, wall) {
    const u = ((wall / 12) + i * 0.6180339887) % 1;
    const x = u * PAL.length, i0 = Math.floor(x), t = smooth(x - i0), i1 = (i0 + 1) % PAL.length;
    const a = PAL[i0], b = PAL[i1];
    return 'rgb(' + (a[0] + (b[0] - a[0]) * t | 0) + ',' + (a[1] + (b[1] - a[1]) * t | 0) + ',' + (a[2] + (b[2] - a[2]) * t | 0) + ')';
  }

  /* ---------- traces ---------- */
  function anchors() { return FR.anchors || DEFAULT_ANCHORS[FR.frame] || DEFAULT_ANCHORS.phone; }
  function makePaths(A) {
    const o = A.origin;
    // Right-angle (Manhattan) traces on the earpiece side, fanning to temple, eye, nose, mouth.
    // Mid x stays left of the outer canthus so we never cross the eyeball.
    const mid = Math.min(o[0] + 42, (A.eyeOuter[0] + o[0]) * 0.5);
    return [
      [o, [o[0], A.temple[1]], A.temple],
      [o, [A.eyeOuter[0], o[1]], A.eyeOuter],
      [o, [mid, o[1]], [mid, A.nose[1]], A.nose],
      [o, [mid - 8, o[1]], [mid - 8, A.mouthCorner[1]], A.mouthCorner]
    ];
  }
  function pathLen(path) {
    let n = 0;
    for (let i = 1; i < path.length; i++) n += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    return n;
  }
  function along(path, u) {
    let rest = clamp(u, 0, 1) * pathLen(path);
    for (let i = 1; i < path.length; i++) {
      const dx = path[i][0] - path[i - 1][0], dy = path[i][1] - path[i - 1][1], L = Math.hypot(dx, dy) || 1;
      if (rest <= L) return [path[i - 1][0] + dx * rest / L, path[i - 1][1] + dy * rest / L];
      rest -= L;
    }
    return path[path.length - 1];
  }
  function stepPulses(h, wall, p) {
    if (FR.faceFx !== 'b' && FR.faceFx !== 'a') { MOT.pulses = []; return; }
    const A = currentActivity();
    const paths = makePaths(anchors());
    if (wall >= MOT.nextPulse) {
      const busy = (MOT.toProf === 'unsettled' || (MOT.fromProf === 'unsettled' && moodBlend() < 1)) ? 1 : 0;
      const maxFull = busy ? 5 : 2;
      const maxP = (A >= 0.97) ? maxFull : (A < 0.12 ? 1 : Math.max(1, Math.round(lerp(1, maxFull, A))));
      if (MOT.pulses.length < maxP) {
        MOT.pulses.push({ path: Math.floor(rnd() * paths.length) % paths.length, u: 0, v: (p.pulse_speed || 0.5) * lerp(0.7, 1, A) });
      }
      MOT.nextPulse = wall + rand((p.pulse_min_s || 3) * lerp(1.8, 1, A), (p.pulse_max_s || 6) * lerp(1.8, 1, A));
    }
    const keep = [];
    for (let i = 0; i < MOT.pulses.length; i++) {
      const q = MOT.pulses[i];
      q.u += q.v * h;
      if (q.u < 1.05) keep.push(q);
    }
    MOT.pulses = keep;
  }
  function drawTraces(ctx, alpha) {
    const A = anchors(), paths = makePaths(A), col = moodColors();
    const busy = currentProf();
    const act = currentActivity();
    const lineA = (0.22 + 0.12 * (busy.jitter_deg ? 1 : 0)) * alpha * (0.08 + 0.92 * act);
    ctx.save();
    ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
    ctx.strokeStyle = rgba(col.line, lineA);
    ctx.lineWidth = 1.15;
    ctx.shadowColor = rgba(col.line, lineA * 0.8);
    ctx.shadowBlur = 2;
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      for (let k = 1; k < p.length; k++) ctx.lineTo(p[k][0], p[k][1]);
      ctx.stroke();
      const e = p[p.length - 1];
      ctx.beginPath(); ctx.fillStyle = rgba(col.line, lineA + 0.12);
      ctx.arc(e[0], e[1], 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
    for (let i = 0; i < MOT.pulses.length; i++) {
      const q = MOT.pulses[i], path = paths[q.path]; if (!path) continue;
      const pt = along(path, q.u);
      const fade = q.u < 0.08 ? q.u / 0.08 : (q.u > 0.9 ? (1.05 - q.u) / 0.15 : 1);
      ctx.beginPath();
      ctx.fillStyle = rgba(col.pulse, 0.9 * fade * alpha * (0.35 + 0.65 * act));
      ctx.arc(pt[0], pt[1], 2.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------- cheek projection (option A) ---------- */
  function drawProjection(ctx, wall, alpha) {
    const A = anchors(), P = A.panel, col = moodColors(), p = currentProf();
    const busy = p.jitter_deg > 0.05 ? 1 : p.speed_wander > 0.1 ? 1 : 0;
    const flick = 1 + 0.04 * Math.sin(wall * 19) + busy * 0.07 * Math.sin(wall * 43.7);
    const a = alpha * flick * (0.08 + 0.92 * currentActivity());
    const x = P[0], y = P[1], w = P[2], h = P[3], r = 7;
    ctx.save();
    // beam from the tab to the panel
    const o = A.origin, bx = x + 8, by = y + 10;
    const beam = ctx.createLinearGradient(o[0], o[1], bx, by);
    beam.addColorStop(0, rgba(col.beam, 0.0));
    beam.addColorStop(0.25, rgba(col.beam, 0.22 * a));
    beam.addColorStop(1, rgba(col.beam, 0.12 * a));
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(o[0] - 1.2, o[1]); ctx.lineTo(o[0] + 1.2, o[1]);
    ctx.lineTo(bx + 10, by); ctx.lineTo(bx, by + 8); ctx.closePath(); ctx.fill();
    // rounded panel
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = rgba(col.panel, 0.16 * a);
    ctx.fill();
    ctx.strokeStyle = rgba(col.beam, 0.28 * a);
    ctx.lineWidth = 0.8; ctx.stroke();
    // scan lines
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(col.line, 0.14 * a);
    ctx.lineWidth = 1;
    const shift = (wall * (busy ? 28 : 14)) % 6;
    for (let sy = y - 6 + shift; sy < y + h + 2; sy += 4) {
      ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x + w, sy); ctx.stroke();
    }
    // moving data marks
    const n = busy ? 11 : 6;
    ctx.fillStyle = rgba(col.pulse, 0.55 * a);
    for (let i = 0; i < n; i++) {
      const px = x + 6 + ((i * 17 + wall * (busy ? 22 : 9) * (i % 2 ? 1 : 0.6)) % (w - 14));
      const py = y + 8 + ((i * 29 + Math.sin(wall * 1.3 + i) * 8) % (h - 16));
      const mw = 3 + (i % 4) * 2.5, mh = 1.2;
      ctx.fillRect(px, py, mw, mh);
    }
    ctx.restore();
    ctx.restore();
  }

  /* ---------- image helpers + ellipse (same as before) ---------- */
  function loadImage(src) {
    return new Promise(function (res, rej) {
      const im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('FocusRotate: failed to load ' + src)); };
      im.src = src;
    });
  }
  function tintGlow(im, color) {
    const c = document.createElement('canvas');
    c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(im, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function point(tDeg, r) {
    const e = FR._ell, t = tDeg * DEG, th = e.rot;
    const u = r * e.rx * Math.cos(t), v = r * e.ry * Math.sin(t);
    const cos = Math.cos(th), sin = Math.sin(th);
    return [e.cx + u * cos - v * sin, e.cy + u * sin + v * cos];
  }
  function tangent(tDeg) {
    const e = FR._ell, t = tDeg * DEG, th = e.rot;
    const du = -e.rx * Math.sin(t), dv = e.ry * Math.cos(t);
    const cos = Math.cos(th), sin = Math.sin(th);
    return Math.atan2(du * sin + dv * cos, du * cos - dv * sin) / DEG;
  }
  function ensureTint() {
    if (!FR._tint) { FR._tint = document.createElement('canvas'); FR._tint.width = 80; FR._tint.height = 80; }
    return FR._tint;
  }
  function drawSquares(x, dt, wall) {
    const sp = FR._sprite, sc = FR._scale, tint = ensureTint(), tx = tint.getContext('2d');
    if (!sp || !sp.naturalWidth) return;
    for (let i = 0; i < FR._sq.length; i++) {
      const s = FR._sq[i], t = s.ellipse_t_deg + dt;
      const p = point(t, s.ellipse_r);
      const spin = (tangent(t) - s.tangent_deg) * DEG;
      const r = s.sprite;
      const sw = Math.max(1, r.w * sc), sh = Math.max(1, r.h * sc);
      if (tint.width !== Math.ceil(sw) || tint.height !== Math.ceil(sh)) { tint.width = Math.ceil(sw); tint.height = Math.ceil(sh); }
      const px = (s.pivot[0] - r.canvas_x) * sc, py = (s.pivot[1] - r.canvas_y) * sc;
      const ta = squareTint(s.id != null ? s.id : i, wall);
      x.save();
      x.translate(p[0] * sc, p[1] * sc);
      x.rotate(spin);
      x.drawImage(sp, r.x * sc, r.y * sc, r.w * sc, r.h * sc, -px, -py, sw, sh);
      if (ta > 0.001) {
        tx.clearRect(0, 0, tint.width, tint.height);
        tx.globalCompositeOperation = 'source-over';
        tx.drawImage(sp, r.x * sc, r.y * sc, r.w * sc, r.h * sc, 0, 0, sw, sh);
        tx.globalCompositeOperation = 'source-in';
        tx.fillStyle = squareColor(s.id != null ? s.id : i, wall);
        tx.fillRect(0, 0, tint.width, tint.height);
        x.globalAlpha = ta;
        x.drawImage(tint, 0, 0, sw, sh, -px, -py, sw, sh);
        x.globalAlpha = 1;
      }
      x.restore();
    }
  }
  function raster(dt, wall) {
    const off = FR._off; if (!off) return null;
    const x = off.getContext('2d');
    x.clearRect(0, 0, off.width, off.height);
    if (FR._glowTinted) {
      const pulse = 0.8 + 0.2 * Math.sin((wall || 0) * 2 * Math.PI / 3.2);
      x.globalAlpha = pulse; x.drawImage(FR._glowTinted, 0, 0, off.width, off.height); x.globalAlpha = 1;
    }
    x.drawImage(FR._base, 0, 0, off.width, off.height);
    drawSquares(x, dt, wall);
    return off;
  }

  FR.seed = seed;
  FR.setMood = function (name) {
    if (!name) return;
    const prof = lookupProf(name);
    const act = lookupActivity(name);
    MOT.mood = String(name);
    const sameProf = prof === MOT.toProf;
    const sameAct = Math.abs(act - (MOT.toAct != null ? MOT.toAct : act)) < 1e-6;
    if (sameProf && sameAct) return;
    MOT.fromAct = currentActivity();
    MOT.toAct = act;
    if (!sameProf) {
      MOT.fromProf = MOT.toProf || prof;
      MOT.toProf = prof;
      MOT.profName = prof;
      const p = rawProfile(prof);
      const wait = MOT.nextRev - MOT.wall;
      if (MOT.phase === 'cruise' && MOT.nextRev && wait > p.reverse_max_s) MOT.nextRev = MOT.wall + p.reverse_max_s;
    }
    MOT.blendS = (FR.moods && FR.moods.blend_s > 0) ? FR.moods.blend_s : 1;
    MOT.blendT = 0;
  };
  FR.forceReverse = function () { if (MOT.phase === 'cruise') MOT.nextRev = MOT.wall; };
  FR.state = function () {
    const p = currentProf();
    return {
      mood: MOT.mood, profile: MOT.toProf, blend: MOT.blendS ? clamp(MOT.blendT / MOT.blendS, 0, 1) : 1,
      phase: MOT.phase, speed: +MOT.speed.toFixed(3), sign: MOT.sign,
      theta: +((MOT.theta % 360) + 360) % 360, thetaAbs: MOT.theta,
      nextRevIn: +(Math.max(0, MOT.nextRev - MOT.wall)).toFixed(3),
      period_s: p.period_s, jitter_deg: p.jitter_deg, wall: MOT.wall,
      faceFx: FR.faceFx, frame: FR.frame, pulses: MOT.pulses.length,
      activity: +currentActivity().toFixed(3), activityTarget: MOT.toAct, blink: MOT.blinkI
    };
  };
  FR.resetMotion = function (wall) {
    MOT.wall = wall || 0; MOT.theta = 0; MOT.sign = 1; MOT.phase = 'cruise'; MOT.phaseT = 0;
    MOT.inited = false; MOT.blendT = MOT.blendS; MOT.wanderPh = 0; MOT.pulses = []; MOT.nextPulse = (wall || 0) + 0.4;
    MOT.blinkI = -1; MOT.blinkT = 0; MOT.nextBlink = (wall || 0) + 1.2;
  };
  FR.setFaceFx = function (mode) {
    FR.faceFx = (mode === 'a' || mode === 'off' || mode === 'A' || mode === 'Off') ? String(mode).toLowerCase() : 'b';
  };
  FR.setFrame = function (name) {
    if (!name) return;
    FR.frame = name;
    FR.anchors = DEFAULT_ANCHORS[name] || FR.anchors;
  };
  FR.setAnchors = function (a) { if (a) FR.anchors = a; };

  FR.load = async function (cfg) {
    FR.ready = false;
    FR.cfg = cfg || {};
    const rot = (cfg && cfg.rotate) || cfg || {};
    const assets = rot.assets || {};
    const map = rot.map || {};
    FR.period = (rot.period_s > 0 ? rot.period_s : 24);
    FR.glowTint = rot.glow || rot.glowTint || '#408cff';
    FR.dest = rot.dest || map.dest_phone || map.dest || null;
    FR.box = rot.box || (cfg && cfg.box) || map.phone_box || null;
    FR.xform = rot.transform || rot.xform || null;
    if (rot.faceFx) FR.setFaceFx(rot.faceFx);
    if (rot.frame) FR.setFrame(rot.frame);
    const baseUrl = rot.baseUrl || assets.baseUrl || '';
    const join = function (p) { if (!p) return p; if (/^https?:|^data:|^\//.test(p) || !baseUrl) return p; return baseUrl.replace(/\/?$/, '/') + p; };
    if (rot.moods) FR.moods = rot.moods;
    else {
      try {
        const mj = await fetch(join('moods.json')).then(function (r) { return r.ok ? r.json() : null; });
        FR.moods = mj || DEFAULT_MOODS;
      } catch (e) { FR.moods = DEFAULT_MOODS; }
    }
    if (FR.moods.profiles && FR.moods.profiles.calm && FR.moods.profiles.calm.period_s) FR.period = FR.moods.profiles.calm.period_s;
    MOT.toAct = lookupActivity(MOT.mood);
    MOT.fromAct = MOT.toAct;
    MOT.blendT = MOT.blendS;
    if (rot.anchors) FR.anchors = rot.anchors;
    const sqSrc = join(assets.squares || assets.json || 'squares.json');
    const data = await fetch(sqSrc).then(function (r) { if (!r.ok) throw new Error('FocusRotate: ' + sqSrc); return r.json(); });
    FR._cw = data.canvas[0]; FR._ch = data.canvas[1];
    FR._scale = data.asset_scale || ((data.asset_canvas && data.asset_canvas[0]) ? data.asset_canvas[0] / data.canvas[0] : 1 / 3);
    FR._ell = {
      cx: data.ellipse.center[0], cy: data.ellipse.center[1],
      rx: data.ellipse.semi_axis_x, ry: data.ellipse.semi_axis_y,
      rot: (data.ellipse.rotation_deg || 0) * DEG
    };
    FR._sq = data.squares;
    if (data.map) {
      if (!FR.dest && data.map.dest_phone) FR.dest = data.map.dest_phone;
      if (!FR.box && data.map.phone_box) FR.box = data.map.phone_box;
    }
    const [base, glow, sprite] = await Promise.all([
      loadImage(join(assets.base || 'layer-base.webp')),
      loadImage(join(assets.glow || 'glow.webp')),
      loadImage(join(assets.sprite || 'squares-sprite.webp'))
    ]);
    FR._base = base; FR._glow = glow; FR._sprite = sprite;
    FR._glowTinted = tintGlow(glow, FR.glowTint);
    const s = FR._scale, w = Math.round(FR._cw * s), h = Math.round(FR._ch * s);
    FR._off = document.createElement('canvas'); FR._off.width = w; FR._off.height = h;
    MOT.inited = false; MOT.blendS = (FR.moods && FR.moods.blend_s > 0) ? FR.moods.blend_s : 1; MOT.blendT = MOT.blendS;
    FR.ready = true;
    return FR;
  };

  FR.setOn = function (on) { FR.on = !!on; };
  FR.setPeriod = function (s) { if (s > 0) FR.period = s; };
  FR.setDest = function (dest, box, xform) {
    if (dest) FR.dest = dest;
    if (box !== undefined) FR.box = box;
    if (xform !== undefined) FR.xform = xform;
  };
  FR.offset = function (wall) {
    if (wall != null) integrate(wall);
    const p = currentProf();
    return (((MOT.theta + jitterOffset(MOT.wall, p)) % 360) + 360) % 360;
  };
  FR.draw = function (ctx, alphaOrWall, maybeAlpha) {
    if (!FR.ready || !FR.dest) return;
    let wall, alpha;
    if (maybeAlpha != null) { wall = alphaOrWall; alpha = maybeAlpha; }
    else if (alphaOrWall <= 1.5) { alpha = alphaOrWall; wall = (typeof performance !== 'undefined' ? performance.now() / 1000 : 0); }
    else { wall = alphaOrWall; alpha = 1; }
    if (!(alpha > 0.001)) return;
    const dt = FR.offset(wall);
    const kit = raster(dt, wall);
    if (!kit) return;
    const d = FR.dest, box = FR.box;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (FR.xform && FR.xform.length === 6) {
      const t = FR.xform;
      ctx.transform(t[0], t[1], t[2], t[3], t[4], t[5]);
    }
    if (box) { ctx.beginPath(); ctx.rect(box[0], box[1], box[2], box[3]); ctx.clip(); }
    ctx.drawImage(kit, d[0], d[1], d[2], d[3]);
    ctx.restore();
    // Face effects are in face-canvas space (already includes normal-ear placement in anchors).
    if (FR.faceFx === 'b') drawTraces(ctx, alpha);
    else if (FR.faceFx === 'a') drawProjection(ctx, wall, alpha);
  };
  FR.drawFocus = function (ctx, wall, fadeS) {
    const dt = Math.min(0.1, FR.last ? wall - FR.last : 0);
    FR.last = wall;
    FR.a = Math.max(0, Math.min(1, FR.a + (FR.on ? 1 : -1) * dt / (fadeS || 0.5)));
    FR.draw(ctx, wall, FR.a);
    return FR.a;
  };

  global.FocusRotate = FR;
})(typeof window !== 'undefined' ? window : globalThis);

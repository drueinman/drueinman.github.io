/* rewriteDrueMouthCues(cues, text, duration, words?)
   Port of the Drue viseme rewrite.

   v3.2.6: turned the wide B + long F pucker on "Drue" into a short DD ("dr") +
   brief ou_soft (~120-160 ms) + X for the rest of the vowel. That skipped the
   syllable. Drue 111426 2110 (t6225u): better than duck lips, but he wants a
   middle shape — a softer, smaller rounded mouth that stays visible for the
   vowel. This rewrite holds ou_soft for the full vowel (no X eating it) and
   applies it to "Drue" and to "you" / "to you" (same -ue/-ou sound). No-op
   when those words aren't in the line.

   Merge: see VISEME-MERGE.md. Call just before egMouth(...) in playDemo and playTyped. */
'use strict';
function rewriteDrueMouthCues(cues, text, duration, words) {
  if (!cues || !cues.length) return cues;
  const plain = w => (w || '').replace(/[^\w']/g, '').toLowerCase();
  const cue = (s, e, v) => ({start: +(+s).toFixed(3), end: +(+e).toFixed(3), value: v});
  const spoken = String(text || '').replace(/\[[A-Za-z][A-Za-z\- ]*\]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u200d]/gu, ' ').replace(/\s+/g, ' ').trim();
  const est = (words && words.length) ? words : estimateDrueWords(spoken, cues, duration);
  const NAMES = new Set(['drue', 'you']);
  const targets = est.filter(w => NAMES.has(plain(w.word || w.spoken || '')));
  const extra = findTrailingYouVowels(spoken, cues, est, targets);
  const all = targets.concat(extra);
  if (!all.length) return cues;
  let cur = cues.map(c => ({start: +c.start, end: +c.end, value: c.value}));
  const seen = [];
  for (const w of all) {
    const w0 = +w.start, w1 = +w.end;
    const isDrue = plain(w.word || w.spoken || '') === 'drue';
    const ov = (c, a, b) => Math.max(0, Math.min(c.end, b) - Math.max(c.start, a));
    const cands = cur.filter(c => c.value === 'F' || c.value === 'ou' || c.value === 'ou_full' || c.value === 'ou_soft');
    let vowel = null;
    if (cands.length) {
      const win0 = w0 - 0.12, win1 = w1 + 0.08;
      cands.sort((a, b) => (ov(b, win0, win1) - ov(a, win0, win1)) || ((b.end - b.start) - (a.end - a.start)) || (Math.abs(a.start - w0) - Math.abs(b.start - w0)));
      const best = cands[0];
      if (ov(best, win0, win1) > 0.04 || Math.abs(best.start - w0) <= 0.20 || Math.abs(best.start - w1) <= 0.12) vowel = best;
    }
    // "to you" often lands as one long F at the end of the phrase; word times can miss it.
    if (!vowel && !isDrue && w._phraseF) vowel = w._phraseF;
    if (!vowel) continue;
    if (seen.some(s => s === vowel || (Math.abs(s.start - vowel.start) < 0.01 && Math.abs(s.end - vowel.end) < 0.01))) continue;
    seen.push(vowel);

    let v0 = +vowel.start, v1 = +vowel.end;
    // Upgrade the v3.2.6 skip: brief ou_soft + immediate X tail → hold ou_soft for the vowel.
    // If ou_soft is already held (>= 200 ms), leave a following rest X alone.
    if (vowel.value === 'ou_soft') {
      if ((v1 - v0) >= 0.20) continue;
      const tail = cur.find(c => c.value === 'X' && Math.abs(c.start - v1) <= 0.02 && (c.end - c.start) > 0.025 && (c.end - v1) <= 0.42);
      if (tail) v1 = +tail.end;
      else continue; // already held, or no tail
    }

    let cons = null;
    for (const c of cur) {
      if (c === vowel || c.value === 'X') continue;
      if (Math.abs(c.end - v0) <= 0.05 || (c.start < v0 && v0 <= c.end)) cons = c;
    }
    let keepHead = null, consStart = v0;
    if (cons && isDrue) {
      const cs = +cons.start;
      const vowelish = 'CDEAGH'.includes(cons.value) || cons.value === 'ou' || cons.value === 'ou_soft';
      if (vowelish && (v0 - cs) > 0.12) {
        consStart = v0 - 0.08;
        keepHead = cue(cs, consStart, cons.value);
      } else {
        consStart = cs;
      }
    }
    const drop = new Set([vowel].filter(Boolean));
    if (vowel.value === 'ou_soft') {
      const tail = cur.find(c => c.value === 'X' && Math.abs(c.start - vowel.end) <= 0.02 && (c.end - c.start) > 0.025 && (c.end - vowel.end) <= 0.42);
      if (tail) drop.add(tail);
    }
    const ins = [];
    if (isDrue) {
      let d0 = cons ? consStart : v0 - 0.07;
      const d1 = v0;
      if (d1 - d0 < 0.05) d0 = v0 - 0.06;
      if (cons && !keepHead && +cons.start < d0 - 0.03) keepHead = cue(cons.start, d0, cons.value);
      if (cons) drop.add(cons);
      if (keepHead && keepHead.end - keepHead.start >= 0.03) ins.push(keepHead);
      if (d1 - d0 >= 0.03) ins.push(cue(d0, d1, 'DD'));
    } else if (cons && drop.has(cons) === false) {
      // "you": leave the leading consonant (often B / "y") alone.
    }
    ins.push(cue(v0, v1, 'ou_soft')); // hold for the full vowel; do not fill the rest with X
    let out = [], done = false;
    for (const c of cur) {
      if (drop.has(c)) { if (!done) { out = out.concat(ins); done = true; } continue; }
      out.push(c);
    }
    if (!done) out = out.concat(ins);
    out.sort((a, b) => a.start - b.start || a.end - b.end);
    const cleaned = [];
    for (let c of out) {
      if (c.end <= c.start) continue;
      if (cleaned.length && c.start < cleaned[cleaned.length - 1].end) {
        const p = cleaned[cleaned.length - 1];
        if (c.value === p.value) { p.end = Math.max(p.end, c.end); continue; }
        const mid = 0.5 * (c.start + p.end); p.end = +mid.toFixed(3); c = Object.assign({}, c, {start: +mid.toFixed(3)});
      }
      cleaned.push(c);
    }
    cur = cleaned;
  }
  return cur;
}
function findTrailingYouVowels(spoken, cues, est, already) {
  // If a phrase ends in "to you" / "you" and has a long F the word timer missed, tag it.
  const plain = w => (w || '').replace(/[^\w']/g, '').toLowerCase();
  const extra = [];
  const re = /\bto\s+you\b|\byou\b/ig;
  if (!re.test(spoken)) return extra;
  const phrases = String(spoken || '').split(/(?<=[.!?])\s+|\s{2,}/);
  // Fallback: last long F/ou in the cue run that overlaps the last "you" / "to you"
  const covered = already.slice();
  const ov = (c, a, b) => Math.max(0, Math.min(c.end, b) - Math.max(c.start, a));
  // For each 'you', if no long F overlapped it, look slightly earlier (same phrase).
  for (const w of est.filter(w => plain(w.word || '') === 'you')) {
    const win0 = +w.start - 0.85, win1 = +w.end + 0.08;
    const longs = cues.filter(c => (c.value === 'F' || c.value === 'ou' || c.value === 'ou_full') && (c.end - c.start) >= 0.18 && ov(c, win0, win1) > 0.08);
    if (!longs.length) continue;
    longs.sort((a, b) => b.end - a.end);
    const best = longs[0];
    if (covered.some(x => ov(best, +x.start, +x.end) > 0.05)) continue;
    extra.push({word: 'you', start: best.start, end: best.end, _phraseF: {start: +best.start, end: +best.end, value: best.value}});
    covered.push({start: best.start, end: best.end});
  }
  return extra;
}
function estimateDrueWords(spoken, cues, duration) {
  const words = [...String(spoken || '').matchAll(/\S+/g)].map(m => [m[0], m.index, m.index + m[0].length]);
  if (!words.length) return [];
  const spans = [];
  for (const c of cues) {
    if (c.value === 'X') continue;
    if (spans.length && c.start - spans[spans.length - 1][1] < 0.25) spans[spans.length - 1][1] = c.end;
    else spans.push([c.start, c.end]);
  }
  if (!spans.length) spans.push([0, duration || 0]);
  const phrases = [], cur = [];
  words.forEach((w, i) => { cur.push(i); if (/[,.!?;:\u2026-]$/.test(w[0])) { phrases.push(cur.splice(0)); } });
  if (cur.length) phrases.push(cur);
  const letters = w => Math.max(1, w.replace(/[^\w']/g, '').length);
  if (phrases.length === spans.length && spans.length > 1) {
    const res = [];
    phrases.forEach((idxs, pi) => {
      const [s, e] = spans[pi], ws = idxs.map(i => letters(words[i][0]));
      const tot = ws.reduce((a, b) => a + b, 0) || 1; let acc = 0;
      idxs.forEach((i, k) => { const st = s + (e - s) * acc / tot; acc += ws[k];
        res.push({word: words[i][0], charStart: words[i][1], charEnd: words[i][2], start: +(st).toFixed(3), end: +(s + (e - s) * acc / tot).toFixed(3)}); });
    });
    return res;
  }
  const total = spans.reduce((a, s) => a + (s[1] - s[0]), 0) || duration || 1;
  const weights = words.map(w => letters(w[0])); const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const at = frac => { let target = frac * total, acc = 0; for (const [s, e] of spans) { if (acc + (e - s) >= target) return s + (target - acc); acc += e - s; } return spans[spans.length - 1][1]; };
  let cum = 0; return words.map((w, i) => { const st = at(cum / wsum); cum += weights[i];
    return {word: w[0], charStart: w[1], charEnd: w[2], start: +st.toFixed(3), end: +at(cum / wsum).toFixed(3)}; });
}
if (typeof module !== 'undefined') module.exports = {rewriteDrueMouthCues, estimateDrueWords};

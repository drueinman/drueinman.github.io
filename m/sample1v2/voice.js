/* Voice adapters (Jarvis 111326, per Drue 2106): the face/emote engine only sees this interface.
   adapter.clock()            -> seconds on the adapter's clock (tracks are scheduled on it)
   adapter.speak(text, cb)    -> Promise, resolves when the phrase is done. While speaking it calls
        cb.mouth(segs, close)  segs = [[t0, t1, oculusViseme]] on adapter.clock()
        cb.word(charIndex, t)  a word starting at charIndex begins at time t (fires emote cues)
   Implementations:
   - WebSpeechVoice: the phone's built-in voice (speechSynthesis). Word timing from boundary events, else estimated.
   - AudioCuesVoice: an audio URL + Rhubarb-style mouth cues JSON {mouthCues:[{start,end,value}], words:[{start,char}]}.
     Used by the prerendered Kokoro demos now; a server voice (Eve later) just supplies synth(text) -> that JSON + url. */
'use strict';
const RHUBARB = {A: 'PP', B: 'CH', C: 'E', D: 'aa', E: 'oh', F: 'ou', G: 'FF', H: 'nn', X: 'sil'};
const toVis = v => RHUBARB[v] || v;
class WebSpeechVoice {
  constructor() { this.name = "Phone's built-in voice (stand-in)"; this.ok = 'speechSynthesis' in window; this.voice = null;
    const pick = () => { const vs = speechSynthesis.getVoices(); this.voice = vs.find(v => /samantha|ava|allison|aria|jenny|zira|female/i.test(v.name) && /^en/i.test(v.lang)) || vs.find(v => /^en-US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; };
    if (this.ok) { pick(); speechSynthesis.onvoiceschanged = pick; } }
  clock() { return performance.now() / 1000; }
  unlock() { if (!this.ok) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
  speak(text, cb) {
    return new Promise(res => {
      if (!this.ok) return res({error: 'no speechSynthesis'});
      const u = new SpeechSynthesisUtterance(text), lps = EG.VM.timing.letters_per_second; let done = false, est = false, gotB = false, t0 = 0;
      if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang; } else u.lang = 'en-US';
      const words = [...text.matchAll(/\S+/g)].map(m => ({c: m.index, w: m[0]}));
      const dur = w => Math.max(0.14, w.replace(/[^a-z]/gi, '').length / lps);
      const finish = why => { if (done) return; done = true; clearTimeout(wd); const t = this.clock(); cb.mouth([[t, t + 0.06, 'sil']], true); res({timing: gotB ? 'boundary' : 'estimated', why}); };
      const estimate = () => { if (gotB || est) return; est = true; let t = this.clock();
        for (const {c, w} of words) { const d = dur(w); cb.word(c, t, d, w.length); cb.mouth(egLetters(w, t, d), false); t += d + (/[,.!?;:]$/.test(w) ? 0.22 : 0.04); } };
      u.onstart = () => { t0 = this.clock(); setTimeout(estimate, 260); };
      u.onboundary = e => { if (est || (e.name && e.name !== 'word')) return; gotB = true; const t = this.clock();
        const wd0 = words.find(x => e.charIndex >= x.c && e.charIndex < x.c + x.w.length) || words.find(x => x.c >= e.charIndex); if (!wd0) return;
        const d = Math.min(dur(wd0.w), e.charLength ? dur(text.substr(e.charIndex, e.charLength)) : 9); cb.word(wd0.c, t, d, wd0.w.length); cb.mouth(egLetters(wd0.w, t, d), false); };
      u.onend = () => finish('end'); u.onerror = e => finish('error:' + (e.error || ''));
      const wd = setTimeout(() => finish('watchdog'), (2 + text.length / lps * 2.5) * 1000);
      speechSynthesis.speak(u);
    });
  }
  stop() { if (this.ok) speechSynthesis.cancel(); }
}
class AudioCuesVoice {
  constructor(audioEl, synth) { this.au = audioEl; this.synth = synth || null; this.name = 'Prerendered audio + mouth cues'; this.base = 0; }
  clock() { return this.au.currentTime; }
  /* whole prerendered track: {url, mouthCues, words} ; returns the play() promise (must be called from the tap) */
  load(url) { if (!this.au.src.endsWith(url)) { this.au.src = url; this.au.load(); } this.au.currentTime = 0; }
  playTrack(url, cues, cb) { this.load(url); const p = this.au.play();
    if (cues) { cb.mouth(cues.mouthCues.map(c => [c.start, c.end, toVis(c.value)]), true); (cues.words || []).forEach(w => cb.word(w.char, w.start, w.end - w.start, w.len)); }
    return p; }
  /* per-phrase server voice (Eve later): synth(text) -> {url, mouthCues, words} */
  async speak(text, cb) { if (!this.synth) return {error: 'no server voice yet'}; const r = await this.synth(text);
    this.au.src = r.url; await this.au.play(); const t0 = this.au.currentTime; this.base = t0;
    cb.mouth(r.mouthCues.map(c => [c.start, c.end, toVis(c.value)]), true); (r.words || []).forEach(w => cb.word(w.char, w.start, (w.end || w.start) - w.start, w.len || 1));
    await new Promise(res => this.au.addEventListener('ended', res, {once: true})); return {timing: 'cues'}; }
  stop() { this.au.pause(); }
}
/* phonemes (Kokoro, IPA) -> Rhubarb-style mouth cues with Oculus viseme values, using the live viseme-map.json */
function phonemesToCues(ph) { const M = EG.VM.ipa; return {mouthCues: ph.map(([a, b, s]) => ({start: a, end: b, value: M[s] || 'hold'}))}; }

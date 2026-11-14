/* Voice adapters (Jarvis 111326; Drue 2106 + 2148). The face/emote engine only sees this interface.
   v3: no phone voice. The voice is whatever is tied to the bot (bots/<bot>.json), spoken by the Eve service:
     POST <host>/speak {text} -> {audio_b64|audio_url, cues (Rhubarb), duration, words (estimated)}   (eve-service/CLIENT.md)
   - AudioCuesVoice: plays an MP3 with Rhubarb mouth cues. Used by the prerendered Eve demos and by ServerVoice. */
'use strict';
const RHUBARB = {A: 'PP', B: 'rB', C: 'E', D: 'aa', E: 'oh', F: 'ou', G: 'FF', H: 'L', X: 'sil'};   // v3: B keeps v2's ee-half; H -> held-L frame
const toVis = v => RHUBARB[v] || v;
const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//WreyTRUoAWgBgkOAGbZHBgG1OF6zM82DWbZaUmMBptgQhGjsyYqc9ae9XFz280948NMBWInljyzsNRFLPWdnZGWrddDsjK1unuSrVN9jJsK8KuQtQCtMBjCEtImISdNKJOopIpBFpNSMbIHCSRpRR5iakjTiyzLhchUUBwCgyKiweBv/7UsQbg8isVNoMPMjAAAA0gAAABEVFGmgqK////9bP/6XCykxBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
class AudioCuesVoice {
  constructor(audioEl) { this.au = audioEl; this.name = 'Audio + Rhubarb mouth cues'; }
  clock() { return this.au.currentTime; }
  load(url) { if (!this.au.src.endsWith(url)) { this.au.src = url; this.au.load(); } this.au.currentTime = 0; }
  /* whole prerendered track; returns the play() promise (call it from the tap) */
  playTrack(url, cues, cb) { this.load(url); const p = this.au.play();
    if (cues) cb.mouth(cues.mouthCues.map(c => [c.start, c.end, toVis(c.value)]), true);
    return p; }
  /* iPhone: audio may only start from a tap. Play a silent clip inside the tap so later src changes can play after the fetch. */
  unlock() { try { this.au.src = SILENT; const p = this.au.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  /* one prepared phrase {url, mouthCues, duration}: cb.start(t0) gets the wall time the audio started, cues are relative to it */
  playPrepared(r, cb) { return new Promise(res => {
    const au = this.au; let started = false, done = false; const fin = why => { if (done) return; done = true; clearTimeout(wd); res({timing: 'cues', why}); };
    au.onplaying = () => { if (started) return; started = true; const t0 = performance.now() / 1000 - au.currentTime; cb.start(t0); };
    au.onended = () => fin('end'); au.onerror = () => fin('error');
    const wd = setTimeout(() => fin('watchdog'), ((r.duration || 8) + 4) * 1000);
    au.src = r.url; au.currentTime = 0; const p = au.play(); if (p && p.catch) p.catch(e => fin('blocked:' + e.name));
  }); }
  stop() { this.au.pause(); this.au.onplaying = this.au.onended = this.au.onerror = null; }
}
/* Server voice for the bot (contract: eve-service/CLIENT.md). Hosts come from eve-endpoint.json (no-store, never in the SW cache),
   tried in order with a short /health check; a failed host is skipped for 60 s. prepare(text) -> {url, mouthCues, duration, words, spoken, from}. */
class ServerVoice {
  constructor(cfg) { this.cfg = cfg; this.name = cfg.voice_label || cfg.voice || 'server voice'; this.down = {}; this.last = null; this.eps = null; }
  async endpoints() { const S = this.cfg.speak || {};
    try { const j = await fetch(S.endpoints_file || 'eve-endpoint.json', {cache: 'no-store'}).then(r => r.ok ? r.json() : null); if (j && j.endpoints && j.endpoints.length) return (this.eps = j.endpoints.map(e => e.replace(/\/+$/, ''))); } catch (e) {}
    return (this.eps = (S.endpoints || []).map(e => e.replace(/\/+$/, ''))); }
  async tfetch(url, opt, ms) { const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms); try { return await fetch(url, Object.assign({signal: ac.signal}, opt)); } finally { clearTimeout(to); } }
  async alive(base) { const S = this.cfg.speak || {}; if (this.down[base] && performance.now() < this.down[base]) return false;
    try { const r = await this.tfetch(base + '/health', {cache: 'no-store'}, S.health_timeout_ms || 2500); if (r.ok) return true; } catch (e) {}
    this.down[base] = performance.now() + (S.down_for_s || 60) * 1000; return false; }
  async prepare(text) {
    const S = this.cfg.speak || {}, eps = this.eps || await this.endpoints(), errs = [];
    for (const base of eps) {
      const host = base.replace(/^https?:\/\//, '');
      if (!await this.alive(base)) { errs.push(host + ': down'); continue; }
      let r; try { r = await this.tfetch(base + '/speak', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({text})}, S.speak_timeout_ms || 12000); }
      catch (e) { this.down[base] = performance.now() + 60000; errs.push(host + ': ' + (e.name === 'AbortError' ? 'timed out' : 'unreachable')); continue; }
      let j = {}; try { j = await r.json(); } catch (e) {}
      if (!r.ok) { const er = j.error || ('HTTP ' + r.status);
        if ([400, 403, 413].includes(r.status) || er === 'daily_budget_exhausted') { const e = new Error(er); e.fatal = true; e.detail = [host + ': ' + er]; e.status = r.status; throw e; }   // no failover (CLIENT.md)
        errs.push(host + ': ' + er); continue; }                       // 429 rate_limited, 5xx, 530: next host
      let a = j.audio_b64 ? 'data:' + (j.content_type || 'audio/mpeg') + ';base64,' + j.audio_b64 : j.audio_url || (j.audio_path ? base + j.audio_path : j.audio || '');
      if (a && !/^(data:|blob:|https?:)/.test(a)) a = /^[A-Za-z0-9+/=\s]+$/.test(a) && a.length > 200 ? 'data:audio/mpeg;base64,' + a.replace(/\s/g, '') : new URL(a, base + '/').href;
      if (!a) { errs.push(host + ': no audio'); continue; }
      const mc = Array.isArray(j.cues) ? j.cues : (j.cues && j.cues.mouthCues) || j.mouthCues || [];
      this.last = base; return {url: a, mouthCues: mc, duration: +j.duration || (mc.length ? mc[mc.length - 1].end : 0), words: j.words || null, spoken: j.spoken_text || text, cached: !!j.cached, from: host};
    }
    const err = new Error('voice offline'); err.detail = errs; throw err;
  }
}
/* Cue time for a character position in the phrase: use the server's (estimated) word spans when the words line up,
   interpolating inside the word (chord-chart cues); else spread the characters over the voiced span. */
function cueTimeWords(text, pos, r) {
  const ws = [...text.matchAll(/\S+/g)], W = r.words || [];
  if (W.length && W.length === ws.length) { let k = ws.findIndex(m => pos < m.index + m[0].length); if (k < 0) k = ws.length - 1;
    const m = ws[k], f = Math.max(0, Math.min(1, (pos - m.index) / Math.max(1, m[0].length))); return W[k].start + f * (W[k].end - W[k].start); }
  return cueTimeEst(text, pos, r.mouthCues, r.duration); }
/* No word timing from the server: spread the characters over the voiced span Rhubarb found (same as build_v3.cue_time_est). */
function cueTimeEst(text, charpos, mc, L) { const v = mc.filter(c => c.value !== 'X'); const s0 = v.length ? v[0].start : 0, s1 = v.length ? v[v.length - 1].end : L;
  return s0 + (s1 - s0) * charpos / Math.max(1, text.length); }

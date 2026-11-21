/* v3.3.8p Messages (Jarvis 111926; Drue 9:36 AM CT t7151u via Aloy: "linked to actual bot responses for you and tweek and the ability
   to craft and send messages"). Private build only: talks to its own signed-in server (/api/*), never to diasx.io.
   Drue writes to Aloy or TweakX -> the server files it and wakes the bot's own Grok Bot webhook routine (if set up) ->
   the bot drops its REAL reply with emote_reply_v338p.py -> it shows here and plays with her face + Eve voice.
   Nothing is made up: a message without a reply stays "waiting". Faces picked automatically from the words are labelled. */
'use strict';
const MSG8 = {bot: 'aloy', items: {}, seen: new Set(JSON.parse(localStorage.getItem('v338pSeen') || '[]')), first: {}, timer: 0, status: null, queue: []};
const MSG8_BOTS = [['aloy', 'Aloy'], ['tweakx', 'TweakX']];
const TWEAK_FACE = {amused: 'happy', smile: 'happy', sad: 'upset', furious: 'upset', 'furious-hurt-tears': 'upset', 'hurt-holding-back-tears': 'upset',
  'phone-down': 'focused', 'thinking-up': 'thinking', crosseyed: 'jittery', drowsy: 'sleepy', justwoke: 'sleepy', 'guilty-down': 'apologetic',
  'skeptical-up': 'skeptical', laughing: 'laughing', excited: 'excited', alert: 'alert', surprised: 'surprised', thinking: 'thinking',
  skeptical: 'skeptical', confused: 'confused', worried: 'worried', apologetic: 'apologetic', relieved: 'relieved', proud: 'proud',
  determined: 'determined', focused: 'focused', listening: 'listening', sleepy: 'sleepy', neutral: 'happy'};
const esc8 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const hm8 = iso => { const t = Date.parse(iso); return isNaN(t) ? '' : new Date(t).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago'}) + ' CT'; };
function m8saveSeen() { try { localStorage.setItem('v338pSeen', JSON.stringify([...MSG8.seen].slice(-300))); } catch (e) {} }
async function m8api(path, body) {
  const r = await fetch(path, body ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store'} : {cache: 'no-store'});
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) { const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
  return j;
}
function m8wakeText(m) { const w = m.wake || {}, n = esc8(m.bot_name || m.bot);
  if (w.state === 'delivered') return 'Sent · ' + n + ' was woken';
  if (w.state === 'failed') return 'Saved · wake failed (HTTP ' + esc8(w.http) + ') <button class="m8retry" data-id="' + esc8(m.id) + '">Retry</button>';
  return 'Saved · no wake hook for ' + n + ' yet, so it waits until ' + n + ' checks'; }
function m8render() {
  const list = $('m8list'); if (!list) return; const items = MSG8.items[MSG8.bot] || [];
  const name = (MSG8_BOTS.find(b => b[0] === MSG8.bot) || [])[1];
  list.innerHTML = items.length ? items.map(m => {
    let h = '';
    if (m.text != null) h += '<div class="m8 me"><div class="m8txt">' + esc8(m.text) + '</div><div class="m8meta">You · ' + hm8(m.created) + ' · ' + m8wakeText(m) + '</div></div>';
    const r = m.reply;
    if (r) { const ef = r.ef && r.ef.dopamine != null ? ' · mood from EF sliders d' + r.ef.dopamine + ' s' + r.ef.serotonin + ' o' + r.ef.oxytocin + ' e' + r.ef.endorphins + (r.ef.conscience ? ' c' + r.ef.conscience : '') : '';
      h += '<div class="m8 bot"><div class="m8txt">' + esc8(r.text) + '</div><div class="m8meta">' + esc8(name) + ' · ' + hm8(r.created) + ' · ' +
        (r.cue_source === 'bot' ? 'face: her own cues' : 'face: auto-picked from the words' + ef) +
        ' <button class="m8play" data-id="' + esc8(r.id) + '">▶ Play</button></div></div>'; }
    else if (m.text != null) h += '<div class="m8 wait">Waiting for ' + esc8(name) + '’s real reply…</div>';
    return h; }).join('') : '<div class="m8 wait">No messages with ' + esc8(name) + ' yet.</div>';
  list.scrollTop = list.scrollHeight;
  const st = MSG8.status && MSG8.status.bots && MSG8.status.bots[MSG8.bot];
  $('m8hookState').textContent = st ? (st.hook ? 'Wake hook saved for ' + name + '.' : 'No wake hook saved for ' + name + ' yet.') : '';
  document.querySelectorAll('#m8tabs button').forEach(b => b.classList.toggle('on', b.dataset.bot === MSG8.bot));
  $('m8send').querySelector('span').textContent = 'Send to ' + name;
}
async function m8refresh(bot) {
  try { const j = await m8api('/api/thread?bot=' + bot); MSG8.items[bot] = j.items || []; }
  catch (e) { if (e.status === 401) { $('m8note').textContent = 'Signed out: open your private link again.'; } return; }
  const fresh = [];
  for (const m of MSG8.items[bot]) if (m.reply && !MSG8.seen.has(m.reply.id + '@' + m.reply.created)) {
    MSG8.seen.add(m.reply.id + '@' + m.reply.created); if (MSG8.first[bot]) fresh.push(m.reply); }
  MSG8.first[bot] = true; m8saveSeen();
  if (bot === MSG8.bot) m8render();
  for (const r of fresh) m8incoming(r);
}
function m8pending() { return MSG8_BOTS.some(([b]) => (MSG8.items[b] || []).some(m => m.text != null && !m.reply)); }
function m8schedule() { clearTimeout(MSG8.timer); const open = !$('m8sheet').hidden;
  MSG8.timer = setTimeout(async () => { await Promise.all(MSG8_BOTS.map(([b]) => m8refresh(b))); m8schedule(); }, (open || m8pending()) ? 4000 : 20000); }
function m8incoming(r) {
  const name = r.bot === 'aloy' ? 'Aloy' : 'TweakX';
  const busy = P.mode === 'demo' || P.mode === 'live' || P.mode === 'gif';
  if (busy) { MSG8.queue.push(r); toast(name + ' replied · tap ▶ in Messages'); return; }
  m8play(r, true);
}
async function m8play(r, auto) {
  const sheet = $('m8sheet'); if (!sheet.hidden) await m8close();
  if (BOT !== r.bot) await selectBot(r.bot);
  if (r.bot === 'aloy') return playTyped(r.text, {pause: 250});
  return m8playOther(r.text);
}
/* TweakX (and any non-Aloy bot): his own face set has no mouth frames, so the face follows the cues and the voice plays (bots/<bot>.json). */
async function m8playOther(text) {
  stopAll(); const run = ++P.run; audioVoice.unlock();
  const items = egParse(text).filter(it => it.say || (it.cues && it.cues.length) || it.beat);
  if (!serverVoice) { toast('No voice is set for this bot'); return; }
  setCaption(items.filter(i => i.say).map(i => i.say).join(' ')); $('statusLine').textContent = 'Preparing voice…'; $('statusLine').hidden = false;
  let ready; try { ready = await Promise.all(items.map(it => it.say ? serverVoice.prepare(it.say) : null)); }
  catch (e) { $('statusLine').textContent = 'Voice offline: ' + (e.message || ''); toast('Voice offline'); return; }
  if (run !== P.run) return; $('statusLine').hidden = true; P.mode = 'live';
  const setF = f => { const set = BOTFACES[BOT] || {}, g = TWEAK_FACE[f] || f; if (set.faces && set.faces[g]) botExpr = g; };
  let wordBase = 0;
  for (let n = 0; n < items.length; n++) { const it = items[n]; if (run !== P.run) return;
    if (it.beat) { setF(it.beat); await sleep(1100); continue; }
    if (!it.say) { it.cues.forEach(([, f]) => setF(f)); continue; }
    const r = ready[n], spans = [...$('caption').children], words = [...it.say.matchAll(/\S+/g)], base = wordBase;
    await audioVoice.playPrepared(r, {start: t0 => {
      for (const [pos, f] of it.cues) setTimeout(() => { if (run === P.run) setF(f); }, Math.max(0, cueTimeWords(it.say, pos, r) * 1000 - 40));
      words.forEach((w, wi) => setTimeout(() => { if (run !== P.run) return; spans.forEach(s => s.classList.remove('on')); const sp = spans[base + wi]; if (sp) sp.classList.add('on'); }, cueTimeWords(it.say, w.index, r) * 1000));
    }});
    wordBase += words.length; await sleep(150);
  }
  if (run === P.run) { P.mode = 'idle'; [...$('caption').children].forEach(s => s.classList.remove('on')); const b = BOTS.find(x => x.id === BOT); setTimeout(() => { if (run === P.run && b) setF(b.default_face); }, 1200); }
}
function m8open(bot) {
  if (typeof takeOver === 'function') takeOver(); openSettings(false); $('compose').hidden = true;
  MSG8.bot = bot || (MSG8_BOTS.some(b => b[0] === BOT) ? BOT : MSG8.bot);
  $('m8sheet').hidden = false; m8render(); m8refresh(MSG8.bot); m8api('/api/status').then(s => { MSG8.status = s; m8render(); }).catch(() => {}); m8schedule();
}
function m8close() { const el = $('m8sheet'); if (el.hidden) return Promise.resolve();
  return new Promise(res => { el.classList.add('closing'); const done = () => { el.classList.remove('closing'); el.hidden = true; res(); };
    el.addEventListener('animationend', done, {once: true}); setTimeout(done, 600); }); }
async function m8send(text, bot) {
  text = (text || '').trim(); if (!text) { toast('Type a message first'); return; }
  audioVoice.unlock();                                      // inside the tap, so her reply can play when it lands (phones block late audio otherwise)
  $('m8note').textContent = 'Sending…';
  try { const m = await m8api('/api/send', {bot, text}); $('m8note').textContent = '';
    (MSG8.items[bot] = MSG8.items[bot] || []).push(Object.assign(m, {reply: null})); if (MSG8.bot === bot) m8render(); m8schedule(); return m; }
  catch (e) { $('m8note').textContent = 'Not sent: ' + e.message; toast('Not sent: ' + e.message); }
}
(function m8init() {
  const btn = $('msgBtn'); if (!btn) return;
  if (window.EMOTE_STATIC) {   // v3.3.8w website: Messages talk to the 18's signed-in server, which the public site can't reach. Greyed, no calls, no polling.
    btn.classList.add('needs18'); btn.setAttribute('aria-disabled', 'true'); btn.title = 'Messages need the Alienware 18 (not on the website version)';
    tapHandler(btn, () => toast('Messages need the Alienware 18. Not on the website version.')); return; }
  tapHandler(btn, () => { if ($('m8sheet').hidden) m8open(); else m8close(); });
  $('m8sheet').querySelector('.sheetX').onclick = () => m8close();
  $('m8tabs').addEventListener('click', e => { const b = e.target.closest('button[data-bot]'); if (!b) return; MSG8.bot = b.dataset.bot; m8render(); m8refresh(MSG8.bot); });
  $('m8send').onclick = async () => { const ta = $('m8text'); const m = await m8send(ta.value, MSG8.bot); if (m) ta.value = ''; };
  $('m8list').addEventListener('click', e => {
    const p = e.target.closest('.m8play'); if (p) { const it = (MSG8.items[MSG8.bot] || []).find(m => m.reply && m.reply.id === p.dataset.id); if (it) { audioVoice.unlock(); m8play(it.reply); } return; }
    const rt = e.target.closest('.m8retry'); if (rt) m8api('/api/wake', {id: rt.dataset.id}).then(() => m8refresh(MSG8.bot)).catch(er => toast('Retry failed: ' + er.message)); });
  $('m8hookSave').onclick = async () => { try { await m8api('/api/hooks', {bot: MSG8.bot, url: $('m8hookUrl').value, key: $('m8hookKey').value});
      $('m8hookUrl').value = ''; $('m8hookKey').value = ''; MSG8.status = await m8api('/api/status'); m8render(); toast('Wake hook saved'); }
    catch (e) { toast('Not saved: ' + e.message); } };
  const cs = $('composeSend'); if (cs) cs.onclick = async () => { const bot = MSG8_BOTS.some(b => b[0] === BOT) ? BOT : 'aloy';
    const m = await m8send($('composeText').value, bot); if (m) { $('compose').hidden = true; m8open(bot); } };
  Promise.all(MSG8_BOTS.map(([b]) => m8refresh(b))).then(m8schedule);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { MSG8_BOTS.forEach(([b]) => m8refresh(b)); m8schedule(); } });
})();

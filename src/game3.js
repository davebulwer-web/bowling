// ---------- sound ----------
let actx = null, muted = false, noiseBuf = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
  if (actx && actx.state === 'suspended') actx.resume();
  if (actx && !noiseBuf) { const n = actx.sampleRate, b = actx.createBuffer(1, n, actx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; noiseBuf = b; }
  if (typeof syncMusic === 'function') syncMusic(true);
  return actx;
}
function tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
  const a = actx; if (!a || muted) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, freq, q, vol, delay = 0, type = 'bandpass') {
  const a = actx; if (!a || muted || !noiseBuf) return;
  const t = a.currentTime + delay, src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}
let lastClack = 0;
const sfx = {
  clack: (j) => {
    const now = performance.now(); if (now - lastClack < 14) return; lastClack = now;
    const v = Math.min(0.5, 0.04 + j * 0.035);
    noise(0.07 + Math.random() * 0.05, 1800 + Math.random() * 1800, 3, v);
    tone(700 + Math.random() * 500, 0.05, 'triangle', v * 0.25);
  },
  crash: () => { noise(0.5, 1400, 0.8, 0.5); noise(0.25, 3000, 2, 0.3, 0.03); },
  gutter: () => { tone(300, 0.35, 'triangle', 0.1, -200); },
  strike: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, 'square', 0.05, 0, i * 0.08)),
  spare: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.14, 'square', 0.05, 0, i * 0.1)),
  split: () => [330, 311, 294].forEach((f, i) => tone(f, 0.22, 'square', 0.04, 0, i * 0.2)),
  win: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'square', 0.05, 0, i * 0.12)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.22, 'triangle', 0.08, 0, i * 0.18)),
  blip: () => tone(660, 0.05, 'square', 0.03),
  tick: () => tone(1200, 0.02, 'square', 0.015),
  set: () => tone(880, 0.07, 'square', 0.04),
  crowd: (len = 1.6, vol = 0.18) => {
    const a = actx; if (!a || muted) return;
    const n = Math.floor(a.sampleRate * len), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / a.sampleRate * 23));
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime;
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(a.destination); src.start(t);
  },
  jingle: () => [262, 330, 392, 523, 392, 523, 659].forEach((f, i) => tone(f, 0.11, 'square', 0.045, 0, i * 0.08)),
};
// the rumble of the ball down the lane
let roll = null;
function rollStart() {
  const a = actx; if (!a || muted || !noiseBuf || roll) return;
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 160; f.Q.value = 2;
  g.gain.value = 0.0001; src.connect(f).connect(g).connect(a.destination); src.start();
  roll = { src, g, f };
}
function rollSet(v, hz) { if (!roll) return; const t = actx.currentTime; roll.g.gain.setTargetAtTime(Math.max(0.0001, v), t, 0.05); roll.f.frequency.setTargetAtTime(hz, t, 0.1); }
function rollStop() { if (!roll) return; const r = roll; roll = null; r.g.gain.setTargetAtTime(0.0001, actx.currentTime, 0.08); setTimeout(() => { try { r.src.stop(); } catch (e) {} }, 400); }

// name call-outs and the title music, shared with the darts game
const VOICE = new Set(BOWLERS.map(b => 'name-' + b.id));
const clips = {};
function clip(k) { if (!clips[k]) { const a = new Audio('sounds/voice/' + k + '.mp3'); a.preload = 'auto'; clips[k] = a; } return clips[k]; }
function say(k) { if (muted || !VOICE.has(k)) return; const a = clip(k); a.currentTime = 0; const pr = a.play(); if (pr) pr.catch(() => {}); }
const music = new Audio('sounds/music.mp3'); music.loop = true; music.volume = 0.45; music.preload = 'auto';
let musicState = null;
function syncMusic(force) {
  const want = !muted && (state === 'title' || state === 'menu' || state === 'select');
  if (!force && want === musicState) return;
  musicState = want;
  if (want) { const pr = music.play(); if (pr) pr.catch(() => { musicState = null; }); }
  else { music.pause(); music.currentTime = 0; }
}

// ---------- saved progress ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('lanes-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('lanes-' + k, JSON.stringify(v)); } catch (e) {} },
};
let beaten = store.get('beaten', []);
if (!Array.isArray(beaten)) beaten = [];
const unlocked = i => i === 0 || beaten.includes(i - 1) || beaten.includes(i) || beaten.includes('all');
let best = store.get('best', {}); if (typeof best !== 'object' || !best) best = {};
let nFrames = store.get('frames', 10); if (![5, 10].includes(nFrames)) nFrames = 10;
let guide = store.get('guide', true) !== false;
let you = store.get('you', 7); if (!(you >= 0 && you < 8)) you = 7;
let meterPeriod = store.get('speed', 1.2); if (![1.6, 1.2, 0.85].includes(meterPeriod)) meterPeriod = 1.2;

// ---------- game state ----------
// state: title, menu, select, play, results
let state = 'title', kind = 'cpu', players = [], cur = 0, frameIdx = 0, opponent = null, winner = null;
let selMode = 'cpu', sel = 0, picks = [];
let banner = null, menuSel = 0, autoPlay = false;
// one delivery: phase position, aim, power, approach, roll, result, sweep, cpuprep
const T = {
  phase: 'position', rack: null, rackPins: null, ballNo: 0, world: null, x0: 0.2, aim: 0.2, power: 0, spin: 0,
  powerSet: false, spinSet: false, t: 0, meterT: 0, released: false, releaseT: 0, ballScreen: null, settleT: 0, resultT: 0,
  sweepT: 0, plan: null, edit: 'position', pose: 'ready', footY: 196, bowlerShift: 0, hits: 0, firstHitDone: false, after: null, react: null, holdT: 0,
};
const fullRack = () => Array(10).fill(true);
const standingOf = pins => pins.map(p => p.st === 'up' ? { x: p.x, z: p.z } : false);
const countUp = r => r.filter(Boolean).length;
const curP = () => players[cur];
const charIdx = p => BOWLERS.indexOf(p.char);

function setRack(r) { T.rack = r; T.rackPins = makePins(r); }

function startMatch(k, chars, opp) {
  audio(); kind = k; banner = null;
  if (k === 'cpu') { opponent = opp; players = [{ name: 'YOU', char: BOWLERS[chars[0]], frames: [] }, { name: BOWLERS[opp].name, char: BOWLERS[opp], cpu: true, frames: [] }]; }
  else if (k === '2p') players = chars.map((c, i) => ({ name: BOWLERS[c].name, char: BOWLERS[c], frames: [], tag: 'P' + (i + 1) }));
  else players = [{ name: BOWLERS[chars[0]].name, char: BOWLERS[chars[0]], frames: [] }];
  players.forEach(p => { p.x0 = 0.2; p.aim = 0.12; p.streak = 0; p.m = { strikes: 0, spares: 0, opens: 0, splits: 0, gutters: 0, converted: 0 }; });
  cur = 0; frameIdx = 0; state = 'play';
  startFrame();
}
function startDemo() {
  kind = 'demo';
  const o = (Math.random() * 8) | 0;
  players = [{ name: BOWLERS[o].name, char: BOWLERS[o], cpu: true, frames: [], x0: 0, aim: 0, streak: 0, m: {} }];
  cur = 0; frameIdx = 0; startFrame();
}
function startFrame() {
  const p = curP();
  if (kind !== 'demo') p.frames[frameIdx] = p.frames[frameIdx] || { rolls: [], split: [] };
  T.ballNo = 0; setRack(fullRack());
  startBall();
  if (kind !== 'demo' && players.length > 1) banner = { text: (p.cpu ? p.name : p.name === 'YOU' ? 'YOUR' : p.name) + (p.name === 'YOU' ? ' FRAME' : ' TO BOWL'), sub: 'FRAME ' + (frameIdx + 1), t: 70 };
  else if (kind !== 'demo') banner = { text: 'FRAME ' + (frameIdx + 1), t: 60 };
}
function startBall() {
  const p = curP();
  Object.assign(T, { world: null, powerSet: false, spinSet: false, power: 0, spin: 0, t: 0, meterT: 0, released: false, ballScreen: null, settleT: 0, resultT: 0, sweepT: 0, pose: 'ready', footY: 196, bowlerShift: 0, hits: 0, firstHitDone: false, after: null, react: null, holdT: 0 });
  T.x0 = p.x0; T.aim = p.aim; T.edit = 'position';
  Object.assign(cam, CAM_AIM);
  if (p.cpu || autoPlay) {
    T.plan = cpuPlan(p.char, T.rack);
    T.phase = 'cpuprep';
  } else T.phase = 'position';
}
function release() {
  const p = curP(), o = p.char;
  let x0 = T.x0, aim = T.aim;
  if (!p.cpu) { x0 += gauss() * 0.002; aim += gauss() * 0.003; }
  const ball = makeBall(x0, aim, speedOf(T.power), T.spin);
  T.world = makeWorld(T.rack, ball);
  T.world.onHit = (j, a, b) => {
    const ballHit = a === ball || b === ball;
    if (ballHit && !T.firstHitDone && j > 2) { T.firstHitDone = true; sfx.crash(); }
    else if (j > 0.15) sfx.clack(j);
  };
  T.released = true; T.releaseT = 0; T.phase = 'roll';
  p.x0 = T.x0; p.aim = T.aim;
  rollStart();
}
function settleResult() {
  const p = curP(), before = countUp(T.rack), after = standingOf(T.world.pins), left = countUp(after), n = before - left;
  rollStop();
  T.after = after;
  const ball = T.world.ball, freshRack = before === 10;
  const split = freshRack && left > 0 && isSplit(after);
  let text = '', sub = '', snd = null;
  if (kind !== 'demo') {
    const f = p.frames[frameIdx]; f.rolls.push(n); f.split.push(split);
  }
  const leave = after.map((v, i) => v ? i + 1 : 0).filter(Boolean).join('-');
  if (left === 0 && freshRack) {
    p.streak = (p.streak || 0) + 1;
    text = ['STRIKE!', 'DOUBLE!', 'TURKEY!'][p.streak - 1] || p.streak + ' BAGGER!';
    snd = 'strike'; T.react = 'cheer'; if (p.m) p.m.strikes++;
  } else if (left === 0) {
    text = 'SPARE!'; snd = 'spare'; T.react = 'cheer'; p.streak = 0; if (p.m) { p.m.spares++; if (p.wasSplit) p.m.converted++; }
  } else {
    p.streak = 0;
    if (n === 0 && ball.gutter) { text = 'GUTTER BALL'; snd = 'gutter'; T.react = 'slump'; if (p.m) p.m.gutters++; }
    else if (n === 0) { text = 'NO PINS'; snd = 'gutter'; T.react = 'slump'; }
    else if (split) { text = 'SPLIT!'; sub = leave; snd = 'split'; T.react = 'slump'; if (p.m) p.m.splits++; }
    else { text = n === 1 ? '1 PIN' : n + ' PINS'; sub = freshRack ? 'LEAVES ' + leave : ''; }
  }
  p.wasSplit = split;
  banner = { text, sub, t: 110 };
  if (snd) sfx[snd]();
  if (snd === 'strike') sfx.crowd(1.6, 0.16);
  T.phase = 'result'; T.resultT = 0;
}
// After the sweep: next ball in this frame, or the next bowler.
function nextBall() {
  const p = curP();
  if (kind === 'demo') {
    T.ballNo++;
    if (T.ballNo >= 2 || countUp(T.after) === 0) { if (Math.random() < 0.5) startDemo(); else { T.ballNo = 0; setRack(fullRack()); startBall(); } }
    else { setRack(T.after); startBall(); }
    return;
  }
  const f = p.frames[frameIdx], last = frameIdx === nFrames - 1;
  if (frameDone(p.frames, frameIdx, nFrames - 1)) {
    if (!last || true) {
      const r = f.rolls;
      if (f.rolls[0] === 10) {} else if (r[0] + r[1] === 10) {} else if (p.m) p.m.opens++;
    }
    nextTurn(); return;
  }
  T.ballNo++;
  const r = f.rolls;
  // tenth frame: fresh rack after a strike or a spare
  if (last && (countUp(T.after) === 0)) setRack(fullRack()); else setRack(T.after);
  startBall();
}
function nextTurn() {
  cur++;
  if (cur >= players.length) { cur = 0; frameIdx++; }
  if (frameIdx >= nFrames) { endMatch(); return; }
  startFrame();
}
const finalScore = p => { const c = scoreCard(p.frames, nFrames); return c[nFrames - 1].total || 0; };
function endMatch() {
  players.forEach(p => { p.final = finalScore(p); const id = p.char.id; if (nFrames === 10 && !p.cpu && (!best[id] || p.final > best[id])) { best[id] = p.final; p.pb = true; } });
  store.set('best', best);
  if (players.length === 1) winner = players[0];
  else winner = players[0].final === players[1].final ? null : players[0].final > players[1].final ? players[0] : players[1];
  if (kind === 'cpu') {
    if (winner === players[0]) { if (!beaten.includes(opponent)) beaten.push(opponent); store.set('beaten', beaten); sfx.win(); sfx.crowd(2.2, 0.2); }
    else sfx.lose();
  } else sfx.win();
  state = 'over'; banner = { text: winner ? (winner.name === 'YOU' ? 'YOU WIN!' : winner.name + ' WINS') : players.length > 1 ? 'TIE GAME' : 'GAME OVER', sub: 'PRESS SPACE', t: 99999 };
}

// ---------- the 8 bowlers ----------
// look: from-behind sprite details. style: how the computer bowls. sig*: how wobbly the computer is.
const BOWLERS = [
  { id: 'jordan', avg: 100, name: 'JORDAN', nick: 'THE ROOKIE',     skin: '#f2c09a', hair: '#8a5a32', hairStyle: 'mop',     shirt: '#ecebe6', shirt2: '#c9c8c2', trim: null,      legs: '#3a4a6a', specs: false, extra: null,      ball: '#2fb8b0', ball2: '#1a7a76',
    power: 0.45, spin: 0.15, sigAim: 0.060, sigPos: 0.040, sigPow: 0.10, sigSpin: 0.14, spare: 1.0 },
  { id: 'fergus', avg: 115, name: 'FERGUS', nick: 'COOL HAND',      skin: '#f0b890', hair: '#c8823a', hairStyle: 'slick',   shirt: '#1f2a4a', shirt2: '#151d34', trim: '#d0408a', legs: '#2a2a33', specs: true,  extra: null,      ball: '#d83a3a', ball2: '#8a1e1e',
    power: 0.70, spin: 0.35, sigAim: 0.044, sigPos: 0.030, sigPow: 0.08, sigSpin: 0.11, spare: 0.9 },
  { id: 'carl', avg: 135,   name: 'CARL',   nick: 'THE REGULAR',    skin: '#f0b890', hair: '#6a4226', hairStyle: 'short',   shirt: '#7ab0e0', shirt2: '#5a8cbc', trim: null,      legs: '#33343c', specs: false, extra: 'lanyard', ball: '#3aa860', ball2: '#1f6a3a',
    power: 0.55, spin: 0.30, sigAim: 0.034, sigPos: 0.024, sigPow: 0.07, sigSpin: 0.09, spare: 0.85 },
  { id: 'pavan', avg: 150,  name: 'PAVAN',  nick: 'THE PROFESSOR',  skin: '#a86a45', hair: '#15100c', hairStyle: 'curly',   shirt: '#f0f0f0', shirt2: '#cfcfcf', trim: null,      legs: '#2c2c36', specs: true,  extra: null,      ball: '#8a3ad8', ball2: '#4e1e8a',
    power: 0.60, spin: 0.55, sigAim: 0.027, sigPos: 0.019, sigPow: 0.06, sigSpin: 0.07, spare: 0.8 },
  { id: 'bhups', avg: 160,  name: 'BHUPS',  nick: 'THE SPARE MAN',  skin: '#c08a5a', hair: '#15100c', hairStyle: 'neat',    shirt: '#f2f2f2', shirt2: '#d2d2d2', trim: '#c8407a', legs: '#2a2a30', specs: false, extra: 'badge',   ball: '#e0a020', ball2: '#9a6a10',
    power: 0.62, spin: 0.40, sigAim: 0.022, sigPos: 0.016, sigPow: 0.05, sigSpin: 0.06, spare: 0.45 },
  { id: 'ekow', avg: 170,   name: 'EKOW',   nick: 'THE AMBASSADOR', skin: '#6e4128', hair: null,      hairStyle: 'bald',    shirt: '#8fa8c8', shirt2: '#6f88a8', trim: '#f4f4f4', legs: '#3c4a66', specs: false, extra: 'suit',    ball: '#2a2a3a', ball2: '#111118',
    power: 0.66, spin: 0.85, sigAim: 0.016, sigPos: 0.012, sigPow: 0.04, sigSpin: 0.045, spare: 0.6 },
  { id: 'andy', avg: 175,   name: 'ANDY',   nick: 'THE GAFFER',     skin: '#eaa888', hair: '#c8c0b8', hairStyle: 'baldtop', shirt: '#24305a', shirt2: '#18203e', trim: null,      legs: '#2a2a30', specs: false, extra: null,      ball: '#e06a20', ball2: '#9a4410',
    power: 0.85, spin: 0.20, sigAim: 0.013, sigPos: 0.010, sigPow: 0.035, sigSpin: 0.04, spare: 0.6 },
  { id: 'dave', avg: 195,   name: 'DAVE',   nick: 'TURKEY TIME',    skin: '#f0b890', hair: '#a8a49c', hairStyle: 'short',   shirt: '#f2f2f2', shirt2: '#d0d0d0', trim: '#24305a', legs: '#2a2a33', specs: true,  extra: 'stripes', ball: '#1a5ad8', ball2: '#f2f2f2',
    power: 0.72, spin: 0.60, sigAim: 0.008, sigPos: 0.006, sigPow: 0.024, sigSpin: 0.024, spare: 0.4 },
];
const speedOf = p => 5.6 + 4.0 * p;   // power 0..1 -> 5.6..9.6 m/s (about 12 to 21 mph)

// ---------- scoring ----------
// frames: [{ rolls: [n, ...], split: [bool, ...] }]
function frameDone(frames, i, last) {
  const f = frames[i]; if (!f) return false;
  const r = f.rolls;
  if (i < last) return r[0] === 10 || r.length === 2;
  if (r.length < 2) return false;
  if (r[0] === 10 || r[0] + r[1] === 10) return r.length === 3;
  return true;
}
function scoreCard(frames, nFrames) {
  const rolls = []; frames.forEach(f => rolls.push(...f.rolls));
  const out = []; let total = 0, k = 0;
  for (let i = 0; i < nFrames; i++) {
    const f = frames[i]; if (!f) { out.push({ total: null }); continue; }
    let val = null;
    if (i < nFrames - 1) {
      if (f.rolls[0] === 10) { if (rolls.length > k + 2) val = 10 + rolls[k + 1] + rolls[k + 2]; k += 1; }
      else if (f.rolls.length === 2) { const s = f.rolls[0] + f.rolls[1]; if (s === 10) { if (rolls.length > k + 2) val = 10 + rolls[k + 2]; } else val = s; k += 2; }
      else k += f.rolls.length;
    } else if (frameDone(frames, i, nFrames - 1)) val = f.rolls.reduce((a, b) => a + b, 0);
    if (val !== null && (i === 0 || out[i - 1].total !== null)) { total += val; out.push({ total }); } else out.push({ total: null });
  }
  return out;
}
function frameMarks(f, last) {
  if (!f) return [];
  const r = f.rolls, m = [], num = (n, i) => n === 0 ? '-' : String(n);
  if (!last) {
    if (r[0] === 10) return ['', 'X'];
    if (r.length) m.push(num(r[0], 0));
    if (r.length > 1) m.push(r[0] + r[1] === 10 ? '/' : num(r[1], 1));
    return m;
  }
  if (r.length > 0) m.push(r[0] === 10 ? 'X' : num(r[0]));
  if (r.length > 1) m.push(r[0] === 10 ? (r[1] === 10 ? 'X' : num(r[1])) : (r[0] + r[1] === 10 ? '/' : num(r[1])));
  if (r.length > 2) {
    if (r[0] === 10 && r[1] !== 10) m.push(r[1] + r[2] === 10 ? '/' : num(r[2]));
    else m.push(r[2] === 10 ? 'X' : num(r[2]));
  }
  return m;
}

// split: head pin down and the standing pins fall into separate groups
function isSplit(standing) {
  if (standing[0]) return false;
  const up = []; standing.forEach((s, i) => { if (s) up.push(i); });
  if (up.length < 2) return false;
  const seen = new Set([up[0]]), q = [up[0]];
  while (q.length) {
    const a = q.pop();
    for (const b of up) if (!seen.has(b) && Math.hypot(SPOTS[a].x - SPOTS[b].x, SPOTS[a].z - SPOTS[b].z) < 0.32) { seen.add(b); q.push(b); }
  }
  return seen.size < up.length;
}

// ---------- computer planning ----------
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Find the aim point at the arrows that sends the ball through (tx, tz).
function solveAim(x0, speed, spin, tx, tz) {
  let lo = -0.52, hi = 0.52;
  const f = a => ballAt(x0, a, speed, spin, tz);
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2, r = f(mid);
    const x = r.gutter ? (r.x < 0 ? -1 : 1) : r.x;
    if (x < tx) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
// standing: array of 10 (falsy or truthy) for the pins left on the deck
function cpuPlan(o, standing, skillScale = 1) {
  const full = standing.every(Boolean);
  let power = o.power, spin = o.spin, tx, tz, x0;
  if (full) {
    tx = 0.062; tz = HEAD_Z;
    x0 = clamp(0.12 + spin * 0.30, -0.4, 0.42);
  } else {
    // spares: go straighter, find the front pin and clip it on the side that sends it into the rest
    spin = o.spin * 0.25; power = Math.min(1, o.power + 0.1);
    const up = []; standing.forEach((s, i) => { if (s) up.push(typeof s === 'object' ? { x: s.x, z: s.z } : { x: SPOTS[i].x, z: SPOTS[i].z }); });
    up.sort((a, b) => a.z - b.z);
    const key = up[0], rest = up.slice(1);
    let off = 0;
    if (rest.length) {
      const mx = rest.reduce((a, p) => a + p.x, 0) / rest.length;
      if (Math.abs(mx - key.x) > 0.04) off = -Math.sign(mx - key.x) * 0.075;
      else off = key.x > 0.02 ? 0.03 : -0.03;
    }
    tx = clamp(key.x + off, -0.47, 0.47); tz = key.z - 0.05;
    // cross-lane angle for corner pins
    x0 = clamp(-tx * 0.7 + spin * 0.25, -0.42, 0.42);
  }
  const speed = speedOf(power);
  const aim = solveAim(x0, speed, spin, tx, tz);
  const k = skillScale * (full ? 1 : o.spare);
  return {
    x0: clamp(x0 + gauss() * o.sigPos * k, -0.45, 0.45),
    aim: clamp(aim + gauss() * o.sigAim * k, -0.5, 0.5),
    power: clamp(power + gauss() * o.sigPow * k, 0, 1),
    spin: clamp(spin + gauss() * o.sigSpin * k, -1, 1),
  };
}

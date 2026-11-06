// ---------- lane physics (metres, seconds; x right of the bowler, z down the lane) ----------
const LANE_HALF = 0.527, GUTTER_W = 0.235, WALL_X = LANE_HALF + GUTTER_W;
const HEAD_Z = 18.288, DECK_END = 19.3, PIT_Z = 19.9;
const ARROWS_Z = 4.57, OIL_END = 11.0, DRY_FULL = 13.0;
const BALL_R = 0.109, BALL_M = 7.0;
const PIN_R = 0.0605, PIN_M = 1.53, PIN_H = 0.38, PIN_LR = 0.048, PIN_HL = 0.17;
const PIN_I = PIN_M * (2 * PIN_HL) * (2 * PIN_HL) / 12;
const HOOK_K = 0.9, KNOCK_V = 0.32;
const E_BALL = 0.7, E_PIN = 0.55, E_WALL = 0.45;
const ROW = 0.3048 * Math.sqrt(3) / 2;
const SPOTS = [
  [0, 0], [-0.1524, ROW], [0.1524, ROW], [-0.3048, 2 * ROW], [0, 2 * ROW], [0.3048, 2 * ROW],
  [-0.4572, 3 * ROW], [-0.1524, 3 * ROW], [0.1524, 3 * ROW], [0.4572, 3 * ROW],
].map(([x, dz]) => ({ x, z: HEAD_Z + dz }));

function makePins(standing) {
  return SPOTS.map((s, i) => {
    const up = !standing || standing[i];
    const pos = standing && standing[i] && typeof standing[i] === 'object' ? standing[i] : s;
    return { n: i + 1, x: pos.x, z: pos.z, vx: 0, vz: 0, st: up ? 'up' : 'gone', th: 0, w: 0, phi: 0, dphi: 0, wob: 0, wobT: 0 };
  });
}
function makeBall(x0, aimX, speed, spin) {
  const z0 = 0.3, dx = aimX - x0, dz = ARROWS_Z - z0, l = Math.hypot(dx, dz);
  return { x: x0, z: z0, vx: speed * dx / l, vz: speed * dz / l, spin, gutter: false, done: false, dist: 0, t: 0 };
}
function hookRamp(z) { return z < OIL_END ? 0.06 : z > DRY_FULL ? 1 : 0.06 + 0.94 * (z - OIL_END) / (DRY_FULL - OIL_END); }

function stepBall(b, dt) {
  if (b.done) return;
  b.t += dt;
  const sp = Math.hypot(b.vx, b.vz) || 1;
  if (!b.gutter) {
    // the ball's side rotation bites in the dry back end and drags it across the lane
    const a = -b.spin * HOOK_K * hookRamp(b.z);
    b.vx += a * dt;
    const dec = (b.z < OIL_END ? 0.15 : 0.45) * dt;
    b.vx -= b.vx / sp * dec; b.vz -= b.vz / sp * dec;
    if (Math.abs(b.x) > LANE_HALF + 0.01 && b.z < DECK_END) { b.gutter = true; b.vx = 0; b.x = Math.sign(b.x) * (LANE_HALF + GUTTER_W / 2); }
  } else {
    b.vx = 0; b.x += (Math.sign(b.x) * (LANE_HALF + GUTTER_W / 2) - b.x) * 0.2;
  }
  b.x += b.vx * dt; b.z += b.vz * dt; b.dist += sp * dt;
  if (Math.abs(b.x) > WALL_X - BALL_R) { b.x = Math.sign(b.x) * (WALL_X - BALL_R); b.vx = -b.vx * 0.3; }
  if (b.z > PIT_Z || b.vz < 0.05 && b.z > HEAD_Z) b.done = true;
}

// Ball path only, no pins: where it is when it reaches depth z. Used by the computer to plan.
function ballAt(x0, aimX, speed, spin, zTarget) {
  const b = makeBall(x0, aimX, speed, spin);
  for (let i = 0; i < 4000 && b.z < zTarget && !b.done; i++) stepBall(b, 1 / 240);
  return { x: b.x, gutter: b.gutter, ang: Math.atan2(b.vx, b.vz) };
}

// segment of a toppling or fallen pin: base point and unit direction
function pinSeg(p) {
  if (p.st === 'down') { const ux = Math.sin(p.th), uz = Math.cos(p.th); return { ax: p.x - ux * PIN_HL, az: p.z - uz * PIN_HL, bx: p.x + ux * PIN_HL, bz: p.z + uz * PIN_HL, r: PIN_LR }; }
  const ux = Math.sin(p.th), uz = Math.cos(p.th), l = PIN_H * Math.sin(p.phi);
  return { ax: p.x, az: p.z, bx: p.x + ux * l, bz: p.z + uz * l, r: PIN_LR };
}
function closestOnSeg(s, px, pz) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, l2 = dx * dx + dz * dz;
  let t = l2 > 1e-9 ? ((px - s.ax) * dx + (pz - s.az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { x: s.ax + dx * t, z: s.az + dz * t, t };
}
function segSeg(s1, s2) {
  // closest points between two segments (sampled refine: good enough for short pins)
  let best = null;
  const tryP = (px, pz, seg, flip) => {
    const c = closestOnSeg(seg, px, pz), d = Math.hypot(px - c.x, pz - c.z);
    if (!best || d < best.d) best = flip ? { d, p1x: c.x, p1z: c.z, p2x: px, p2z: pz } : { d, p1x: px, p1z: pz, p2x: c.x, p2z: c.z };
  };
  for (let k = 0; k <= 4; k++) {
    const t = k / 4;
    tryP(s1.ax + (s1.bx - s1.ax) * t, s1.az + (s1.bz - s1.az) * t, s2, false);
    tryP(s2.ax + (s2.bx - s2.ax) * t, s2.az + (s2.bz - s2.az) * t, s1, true);
  }
  return best;
}

// body helpers: mass, inertia, velocity at a point, impulse
function bodyOf(o, isBall) {
  if (isBall) return { o, m: BALL_M, I: Infinity, cx: o.x, cz: o.z, rot: false };
  if (o.st === 'down') return { o, m: PIN_M, I: PIN_I, cx: o.x, cz: o.z, rot: true };
  return { o, m: PIN_M, I: Infinity, cx: o.x, cz: o.z, rot: false };
}
function velAt(B, px, pz) {
  const o = B.o; let vx = o.vx, vz = o.vz;
  if (B.rot) { const rx = px - B.cx, rz = pz - B.cz; vx += -o.w * rz; vz += o.w * rx; }
  if (o.st === 'tip') {
    // the top of a toppling pin sweeps outward as it falls
    const s = Math.hypot(px - o.x, pz - o.z) / PIN_H, sp = PIN_H * Math.cos(o.phi) * o.dphi * Math.min(1, s / Math.max(0.05, Math.sin(o.phi)));
    vx += Math.sin(o.th) * sp; vz += Math.cos(o.th) * sp;
  }
  return { vx, vz };
}
function contact(A, B, px, pz, nx, nz, pen, e, world) {
  const va = velAt(A, px, pz), vb = velAt(B, px, pz);
  const rvn = (vb.vx - va.vx) * nx + (vb.vz - va.vz) * nz;
  const raxn = A.rot ? (px - A.cx) * nz - (pz - A.cz) * nx : 0;
  const rbxn = B.rot ? (px - B.cx) * nz - (pz - B.cz) * nx : 0;
  const k = 1 / A.m + 1 / B.m + (A.rot ? raxn * raxn / A.I : 0) + (B.rot ? rbxn * rbxn / B.I : 0);
  if (rvn < 0) {
    const j = -(1 + e) * rvn / k;
    A.o.vx -= j * nx / A.m; A.o.vz -= j * nz / A.m; if (A.rot) A.o.w -= j * raxn / A.I;
    B.o.vx += j * nx / B.m; B.o.vz += j * nz / B.m; if (B.rot) B.o.w += j * rbxn / B.I;
    // a little tangential friction makes pins spin off each other
    const tx = -nz, tz = nx, rvt = (vb.vx - va.vx) * tx + (vb.vz - va.vz) * tz;
    const jt = Math.max(-0.25 * j, Math.min(0.25 * j, -rvt / k));
    A.o.vx -= jt * tx / A.m; A.o.vz -= jt * tz / A.m; B.o.vx += jt * tx / B.m; B.o.vz += jt * tz / B.m;
    if (A.rot) A.o.w -= jt * ((px - A.cx) * tz - (pz - A.cz) * tx) / A.I;
    if (B.rot) B.o.w += jt * ((px - B.cx) * tz - (pz - B.cz) * tx) / B.I;
    if (world && world.onHit) world.onHit(j, A.o, B.o);
    A.o.hit = B.o.hit = true;
  }
  // push apart
  const corr = Math.max(0, pen - 0.001) * 0.6 / (1 / A.m + 1 / B.m);
  A.o.x -= corr * nx / A.m; A.o.z -= corr * nz / A.m; B.o.x += corr * nx / B.m; B.o.z += corr * nz / B.m;
}

function knockCheck(p, rng) {
  if (p.st !== 'up' || !p.hit) return;
  p.hit = false;
  const sp = Math.hypot(p.vx, p.vz);
  if (sp > KNOCK_V) {
    p.st = 'tip'; p.th = Math.atan2(p.vx, p.vz) + (rng() - 0.5) * 0.3;
    p.phi = 0.12; p.dphi = Math.min(14, 2.5 + sp * 1.4);
    p.vx *= 0.75; p.vz *= 0.75;
  } else if (sp > 0.03) {
    p.wob = Math.min(1, (p.wob || 0) + sp * 4); p.wobT = 0; p.wobDir = Math.atan2(p.vx, p.vz); p.vx *= 0.4; p.vz *= 0.4;
  }
}

function stepWorld(W, dt) {
  const { ball, pins, rng } = W;
  if (ball) stepBall(ball, dt);
  for (const p of pins) {
    if (p.st === 'gone') continue;
    p.x += p.vx * dt; p.z += p.vz * dt;
    const sp = Math.hypot(p.vx, p.vz);
    const fr = (p.st === 'up' ? 6 : p.st === 'tip' ? 2.0 : 2.4) * dt;
    if (sp > fr) { p.vx -= p.vx / sp * fr; p.vz -= p.vz / sp * fr; } else { p.vx = 0; p.vz = 0; }
    if (p.st === 'down' || p.st === 'pit') { p.th += p.w * dt; p.w *= Math.max(0, 1 - 2.5 * dt); }
    if (p.st === 'tip') {
      p.dphi += 38 * Math.sin(p.phi) * dt; p.phi += p.dphi * dt;
      if (p.phi >= 1.42) {
        // lying down: the body centre moves out along the fall direction
        p.st = 'down'; p.x += Math.sin(p.th) * PIN_HL; p.z += Math.cos(p.th) * PIN_HL;
        const tip = PIN_H * p.dphi * 0.35;
        p.vx += Math.sin(p.th) * tip * 0.5; p.vz += Math.cos(p.th) * tip * 0.5;
        p.w = (rng() - 0.5) * 6;
      }
    }
    if (p.st === 'up' && p.wob > 0) { p.wobT += dt; p.wob *= Math.max(0, 1 - 2.2 * dt); if (p.wob < 0.02) p.wob = 0; }
    // side kickbacks and the back of the pit
    const r = p.st === 'up' ? PIN_R : PIN_LR;
    if (Math.abs(p.x) > WALL_X - r) { p.x = Math.sign(p.x) * (WALL_X - r); if (p.vx * Math.sign(p.x) > 0) p.vx = -p.vx * E_WALL; }
    if (p.st === 'up' && (Math.abs(p.x) > LANE_HALF - 0.02 || p.z > DECK_END)) { p.st = 'tip'; p.th = Math.atan2(p.vx || Math.sign(p.x), p.vz || 0.01); p.phi = 0.2; p.dphi = 3; }
    if (p.z > PIT_Z - 0.05) { p.z = PIT_Z - 0.05; if (p.vz > 0) p.vz = -p.vz * 0.2; }
    if (p.z > DECK_END + 0.08 && (p.st === 'down' || p.st === 'tip')) { if (p.st === 'tip') { p.x += Math.sin(p.th) * PIN_HL; p.z += Math.cos(p.th) * PIN_HL; } p.st = 'pit'; p.w = p.w || (rng() - 0.5) * 8; }
  }
  // collisions
  const act = pins.filter(p => p.st !== 'gone' && p.st !== 'pit');
  for (let it = 0; it < 2; it++) {
    if (ball && !ball.done && !ball.gutter && ball.z > HEAD_Z - 1) {
      const B = bodyOf(ball, true);
      for (const p of act) {
        if (p.st === 'gone') continue;
        const P = bodyOf(p, false);
        if (p.st === 'up') {
          const dx = p.x - ball.x, dz = p.z - ball.z, d = Math.hypot(dx, dz);
          if (d < BALL_R + PIN_R && d > 1e-6) contact(B, P, ball.x + dx / d * BALL_R, ball.z + dz / d * BALL_R, dx / d, dz / d, BALL_R + PIN_R - d, E_BALL, W);
        } else {
          const s = pinSeg(p), c = closestOnSeg(s, ball.x, ball.z), dx = c.x - ball.x, dz = c.z - ball.z, d = Math.hypot(dx, dz);
          if (d < BALL_R + s.r && d > 1e-6) contact(B, P, c.x, c.z, dx / d, dz / d, BALL_R + s.r - d, E_BALL, W);
        }
      }
    }
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j];
      if (a.st === 'gone' || b.st === 'gone') continue;
      if (Math.abs(a.x - b.x) > 0.8 || Math.abs(a.z - b.z) > 0.8) continue;
      const A = bodyOf(a, false), Bb = bodyOf(b, false);
      if (a.st === 'up' && b.st === 'up') {
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < 2 * PIN_R && d > 1e-6) contact(A, Bb, a.x + dx / d * PIN_R, a.z + dz / d * PIN_R, dx / d, dz / d, 2 * PIN_R - d, E_PIN, W);
      } else if (a.st === 'up' || b.st === 'up') {
        const up = a.st === 'up' ? a : b, ly = up === a ? b : a, U = up === a ? A : Bb, L = up === a ? Bb : A;
        const s = pinSeg(ly), c = closestOnSeg(s, up.x, up.z), dx = up.x - c.x, dz = up.z - c.z, d = Math.hypot(dx, dz);
        if (d < PIN_R + s.r && d > 1e-6) contact(L, U, c.x, c.z, dx / d, dz / d, PIN_R + s.r - d, E_PIN, W);
      } else {
        const s1 = pinSeg(a), s2 = pinSeg(b), q = segSeg(s1, s2);
        if (q && q.d < s1.r + s2.r && q.d > 1e-6) {
          const nx = (q.p2x - q.p1x) / q.d, nz = (q.p2z - q.p1z) / q.d;
          contact(A, Bb, (q.p1x + q.p2x) / 2, (q.p1z + q.p2z) / 2, nx, nz, s1.r + s2.r - q.d, E_PIN, W);
        }
      }
    }
  }
  for (const p of act) knockCheck(p, rng);
  W.t += dt;
}

function worldSettled(W) {
  if (W.ball && !W.ball.done && W.ball.z < PIT_Z && !(W.ball.gutter && W.ball.z > DECK_END)) return false;
  return W.pins.every(p => p.st === 'gone' || p.st === 'pit' || (p.st !== 'tip' && Math.hypot(p.vx, p.vz) < 0.04 && (p.st !== 'down' || Math.abs(p.w) < 0.3) && !(p.wob > 0.05)));
}
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeWorld(standing, ball, rng) { return { pins: makePins(standing), ball, rng: rng || Math.random, t: 0, onHit: null }; }
// run a whole delivery without drawing (computer planning and tests)
function simulate(standing, x0, aimX, speed, spin, rng) {
  const W = makeWorld(standing, makeBall(x0, aimX, speed, spin), rng);
  let after = 0;
  for (let i = 0; i < 240 * 12; i++) {
    stepWorld(W, 1 / 240);
    if (W.ball.z > HEAD_Z - 0.5 || W.ball.done) after += 1 / 240;
    if (after > 0.6 && worldSettled(W)) break;
    if (after > 6) break;
  }
  return W;
}

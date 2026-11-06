// ---------- the lane, drawn a row at a time in perspective ----------
const FOC = 330, HY = 54, CX = 160;
const CAM_AIM = { x: 0, y: 1.5, z: -6 }, CAM_PINS_Z = 13.6;
const cam = { x: 0, y: 1.5, z: -6 };
const PITCH = 2 * WALL_X + 0.2, BOARD = 2 * LANE_HALF / 39;
const floorImg = ctx.createImageData(W, H), fbuf = new Uint32Array(floorImg.data.buffer);
const boardTone = Array.from({ length: 39 }, (_, i) => 0.93 + ((i * 37 + 11) % 7) * 0.018);
const COL = {
  lane: [218, 172, 112], deck: [232, 196, 140], approach: [176, 126, 78], mark: [92, 44, 26], foul: [150, 30, 30],
  gutter: [88, 90, 100], gutterDark: [48, 50, 58], cap: [40, 30, 50], capTop: [70, 54, 86], pit: [10, 8, 10], fog: [20, 14, 24],
};
const ARROW_X = [5, 10, 15, 20, 25, 30, 35].map(b => LANE_HALF - (b - 0.5) * BOARD);
const DOT_X = [3, 5, 8, 11, 14, 26, 29, 32, 35, 37].map(b => LANE_HALF - (b - 0.5) * BOARD);
function floorColour(xw, z, zLo, zHi, colW, out) {
  const k = Math.round(xw / PITCH), xl = xw - k * PITCH, ax = Math.abs(xl);
  let c, r, g, b;
  if (z > DECK_END) { c = COL.pit; }
  else if (ax > WALL_X) { c = ax > WALL_X + 0.03 ? COL.cap : COL.capTop; }
  else if (z < 0) {
    // approach: the boards run the full width up to the foul line
    const bd = Math.min(38, Math.max(0, Math.floor((xl + LANE_HALF) / BOARD)));
    const t = ax > LANE_HALF ? 0.85 : boardTone[bd];
    c = COL.approach; r = c[0] * t; g = c[1] * t; b = c[2] * t;
    if ((zHi > -3.7 && zLo < -3.62) || (zHi > -4.6 && zLo < -4.52)) for (const dx of DOT_X) if (Math.abs(xl - dx) < Math.max(0.02, colW * 0.6)) { c = COL.mark; r = null; }
    if (zHi > -0.04 && zLo < 0.0 && ax <= WALL_X) { c = COL.foul; r = null; }
  } else if (ax > LANE_HALF) {
    const t = (ax - LANE_HALF) / GUTTER_W, d = 1 - Math.abs(t - 0.5) * 2;
    const m = COL.gutter, n = COL.gutterDark;
    r = m[0] + (n[0] - m[0]) * d; g = m[1] + (n[1] - m[1]) * d; b = m[2] + (n[2] - m[2]) * d;
    if (zHi > 0 && zLo < 0.04) { c = COL.foul; r = null; }
  } else {
    const bd = Math.min(38, Math.max(0, Math.floor((xl + LANE_HALF) / BOARD)));
    const t = boardTone[bd];
    c = z > HEAD_Z - 0.75 ? COL.deck : COL.lane;
    // a faint sheen down the middle of the oiled front of the lane
    const sh = z < OIL_END ? 1 + 0.06 * Math.max(0, 1 - ax / 0.35) : 1;
    r = c[0] * t * sh; g = c[1] * t * sh; b = c[2] * t * sh;
    if (zHi > 0 && zLo < 0.04) { c = COL.foul; r = null; }
    else if (zHi > 2.1 && zLo < 2.16) { for (const dx of DOT_X) if (Math.abs(xl - dx) < Math.max(0.014, colW * 0.6)) { c = COL.mark; r = null; } }
    else if (zHi > 4.25 && zLo < 4.95) {
      for (let i = 0; i < 7; i++) {
        const z0 = 4.3 + (3 - Math.abs(i - 3)) * 0.1, u = (z - z0) / 0.36;
        if (u >= 0 && u <= 1 && Math.abs(xl - ARROW_X[i]) < Math.max(BOARD * 0.75 * (1 - u), colW * 0.5)) { c = COL.mark; r = null; }
      }
    } else if (z > HEAD_Z - 0.1) {
      for (const s of SPOTS) if (Math.abs(xl - s.x) < Math.max(0.02, colW * 0.5) && zHi > s.z - 0.02 && zLo < s.z + 0.02) { r *= 0.8; g *= 0.8; b *= 0.8; }
    }
  }
  if (r === null || r === undefined) { r = c[0]; g = c[1]; b = c[2]; }
  if (k !== 0) { r *= 0.72; g *= 0.72; b *= 0.74; }
  out[0] = r; out[1] = g; out[2] = b;
}
const tmpC = [0, 0, 0];
function renderFloor() {
  for (let y = 0; y < H; y++) {
    const row = y * W;
    if (y <= HY) {
      const t = y / HY, r = 14 + 10 * t, g = 10 + 6 * t, b = 22 + 12 * t;
      const v = (255 << 24) | (b << 16) | (g << 8) | r;
      for (let x = 0; x < W; x++) fbuf[row + x] = v;
      continue;
    }
    const depth = FOC * cam.y / (y + 0.5 - HY), z = cam.z + depth;
    const zHi = cam.z + FOC * cam.y / Math.max(0.01, y - HY), zLo = cam.z + FOC * cam.y / (y + 1 - HY);
    const colW = depth / FOC;
    const fog = Math.max(0, Math.min(0.6, (depth - 10) / 28));
    for (let x = 0; x < W; x++) {
      const xw = cam.x + (x + 0.5 - CX) * colW;
      floorColour(xw, z, zLo, zHi, colW, tmpC);
      const r = (tmpC[0] + (COL.fog[0] - tmpC[0]) * fog) | 0, g = (tmpC[1] + (COL.fog[1] - tmpC[1]) * fog) | 0, b = (tmpC[2] + (COL.fog[2] - tmpC[2]) * fog) | 0;
      fbuf[row + x] = (255 << 24) | (b << 16) | (g << 8) | r;
    }
  }
  ctx.putImageData(floorImg, 0, 0);
}
function proj(x, y, z) {
  const d = z - cam.z; if (d < 0.4) return null;
  const s = FOC / d;
  return { sx: CX + (x - cam.x) * s, sy: HY + (cam.y - y) * s, s, d };
}
// the masking units over the pit, one per lane, with the lane numbers
const MY_LANE = 7;
function drawMasking() {
  const dw = PIT_Z + 0.05 - cam.z; if (dw < 0.5) return;
  const s = FOC / dw, yTop = Math.round(HY - (2.7 - cam.y) * s), yBot = Math.round(HY + (cam.y - 0.5) * s);
  for (let k = -5; k <= 5; k++) {
    const x0 = Math.round(CX + (k * PITCH - PITCH / 2 - cam.x) * s), x1 = Math.round(CX + (k * PITCH + PITCH / 2 - cam.x) * s);
    if (x1 < 0 || x0 > W) continue;
    const w = x1 - x0, h = yBot - yTop, dim = k === 0 ? 1 : 0.7;
    rect(x0, yTop, w, h, shadeHex(k % 2 ? '#2c1a48' : '#1a2c48', dim));
    rect(x0, yTop, Math.max(1, Math.round(s * 0.04)), h, '#0a0810');
    const band = (f, hh, col) => rect(x0 + 1, Math.round(yTop + h * f), w - 1, Math.max(1, Math.round(h * hh)), shadeHex(col, dim));
    band(0.62, 0.05, '#e0407a'); band(0.70, 0.03, '#f2d34b'); band(0.76, 0.03, '#5fd3e0');
    rect(x0 + 1, yBot - Math.max(1, Math.round(h * 0.04)), w - 1, Math.max(1, Math.round(h * 0.04)), '#0a0810');
    const sc = Math.max(1, Math.floor(h / 26)), n = String(MY_LANE + k);
    if (h > 10) drawText(n, x0 + w / 2, yTop + Math.round(h * 0.18), shadeHex(k === 0 ? '#f2d34b' : '#ece6d6', dim), sc, 'center');
    if (k === 0 && sc >= 2 && textWidth('LANE LEGENDS', Math.max(1, sc - 1)) < w - 6) drawText('LANE LEGENDS', x0 + w / 2, yTop + Math.round(h * 0.46), '#ece6d6', Math.max(1, sc - 1), 'center');
  }
}

// ---------- pins and ball ----------
const PROFILE = [[0, 0.026], [0.06, 0.042], [0.18, 0.057], [0.3, 0.0605], [0.42, 0.055], [0.53, 0.04], [0.62, 0.026], [0.7, 0.023], [0.8, 0.029], [0.88, 0.031], [0.95, 0.025], [1, 0.008]];
function pinRadius(s) {
  for (let i = 1; i < PROFILE.length; i++) if (s <= PROFILE[i][0]) { const a = PROFILE[i - 1], b = PROFILE[i], t = (s - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; }
  return 0.008;
}
const PIN_COLS = [
  { w: C.pinWhite, s: C.pinShade, r: C.pinRed, rl: C.pinRedLight, o: C.outline },
  { w: '#b4b0aa', s: '#86817a', r: '#8a2a26', rl: '#9a3a32', o: '#120a06' },
];
const samp = [];
function drawPinAt(p, ox, dimmed) {
  // axis of the pin in 3D: base point and unit direction
  let bx = p.x + ox, by = 0, bz = p.z, ax, ay, az;
  if (p.st === 'pit') dimmed = true;
  if (p.st === 'down' || p.st === 'pit') { const ux = Math.sin(p.th), uz = Math.cos(p.th); bx -= ux * PIN_HL; bz -= uz * PIN_HL; by = PIN_LR - (p.st === 'pit' ? Math.min(0.35, (p.z - DECK_END) * 1.2) : 0); ax = ux; ay = 0; az = uz; }
  else {
    let phi = p.st === 'tip' ? p.phi : 0, th = p.th;
    if (p.st === 'up' && p.wob > 0) { phi = p.wob * 0.18 * Math.sin(p.wobT * 22); th = p.wobDir || 0; }
    ax = Math.sin(phi) * Math.sin(th); ay = Math.cos(phi); az = Math.sin(phi) * Math.cos(th);
  }
  const pb = proj(bx, by, bz); if (!pb) return;
  const n = Math.max(5, Math.min(40, Math.ceil(PIN_H * pb.s / 1.3)));
  samp.length = 0;
  for (let i = 0; i <= n; i++) {
    const s = i / n, q = proj(bx + ax * s * PIN_H, by + ay * s * PIN_H, bz + az * s * PIN_H); if (!q) continue;
    samp.push({ x: q.sx, y: q.sy, r: pinRadius(s) * q.s, s, d: q.d });
  }
  samp.sort((a, b) => b.d - a.d);
  const P = PIN_COLS[dimmed ? 1 : 0];
  const stripe = s => (s > 0.6 && s < 0.645) || (s > 0.675 && s < 0.72);
  if (samp.length && Math.max(...samp.map(q => q.r)) < 0.9) { for (const q of samp) px(Math.round(q.x), Math.round(q.y), stripe(q.s) ? P.r : P.w); return; }
  for (const q of samp) fillCircle(ctx, q.x, q.y, q.r + 1, P.o);
  for (const q of samp) fillCircle(ctx, q.x, q.y, q.r, stripe(q.s) ? P.r : P.s);
  for (const q of samp) if (q.r > 1.2) fillCircle(ctx, q.x - q.r * 0.28, q.y - q.r * 0.1, q.r * 0.62, stripe(q.s) ? P.rl : P.w);
}
function drawBall(b, o) {
  const y = b.gutter ? BALL_R - 0.07 : BALL_R;
  const q = proj(b.x, y, b.z); if (!q) return null;
  drawBallScreen(q.sx, q.sy, BALL_R * q.s, b.dist, o);
  return q;
}
function drawBallScreen(x, y, r, dist, o) {
  fillCircle(ctx, x, y, r + 1, C.outline);
  fillCircle(ctx, x, y, r, o.ball2);
  fillCircle(ctx, x - r * 0.15, y - r * 0.15, r * 0.82, o.ball);
  if (o.id === 'dave' && r > 3) { fillCircle(ctx, x + r * 0.2, y - r * 0.3, r * 0.3, '#f2f2f2'); fillCircle(ctx, x - r * 0.35, y + r * 0.3, r * 0.22, '#f2f2f2'); }
  const a = dist / BALL_R;
  [[-0.28, 0], [0.12, 0.1], [0, 1.4]].forEach(([hx, off]) => {
    const t = a + off, fz = Math.sin(t);
    if (fz > 0.25 && r > 2.5) fillCircle(ctx, x + hx * r, y - Math.cos(t) * r * 0.55, Math.max(0.6, r * 0.12), '#0a0608');
  });
  if (r > 2) fillCircle(ctx, x - r * 0.42, y - r * 0.42, Math.max(0.6, r * 0.2), '#ffffffcc');
}

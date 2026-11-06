// ---------- per-tick update ----------
const DT = 1 / 60;
const tri = u => { const m = ((u % 2) + 2) % 2; return 1 - Math.abs(m - 1); };
const boardNo = x => Math.max(1, Math.min(39, Math.round((LANE_HALF - x) / BOARD + 0.5)));
let heldDir = 0, heldT = 0;
function nudge(dir) {
  if (T.phase === 'position') T.x0 = clamp(T.x0 + dir * BOARD, -0.45, 0.45);
  else if (T.phase === 'aim') T.aim = clamp(T.aim + dir * BOARD, -0.5, 0.5);
  else return;
  sfx.tick();
}
function poseAt(t) { return t < 0.12 ? 'ready' : t < 0.4 ? 'push' : t < 0.7 ? 'back' : t < 1.02 ? 'slide' : 'follow'; }
const RELEASE_T = 0.94;
function updateTurn() {
  const p = curP(), fast = kind === 'demo' ? 1.25 : 1;
  if ((T.phase === 'position' || T.phase === 'aim') && heldDir) {
    heldT++;
    if (heldT > 14 && heldT % 2 === 0) nudge(heldDir);
  }
  if (T.phase === 'power') { T.meterT += DT; T.power = tri(T.meterT / meterPeriod); }
  if (T.phase === 'cpuprep') {
    T.t += DT * fast; const P = T.plan;
    T.x0 += (P.x0 - T.x0) * 0.12;
    if (T.t > 0.45) T.aim += (P.aim - T.aim) * 0.14;
    if (T.t > 1.0) T.power = Math.min(P.power, (T.t - 1.0) * 1.6);
    if (T.t > 1.0 + P.power / 1.6 + 0.25) { T.x0 = P.x0; T.aim = P.aim; T.power = P.power; T.powerSet = true; T.phase = 'approach'; T.t = 0; T.meterT = 0; }
  }
  if (T.phase === 'approach') {
    T.t += DT;
    if (!T.spinSet) {
      T.meterT += DT;
      if (p.cpu || autoPlay) { T.spin += (T.plan.spin - T.spin) * 0.18; if (T.t > 0.6) { T.spin = T.plan.spin; T.spinSet = true; } }
      else T.spin = 1 - 2 * tri(T.meterT / (meterPeriod * 1.1) + 1);
    }
    T.pose = poseAt(T.t);
    T.footY = 196 - 24 * Math.min(1, T.t / RELEASE_T);
    if (T.t >= RELEASE_T) { if (!T.spinSet) { T.spinSet = true; if (!p.cpu) sfx.set(); } release(); }
  }
  if (T.phase === 'roll' || T.phase === 'result' || T.phase === 'sweep') { T.t += DT; T.pose = 'follow'; }
  if (T.phase === 'roll') {
    const Wd = T.world, b = Wd.ball;
    for (let i = 0; i < 4; i++) stepWorld(Wd, DT / 4);
    T.releaseT += DT;
    const sp = Math.hypot(b.vx, b.vz);
    if (!b.done) rollSet(b.z < HEAD_Z ? 0.05 + sp * 0.012 : 0.02, b.gutter ? 260 : 120 + sp * 8); else rollSet(0.0001, 100);
    if (b.z > HEAD_Z - 0.4 || b.done) T.settleT += DT;
    if ((T.settleT > 0.9 && worldSettled(Wd)) || T.settleT > 5.5) settleResult();
  }
  if (T.phase === 'result') {
    T.resultT += DT;
    for (let i = 0; i < 4; i++) stepWorld(T.world, DT / 4);
    if (T.resultT > (kind === 'demo' ? 1.4 : 2.0)) { T.phase = 'sweep'; T.sweepT = 0; banner = null; }
  }
  if (T.phase === 'sweep') { T.sweepT += DT; if (T.sweepT >= 1.0) nextBall(); }
  // camera: rides behind the ball, then holds on the pins
  if (T.phase === 'roll' || T.phase === 'result' || T.phase === 'sweep') {
    const b = T.world.ball;
    const tz = clamp(b.z - 6.2, CAM_AIM.z, CAM_PINS_Z);
    if (T.releaseT > 0.25) cam.z += (Math.max(cam.z, tz) - cam.z) * 0.1;
    const k = (cam.z - CAM_AIM.z) / (CAM_PINS_Z - CAM_AIM.z);
    cam.y = CAM_AIM.y + (1.05 - CAM_AIM.y) * k;
  } else { cam.z = CAM_AIM.z; cam.y = CAM_AIM.y; cam.x = 0; }
}
function update() {
  if (banner && --banner.t <= 0) banner = null;
  if (state === 'play' || state === 'title') updateTurn();
  if (state === 'over' && T.world) for (let i = 0; i < 4; i++) stepWorld(T.world, DT / 4);
  syncMusic();
}

// ---------- drawing the scene ----------
const NEIGHBOUR_PINS = makePins(null);
function drawScene() {
  renderFloor();
  drawMasking();
  // the other lanes' racks, for company
  for (let k = -4; k <= 4; k++) {
    if (!k) continue;
    const q = proj(k * PITCH, 0, HEAD_Z); if (!q || q.sx < -40 || q.sx > W + 40) continue;
    [...NEIGHBOUR_PINS].sort((a, b) => b.z - a.z).forEach(p => drawPinAt(p, k * PITCH, true));
  }
  const pins = T.world ? T.world.pins : T.rackPins;
  const ents = [];
  let barZ = null, barH = 0;
  if (T.phase === 'sweep') {
    const s = T.sweepT;
    if (s < 0.3) { barZ = HEAD_Z - 0.3; barH = 0.9 - (s / 0.3) * 0.86; }
    else if (s < 0.72) { barZ = HEAD_Z - 0.3 + (s - 0.3) / 0.42 * 1.4; barH = 0.04; }
  }
  for (const p of pins || []) {
    if (p.st === 'gone') continue;
    if (p.st === 'pit' && T.phase === 'sweep' && T.sweepT > 0.5) continue;
    if (T.phase === 'sweep' && p.st !== 'up' && (T.sweepT > 0.72 || (barZ !== null && T.sweepT > 0.3 && p.z < barZ + 0.1))) continue;
    ents.push({ z: p.z, f: () => drawPinAt(p, 0, false) });
  }
  if (barZ !== null) ents.push({ z: barZ, f: () => drawSweepBar(barZ, barH) });
  const b = T.world && T.world.ball;
  if (b && T.released && !(b.done && b.z > PIT_Z - 0.1)) ents.push({ z: b.z, f: () => drawRolling(b) });
  ents.sort((a, c) => c.z - a.z).forEach(e => e.f());
  drawBowler();
  drawAimMarks();
}
function drawSweepBar(z, h) {
  const a = proj(-WALL_X, h + 0.12, z), c = proj(WALL_X, h, z); if (!a || !c) return;
  rect(Math.round(a.sx) - 1, Math.round(a.sy) - 1, Math.round(c.sx - a.sx) + 2, Math.round(c.sy - a.sy) + 2, C.outline);
  rect(Math.round(a.sx), Math.round(a.sy), Math.round(c.sx - a.sx), Math.max(1, Math.round(c.sy - a.sy)), '#4a4a58');
  rect(Math.round(a.sx), Math.round(a.sy), Math.round(c.sx - a.sx), 1, '#8a8a98');
}
function bowlerScreenX() { return Math.round(CX + T.x0 * 55 - 31); }
function drawBowler() {
  const p = curP(); if (!p) return;
  const shift = Math.max(0, (cam.z - CAM_AIM.z) * 26);
  const y = Math.round(T.footY + shift) - FOOT;
  if (y > H) return;
  const spr = sprites[charIdx(p)][T.pose];
  ctx.drawImage(spr, bowlerScreenX(), y);
}
function drawRolling(b) {
  const o = curP().char;
  const y = b.gutter ? BALL_R - 0.07 : BALL_R, q = proj(b.x, y, b.z); if (!q) return;
  let x = q.sx, yy = q.sy, r = BALL_R * q.s;
  const k = Math.min(1, T.releaseT / 0.3);
  if (k < 1) {
    // blend from the bowler's hand into the lane
    const hx = bowlerScreenX() + BALL_IN_POSE.slide[0], hy = Math.round(T.footY) - FOOT + BALL_IN_POSE.slide[1];
    const e = k * k * (3 - 2 * k);
    x = hx + (x - hx) * e; yy = hy + (yy - hy) * e; r = 5 + (r - 5) * e;
  }
  drawBallScreen(x, yy, r, b.dist, o);
}
function drawAimMarks() {
  const p = curP(); if (!p || !['position', 'aim', 'power', 'cpuprep'].includes(T.phase)) return;
  const blink = Math.floor(performance.now() / 250) % 2;
  const a = proj(T.aim, 0, ARROWS_Z), f = proj(T.x0, 0, 0.3);
  if (guide && a && f && !p.cpu) {
    for (let i = 0; i <= 14; i++) { const t = i / 14, x = f.sx + (a.sx - f.sx) * t, y = f.sy + (a.sy - f.sy) * t; if (i % 2 === 0) px(Math.round(x), Math.round(y), '#f2d34b88'); }
  }
  if (a) {
    const x = Math.round(a.sx), y = Math.round(a.sy), col = T.phase === 'aim' && blink ? '#ffffff' : C.yellow;
    rect(x - 3, y + 2, 7, 1, C.outline); rect(x - 2, y + 1, 5, 1, col); rect(x - 1, y, 3, 1, col); rect(x, y - 1, 1, 1, col); rect(x - 3, y + 2, 7, 1, col);
  }
  if (f) {
    const x = Math.round(f.sx), y = Math.round(f.sy) + 1, col = T.phase === 'position' && blink ? '#ffffff' : C.cyan;
    rect(x - 2, y, 5, 1, col); rect(x - 1, y + 1, 3, 1, col); px(x, y + 2, col);
  }
}

// ---------- HUD ----------
function markColour(m, split) { return m === 'X' ? C.yellow : m === '/' ? C.cyan : split ? C.red : C.chalk; }
function drawScoreboard(y0) {
  const nameW = 34, x0 = 1, avail = W - 2 - nameW, fw = Math.floor((avail - 14) / nFrames), lastW = avail - fw * (nFrames - 1);
  players.forEach((p, i) => {
    const y = y0 + i * 17, active = i === cur && state === 'play';
    rect(x0, y, W - 2, 16, C.panelEdge);
    rect(x0 + 1, y + 1, nameW - 2, 14, active ? '#3a3010' : C.panel);
    drawText(p.name, x0 + 3, y + 3, active ? C.yellow : C.chalk, 1, 'left');
    drawText(p.cpu ? 'CPU' : p.tag || (p.name === 'YOU' ? p.char.name : ''), x0 + 3, y + 9, C.chalkDim, 1, 'left');
    const card = scoreCard(p.frames, nFrames);
    for (let f = 0; f < nFrames; f++) {
      const fx = x0 + nameW + f * fw - 1, w = f === nFrames - 1 ? lastW : fw, last = f === nFrames - 1;
      const on = active && f === frameIdx;
      rect(fx, y + 1, w - 1, 14, on ? '#2a3550' : C.panel);
      const fr = p.frames[f], marks = frameMarks(fr, last);
      const nb = last ? 3 : 2;
      for (let k = 1; k < nb; k++) { const bx = fx + w - 1 - (nb - k) * 9; rect(bx - 1, y + 1, 1, 7, C.panelLine); }
      rect(fx + w - 1 - (nb - 1) * 9 - 1, y + 8, (nb - 1) * 9 + 1, 1, C.panelLine);
      marks.forEach((m, k) => {
        if (!m) return;
        const bx = last ? fx + w - 1 - (3 - k) * 9 + 3 : k === 0 ? fx + w - 1 - 18 + 3 : fx + w - 1 - 9 + 3;
        drawText(m, bx, y + 2, markColour(m, fr.split && fr.split[k] && m !== 'X'), 1, 'left');
      });
      if (card[f].total !== null) drawText(String(card[f].total), fx + w - 4, y + 9, C.chalk, 1, 'right');
      drawText(String(f + 1), fx + 2, y + 9, on ? C.yellow : '#4a5a7a', 1, 'left');
    }
  });
  return y0 + players.length * 17;
}
function drawPrompt(y, text, sub) {
  const w = Math.max(textWidth(text), sub ? textWidth(sub) : 0) + 10, h = sub ? 17 : 10, x = CX - Math.round(w / 2);
  rect(x - 1, y - 1, w + 2, h + 2, C.outline); rect(x, y, w, h, '#100c09dd');
  drawText(text, CX, y + 3, C.yellow, 1, 'center');
  if (sub) drawText(sub, CX, y + 10, C.chalkDim, 1, 'center');
}
const CHEERS = ['GET IN!', 'YES!', 'LOVELY!', 'BOOM!'], GROANS = ['NOOO!', 'UNLUCKY', 'ARGH!', 'OH DEAR'];
function drawPortraitPanel() {
  const p = curP(); if (!p) return;
  const i = charIdx(p), o = p.char;
  rect(3, 133, 52, 52, C.outline); rect(4, 134, 50, 50, kind === 'demo' ? C.yellow : (cur === 0 ? C.p1 : C.p2)); rect(5, 135, 48, 48, '#26324a');
  if (portraits[i]) ctx.drawImage(portraits[i], 5, 135);
  const plate = `${o.name} ${o.nick}`;
  rect(3, 186, textWidth(plate) + 8, 11, '#100c09'); drawText(plate, 7, 189, C.yellow, 1, 'left');
  if (T.phase === 'result' && T.react && T.resultT > 0.2) {
    const lines = T.react === 'cheer' ? CHEERS : GROANS, s = lines[(frameIdx + T.ballNo + i) % lines.length];
    const w = textWidth(s, 1) + 8;
    rect(46, 124, w + 2, 11, C.outline); rect(47, 125, w, 9, '#f4ecd8'); rect(49, 134, 3, 3, '#f4ecd8'); px(48, 136, '#f4ecd8');
    drawText(s, 51, 127, '#2a160c', 1, 'left');
  }
}
function drawMeters() {
  const x = 252, y = 128, w = 64;
  rect(x - 1, y - 1, w + 2, 70, C.outline); rect(x, y, w, 68, '#100c09e8');
  drawText('POWER', x + 4, y + 4, C.chalkDim, 1, 'left');
  const bx = x + 4, bw = w - 8;
  rect(bx, y + 11, bw, 7, '#26324a');
  const fill = Math.round(T.power * bw);
  for (let i = 0; i < fill; i++) rect(bx + i, y + 12, 1, 5, i < bw * 0.55 ? '#3aa860' : i < bw * 0.85 ? '#f2d34b' : '#d8443a');
  for (let k = 1; k < 4; k++) rect(bx + Math.round(bw * k / 4), y + 11, 1, 2, '#0a0810');
  drawText(Math.round(speedOf(T.power) * 2.237) + ' MPH', x + w - 4, y + 4, T.powerSet || T.phase === 'power' ? C.chalk : '#4a5a7a', 1, 'right');
  drawText('SPIN', x + 4, y + 24, C.chalkDim, 1, 'left');
  rect(bx, y + 31, bw, 7, '#26324a'); rect(bx + bw / 2, y + 30, 1, 9, '#4a5a7a');
  drawText('<', bx - 1, y + 40, C.chalkDim, 1, 'left'); drawText('>', bx + bw - 2, y + 40, C.chalkDim, 1, 'left');
  const nx = Math.round(bx + bw / 2 - T.spin * bw / 2);
  if (T.phase === 'approach' || T.spinSet || T.phase === 'roll') { rect(nx - 1, y + 30, 3, 9, C.outline); rect(nx, y + 31, 1, 7, T.spinSet ? C.yellow : '#ffffff'); }
  const sp = T.spin, word = Math.abs(sp) < 0.08 ? 'STRAIGHT' : sp > 0 ? 'HOOK' : 'BACK UP';
  if (T.phase === 'approach' || T.spinSet || T.phase === 'roll') drawText(word, x + w / 2, y + 41, C.chalk, 1, 'center');
  drawText('BOARD ' + boardNo(T.x0), x + 4, y + 52, T.phase === 'position' ? C.cyan : C.chalkDim, 1, 'left');
  drawText('AIM ' + boardNo(T.aim), x + 4, y + 60, T.phase === 'aim' ? C.yellow : C.chalkDim, 1, 'left');
}
function drawBanner(cx = CX, cy = 96) {
  if (!banner) return;
  const w = Math.max(textWidth(banner.text, 2), banner.sub ? textWidth(banner.sub, 1) : 0) + 16;
  const h = banner.sub ? 30 : 22, x = Math.round(cx - w / 2), y = Math.round(cy - h / 2);
  rect(x - 1, y - 1, w + 2, h + 2, C.outline); rect(x, y, w, h, C.bannerBg);
  rect(x, y, w, 1, C.yellow); rect(x, y + h - 1, w, 1, C.yellow);
  drawText(banner.text, cx, y + 6, C.yellow, 2, 'center');
  if (banner.sub) drawText(banner.sub, cx, y + 20, C.chalk, 1, 'center');
}
const PROMPTS = {
  position: ['< > MOVE YOUR BOWLER', 'SPACE TO SET   UP/DOWN SWITCHES TO AIM'],
  aim: ['< > MOVE THE AIM ARROW', 'SPACE TO SET   UP/DOWN SWITCHES TO POSITION'],
  power: ['SPACE TO STOP THE POWER', 'FASTER BALLS HOOK LESS'],
  approach: ['SPACE TO STOP THE SPIN', '< HOOKS LEFT     BACKS UP RIGHT >'],
};
function drawPlay() {
  drawScene();
  const yb = drawScoreboard(1);
  const p = curP();
  if (!p.cpu && PROMPTS[T.phase] && !(T.phase === 'approach' && T.spinSet)) drawPrompt(yb + 3, ...PROMPTS[T.phase]);
  if (p.cpu && T.phase === 'cpuprep') drawPrompt(yb + 3, p.name + ' IS LINING UP');
  drawPortraitPanel();
  if (['position', 'aim', 'power', 'approach', 'cpuprep'].includes(T.phase) || (T.phase === 'roll' && T.releaseT < 0.8)) drawMeters();
  drawBanner();
}

// ---------- menu, select, title, results ----------
function drawSlate(title) {
  rect(0, 0, W, H, '#5a3418');
  for (let y = 0; y < H; y += 3) rect(0, y, W, 1, '#7a4a22');
  rect(6, 6, W - 12, H - 12, C.outline); rect(8, 8, W - 16, H - 16, '#141a26');
  for (let i = 0; i < 260; i++) px(8 + ((i * 97) % (W - 16)), 8 + ((i * 53) % (H - 16)), '#1c2434');
  if (title) drawText(title, 160, 16, C.yellow, 3, 'center');
}
const MENU = ['VS COMPUTER', '2 PLAYERS', 'PRACTICE', 'GAME', 'AIM GUIDE'];
const MENU_YS = [56, 76, 96, 124, 144];
function drawMenu() {
  drawSlate('LANE LEGENDS');
  drawText('TEN PIN BOWLING FOR 1 OR 2 PLAYERS', 160, 38, C.chalkDim, 1, 'center');
  rect(40, 50, 240, 1, C.chalkDim);
  MENU.forEach((m, i) => {
    let label = m;
    if (i === 3) label = `< GAME: ${nFrames} FRAMES >`;
    if (i === 4) label = `< AIM GUIDE: ${guide ? 'ON' : 'OFF'} >`;
    const y = MENU_YS[i], on = i === menuSel;
    if (i === 3) rect(40, y - 9, 240, 1, '#2a3550');
    drawText(label, 160, y, on ? C.yellow : (i >= 3 ? C.chalkDim : C.chalk), 2, 'center');
    if (on && i < 3) drawText('>', 160 - textWidth(label, 2) / 2 - 14, y, C.yellow, 2, 'left');
  });
  rect(40, 166, 240, 1, C.chalkDim);
  drawText('ARROWS TO CHOOSE   SPACE TO SELECT', 160, 172, C.chalkDim, 1, 'center');
  drawText('ESC RETURNS HERE ANY TIME', 160, 182, C.chalkDim, 1, 'center');
}
function openMenu() { audio(); rollStop(); if (state === 'title') sfx.jingle(); state = 'menu'; banner = null; heldDir = 0; }
function menuMove([dx, dy]) {
  if (dy) { menuSel = (menuSel + dy + MENU.length) % MENU.length; sfx.blip(); }
  if (dx && menuSel === 3) { nFrames = nFrames === 10 ? 5 : 10; store.set('frames', nFrames); sfx.blip(); }
  if (dx && menuSel === 4) { guide = !guide; store.set('guide', guide); sfx.blip(); }
}
function menuSelect() {
  if (menuSel === 0) openSelect('you');
  else if (menuSel === 1) openSelect('p1');
  else if (menuSel === 2) openSelect('prac');
  else menuMove([1, 0]);
}
function openSelect(mode) {
  audio(); rollStop(); state = 'select'; selMode = mode; banner = null; heldDir = 0;
  if (mode === 'you' || mode === 'prac') sel = you;
  else if (mode === 'p1') { picks = []; sel = you; }
  else if (mode === 'cpu') { sel = BOWLERS.findIndex((o, i) => unlocked(i) && !beaten.includes(i)); if (sel < 0) sel = 0; }
}
const selOpen = i => selMode !== 'cpu' || unlocked(i);
function moveSel([dx, dy]) { const c = (sel % 4 + dx + 4) % 4, r = (Math.floor(sel / 4) + dy + 2) % 2; sel = r * 4 + c; sfx.blip(); }
function selectAction() {
  if (selMode === 'you') { you = sel; store.set('you', you); say('name-' + BOWLERS[sel].id); openSelect('cpu'); return; }
  if (selMode === 'prac') { you = sel; store.set('you', you); say('name-' + BOWLERS[sel].id); startMatch('practice', [sel]); return; }
  if (selMode === 'p1') { picks = [sel]; selMode = 'p2'; sfx.blip(); say('name-' + BOWLERS[sel].id); sel = (sel + 1) % 8; return; }
  if (selMode === 'p2') {
    if (sel === picks[0]) { banner = { text: 'TAKEN', sub: 'PLAYER 1 IS ' + BOWLERS[sel].name, t: 70 }; return; }
    say('name-' + BOWLERS[sel].id); startMatch('2p', [picks[0], sel]); return;
  }
  if (unlocked(sel)) { say('name-' + BOWLERS[sel].id); startMatch('cpu', [you], sel); }
  else banner = { text: 'LOCKED', sub: 'BEAT ' + BOWLERS[sel - 1].name + ' FIRST', t: 70 };
}
function drawSelect() {
  rect(0, 0, W, H, '#10141e');
  for (let y = 0; y < H; y += 2) rect(0, y, W, 1, '#141a26');
  const head = { you: 'CHOOSE YOUR BOWLER', prac: 'PRACTICE: CHOOSE YOUR BOWLER', cpu: 'CHOOSE YOUR OPPONENT', p1: 'PLAYER 1: CHOOSE YOUR BOWLER', p2: 'PLAYER 2: CHOOSE YOUR BOWLER' }[selMode];
  drawText(head, 8, 5, C.yellow, 1, 'left');
  drawText('ARROWS + SPACE', 312, 5, C.chalkDim, 1, 'right');
  BOWLERS.forEach((o, i) => {
    const c = i % 4, r = Math.floor(i / 4), x = 8 + c * 78, y = 16 + r * 86, open = selOpen(i), on = i === sel;
    rect(x, y, 72, 82, on ? C.yellow : '#3a4a66');
    rect(x + 1, y + 1, 70, 80, '#1a2236');
    rect(x + 2, y + 2, 68, 78, open ? '#26324a' : '#181e2a');
    for (let k = 0; k < 68; k += 4) rect(x + 2 + k, y + 2, 2, 78, open ? '#2a3752' : '#1a2030');
    const pic = open ? portraits[i] : silhouettes[i];
    if (pic) ctx.drawImage(pic, x + 12, y + 3);
    rect(x + 4, y + 53, 64, 26, '#100c09');
    drawText(open ? o.name : '???', x + 36, y + 56, open ? C.chalk : C.chalkDim, 1, 'center');
    drawText(open ? o.nick : 'LOCKED', x + 36, y + 64, open ? C.yellow : C.chalkDim, 1, 'center');
    if (open && selMode === 'cpu') drawText('AV ' + o.avg, x + 36, y + 72, C.chalkDim, 1, 'center');
    else if (selMode !== 'cpu' && best[o.id]) drawText('BEST ' + best[o.id], x + 36, y + 72, C.chalkDim, 1, 'center');
    if (selMode === 'p2' && picks[0] === i) { rect(x + 2, y + 2, 16, 9, C.p1); drawText('P1', x + 10, y + 4, C.black, 1, 'center'); }
    if (selMode === 'cpu' && beaten.includes(i)) { const sx = x + 61, sy = y + 5; [[2,0],[1,1],[2,1],[3,1],[0,2],[1,2],[2,2],[3,2],[4,2],[1,3],[3,3],[0,4],[4,4]].forEach(([a, b]) => px(sx + a, sy + b, C.yellow)); }
    if (!open) { rect(x + 32, y + 26, 8, 6, '#8a8a8a'); rect(x + 33, y + 22, 1, 4, '#8a8a8a'); rect(x + 38, y + 22, 1, 4, '#8a8a8a'); rect(x + 34, y + 21, 4, 1, '#8a8a8a'); }
  });
  drawText(selMode === 'cpu' ? 'BEAT EACH OPPONENT TO UNLOCK THE NEXT' : 'YOU BOWL AS THEM', 160, 191, C.chalkDim, 1, 'center');
  drawBanner(160, 100);
}
function drawTitle() {
  drawScene();
  drawPortraitPanel();
  // logo plate
  rect(9, 5, 150, 56, C.outline); rect(10, 6, 148, 54, C.bannerBg);
  rect(10, 6, 148, 1, C.yellow); rect(10, 59, 148, 1, C.yellow);
  drawText('LANE', 85, 11, '#5a3418', 4, 'center'); drawText('LANE', 84, 10, C.yellow, 4, 'center');
  drawText('LEGENDS', 85, 34, '#5a3418', 3, 'center'); drawText('LEGENDS', 84, 33, C.chalk, 3, 'center');
  drawText('TEN PIN BOWLING FOR 1 OR 2', 84, 51, C.chalkDim, 1, 'center');
  if (Math.floor(performance.now() / 500) % 2 === 0) { rect(116, 168, 88, 13, C.bannerBg); drawText('PRESS SPACE', 160, 172, C.yellow, 1, 'center'); }
  // the ladder
  rect(213, 3, 105, 194, C.outline); rect(214, 4, 103, 192, '#100c09e0');
  drawText('THE LADDER', 265, 9, C.yellow, 1, 'center');
  rect(218, 17, 95, 1, C.chalkDim);
  BOWLERS.forEach((op, i) => {
    const y = 23 + i * 20, open = unlocked(i);
    drawText(`${i + 1} ${open ? op.name : '???'}`, 219, y, open ? C.chalk : C.chalkDim, 1, 'left');
    drawText(open ? op.nick : 'LOCKED', 223, y + 7, C.chalkDim, 1, 'left');
    if (open) drawText(String(op.avg), 313, y, C.chalkDim, 1, 'right');
    if (beaten.includes(i)) drawText('+', 313, y + 7, C.yellow, 1, 'right');
  });
  drawText('AV  + BEATEN', 265, 186, C.chalkDim, 1, 'center');
  drawBanner(110, 110);
}
function drawResult() {
  const cpuMatch = kind === 'cpu';
  drawSlate(winner ? (winner.name === 'YOU' ? 'YOU WIN!' : winner.name + ' WINS') : players.length > 1 ? 'TIE GAME' : 'FINAL SCORE');
  drawScoreboard(36);
  const yb = 36 + players.length * 17 + 6;
  const cols = players.length === 1 ? [160] : [86, 234];
  players.forEach((p, i) => {
    const x = cols[i], won = p === winner || players.length === 1;
    rect(x - 27 - 30, yb, 54, 54, won ? C.yellow : C.chalkDim); rect(x - 26 - 30, yb + 1, 52, 52, '#26324a');
    const pic = portraits[charIdx(p)]; if (pic) ctx.drawImage(pic, x - 24 - 30, yb + 3);
    drawText(p.name, x + 26, yb + 4, won ? C.yellow : C.chalk, 1, 'center');
    drawText(String(p.final), x + 26, yb + 14, won ? C.yellow : C.chalk, 3, 'center');
    if (p.pb) drawText('NEW BEST', x + 26, yb + 34, C.cyan, 1, 'center');
    const m = p.m, rows = [['STRIKES', m.strikes], ['SPARES', m.spares], ['OPEN FRAMES', m.opens], ['SPLITS', m.splits], ['GUTTERS', m.gutters]];
    rows.forEach(([k, v], r) => { drawText(k, x - 56, yb + 60 + r * 8, C.chalkDim, 1, 'left'); drawText(String(v), x + 56, yb + 60 + r * 8, C.chalk, 1, 'right'); });
  });
  drawText(cpuMatch ? 'SPACE FOR THE LADDER' : 'SPACE FOR THE MENU', 160, 182, C.yellow, 1, 'center');
}
function render() {
  if (state === 'select') { drawSelect(); return; }
  if (state === 'title') { drawTitle(); return; }
  if (state === 'menu') { drawMenu(); return; }
  if (state === 'results') { drawResult(); return; }
  drawPlay();
}

// ---------- input ----------
function action() {
  audio();
  if (state === 'title') { openMenu(); return; }
  if (state === 'menu') { menuSelect(); return; }
  if (state === 'select') { selectAction(); return; }
  if (state === 'over') { state = 'results'; banner = null; return; }
  if (state === 'results') { if (kind === 'cpu') openSelect('cpu'); else openMenu(); return; }
  if (state !== 'play' || curP().cpu) {
    if (state === 'play' && T.phase === 'result' && T.resultT > 0.4) T.resultT = 99;
    return;
  }
  if (T.phase === 'position') { T.phase = 'aim'; sfx.set(); }
  else if (T.phase === 'aim') { T.phase = 'power'; T.meterT = 0; sfx.set(); }
  else if (T.phase === 'power') { T.powerSet = true; T.phase = 'approach'; T.t = 0; T.meterT = 0; sfx.set(); }
  else if (T.phase === 'approach' && !T.spinSet) { T.spinSet = true; sfx.set(); }
  else if (T.phase === 'result' && T.resultT > 0.4) T.resultT = 99;
}
function vertical(dy) {
  if (state === 'select') { moveSel([0, dy]); return; }
  if (state === 'menu') { menuMove([0, dy]); return; }
  if (state === 'play' && !curP().cpu && (T.phase === 'position' || T.phase === 'aim')) { T.phase = T.phase === 'position' ? 'aim' : 'position'; sfx.blip(); }
}
function horizontal(dx, fresh) {
  if (state === 'select') { if (fresh) moveSel([dx, 0]); return; }
  if (state === 'menu') { if (fresh) menuMove([dx, 0]); return; }
  if (state === 'play' && !curP().cpu) { if (fresh) { nudge(dx); heldDir = dx; heldT = 0; } }
}
const KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
window.addEventListener('keydown', e => {
  const k = KEYS[e.code];
  if (k) { e.preventDefault(); if (e.repeat) return; if (k[1]) vertical(k[1]); else horizontal(k[0], true); return; }
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) action(); return; }
  if (e.code === 'Digit1' || e.code === 'Numpad1') openSelect('you');
  if (e.code === 'Digit2' || e.code === 'Numpad2') openSelect('p1');
  if (e.code === 'KeyP') openSelect('prac');
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Escape') openMenu();
});
window.addEventListener('keyup', e => { const k = KEYS[e.code]; if (k && k[0] === heldDir) heldDir = 0; });
window.addEventListener('blur', () => { heldDir = 0; });
document.querySelectorAll('[data-dir]').forEach(b => {
  b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); const [x, y] = b.dataset.dir.split(',').map(Number); if (y) vertical(y); else horizontal(x, true); });
  const up = () => { heldDir = 0; };
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});
document.getElementById('bowlBtn').addEventListener('pointerdown', e => { e.preventDefault(); action(); });
cv.addEventListener('pointerdown', e => {
  const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  if (state === 'select') {
    const c = Math.floor((x - 8) / 78), rr = Math.floor((y - 16) / 86);
    if (c >= 0 && c < 4 && rr >= 0 && rr < 2) { const i = rr * 4 + c; if (sel === i) action(); else { sel = i; sfx.blip(); } }
    return;
  }
  if (state === 'menu') {
    const i = MENU_YS.findIndex(my => y >= my - 4 && y < my + 14);
    if (i >= 0) { if (menuSel === i) action(); else { menuSel = i; sfx.blip(); } }
    return;
  }
  action();
});
const btn = (id, f) => document.getElementById(id).addEventListener('click', e => { e.currentTarget.blur(); audio(); f(); });
btn('newCpu', () => openSelect('you'));
btn('new2', () => openSelect('p1'));
btn('newPrac', () => openSelect('prac'));
btn('menuBtn', () => openMenu());
btn('unlock', () => { if (!beaten.includes('all')) beaten.push('all'); store.set('beaten', beaten); if (state === 'select' && selMode === 'cpu') return; openSelect('cpu'); });
const muteBtn = document.getElementById('mute');
function toggleMute() { muted = !muted; if (muted) rollStop(); syncMusic(true); muteBtn.textContent = muted ? 'Sound off' : 'Sound on'; muteBtn.setAttribute('aria-pressed', String(muted)); }
muteBtn.addEventListener('click', e => { e.currentTarget.blur(); toggleMute(); });
document.querySelectorAll('input[name=speed]').forEach(r => {
  if (Number(r.value) === meterPeriod) r.checked = true;
  r.addEventListener('change', () => { meterPeriod = Number(r.value); r.blur(); store.set('speed', meterPeriod); });
});

// ---------- loop ----------
startDemo();
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= DT) { update(); acc -= DT; }
  render();
  requestAnimationFrame(frame);
}
function fit() {
  const box = document.getElementById('screen').clientWidth - 8;
  const s = Math.max(1, Math.floor(box / W));
  cv.style.width = (box >= W * 2 ? W * s : box) + 'px';
}
window.addEventListener('resize', fit); fit();
requestAnimationFrame(frame);
window.__lanes = { set auto(v) { autoPlay = v; }, sprites, tick: n => { for (let i = 0; i < n; i++) update(); }, get frameIdx() { return frameIdx; }, get winner() { return winner; }, get state() { return state; }, T, cam, get players() { return players; }, startMatch, openSelect, action, horizontal, vertical, startDemo, BOWLERS, get banner() { return banner; } };

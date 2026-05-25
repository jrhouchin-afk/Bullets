// ─── Storage ────────────────────────────────────────────────────────────────
const LS_P = 'blt_players';
const LS_G = 'blt_games';
let SP = JSON.parse(localStorage.getItem(LS_P) || '[]');
let SG = JSON.parse(localStorage.getItem(LS_G) || '[]');
let CG = null, CH = 1;
let newSel = [], newPar3 = new Set();

function lsave() {
  localStorage.setItem(LS_P, JSON.stringify(SP));
  localStorage.setItem(LS_G, JSON.stringify(SG));
}

// ─── Navigation ─────────────────────────────────────────────────────────────
function nav(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 's-home') renderHome();
  if (id === 's-new') initNew();
  if (id === 's-game') renderGame();
  if (id === 's-sc') renderSC();
}

// ─── Home ────────────────────────────────────────────────────────────────────
function renderHome() {
  const el = document.getElementById('recent-list');
  if (!SG.length) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="seclabel">Recent games</div>';
  [...SG].reverse().slice(0, 6).forEach((g, i) => {
    const ri = SG.length - 1 - i;
    const done = g.holes.filter(h => h.confirmed).length;
    el.innerHTML += `<div class="card" style="cursor:pointer" onclick="loadGame(${ri})">
      <div class="row-between">
        <div>
          <div style="font-weight:600">${g.course || 'Game'} <span style="font-size:12px;color:var(--color-text-secondary)">${g.date}</span></div>
          <div style="font-size:13px;color:var(--color-text-secondary);margin-top:2px">${g.players.join(', ')} · $${g.denom}/bullet</div>
        </div>
        <span class="pill ${done >= 18 ? 'pill-green' : 'pill-gray'}">${done >= 18 ? 'Done' : 'H' + done}</span>
      </div>
    </div>`;
  });
}

function loadGame(i) {
  CG = SG[i];
  const lp = CG.holes.findIndex(h => !h.confirmed);
  CH = lp >= 0 ? lp + 1 : 18;
  nav('s-game');
}

// ─── New Game ────────────────────────────────────────────────────────────────
function initNew() {
  newSel = [];
  newPar3 = new Set([3, 6, 12, 16]);
  document.getElementById('g-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('g-course').value = '';
  document.getElementById('g-denom').value = '0.25';
  renderChips();
  renderPar3Grid();
}

function renderChips() {
  const d = document.getElementById('saved-chips');
  if (!SP.length) { d.innerHTML = '<div style="font-size:13px;color:var(--color-text-secondary)">No saved players yet — add one below</div>'; return; }
  d.innerHTML = '<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:6px">Saved players</div>';
  SP.forEach(p => {
    const s = newSel.includes(p);
    d.innerHTML += `<span class="player-chip ${s ? 'sel' : ''}" onclick="toggleSel('${escQ(p)}')">${esc(p)}${s ? ' <i class="ti ti-check" style="font-size:11px"></i>' : ''}</span>`;
  });
}

function renderSelList() {
  const d = document.getElementById('sel-list');
  if (!newSel.length) { d.innerHTML = ''; return; }
  d.innerHTML = `<div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:4px">Selected (${newSel.length})</div>`;
  newSel.forEach(p => {
    d.innerHTML += `<div class="row-between" style="padding:4px 0">
      <span style="font-size:14px">${esc(p)}</span>
      <button class="btn btn-sm btn-danger" onclick="toggleSel('${escQ(p)}')"><i class="ti ti-x"></i></button>
    </div>`;
  });
}

function toggleSel(p) {
  if (newSel.includes(p)) newSel = newSel.filter(x => x !== p);
  else newSel.push(p);
  renderChips(); renderSelList();
}

function addPlayer() {
  const inp = document.getElementById('new-pname');
  const n = inp.value.trim();
  if (!n) return;
  if (!SP.includes(n)) { SP.push(n); lsave(); }
  if (!newSel.includes(n)) newSel.push(n);
  inp.value = '';
  renderChips(); renderSelList();
}

function renderPar3Grid() {
  const d = document.getElementById('par3-grid');
  d.innerHTML = '';
  for (let h = 1; h <= 18; h++) {
    const p = newPar3.has(h);
    d.innerHTML += `<div class="hbtn ${p ? 'par3' : ''}" onclick="toggleP3(${h})">${h}</div>`;
  }
}

function toggleP3(h) {
  if (newPar3.has(h)) newPar3.delete(h); else newPar3.add(h);
  renderPar3Grid();
}

function startGame() {
  if (newSel.length < 2) { alert('Select at least 2 players'); return; }
  const denom = parseFloat(document.getElementById('g-denom').value) || 1;
  const holes = [];
  for (let h = 1; h <= 18; h++) {
    holes.push({
      hole: h, isPar3: newPar3.has(h), bullets: [],
      par3: { closestPlayer: null, validated: null, winner: null, bulletNum: null, carries: [] },
      postP3Carry: null, // used on regular holes after last par 3 if carries are active
      confirmed: false
    });
  }
  const g = {
    id: Date.now(),
    date: document.getElementById('g-date').value,
    course: document.getElementById('g-course').value.trim(),
    players: [...newSel], denom, holes,
    par3Holes: [...newPar3].sort((a, b) => a - b)
  };
  SG.push(g); lsave();
  CG = g; CH = 1;
  nav('s-game');
}

// ─── Bullet Numbering ────────────────────────────────────────────────────────
//
// Every par 3 bullet number — whether won or carried — permanently occupies
// a slot in the sequence. Post-last-par3 carryover resolutions on regular
// holes do NOT consume new bullet numbers; they use the same numbers from
// the original par 3 carries.

function totalBulletsThrough(upToIdx) {
  let n = 0;
  for (let i = 0; i < upToIdx; i++) {
    const hd = CG.holes[i];
    if (hd.isPar3 && (hd.par3.winner !== null || hd.par3.validated === false)) n++;
    n += hd.bullets.length;
  }
  return n;
}

function nextP3BulletNum(hi) {
  return totalBulletsThrough(hi) + 1;
}

function nextRegBulletNum(hi) {
  const hd = CG.holes[hi];
  let n = totalBulletsThrough(hi);
  if (hd.isPar3 && (hd.par3.winner !== null || hd.par3.validated === false)) n++;
  n += hd.bullets.length;
  return n + 1;
}

// ─── Carry Logic ─────────────────────────────────────────────────────────────
//
// getCarries: returns all unresolved par 3 carry-overs arriving at holeIdx.
// Carries accumulate through:
//   - Par 3 holes where par3.validated === false (carry to next par 3)
//   - Post-last-par3 regular holes where postP3Carry.validated === false
// Carries are cleared when any hole's winner claims them.

function getCarries(holeIdx) {
  const carries = [];
  let runB = 0;
  for (let i = 0; i < holeIdx; i++) {
    const hd = CG.holes[i];
    if (hd.isPar3) {
      const p3Num = runB + 1;
      if (hd.par3.winner !== null) {
        runB++; runB += hd.bullets.length;
        carries.length = 0; // all carries consumed by winner
      } else if (hd.par3.validated === false) {
        carries.push({ fromHole: i + 1, bulletNum: p3Num });
        runB++; runB += hd.bullets.length;
      } else {
        runB += hd.bullets.length;
      }
    } else {
      // Regular hole — may have a post-par3 carry resolution
      if (hd.postP3Carry && hd.postP3Carry.winner !== null) {
        runB += hd.bullets.length;
        carries.length = 0; // winner claimed all carries on this regular hole
      } else {
        // Not resolved (or no carry active) — carries continue unchanged
        runB += hd.bullets.length;
      }
    }
  }
  return carries;
}

// Is this hole a regular hole after the last par 3?
function isAfterLastPar3(hi) {
  if (CG.holes[hi].isPar3) return false;
  if (!CG.par3Holes.length) return false;
  const lastP3idx = Math.max(...CG.par3Holes) - 1; // convert to 0-based
  return hi > lastP3idx;
}

// Does this hole have active (unresolved) post-par3 carries coming in?
function hasActivePostP3Carry(hi) {
  if (!isAfterLastPar3(hi)) return false;
  return getCarries(hi).length > 0;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────
//
// B(n) * denomination from each opponent per bullet.

function bulletValue(bulletNum) {
  return bulletNum * CG.denom;
}

function calcScores() {
  const scores = {};
  CG.players.forEach(p => { scores[p] = { holes: Array(18).fill(0), front: 0, back: 0, total: 0 }; });

  CG.holes.forEach((hd, i) => {
    // Par 3 bullet (on a par 3 hole)
    if (hd.par3 && hd.par3.winner) {
      const allBullets = [...(hd.par3.carries || []).map(c => c.bulletNum), hd.par3.bulletNum];
      allBullets.forEach(bNum => {
        const val = bulletValue(bNum);
        CG.players.forEach(op => {
          if (op !== hd.par3.winner) {
            scores[hd.par3.winner].holes[i] += val;
            scores[op].holes[i] -= val;
          }
        });
      });
    }
    // Post-last-par3 carry won on a regular hole
    if (hd.postP3Carry && hd.postP3Carry.winner) {
      const carries = hd.postP3Carry.carries || [];
      carries.forEach(c => {
        const val = bulletValue(c.bulletNum);
        CG.players.forEach(op => {
          if (op !== hd.postP3Carry.winner) {
            scores[hd.postP3Carry.winner].holes[i] += val;
            scores[op].holes[i] -= val;
          }
        });
      });
    }
    // Regular bullets
    hd.bullets.forEach(b => {
      const val = bulletValue(b.num);
      CG.players.forEach(op => {
        if (op !== b.player) {
          scores[b.player].holes[i] += val;
          scores[op].holes[i] -= val;
        }
      });
    });
  });

  CG.players.forEach(p => {
    scores[p].front = scores[p].holes.slice(0, 9).reduce((a, b) => a + b, 0);
    scores[p].back = scores[p].holes.slice(9).reduce((a, b) => a + b, 0);
    scores[p].total = scores[p].front + scores[p].back;
  });
  return scores;
}

// ─── Game Screen ─────────────────────────────────────────────────────────────
function renderGame() {
  if (!CG) return;
  document.getElementById('g-title').textContent = CG.course || 'Game';
  const navEl = document.getElementById('hole-nav');
  navEl.innerHTML = '';
  CG.holes.forEach((hd, i) => {
    const h = i + 1;
    const active = h === CH;
    const isDone = hd.confirmed;
    const isCarry = hd.isPar3 && hd.par3.validated === false && !isDone;
    const cls = active ? 'active ' : isDone ? (hd.isPar3 && hd.par3.winner ? 'done-p3' : 'done') : (isCarry ? 'carryover' : '');
    navEl.innerHTML += `<div class="hn ${cls}" onclick="goH(${h})" style="width:100%">${h}</div>`;
  });
  renderHole();
}

function goH(h) { CH = h; renderGame(); }

function renderHole() {
  const hd = CG.holes[CH - 1];
  const el = document.getElementById('hole-body');
  if (hd.isPar3) renderPar3Hole(hd, el, CH - 1);
  else renderRegHole(hd, el, CH - 1);
}

// ─── Par 3 Hole ──────────────────────────────────────────────────────────────
function renderPar3Hole(hd, el, hi) {
  const carries = getCarries(hi);
  const p3Num = nextP3BulletNum(hi);
  let html = '';

  if (hd.par3.winner === null && hd.par3.validated === null && !hd.par3.closestPlayer) {
    html += `<div class="card">
      <div class="row-between" style="margin-bottom:.75rem">
        <div class="row">
          <span style="font-size:17px;font-weight:600">Hole ${CH}</span>
          <span class="pill pill-blue">Par 3</span>
        </div>
      </div>`;
    if (carries.length > 0) {
      const allBullets = [...carries.map(c => c.bulletNum), p3Num];
      const totalPayout = allBullets.reduce((sum, n) => sum + bulletValue(n), 0) * (CG.players.length - 1);
      html += `<div class="stake-box">
        <div style="font-size:13px;font-weight:600;color:var(--color-amber-text);margin-bottom:6px">
          <i class="ti ti-trophy" style="font-size:13px;vertical-align:-2px;margin-right:4px"></i>What's at stake
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">`;
      carries.forEach(c => {
        html += `<div>
          <div style="font-size:11px;color:#854f0b;margin-bottom:3px">Carry from H${c.fromHole}</div>
          <span class="pill pill-amber">B${c.bulletNum} · $${bulletValue(c.bulletNum).toFixed(2)}</span>
        </div>`;
      });
      html += `<div>
          <div style="font-size:11px;color:#854f0b;margin-bottom:3px">This hole</div>
          <span class="pill pill-amber">B${p3Num} · $${bulletValue(p3Num).toFixed(2)}</span>
        </div></div>
        <div style="border-top:0.5px solid var(--color-amber-border);padding-top:8px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px;color:var(--color-amber-text);font-weight:600">Total if validated</span>
          <span style="font-size:15px;font-weight:600;color:var(--color-amber-dark)">$${totalPayout.toFixed(2)} from each</span>
        </div>
      </div>`;
    }
    html += `<div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:.5rem">
        Who won the par 3 bullet <strong style="color:var(--color-text)">B${p3Num}</strong>
        <span style="color:var(--color-text-secondary)">($${bulletValue(p3Num).toFixed(2)} ea)</span>?
      </div>
      <div class="player-grid">`;
    CG.players.forEach(p => {
      html += `<button class="pbtn" onclick="setClosest(${hi},'${escQ(p)}')">${esc(p)}</button>`;
    });
    html += `</div>
      <button class="btn btn-muted" onclick="carryP3(${hi})">No — carry over to next par 3</button>
    </div>`;

  } else if (hd.par3.closestPlayer && hd.par3.validated === null) {
    html += `<div class="card">
      <div class="row-between" style="margin-bottom:.75rem">
        <div class="row"><span style="font-size:17px;font-weight:600">Hole ${CH}</span><span class="pill pill-blue">Par 3</span></div>
      </div>
      <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:.75rem">
        <strong style="color:var(--color-text)">${esc(hd.par3.closestPlayer)}</strong> was closest — did they validate? (≤ 2 putts)
      </div>
      <div class="row" style="gap:8px">
        <button class="btn" onclick="validateP3(${hi},true)" style="flex:1">Yes — validated</button>
        <button class="btn" onclick="validateP3(${hi},false)" style="flex:1;color:var(--color-text-secondary)">No — carry over</button>
      </div>
    </div>`;

  } else if (hd.par3.winner) {
    const allWon = [...(hd.par3.carries || []).map(c => c.bulletNum), hd.par3.bulletNum];
    const totalWon = allWon.reduce((s, n) => s + bulletValue(n), 0) * (CG.players.length - 1);
    html += `<div class="card">
      <div class="row-between" style="margin-bottom:.75rem">
        <div class="row"><span style="font-size:17px;font-weight:600">Hole ${CH}</span><span class="pill pill-blue">Par 3</span></div>
      </div>
      <div class="bullet-row">
        <span class="pill pill-amber">B${hd.par3.bulletNum}</span>
        <span style="font-size:14px;font-weight:600;flex:1">${esc(hd.par3.winner)}</span>
        <span style="font-size:12px;color:var(--color-text-secondary)">par 3 · $${bulletValue(hd.par3.bulletNum).toFixed(2)} ea</span>
        <button class="btn btn-sm btn-danger" onclick="clearP3(${hi})"><i class="ti ti-x"></i></button>
      </div>
      ${hd.par3.carries && hd.par3.carries.length
        ? `<div style="font-size:12px;color:#854f0b;margin-top:6px">Also won: ${hd.par3.carries.map(c => `B${c.bulletNum} ($${bulletValue(c.bulletNum).toFixed(2)} ea)`).join(', ')}</div>
           <div style="font-size:12px;font-weight:600;color:var(--color-green-text);margin-top:4px">Total: $${totalWon.toFixed(2)}</div>`
        : ''}
    </div>`;

  } else if (hd.par3.validated === false) {
    html += `<div class="card">
      <div class="row-between" style="margin-bottom:.75rem">
        <div class="row"><span style="font-size:17px;font-weight:600">Hole ${CH}</span><span class="pill pill-blue">Par 3</span></div>
      </div>
      <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:.5rem">
        <i class="ti ti-arrow-right"></i> Par 3 bullet B${p3Num} ($${bulletValue(p3Num).toFixed(2)} ea) carried over
      </div>
      <button class="btn btn-sm" onclick="clearP3(${hi})">Undo</button>
    </div>`;
  }

  // Step 2: regular bullets (only after par 3 resolved)
  const p3Resolved = hd.par3.winner !== null || hd.par3.validated === false;
  if (p3Resolved) {
    html += renderRegBulletsCard(hd, hi, true);
  }

  html += navBtns();
  el.innerHTML = html;
}

// ─── Regular Hole ─────────────────────────────────────────────────────────────
function renderRegHole(hd, el, hi) {
  let html = '';
  const carries = getCarries(hi);
  const hasCarry = hasActivePostP3Carry(hi);

  if (hasCarry) {
    // Step 1: resolve the post-last-par3 carry
    const pc = hd.postP3Carry;

    if (!pc || (pc.winner === null && pc.validated === null && !pc.closestPlayer)) {
      // Ask who won the carryover
      const totalPayout = carries.reduce((sum, c) => sum + bulletValue(c.bulletNum), 0) * (CG.players.length - 1);
      html += `<div class="card">
        <div class="row-between" style="margin-bottom:.75rem">
          <div class="row">
            <span style="font-size:17px;font-weight:600">Hole ${CH}</span>
            <span class="pill pill-amber">Par 3 carry</span>
          </div>
        </div>
        <div class="stake-box">
          <div style="font-size:13px;font-weight:600;color:var(--color-amber-text);margin-bottom:6px">
            <i class="ti ti-trophy" style="font-size:13px;vertical-align:-2px;margin-right:4px"></i>Unclaimed par 3 bullet${carries.length > 1 ? 's' : ''}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">`;
      carries.forEach(c => {
        html += `<div>
            <div style="font-size:11px;color:#854f0b;margin-bottom:3px">From H${c.fromHole}</div>
            <span class="pill pill-amber">B${c.bulletNum} · $${bulletValue(c.bulletNum).toFixed(2)}</span>
          </div>`;
      });
      html += `</div>
          <div style="border-top:0.5px solid var(--color-amber-border);padding-top:8px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;color:var(--color-amber-text);font-weight:600">Total if won</span>
            <span style="font-size:15px;font-weight:600;color:var(--color-amber-dark)">$${totalPayout.toFixed(2)} from each</span>
          </div>
        </div>
        <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:.5rem">Who was closest to the pin?</div>
        <div class="player-grid">`;
      CG.players.forEach(p => {
        html += `<button class="pbtn" onclick="setPostCarryClosest(${hi},'${escQ(p)}')">${esc(p)}</button>`;
      });
      html += `</div>
        <button class="btn btn-muted" onclick="passPostCarry(${hi})">No — carry to next hole</button>
      </div>`;

    } else if (pc && pc.closestPlayer && pc.validated === null) {
      // Confirm validation
      html += `<div class="card">
        <div class="row-between" style="margin-bottom:.75rem">
          <div class="row">
            <span style="font-size:17px;font-weight:600">Hole ${CH}</span>
            <span class="pill pill-amber">Par 3 carry</span>
          </div>
        </div>
        <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:.75rem">
          <strong style="color:var(--color-text)">${esc(pc.closestPlayer)}</strong> was closest — did they validate? (≤ 2 putts)
        </div>
        <div class="row" style="gap:8px">
          <button class="btn" onclick="validatePostCarry(${hi},true)" style="flex:1">Yes — validated</button>
          <button class="btn" onclick="validatePostCarry(${hi},false)" style="flex:1;color:var(--color-text-secondary)">No — carry to next hole</button>
        </div>
      </div>`;

    } else if (pc && pc.winner) {
      // Won — show result
      const totalWon = carries.reduce((sum, c) => sum + bulletValue(c.bulletNum), 0) * (CG.players.length - 1);
      html += `<div class="card">
        <div class="row-between" style="margin-bottom:.75rem">
          <div class="row">
            <span style="font-size:17px;font-weight:600">Hole ${CH}</span>
            <span class="pill pill-amber">Par 3 carry</span>
          </div>
        </div>`;
      carries.forEach(c => {
        html += `<div class="bullet-row">
          <span class="pill pill-amber">B${c.bulletNum}</span>
          <span style="font-size:14px;font-weight:600;flex:1">${esc(pc.winner)}</span>
          <span style="font-size:12px;color:var(--color-text-secondary)">carry · $${bulletValue(c.bulletNum).toFixed(2)} ea</span>
        </div>`;
      });
      html += `<div style="font-size:12px;font-weight:600;color:var(--color-green-text);margin-top:6px">Total: $${totalWon.toFixed(2)}</div>
        <button class="btn btn-sm btn-danger" onclick="clearPostCarry(${hi})" style="margin-top:.5rem">Undo</button>
      </div>`;

    } else if (pc && pc.validated === false) {
      // Passed to next hole
      html += `<div class="card">
        <div class="row-between" style="margin-bottom:.75rem">
          <div class="row">
            <span style="font-size:17px;font-weight:600">Hole ${CH}</span>
            <span class="pill pill-amber">Par 3 carry</span>
          </div>
        </div>
        <div style="font-size:13px;color:var(--color-text-secondary);margin-bottom:.5rem">
          <i class="ti ti-arrow-right"></i> Par 3 carry passed to next hole
        </div>
        <button class="btn btn-sm" onclick="clearPostCarry(${hi})">Undo</button>
      </div>`;
    }

    // Only show regular bullets after carry is resolved
    const carryResolved = pc && (pc.winner !== null || pc.validated === false);
    if (carryResolved) {
      html += renderRegBulletsCard(hd, hi, false);
    }

  } else {
    // No carry — normal regular hole
    html += renderRegBulletsCard(hd, hi, false);
  }

  html += navBtns();
  el.innerHTML = html;
}

// Shared card for regular bullets on any hole
function renderRegBulletsCard(hd, hi, isPar3Hole) {
  const regNext = nextRegBulletNum(hi);
  const awarded = hd.bullets.map(b => b.player);
  let html = `<div class="card">
    <div class="row-between" style="margin-bottom:.75rem">
      <span style="font-size:14px;font-weight:600">${isPar3Hole ? 'Regular bullets (long putts)' : 'Hole ' + (hi + 1)}</span>
      <span style="font-size:13px;color:var(--color-text-secondary)">Next: <strong style="color:var(--color-text)">B${regNext}</strong> · $${bulletValue(regNext).toFixed(2)} ea</span>
    </div>`;
  if (hd.bullets.length) {
    hd.bullets.forEach((b, bi) => {
      html += `<div class="bullet-row">
        <span class="pill pill-green">B${b.num}</span>
        <span style="font-size:14px;font-weight:600;flex:1">${esc(b.player)}</span>
        <span style="font-size:12px;color:var(--color-text-secondary)">$${bulletValue(b.num).toFixed(2)} ea</span>
        <button class="btn btn-sm btn-danger" onclick="removeB(${hi},${bi})"><i class="ti ti-x"></i></button>
      </div>`;
    });
    html += `<div style="height:6px"></div>`;
  }
  html += `<div class="player-grid">`;
  CG.players.forEach(p => {
    const already = awarded.includes(p);
    html += `<button class="pbtn" onclick="addB(${hi},'${escQ(p)}')" ${already ? 'disabled' : ''}>
      ${esc(p)}${already ? ' <i class="ti ti-check" style="font-size:11px"></i>' : ''}
    </button>`;
  });
  html += `</div>
    <button class="btn btn-muted" onclick="confirmHole(${hi})">${hd.bullets.length ? 'Done — confirm hole' : 'No bullets this hole — confirm'}</button>
  </div>`;
  return html;
}

function navBtns() {
  return `<div class="row" style="gap:8px;margin-top:.5rem">
    ${CH > 1
      ? `<button class="btn" onclick="goH(${CH - 1})" style="flex:1"><i class="ti ti-arrow-left"></i> H${CH - 1}</button>`
      : '<div style="flex:1"></div>'}
    ${CH < 18
      ? `<button class="btn btn-primary" onclick="goH(${CH + 1})" style="flex:1">H${CH + 1} <i class="ti ti-arrow-right"></i></button>`
      : `<button class="btn btn-primary" onclick="nav('s-sc')" style="flex:1">Scorecard</button>`}
  </div>`;
}

// ─── Actions ──────────────────────────────────────────────────────────────────
function addB(hi, player) {
  const hd = CG.holes[hi];
  if (hd.bullets.some(b => b.player === player)) return;
  const num = nextRegBulletNum(hi);
  hd.bullets.push({ num, player });
  hd.confirmed = false;
  lsave(); renderGame();
}

function removeB(hi, bi) {
  CG.holes[hi].bullets.splice(bi, 1);
  CG.holes[hi].confirmed = false;
  lsave(); renderGame();
}

function confirmHole(hi) {
  CG.holes[hi].confirmed = true;
  lsave();
  if (CH < 18) goH(CH + 1); else renderGame();
}

// Par 3 hole actions
function setClosest(hi, player) {
  CG.holes[hi].par3.closestPlayer = player;
  CG.holes[hi].par3.validated = null;
  lsave(); renderGame();
}

function validateP3(hi, val) {
  const hd = CG.holes[hi];
  if (val) {
    const carries = getCarries(hi);
    const num = nextP3BulletNum(hi);
    hd.par3.winner = hd.par3.closestPlayer;
    hd.par3.validated = true;
    hd.par3.bulletNum = num;
    hd.par3.carries = carries;
  } else {
    hd.par3.validated = false;
    hd.par3.winner = null;
  }
  lsave(); renderGame();
}

function carryP3(hi) {
  const hd = CG.holes[hi];
  hd.par3.validated = false;
  hd.par3.winner = null;
  hd.par3.closestPlayer = null;
  lsave(); renderGame();
}

function clearP3(hi) {
  CG.holes[hi].par3 = { closestPlayer: null, validated: null, winner: null, bulletNum: null, carries: [] };
  CG.holes[hi].confirmed = false;
  lsave(); renderGame();
}

// Post-last-par3 carry actions (on regular holes)
function setPostCarryClosest(hi, player) {
  if (!CG.holes[hi].postP3Carry) CG.holes[hi].postP3Carry = { closestPlayer: null, validated: null, winner: null, carries: [] };
  CG.holes[hi].postP3Carry.closestPlayer = player;
  CG.holes[hi].postP3Carry.validated = null;
  lsave(); renderGame();
}

function validatePostCarry(hi, val) {
  const hd = CG.holes[hi];
  if (!hd.postP3Carry) return;
  if (val) {
    const carries = getCarries(hi);
    hd.postP3Carry.winner = hd.postP3Carry.closestPlayer;
    hd.postP3Carry.validated = true;
    hd.postP3Carry.carries = carries;
  } else {
    hd.postP3Carry.validated = false;
    hd.postP3Carry.winner = null;
    hd.postP3Carry.closestPlayer = null;
  }
  lsave(); renderGame();
}

function passPostCarry(hi) {
  if (!CG.holes[hi].postP3Carry) CG.holes[hi].postP3Carry = { closestPlayer: null, validated: null, winner: null, carries: [] };
  CG.holes[hi].postP3Carry.validated = false;
  CG.holes[hi].postP3Carry.winner = null;
  CG.holes[hi].postP3Carry.closestPlayer = null;
  lsave(); renderGame();
}

function clearPostCarry(hi) {
  CG.holes[hi].postP3Carry = null;
  CG.holes[hi].confirmed = false;
  lsave(); renderGame();
}

// ─── Scorecard ────────────────────────────────────────────────────────────────
function renderSC() {
  if (!CG) return;
  const scores = calcScores();
  const el = document.getElementById('sc-body');

  const statCards = CG.players.map(p => {
    const net = scores[p].total;
    return `<div class="stat-card">
      <div class="lbl">${esc(p)}</div>
      <div class="val ${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : ''}$${net.toFixed(2)}</div>
    </div>`;
  }).join('');

  const mkCells = (p, range) => scores[p].holes.slice(...range).map(v =>
    `<td style="color:${v > 0 ? 'var(--color-green-text)' : v < 0 ? '#a32d2d' : 'var(--color-text-secondary)'}">${v !== 0 ? (v > 0 ? '+' : '') + '$' + Math.abs(v).toFixed(0) : '-'}</td>`
  ).join('');

  const mkSum = (val, dollar = false) =>
    `<td style="font-weight:600;color:${val >= 0 ? 'var(--color-green-text)' : '#a32d2d'}">${val >= 0 ? '+' : ''}${dollar ? '$' + Math.abs(val).toFixed(2) : '$' + Math.abs(val).toFixed(0)}</td>`;

  const fHead = '<tr><th class="pcol">Player</th>' + [1,2,3,4,5,6,7,8,9].map(h => `<th>${h}${CG.holes[h-1].isPar3 ? '*' : ''}</th>`).join('') + '<th>F</th></tr>';
  const fRows = CG.players.map(p => `<tr><td class="pcol sc-table">${esc(p)}</td>${mkCells(p, [0, 9])}${mkSum(scores[p].front)}</tr>`).join('');
  const bHead = '<tr><th class="pcol">Player</th>' + [10,11,12,13,14,15,16,17,18].map(h => `<th>${h}${CG.holes[h-1].isPar3 ? '*' : ''}</th>`).join('') + '<th>B</th><th>Tot</th></tr>';
  const bRows = CG.players.map(p => `<tr><td class="pcol sc-table">${esc(p)}</td>${mkCells(p, [9, 18])}${mkSum(scores[p].back)}${mkSum(scores[p].total, true)}</tr>`).join('');

  // Bullet log
  const allBullets = [];
  CG.holes.forEach((hd, i) => {
    if (hd.par3 && hd.par3.winner) {
      allBullets.push({ h: i+1, player: hd.par3.winner, num: hd.par3.bulletNum, type: 'p3', carries: hd.par3.carries || [] });
    }
    if (hd.postP3Carry && hd.postP3Carry.winner) {
      // Log each carried bullet individually under the hole it was claimed
      (hd.postP3Carry.carries || []).forEach(c => {
        allBullets.push({ h: i+1, player: hd.postP3Carry.winner, num: c.bulletNum, type: 'carry' });
      });
    }
    hd.bullets.forEach(b => allBullets.push({ h: i+1, player: b.player, num: b.num, type: 'reg' }));
  });
  allBullets.sort((a, b) => a.num - b.num);

  let blog = '';
  if (allBullets.length) {
    blog = '<div class="seclabel">Bullet log</div><div class="card">';
    allBullets.forEach(b => {
      let label = '', pillCls = 'pill-green', valEa = bulletValue(b.num);
      if (b.type === 'p3') {
        const allNums = [...b.carries.map(c => c.bulletNum), b.num];
        const totalEa = allNums.reduce((s, n) => s + bulletValue(n), 0);
        const totalAll = totalEa * (CG.players.length - 1);
        pillCls = 'pill-amber';
        blog += `<div class="bullet-row">
          <span class="pill ${pillCls}">B${b.num}</span>
          <span style="font-size:14px;flex:1">H${b.h} — ${esc(b.player)} <span style="font-size:12px;color:var(--color-text-secondary)">(par 3${b.carries.length ? ' +' + b.carries.length + ' carry' : ''})</span></span>
          <span style="font-size:13px;font-weight:600;color:var(--color-green-text)">+$${totalAll.toFixed(2)}</span>
        </div>`;
        return;
      } else if (b.type === 'carry') {
        pillCls = 'pill-amber';
        label = ' (carry)';
      }
      const val = bulletValue(b.num) * (CG.players.length - 1);
      blog += `<div class="bullet-row">
        <span class="pill ${pillCls}">B${b.num}</span>
        <span style="font-size:14px;flex:1">H${b.h} — ${esc(b.player)}${label}</span>
        <span style="font-size:13px;font-weight:600;color:var(--color-green-text)">+$${val.toFixed(2)}</span>
      </div>`;
    });
    blog += '</div>';
  }

  el.innerHTML = `
    <div class="stat-grid">${statCards}</div>
    <div class="seclabel">Front 9 <span style="font-size:10px;font-weight:400">* = par 3</span></div>
    <div style="overflow-x:auto;margin-bottom:.75rem"><table class="sc-table">${fHead}${fRows}</table></div>
    <div class="seclabel">Back 9</div>
    <div style="overflow-x:auto;margin-bottom:.75rem"><table class="sc-table">${bHead}${bRows}</table></div>
    ${blog}`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escQ(s) {
  return String(s).replace(/'/g, "\\'");
}

// ─── Init ─────────────────────────────────────────────────────────────────────
renderHome();

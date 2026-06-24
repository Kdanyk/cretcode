(() => {
  if (window.scanCounterV29) return;
  window.scanCounterV29 = true;
  document.querySelectorAll('[data-reit-counter]').forEach((el) => el.remove());

  const saveKey = 'scanCounterV29State';
  const technoFont = 'system-ui, -apple-system, sans-serif';
  const dayHours = ['7:30', '8:30', '9:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:00'];
  const nightHours = ['19:30', '20:30', '21:30', '22:30', '23:30', '00:30', '1:30', '2:30', '3:30', '4:30', '5:00'];
  const currentHour = new Date().getHours();
  const night = currentHour >= 17 || currentHour < 5;
  const hours = night ? nightHours : dayHours;
  const shiftName = night ? 'night' : 'day';

  let total = 0, problemTotal = 0, seen = '', start = Date.now(), lastTrigger = 'Standby';
  let targetPerHour = 28, beforeBreak = 0, open = true, grace = 4 * 60 * 1000, selectedBreak = 1;
  let offRemain = 30 * 60 * 1000, lastActivityTime = Date.now(), offLastTick = Date.now();
  let triggerText = 'Wprowadź pojemnik', problemText = 'Zeskanuj - PROBLEM-SOLVE', nlpText = 'Zeskanuj nowy NLP';
  let skipNextPack = false, showRatePercent = false, showLeftInsteadTotal = false, autoStatusColor = false, ignoreNLP = false;
  let manualColor = '#06b6d4', miniOpacity = 100, miniSize = 14, miniPos = 'tl', hourCounts = {}, problemCounts = {}, lastSave = 0;

  function initCounts() { hours.forEach((h) => { if (hourCounts[h] == null) hourCounts[h] = 0; if (problemCounts[h] == null) problemCounts[h] = 0; }); }

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(saveKey) || '{}');
      if (s.shift && s.shift !== shiftName) { initCounts(); return; }
      start = Number(s.start) || Date.now();
      problemTotal = Math.max(0, parseInt(s.problemTotal) || 0);
      beforeBreak = Math.max(0, parseInt(s.beforeBreak) || 0);
      targetPerHour = Math.max(1, parseInt(s.targetPerHour) || 28);
      selectedBreak = s.selectedBreak !== undefined ? parseInt(s.selectedBreak) : 1;
      offRemain = Math.max(0, Number(s.offRemain) || 30 * 60 * 1000);
      showRatePercent = !!s.showRatePercent;
      showLeftInsteadTotal = !!s.showLeftInsteadTotal;
      autoStatusColor = !!s.autoStatusColor;
      ignoreNLP = !!s.ignoreNLP;
      manualColor = s.manualColor || '#06b6d4';
      miniPos = s.miniPos || 'tl';
      miniOpacity = Math.min(100, Math.max(0, s.miniOpacity !== undefined ? parseInt(s.miniOpacity) : 100));
      miniSize = Math.min(45, Math.max(10, parseInt(s.miniSize) || 14));
      hourCounts = {}; problemCounts = {};
      hours.forEach((h) => { hourCounts[h] = Math.max(0, parseInt(s.hourCounts && s.hourCounts[h]) || 0); problemCounts[h] = Math.max(0, parseInt(s.problemCounts && s.problemCounts[h]) || 0); });
      lastTrigger = s.lastTrigger || 'System Restored';
    } catch (_) { initCounts(); }
  }

  function saveState(force) {
    const now = Date.now(); if (!force && now - lastSave < 1500) return; lastSave = now;
    try { localStorage.setItem(saveKey, JSON.stringify({ shift: shiftName, savedAt: now, start, problemTotal, beforeBreak, targetPerHour, selectedBreak, offRemain, showRatePercent, showLeftInsteadTotal, autoStatusColor, ignoreNLP, manualColor, miniOpacity, miniSize, miniPos, hourCounts, problemCounts, lastTrigger })); } catch (_) {}
  }

  loadState(); initCounts();

  function getBreakTimestamps() {
    if (selectedBreak === 0) return {start: 0, end: 0};
    const times = night ? [{h:23,m:20}, {h:23,m:50}, {h:0,m:20}, {h:0,m:50}] : [{h:11,m:20}, {h:11,m:50}, {h:12,m:20}, {h:12,m:50}];
    const t = times[selectedBreak - 1]; let d = new Date(); d.setHours(t.h, t.m, 0, 0);
    if (night) { let ch = new Date().getHours(); if (ch >= 17 && t.h < 12) d.setDate(d.getDate() + 1); if (ch < 12 && t.h >= 17) d.setDate(d.getDate() - 1); }
    let startTs = d.getTime(); return { start: startTs, end: startTs + 30 * 60000 };
  }

  function isBreakActive() { if (selectedBreak === 0) return false; let bt = getBreakTimestamps(); let now = Date.now(); return now >= bt.start && now < bt.end; }
  function getActiveHours() {
    let ms = Date.now() - start;
    if (selectedBreak > 0) {
      let bt = getBreakTimestamps(); let overlap = 0;
      if (start < bt.end && Date.now() > bt.start) { let startOverlap = Math.max(start, bt.start); let endOverlap = Math.min(Date.now(), bt.end); overlap = Math.max(0, endOverlap - startOverlap); }
      ms -= overlap;
    }
    return ms > 0 ? ms / 3600000 : 0;
  }

  const box = document.createElement('div');
  box.setAttribute('data-reit-counter', 'mini');
  box.style = 'position:fixed;background:rgba(15, 23, 42, 0.4);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);color:' + manualColor + ';padding:6px 12px;font-size:' + miniSize + 'px;font-family:' + technoFont + ';z-index:999999;border-radius:20px;border:1px solid rgba(255,255,255,0.1);opacity:' + (miniOpacity / 100) + ';cursor:pointer;user-select:none;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.3);letter-spacing:0.5px;';

  function applyMiniPos() {
    box.style.top = 'auto'; box.style.bottom = 'auto'; box.style.left = 'auto'; box.style.right = 'auto';
    if (miniPos === 'bl') { box.style.bottom = '34px'; box.style.left = '300px'; }
    if (miniPos === 'br') { box.style.bottom = '34px'; box.style.right = '360px'; }
    if (miniPos === 'tl') { box.style.top = '5px'; box.style.left = '300px'; }
    if (miniPos === 'tr') { box.style.top = '5px'; box.style.right = '360px'; }
  }
  applyMiniPos(); document.body.appendChild(box);

  const panel = document.createElement('div');
  panel.setAttribute('data-reit-counter', 'panel');
  panel.style = 'position:fixed;top:58px;bottom:24px;right:20px;background:rgba(15, 23, 42, 0.75);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:#f8fafc;padding:16px;border-radius:20px;border:1px solid rgba(255,255,255,0.1);z-index:999999;font-family:' + technoFont + ';width:330px;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;transform:translateX(0);opacity:1;pointer-events:auto;transition:all 0.4s cubic-bezier(0.16, 1, 0.3, 1);box-shadow:0 10px 40px rgba(0,0,0,0.5);';

  panel.innerHTML = `
  <div id="mainView" style="width:100%; box-sizing:border-box;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
      <div id="mainTitle" style="font-size:16px; font-weight:600; letter-spacing:1px;">C-RET <span style="font-weight:300;opacity:0.6;">HUD</span></div>
      <button id="settingsBtn" style="border:none; background:rgba(255,255,255,0.1); border-radius:50%; width:28px; height:28px; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">⚙</button>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
      <div style="background:rgba(0,0,0,0.2); border-radius:12px; padding:10px; border:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Status</div>
        <div id="lt" style="font-size:12px; color:#e2e8f0; word-break:break-all; font-weight:500;">-</div>
      </div>
      <div style="background:rgba(0,0,0,0.2); border-radius:12px; padding:10px; border:1px solid rgba(255,255,255,0.05);">
        <div style="font-size:10px; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Off-Task</div>
        <div id="off" style="font-size:18px; color:#4ade80; font-weight:600; text-shadow:0 0 10px rgba(74, 222, 128, 0.4);">30:00</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
      <div style="background:linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1)); border-radius:12px; padding:12px 10px; text-align:center; border:1px solid rgba(239,68,68,0.2);">
        <div style="font-size:10px; color:#fca5a5; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Issues</div>
        <div id="pb" style="font-size:22px; color:#f87171; font-weight:600;">0</div>
      </div>
      <div style="background:linear-gradient(135deg, rgba(6,182,212,0.2), rgba(56,189,248,0.1)); border-radius:12px; padding:12px 10px; text-align:center; border:1px solid rgba(6,182,212,0.2);">
        <div style="font-size:10px; color:#7dd3fc; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px;">Remaining</div>
        <div id="left" style="font-size:22px; color:#38bdf8; font-weight:600;">0</div>
      </div>
    </div>
    <div id="hours" style="width:100%; box-sizing:border-box;"></div>
  </div>
  <div id="settingsView" style="display:none; width:100%; box-sizing:border-box;">
    <div style="display:flex; align-items:center; margin-bottom:15px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
      <button id="backBtn" style="border:none; background:rgba(255,255,255,0.1); border-radius:50%; width:28px; height:28px; color:#fff; cursor:pointer; margin-right:10px; display:flex; align-items:center; justify-content:center;">‹</button>
      <div style="font-size:14px; font-weight:600; letter-spacing:1px;">Preferences</div>
    </div>
    <div style="background:rgba(0,0,0,0.2); border-radius:12px; padding:12px; margin-bottom:10px; border:1px solid rgba(255,255,255,0.05);">
      <div style="display:grid; grid-template-columns:100px 1fr; gap:10px; align-items:center; font-size:11px; color:#cbd5e1;">
        <label>Break Filter</label>
        <select id="breakSel" style="background:rgba(255,255,255,0.1); color:#fff; border:none; border-radius:6px; padding:4px; outline:none;">
          <option value="0" ${selectedBreak === 0 ? 'selected' : ''}>Disabled</option>
          <option value="1" ${selectedBreak === 1 ? 'selected' : ''}>Slot 1</option>
          <option value="2" ${selectedBreak === 2 ? 'selected' : ''}>Slot 2</option>
          <option value="3" ${selectedBreak === 3 ? 'selected' : ''}>Slot 3</option>
          <option value="4" ${selectedBreak === 4 ? 'selected' : ''}>Slot 4</option>
        </select>
        <label>Anchor Pos</label>
        <select id="pos" style="background:rgba(255,255,255,0.1); color:#fff; border:none; border-radius:6px; padding:4px; outline:none;">
          <option value="bl" ${miniPos === 'bl' ? 'selected' : ''}>Bottom-Left</option>
          <option value="br" ${miniPos === 'br' ? 'selected' : ''}>Bottom-Right</option>
          <option value="tl" ${miniPos === 'tl' ? 'selected' : ''}>Top-Left</option>
          <option value="tr" ${miniPos === 'tr' ? 'selected' : ''}>Top-Right</option>
        </select>
        <label>Theme Color</label>
        <input type="color" id="c" value="${manualColor}" style="width:100%; height:24px; border:none; border-radius:4px; padding:0; background:transparent;">
        <label>HUD Size</label>
        <input type="range" id="s" min="10" max="30" value="${miniSize}" style="width:100%; accent-color:#06b6d4;">
        <label>Visibility</label>
        <input type="range" id="o" min="0" max="100" value="${miniOpacity}" style="width:100%; accent-color:#06b6d4;">
        <label>Target / Hr</label>
        <input type="text" inputmode="numeric" id="target" value="${targetPerHour}" style="background:rgba(255,255,255,0.1); color:#fff; border:none; border-radius:6px; padding:4px 8px; text-align:center; outline:none;">
      </div>
    </div>
    <div style="background:rgba(0,0,0,0.2); border-radius:12px; padding:12px; margin-bottom:15px; border:1px solid rgba(255,255,255,0.05);">
      <label style="display:flex; justify-content:space-between; cursor:pointer; margin-bottom:10px; font-size:12px;">Bypass NLP <input id="ignoreNLP" type="checkbox" style="accent-color:#06b6d4;" ${ignoreNLP ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; cursor:pointer; margin-bottom:10px; font-size:12px;">Display % Rate <input id="ratePercent" type="checkbox" style="accent-color:#06b6d4;" ${showRatePercent ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; cursor:pointer; margin-bottom:10px; font-size:12px;">Count Down <input id="leftMode" type="checkbox" style="accent-color:#06b6d4;" ${showLeftInsteadTotal ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; cursor:pointer; font-size:12px;">Smart Color <input id="autoColor" type="checkbox" style="accent-color:#06b6d4;" ${autoStatusColor ? 'checked' : ''}></label>
    </div>
    <button id="resetOff" style="width:100%; background:rgba(250, 204, 21, 0.2); color:#fde047; border:1px solid rgba(250, 204, 21, 0.3); border-radius:8px; cursor:pointer; padding:10px; font-weight:600; text-transform:uppercase; letter-spacing:1px; transition:background 0.2s;">Reset Timer</button>
  </div>`;

  document.body.appendChild(panel);
  const mainView = panel.querySelector('#mainView'), settingsView = panel.querySelector('#settingsView'), tableBox = panel.querySelector('#hours');
  const settingsHost = document.createElement('div'); settingsHost.id = 'settingsOnMain';
  tableBox.replaceWith(settingsHost); while (settingsView.children.length > 1) settingsHost.appendChild(settingsView.children[1]); settingsView.appendChild(tableBox);

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cnt(txt, what) { return (txt.match(new RegExp(esc(what), 'gi')) || []).length; }
  function fmt(ms) { if (ms < 0) ms = 0; let s = Math.floor(ms / 1000); const m = Math.floor(s / 60); s %= 60; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
  function timeNow() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function minOf(h) { const a = h.split(':'); return +a[0] * 60 + +a[1]; }
  function getSlot() {
    const d = new Date(); let mins = d.getHours() * 60 + d.getMinutes(); let slots = hours.map(minOf);
    if (night && mins < 360) mins += 1440;
    if (night) slots = slots.map((x) => x < 360 ? x + 1440 : x);
    for (let i = 0; i < slots.length; i++) { if (mins <= slots[i]) return hours[i]; } return hours[hours.length - 1];
  }
  function hourlyTotal() { return hours.reduce((s, h) => s + (parseInt(hourCounts[h]) || 0), 0); }
  function recalcTotal() { total = hourlyTotal() + (parseInt(beforeBreak) || 0); }
  function currentRate() { const h = getActiveHours(); return h > 0 ? hourlyTotal() / h : 0; }
  function shiftTarget() { return (targetPerHour * 10) + Math.round(targetPerHour / 2); }
  function markActivity() { lastActivityTime = Date.now(); offLastTick = Date.now(); }
  function miniColor(rate) { if (!autoStatusColor) return manualColor; const pct = targetPerHour > 0 ? rate / targetPerHour : 0; return pct >= 1 ? '#4ade80' : pct >= 0.85 ? '#facc15' : '#f87171'; }
  function miniText() {
    const rate = currentRate(), left = Math.max(0, shiftTarget() - total);
    const main = showLeftInsteadTotal ? String(left) : String(total);
    const r = showRatePercent ? (targetPerHour > 0 ? ((rate / targetPerHour) * 100).toFixed(0) : '0') + '%' : rate.toFixed(1);
    return `${main} <span style="opacity:0.5;font-weight:300;">|</span> ${r}`;
  }
  
  function applyMini() { const rate = currentRate(); box.innerHTML = miniText(); box.style.color = miniColor(rate); box.style.textShadow = '0 0 8px ' + miniColor(rate); }
  
  function addPacks(n) { n = parseInt(n) || 0; if (n <= 0) return; loadState(); const slot = getSlot(); hourCounts[slot] += n; recalcTotal(); lastTrigger = 'Scanned +' + n; markActivity(); saveState(true); render(); }
  function removePack() { loadState(); const slot = getSlot(); if (hourlyTotal() > 0) { hourCounts[slot] = Math.max(0, hourCounts[slot] - 1); recalcTotal(); lastTrigger = 'Reverted -1'; saveState(true); render(); } }
  function addProblem(n) { n = parseInt(n) || 0; if (n <= 0) return; loadState(); problemTotal += n; problemCounts[getSlot()] += n; lastTrigger = 'Problem Logged'; markActivity(); saveState(true); render(); }
  
  function bindCountInputs() {
    panel.querySelectorAll('.hc').forEach((inp) => {
      inp.oninput = (e) => { hourCounts[e.target.getAttribute('data-h')] = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); };
      inp.onblur = (e) => { loadState(); hourCounts[e.target.getAttribute('data-h')] = Math.max(0, parseInt(e.target.value) || 0); lastTrigger = 'Manual Edit'; saveState(true); renderHours(true); render(); };
    });
    const bb = panel.querySelector('#beforeBreak');
    if (bb) {
      bb.oninput = (e) => { beforeBreak = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); };
      bb.onblur = (e) => { loadState(); beforeBreak = Math.max(0, parseInt(e.target.value) || 0); lastTrigger = 'Manual Edit'; saveState(true); renderHours(true); render(); };
    }
  }
  function renderHours(force) {
    const active = document.activeElement; if (!force && active && panel.contains(active) && (active.classList.contains('hc') || active.id === 'beforeBreak')) return;
    const visibleHours = night ? nightHours : dayHours;
    const max = Math.max(targetPerHour, beforeBreak, ...visibleHours.map((h) => hourCounts[h] || 0), 1);
    let rows = visibleHours.map((h, i) => {
      const isLastSlot = i === visibleHours.length - 1; const slotTarget = isLastSlot ? Math.round(targetPerHour / 2) : targetPerHour;
      const cumTarget = (i * targetPerHour) + slotTarget; const val = hourCounts[h] || 0, bars = Math.min(100, Math.round((val / max) * 100)), good = val >= slotTarget;
      return `<div style="display:flex; align-items:center; margin-bottom:8px; font-size:12px; background:rgba(0,0,0,0.15); border-radius:8px; padding:4px 8px; border:1px solid rgba(255,255,255,0.03);">
        <div style="width:40px; color:#94a3b8; font-weight:500;">${h}</div>
        <input class="hc" data-h="${h}" type="text" inputmode="numeric" value="${val}" style="width:30px; background:rgba(255,255,255,0.1); border:none; border-radius:4px; color:#fff; text-align:center; outline:none; padding:2px; font-weight:600; margin:0 8px;">
        <div style="width:30px; color:#64748b; font-size:10px;">/${cumTarget}</div>
        <div style="flex-grow:1; height:4px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; margin-left:5px;">
          <div style="height:100%; width:${bars}%; background:${good ? '#4ade80' : '#06b6d4'}; box-shadow:0 0 10px ${good ? '#4ade80' : '#06b6d4'}; transition:width 0.5s ease-out;"></div>
        </div>
      </div>`;
    }).join('');
    rows += `<div style="display:flex; align-items:center; margin-top:12px; font-size:11px; background:rgba(0,0,0,0.15); border-radius:8px; padding:4px 8px; border:1px solid rgba(255,255,255,0.03);">
      <div style="width:40px; color:#64748b;">Pre-Brk</div>
      <input id="beforeBreak" type="text" inputmode="numeric" value="${beforeBreak}" style="width:30px; background:rgba(255,255,255,0.05); border:none; border-radius:4px; color:#cbd5e1; text-align:center; outline:none; padding:2px; margin:0 8px;">
      <div style="width:30px;"></div>
      <div style="flex-grow:1; height:4px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden; margin-left:5px;">
        <div style="height:100%; width:${Math.min(100, Math.round((beforeBreak / max) * 100))}%; background:#64748b;"></div>
      </div>
    </div>`;
    panel.querySelector('#hours').innerHTML = rows; bindCountInputs();
  }
  
  function render() {
    recalcTotal(); const now = Date.now();
    if (now - lastActivityTime > grace) { offRemain -= now - offLastTick; if (offRemain < 0) offRemain = 0; } offLastTick = now;
    let isBreak = isBreakActive();
    panel.querySelector('#lt').textContent = isBreak ? 'Break Sequence...' : lastTrigger; panel.querySelector('#lt').style.color = isBreak ? '#facc15' : '#e2e8f0';
    panel.querySelector('#off').textContent = fmt(offRemain);
    panel.querySelector('#pb').textContent = problemTotal; panel.querySelector('#left').textContent = Math.max(0, shiftTarget() - total);
    applyMini(); renderHours(false); 
  }
  
  function scan() {
    const txt = document.body.innerText || '', m = cnt(txt, triggerText), p = cnt(seen, triggerText), pm = cnt(txt, problemText), pp = cnt(seen, problemText), nlpm = cnt(txt, nlpText), nlpp = cnt(seen, nlpText);
    if (!ignoreNLP && nlpm > nlpp) { skipNextPack = true; lastTrigger = 'NLP Ignored'; markActivity(); saveState(true); render(); }
    if (pm > pp) addProblem(pm - pp);
    else if (m > p) { 
      let diff = m - p; if (skipNextPack) { diff--; skipNextPack = false; lastTrigger = 'Bypass Act'; } 
      if (diff > 0) { if (isBreakActive()) { lastTrigger = 'Break Filtered'; markActivity(); saveState(true); render(); } else { addPacks(diff); } } 
    }
    seen = txt;
  }
  
  function toggleUI() { open = !open; panel.style.transform = open ? 'translateX(0)' : 'translateX(350px)'; panel.style.opacity = open ? '1' : '0'; panel.style.pointerEvents = open ? 'auto' : 'none'; }
  function showSettings(v) { panel.querySelector('#mainView').style.display = v ? 'none' : 'block'; panel.querySelector('#settingsView').style.display = v ? 'block' : 'none'; applyMini(); }

  setInterval(scan, 1000); setInterval(render, 1000); window.addEventListener('beforeunload', () => saveState(true)); box.onclick = toggleUI;
  panel.querySelector('#settingsBtn').onclick = () => showSettings(true); panel.querySelector('#backBtn').onclick = () => showSettings(false);
  panel.querySelector('#ignoreNLP').checked = ignoreNLP; panel.querySelector('#ratePercent').checked = showRatePercent; panel.querySelector('#leftMode').checked = showLeftInsteadTotal; panel.querySelector('#autoColor').checked = autoStatusColor;
  panel.querySelector('#breakSel').onchange = (e) => { selectedBreak = parseInt(e.target.value) || 0; saveState(true); render(); };
  panel.querySelector('#pos').onchange = (e) => { miniPos = e.target.value; applyMiniPos(); saveState(true); };
  panel.querySelector('#ignoreNLP').onchange = (e) => { ignoreNLP = e.target.checked; saveState(true); };
  panel.querySelector('#ratePercent').onchange = (e) => { showRatePercent = e.target.checked; saveState(true); applyMini(); };
  panel.querySelector('#leftMode').onchange = (e) => { showLeftInsteadTotal = e.target.checked; saveState(true); applyMini(); };
  panel.querySelector('#autoColor').onchange = (e) => { autoStatusColor = e.target.checked; saveState(true); applyMini(); };
  panel.querySelector('#resetOff').onclick = () => { offRemain = 30 * 60 * 1000; lastActivityTime = Date.now(); offLastTick = Date.now(); saveState(true); render(); };
  panel.querySelector('#c').oninput = (e) => { manualColor = e.target.value; saveState(true); applyMini(); };
  panel.querySelector('#s').oninput = (e) => { miniSize = parseInt(e.target.value) || 14; box.style.fontSize = miniSize + 'px'; saveState(true); };
  panel.querySelector('#o').oninput = (e) => { miniOpacity = parseInt(e.target.value) || 0; box.style.opacity = miniOpacity / 100; saveState(true); };
  panel.querySelector('#target').oninput = (e) => { targetPerHour = parseInt(e.target.value) || 28; saveState(true); render(); };
  window.addEventListener('storage', (e) => { if (e.key === saveKey) { loadState(); render(); } });
  render(); scan(); renderHours(true); applyMini();
})();

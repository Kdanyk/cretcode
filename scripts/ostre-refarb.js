(() => {
  if (window.scanCounterV29) return;
  window.scanCounterV29 = true;
  document.querySelectorAll('[data-reit-counter]').forEach((el) => el.remove());

  const saveKey = 'scanCounterV29State';
  const technoFont = '"Courier New", Courier, monospace';
  const dayHours = ['7:30', '8:30', '9:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:00'];
  const nightHours = ['19:30', '20:30', '21:30', '22:30', '23:30', '00:30', '1:30', '2:30', '3:30', '4:30', '5:00'];
  const currentHour = new Date().getHours();
  const night = currentHour >= 17 || currentHour < 5;
  const hours = night ? nightHours : dayHours;
  const shiftName = night ? 'night' : 'day';

  let total = 0, problemTotal = 0, seen = '', start = Date.now(), lastTrigger = 'SYS.INIT';
  let targetPerHour = 28, beforeBreak = 0, open = true, grace = 4 * 60 * 1000, selectedBreak = 1;
  let offRemain = 30 * 60 * 1000, lastActivityTime = Date.now(), offLastTick = Date.now();
  let triggerText = 'Wprowadź pojemnik', problemText = 'Zeskanuj - PROBLEM-SOLVE', nlpText = 'Zeskanuj nowy NLP';
  let skipNextPack = false, showRatePercent = false, showLeftInsteadTotal = false, autoStatusColor = false, ignoreNLP = false;
  let manualColor = '#00ff00', miniOpacity = 100, miniSize = 14, miniPos = 'tl', hourCounts = {}, problemCounts = {}, lastSave = 0;

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
      manualColor = s.manualColor || '#00ff00';
      miniPos = s.miniPos || 'tl';
      miniOpacity = Math.min(100, Math.max(0, s.miniOpacity !== undefined ? parseInt(s.miniOpacity) : 100));
      miniSize = Math.min(45, Math.max(10, parseInt(s.miniSize) || 14));
      hourCounts = {}; problemCounts = {};
      hours.forEach((h) => { hourCounts[h] = Math.max(0, parseInt(s.hourCounts && s.hourCounts[h]) || 0); problemCounts[h] = Math.max(0, parseInt(s.problemCounts && s.problemCounts[h]) || 0); });
      lastTrigger = s.lastTrigger || 'RESTORED';
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
  box.style = 'position:fixed;background:#000;color:' + manualColor + ';padding:4px 8px;font-size:' + miniSize + 'px;font-family:' + technoFont + ';z-index:999999;opacity:' + (miniOpacity / 100) + ';cursor:pointer;user-select:none;font-weight:bold;border:1px solid ' + manualColor + ';text-shadow:0 0 5px ' + manualColor + ';text-transform:uppercase;';

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
  panel.style = 'position:fixed;top:58px;bottom:24px;right:20px;background:#050505;color:#00ff00;padding:12px;border:1px solid #00ff00;z-index:999999;font-family:' + technoFont + ';font-size:12px;width:300px;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;transform:translateX(0);opacity:1;pointer-events:auto;transition:none;box-shadow:0 0 15px rgba(0,255,0,0.1);text-transform:uppercase;';

  panel.innerHTML = `
  <div id="mainView" style="width:100%; box-sizing:border-box;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; border-bottom:1px dashed #00ff00; padding-bottom:5px;">
      <div id="mainTitle" style="font-weight:bold; font-size:16px;">>_C-RET.EXE</div>
      <button id="settingsBtn" title="Config" style="border:1px solid #00ff00; background:#000; color:#00ff00; font-family:inherit; cursor:pointer; padding:2px 6px;">[CFG]</button>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
      <div style="border:1px solid #333; padding:5px;">
        <div style="color:#008800; font-size:10px;">LAST_CMD</div>
        <div id="lt" style="color:#00ff00; word-break:break-all;">-</div>
      </div>
      <div style="border:1px solid #333; padding:5px;">
        <div style="color:#008800; font-size:10px;">OFF_TASK</div>
        <div id="off" style="color:#ffff00; font-weight:bold; font-size:16px;">30:00</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:15px;">
      <div style="border:1px solid #ff0000; background:rgba(255,0,0,0.1); padding:5px;">
        <div style="color:#ff0000; font-size:10px;">ERRORS</div>
        <div id="pb" style="color:#ff0000; font-weight:bold; font-size:18px;">0</div>
      </div>
      <div style="border:1px solid #0088ff; background:rgba(0,136,255,0.1); padding:5px;">
        <div style="color:#0088ff; font-size:10px;">REMAINING</div>
        <div id="left" style="color:#0088ff; font-weight:bold; font-size:18px;">0</div>
      </div>
    </div>
    <div id="hours" style="width:100%; box-sizing:border-box;"></div>
  </div>
  <div id="settingsView" style="display:none; width:100%; box-sizing:border-box;">
    <div style="display:flex; align-items:center; margin-bottom:10px; border-bottom:1px dashed #00ff00; padding-bottom:5px;">
      <button id="backBtn" style="border:1px solid #00ff00; background:#000; color:#00ff00; font-family:inherit; cursor:pointer; padding:2px 6px; margin-right:10px;">[ESC]</button>
      <div style="font-weight:bold;">>_SYS_CONFIG</div>
    </div>
    <div style="border:1px solid #333; padding:8px; margin-bottom:10px;">
      <div style="display:grid; grid-template-columns:90px 1fr; gap:6px; align-items:center;">
        <label>BREAK_EXCL</label>
        <select id="breakSel" style="border:1px solid #00ff00; background:#000; color:#00ff00; font-family:inherit; padding:2px;">
          <option value="0" ${selectedBreak === 0 ? 'selected' : ''}>NONE</option>
          <option value="1" ${selectedBreak === 1 ? 'selected' : ''}>BRK 1</option>
          <option value="2" ${selectedBreak === 2 ? 'selected' : ''}>BRK 2</option>
          <option value="3" ${selectedBreak === 3 ? 'selected' : ''}>BRK 3</option>
          <option value="4" ${selectedBreak === 4 ? 'selected' : ''}>BRK 4</option>
        </select>
        <label>HUD_POS</label>
        <select id="pos" style="border:1px solid #00ff00; background:#000; color:#00ff00; font-family:inherit; padding:2px;">
          <option value="bl" ${miniPos === 'bl' ? 'selected' : ''}>BOT-L</option>
          <option value="br" ${miniPos === 'br' ? 'selected' : ''}>BOT-R</option>
          <option value="tl" ${miniPos === 'tl' ? 'selected' : ''}>TOP-L</option>
          <option value="tr" ${miniPos === 'tr' ? 'selected' : ''}>TOP-R</option>
        </select>
        <label>HUD_COLOR</label>
        <input type="color" id="c" value="${manualColor}" style="border:1px solid #00ff00; background:#000; height:20px; width:100%; padding:0;">
        <label>HUD_SIZE</label>
        <input type="range" id="s" min="10" max="30" value="${miniSize}" style="width:100%; accent-color:#00ff00;">
        <label>OPACITY</label>
        <input type="range" id="o" min="0" max="100" value="${miniOpacity}" style="width:100%; accent-color:#00ff00;">
        <label>TGT/HR</label>
        <input type="text" inputmode="numeric" id="target" value="${targetPerHour}" style="border:1px solid #00ff00; background:#000; color:#00ff00; font-family:inherit; text-align:center; padding:2px;">
      </div>
    </div>
    <div style="border:1px solid #333; padding:8px; margin-bottom:10px;">
      <label style="display:flex; justify-content:space-between; cursor:pointer; margin-bottom:4px;">IGN_NLP <input id="ignoreNLP" type="checkbox" style="accent-color:#00ff00;" ${ignoreNLP ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; cursor:pointer; margin-bottom:4px;">RATE_% <input id="ratePercent" type="checkbox" style="accent-color:#00ff00;" ${showRatePercent ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; cursor:pointer; margin-bottom:4px;">LEFT_MODE <input id="leftMode" type="checkbox" style="accent-color:#00ff00;" ${showLeftInsteadTotal ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; cursor:pointer;">AUTO_CLR <input id="autoColor" type="checkbox" style="accent-color:#00ff00;" ${autoStatusColor ? 'checked' : ''}></label>
    </div>
    <button id="resetOff" style="width:100%; border:1px solid #ffff00; background:#000; color:#ffff00; font-family:inherit; cursor:pointer; padding:8px;">[ RESET_OFF_TASK ]</button>
  </div>`;

  document.body.appendChild(panel);
  const mainView = panel.querySelector('#mainView'), settingsView = panel.querySelector('#settingsView'), tableBox = panel.querySelector('#hours');
  const settingsHost = document.createElement('div'); settingsHost.id = 'settingsOnMain';
  tableBox.replaceWith(settingsHost); while (settingsView.children.length > 1) settingsHost.appendChild(settingsView.children[1]); settingsView.appendChild(tableBox);

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cnt(txt, what) { return (txt.match(new RegExp(esc(what), 'gi')) || []).length; }
  function fmt(ms) { if (ms < 0) ms = 0; let s = Math.floor(ms / 1000); const m = Math.floor(s / 60); s %= 60; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
  function timeNow() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
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
  function miniColor(rate) { if (!autoStatusColor) return manualColor; const pct = targetPerHour > 0 ? rate / targetPerHour : 0; return pct >= 1 ? '#00ff00' : pct >= 0.85 ? '#ffff00' : '#ff0000'; }
  function miniText() {
    const rate = currentRate(), left = Math.max(0, shiftTarget() - total);
    const main = showLeftInsteadTotal ? String(left) : String(total);
    const r = showRatePercent ? (targetPerHour > 0 ? ((rate / targetPerHour) * 100).toFixed(0) : '0') + '%' : rate.toFixed(2);
    return `[${main}|${r}]`;
  }
  
  function updateHeader() { const hdr = panel.querySelector('#mainTitle'); if (hdr) hdr.innerHTML = '>_C-RET' + (selectedBreak > 0 ? ` <span style="color:#008800; font-size:10px;">[BRK:${selectedBreak}]</span>` : ''); }
  function applyMini() { const rate = currentRate(); box.innerHTML = miniText(); box.style.color = miniColor(rate); box.style.borderColor = miniColor(rate); box.style.textShadow = '0 0 5px ' + miniColor(rate); }
  
  function addPacks(n) { n = parseInt(n) || 0; if (n <= 0) return; loadState(); const slot = getSlot(); hourCounts[slot] += n; recalcTotal(); lastTrigger = 'SYS.ADD +' + n; markActivity(); saveState(true); render(); }
  function removePack() { loadState(); const slot = getSlot(); if (hourlyTotal() > 0) { hourCounts[slot] = Math.max(0, hourCounts[slot] - 1); recalcTotal(); lastTrigger = 'SYS.SUB -1'; saveState(true); render(); } }
  function addProblem(n) { n = parseInt(n) || 0; if (n <= 0) return; loadState(); problemTotal += n; problemCounts[getSlot()] += n; lastTrigger = 'ERR.DETECTED'; markActivity(); saveState(true); render(); }
  
  function bindCountInputs() {
    panel.querySelectorAll('.hc').forEach((inp) => {
      inp.oninput = (e) => { hourCounts[e.target.getAttribute('data-h')] = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); };
      inp.onblur = (e) => { loadState(); hourCounts[e.target.getAttribute('data-h')] = Math.max(0, parseInt(e.target.value) || 0); lastTrigger = 'USR.EDIT'; saveState(true); renderHours(true); render(); };
    });
    const bb = panel.querySelector('#beforeBreak');
    if (bb) {
      bb.oninput = (e) => { beforeBreak = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); };
      bb.onblur = (e) => { loadState(); beforeBreak = Math.max(0, parseInt(e.target.value) || 0); lastTrigger = 'USR.EDIT'; saveState(true); renderHours(true); render(); };
    }
  }
  function renderHours(force) {
    const active = document.activeElement; if (!force && active && panel.contains(active) && (active.classList.contains('hc') || active.id === 'beforeBreak')) return;
    const visibleHours = night ? nightHours : dayHours;
    const max = Math.max(targetPerHour, beforeBreak, ...visibleHours.map((h) => hourCounts[h] || 0), 1);
    let rows = visibleHours.map((h, i) => {
      const isLastSlot = i === visibleHours.length - 1; const slotTarget = isLastSlot ? Math.round(targetPerHour / 2) : targetPerHour;
      const cumTarget = (i * targetPerHour) + slotTarget; const val = hourCounts[h] || 0, bars = Math.min(100, Math.round((val / max) * 100)), good = val >= slotTarget;
      return `<div style="display:flex; align-items:center; margin-bottom:4px; font-size:12px;">
        <div style="width:45px; color:#00aa00;">${h}</div>
        <div style="color:#00ff00; margin:0 4px;">[</div>
        <input class="hc" data-h="${h}" type="text" inputmode="numeric" value="${val}" style="width:25px; background:transparent; border:none; color:${good?'#00ff00':'#ffff00'}; text-align:center; font-family:inherit; outline:none; padding:0;">
        <div style="color:#00ff00; margin:0 4px;">]</div>
        <div style="width:35px; color:#005500; text-align:right; font-size:10px; margin-right:6px;">/${cumTarget}</div>
        <div style="flex-grow:1; height:6px; border:1px solid #333; position:relative;">
          <div style="height:100%; width:${bars}%; background:${good ? '#00ff00' : '#ffff00'}; opacity:0.8;"></div>
        </div>
      </div>`;
    }).join('');
    rows += `<div style="display:flex; align-items:center; margin-top:10px; border-top:1px dashed #333; padding-top:6px; font-size:12px;">
      <div style="width:45px; color:#00aa00;">PRE_B</div>
      <div style="color:#00ff00; margin:0 4px;">[</div>
      <input id="beforeBreak" type="text" inputmode="numeric" value="${beforeBreak}" style="width:25px; background:transparent; border:none; color:#00ff00; text-align:center; font-family:inherit; outline:none; padding:0;">
      <div style="color:#00ff00; margin:0 4px;">]</div>
      <div style="width:35px;"></div>
      <div style="flex-grow:1; height:6px; border:1px solid #333;">
        <div style="height:100%; width:${Math.min(100, Math.round((beforeBreak / max) * 100))}%; background:#005500;"></div>
      </div>
    </div>`;
    panel.querySelector('#hours').innerHTML = rows; bindCountInputs();
  }
  
  function render() {
    recalcTotal(); const now = Date.now();
    if (now - lastActivityTime > grace) { offRemain -= now - offLastTick; if (offRemain < 0) offRemain = 0; } offLastTick = now;
    let isBreak = isBreakActive();
    panel.querySelector('#lt').textContent = isBreak ? 'SYS.SLEEP' : lastTrigger; panel.querySelector('#lt').style.color = isBreak ? '#ffff00' : '#00ff00';
    panel.querySelector('#off').textContent = fmt(offRemain);
    panel.querySelector('#pb').textContent = problemTotal; panel.querySelector('#left').textContent = Math.max(0, shiftTarget() - total);
    updateHeader(); applyMini(); renderHours(false); 
  }
  
  function scan() {
    const txt = document.body.innerText || '', m = cnt(txt, triggerText), p = cnt(seen, triggerText), pm = cnt(txt, problemText), pp = cnt(seen, problemText), nlpm = cnt(txt, nlpText), nlpp = cnt(seen, nlpText);
    if (!ignoreNLP && nlpm > nlpp) { skipNextPack = true; lastTrigger = 'NLP_BYPASS'; markActivity(); saveState(true); render(); }
    if (pm > pp) addProblem(pm - pp);
    else if (m > p) { 
      let diff = m - p; if (skipNextPack) { diff--; skipNextPack = false; lastTrigger = 'BYPASS_EXEC'; } 
      if (diff > 0) { if (isBreakActive()) { lastTrigger = 'IGN_BRK_' + diff; markActivity(); saveState(true); render(); } else { addPacks(diff); } } 
    }
    seen = txt;
  }
  
  function toggleUI() { open = !open; panel.style.transform = open ? 'translateX(0)' : 'translateX(320px)'; panel.style.opacity = open ? '1' : '0'; panel.style.pointerEvents = open ? 'auto' : 'none'; }
  function showSettings(v) { panel.querySelector('#mainView').style.display = v ? 'none' : 'block'; panel.querySelector('#settingsView').style.display = v ? 'block' : 'none'; applyMini(); }

  setInterval(scan, 1000); setInterval(render, 1000); window.addEventListener('beforeunload', () => saveState(true)); box.onclick = toggleUI;
  panel.querySelector('#settingsBtn').onclick = () => showSettings(true); panel.querySelector('#backBtn').onclick = () => showSettings(false);
  panel.querySelector('#ignoreNLP').checked = ignoreNLP; panel.querySelector('#ratePercent').checked = showRatePercent; panel.querySelector('#leftMode').checked = showLeftInsteadTotal; panel.querySelector('#autoColor').checked = autoStatusColor;
  panel.querySelector('#breakSel').onchange = (e) => { selectedBreak = parseInt(e.target.value) || 0; saveState(true); updateHeader(); render(); };
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
  render(); scan(); renderHours(true); applyMini(); updateHeader();
})();

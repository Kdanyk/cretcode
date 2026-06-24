(() => {
  if (window.scanCounterV29) return;
  window.scanCounterV29 = true;
  document.querySelectorAll('[data-reit-counter]').forEach((el) => el.remove());

  const saveKey = 'scanCounterV29State';
  const technoFont = 'Consolas,"Lucida Console","Courier New",monospace';
  const dayHours = ['7:30', '8:30', '9:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:00'];
  const nightHours = ['19:30', '20:30', '21:30', '22:30', '23:30', '00:30', '1:30', '2:30', '3:30', '4:30', '5:00'];
  const currentHour = new Date().getHours();
  const night = currentHour >= 17 || currentHour < 5;
  const hours = night ? nightHours : dayHours;
  const shiftName = night ? 'night' : 'day';

  let total = 0, problemTotal = 0, seen = '', start = Date.now(), lastTrigger = '-';
  let targetPerHour = 28, beforeBreak = 0, open = true, grace = 4 * 60 * 1000, selectedBreak = 1;
  let offRemain = 30 * 60 * 1000, lastActivityTime = Date.now(), offLastTick = Date.now();
  let triggerText = 'Wprowadź pojemnik', problemText = 'Zeskanuj - PROBLEM-SOLVE', nlpText = 'Zeskanuj nowy NLP';
  let skipNextPack = false, showRatePercent = false, showLeftInsteadTotal = false, autoStatusColor = false, ignoreNLP = false;
  let manualColor = '#808080', miniOpacity = 100, miniSize = 12, miniPos = 'tl', hourCounts = {}, problemCounts = {}, lastSave = 0;

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
      manualColor = s.manualColor || '#808080';
      miniPos = s.miniPos || 'tl';
      miniOpacity = Math.min(100, Math.max(0, s.miniOpacity !== undefined ? parseInt(s.miniOpacity) : 100));
      miniSize = Math.min(45, Math.max(10, parseInt(s.miniSize) || 12));
      hourCounts = {}; problemCounts = {};
      hours.forEach((h) => {
        hourCounts[h] = Math.max(0, parseInt(s.hourCounts && s.hourCounts[h]) || 0);
        problemCounts[h] = Math.max(0, parseInt(s.problemCounts && s.problemCounts[h]) || 0);
      });
      lastTrigger = s.lastTrigger || 'PRZYWRÓCONO';
    } catch (_) { initCounts(); }
  }

  function saveState(force) {
    const now = Date.now();
    if (!force && now - lastSave < 1500) return;
    lastSave = now;
    try { localStorage.setItem(saveKey, JSON.stringify({ shift: shiftName, savedAt: now, start, problemTotal, beforeBreak, targetPerHour, selectedBreak, offRemain, showRatePercent, showLeftInsteadTotal, autoStatusColor, ignoreNLP, manualColor, miniOpacity, miniSize, miniPos, hourCounts, problemCounts, lastTrigger })); } catch (_) {}
  }

  loadState(); initCounts();

  function getBreakTimestamps() {
    if (selectedBreak === 0) return {start: 0, end: 0};
    const times = night ? [{h:23,m:20}, {h:23,m:50}, {h:0,m:20}, {h:0,m:50}] : [{h:11,m:20}, {h:11,m:50}, {h:12,m:20}, {h:12,m:50}];
    const t = times[selectedBreak - 1];
    let d = new Date(); d.setHours(t.h, t.m, 0, 0);
    if (night) {
      let ch = new Date().getHours();
      if (ch >= 17 && t.h < 12) d.setDate(d.getDate() + 1);
      if (ch < 12 && t.h >= 17) d.setDate(d.getDate() - 1);
    }
    let startTs = d.getTime();
    return { start: startTs, end: startTs + 30 * 60000 };
  }

  function isBreakActive() {
    if (selectedBreak === 0) return false;
    let bt = getBreakTimestamps();
    let now = Date.now();
    return now >= bt.start && now < bt.end;
  }

  function getActiveHours() {
    let ms = Date.now() - start;
    if (selectedBreak > 0) {
      let bt = getBreakTimestamps();
      let overlap = 0;
      if (start < bt.end && Date.now() > bt.start) {
        let startOverlap = Math.max(start, bt.start);
        let endOverlap = Math.min(Date.now(), bt.end);
        overlap = Math.max(0, endOverlap - startOverlap);
      }
      ms -= overlap;
    }
    return ms > 0 ? ms / 3600000 : 0;
  }

  // CSS Styles
  const styles = document.createElement('style');
  styles.textContent = `
    .reit-mini {
      position: fixed;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: #e2e8f0;
      padding: 6px 14px;
      font-family: ${technoFont};
      z-index: 999999;
      border-radius: 50px;
      cursor: pointer;
      user-select: none;
      font-weight: 800;
      letter-spacing: 0.3px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .reit-mini:hover {
      background: rgba(15, 23, 42, 0.95);
      border-color: rgba(148, 163, 184, 0.4);
      transform: translateY(-2px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
    }
    .reit-mini-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 10px rgba(34, 197, 94, 0.6);
    }
    .reit-panel {
      position: fixed;
      top: 50%;
      right: 30px;
      transform: translateY(-50%);
      background: linear-gradient(145deg, #0f172a 0%, #1e293b 100%);
      color: #e2e8f0;
      padding: 24px;
      border-radius: 24px;
      z-index: 999999;
      font-family: ${technoFont};
      width: 380px;
      max-height: 85vh;
      overflow-y: auto;
      overflow-x: hidden;
      box-sizing: border-box;
      backdrop-filter: blur(30px);
      -webkit-backdrop-filter: blur(30px);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(148, 163, 184, 0.1);
      scrollbar-width: thin;
      scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(148, 163, 184, 0.15);
    }
    .reit-panel.hidden {
      transform: translate(420px, -50%);
      opacity: 0;
      pointer-events: none;
    }
    .reit-panel::-webkit-scrollbar { width: 6px; }
    .reit-panel::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.3); border-radius: 10px; }
    .reit-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }
    .reit-logo {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 2px;
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .reit-btn-icon {
      width: 36px;
      height: 36px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      color: #e2e8f0;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      backdrop-filter: blur(10px);
    }
    .reit-btn-icon:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(148, 163, 184, 0.4);
      transform: scale(1.05);
    }
    .reit-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(148, 163, 184, 0.08);
      border-radius: 16px;
      padding: 14px;
      backdrop-filter: blur(10px);
    }
    .reit-stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
    }
    .reit-stat-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.1);
      border-radius: 14px;
      padding: 14px;
      backdrop-filter: blur(10px);
      transition: all 0.3s;
    }
    .reit-stat-box:hover {
      border-color: rgba(148, 163, 184, 0.25);
      transform: translateY(-2px);
    }
    .reit-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 6px;
      font-weight: 700;
    }
    .reit-value {
      font-size: 13px;
      font-weight: 700;
      color: #f1f5f9;
      word-break: break-all;
    }
    .reit-big-value {
      font-size: 26px;
      font-weight: 900;
    }
    .reit-problem-card {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.05) 100%);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      padding: 16px;
      border-radius: 14px;
      text-align: center;
      font-weight: 900;
      backdrop-filter: blur(10px);
    }
    .reit-left-card {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.05) 100%);
      border: 1px solid rgba(59, 130, 246, 0.2);
      color: #93c5fd;
      padding: 16px;
      border-radius: 14px;
      text-align: center;
      font-weight: 900;
      backdrop-filter: blur(10px);
    }
    .reit-hour-row {
      display: grid;
      grid-template-columns: 45px 50px 35px 1fr;
      gap: 8px;
      align-items: center;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(148, 163, 184, 0.06);
      border-radius: 10px;
      padding: 8px 12px;
      margin-bottom: 6px;
      border-left: 4px solid #334155;
      transition: all 0.2s;
    }
    .reit-hour-row:hover {
      background: rgba(255, 255, 255, 0.05);
      border-left-color: #475569;
    }
    .reit-hour-row.good {
      border-left-color: #22c55e !important;
    }
    .reit-input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.8);
      color: #e2e8f0;
      text-align: center;
      font-family: ${technoFont};
      font-weight: 900;
      outline: none;
      font-size: 13px;
      box-sizing: border-box;
      transition: all 0.2s;
    }
    .reit-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }
    .reit-settings-input, .reit-settings-select {
      width: 100%;
      height: 34px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 10px;
      cursor: pointer;
      background: rgba(15, 23, 42, 0.8);
      color: #e2e8f0;
      font-family: ${technoFont};
      font-weight: 700;
      box-sizing: border-box;
      padding: 0 10px;
      outline: none;
      transition: all 0.2s;
    }
    .reit-settings-input:focus, .reit-settings-select:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }
    .reit-settings-select option {
      background: #1e293b;
      color: #e2e8f0;
    }
    .reit-range {
      width: 100%;
      accent-color: #3b82f6;
      box-sizing: border-box;
    }
    .reit-btn {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 12px;
      font-family: ${technoFont};
      font-size: 13px;
      font-weight: 900;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: all 0.3s;
      box-sizing: border-box;
    }
    .reit-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0,0,0,0.3);
    }
    .reit-btn-reset {
      background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
      color: #1e293b;
    }
    .reit-toggle-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #cbd5e1;
      cursor: pointer;
    }
    .reit-toggle-checkbox {
      width: 44px;
      height: 24px;
      background: rgba(148, 163, 184, 0.2);
      border-radius: 12px;
      position: relative;
      cursor: pointer;
      transition: background 0.3s;
      border: none;
      appearance: none;
      -webkit-appearance: none;
      outline: none;
    }
    .reit-toggle-checkbox::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: #e2e8f0;
      border-radius: 50%;
      transition: all 0.3s;
    }
    .reit-toggle-checkbox:checked {
      background: #3b82f6;
    }
    .reit-toggle-checkbox:checked::after {
      left: 22px;
      background: white;
    }
    .reit-preview {
      font-size: 18px;
      font-weight: 900;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.15);
      border-radius: 12px;
      padding: 12px;
      text-align: center;
      color: #e2e8f0;
      width: 100%;
      box-sizing: border-box;
    }
    .reit-progress-bar {
      height: 6px;
      background: rgba(148, 163, 184, 0.15);
      border-radius: 999px;
      overflow: hidden;
      width: 100%;
    }
    .reit-progress-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 0.4s ease;
    }
    .reit-progress-fill.blue { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
    .reit-progress-fill.green { background: linear-gradient(90deg, #22c55e, #4ade80); }
    .reit-progress-fill.gray { background: linear-gradient(90deg, #64748b, #94a3b8); }
  `;
  document.head.appendChild(styles);

  const box = document.createElement('div');
  box.setAttribute('data-reit-counter', 'mini');
  box.className = 'reit-mini';
  const dot = document.createElement('div');
  dot.className = 'reit-mini-dot';
  box.appendChild(dot);
  const boxText = document.createElement('span');
  box.appendChild(boxText);

  function applyMiniPos() {
    box.style.top = 'auto'; box.style.bottom = 'auto'; box.style.left = 'auto'; box.style.right = 'auto';
    if (miniPos === 'bl') { box.style.bottom = '40px'; box.style.left = '24px'; }
    if (miniPos === 'br') { box.style.bottom = '40px'; box.style.right = '24px'; }
    if (miniPos === 'tl') { box.style.top = '16px'; box.style.left = '24px'; }
    if (miniPos === 'tr') { box.style.top = '16px'; box.style.right = '24px'; }
  }
  applyMiniPos();
  document.body.appendChild(box);

  const panel = document.createElement('div');
  panel.setAttribute('data-reit-counter', 'panel');
  panel.className = 'reit-panel';
  panel.innerHTML = `
  <div id="mainView" style="width:100%; box-sizing:border-box;">
    <div class="reit-header">
      <div class="reit-logo" id="mainTitle">C-RET</div>
      <button id="settingsBtn" class="reit-btn-icon" title="Ustawienia">⚙️</button>
    </div>
    <div class="reit-stat-grid">
      <div class="reit-stat-box">
        <div class="reit-label">Trigger</div>
        <div id="lt" class="reit-value">-</div>
      </div>
      <div class="reit-stat-box">
        <div class="reit-label">Off Task</div>
        <div id="off" class="reit-big-value" style="color:#4ade80;">30:00</div>
      </div>
    </div>
    <div class="reit-stat-grid" style="margin-bottom:16px;">
      <div class="reit-problem-card">
        <div class="reit-label" style="color:rgba(252,165,165,0.8);">Problem</div>
        <div id="pb" class="reit-big-value" style="color:#fca5a5;">0</div>
      </div>
      <div class="reit-left-card">
        <div class="reit-label" style="color:rgba(147,197,253,0.8);">Pozostało</div>
        <div id="left" class="reit-big-value" style="color:#93c5fd;">0</div>
      </div>
    </div>
    <div id="hours" style="margin-top:8px; padding-bottom:10px; width:100%; box-sizing:border-box;"></div>
  </div>
  <div id="settingsView" style="display:none; width:100%; box-sizing:border-box;">
    <div class="reit-header">
      <button id="backBtn" class="reit-btn-icon" title="Powrót" style="margin-right:10px;">‹</button>
      <div class="reit-logo" style="font-size:18px;">USTAWIENIA</div>
      <div style="width:36px;"></div>
    </div>
    <div class="reit-card" style="margin-bottom:12px;">
      <div style="display:grid; grid-template-columns:105px 1fr; gap:10px; align-items:center; font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase;">
        <label>Wyklucz Przerwę</label>
        <select id="breakSel" class="reit-settings-select">
          <option value="0" ${selectedBreak === 0 ? 'selected' : ''}>Brak</option>
          <option value="1" ${selectedBreak === 1 ? 'selected' : ''}>Przerwa 1 (11:20/23:20)</option>
          <option value="2" ${selectedBreak === 2 ? 'selected' : ''}>Przerwa 2 (11:50/23:50)</option>
          <option value="3" ${selectedBreak === 3 ? 'selected' : ''}>Przerwa 3 (12:20/00:20)</option>
          <option value="4" ${selectedBreak === 4 ? 'selected' : ''}>Przerwa 4 (12:50/00:50)</option>
        </select>
        <label>Pozycja mini</label>
        <select id="pos" class="reit-settings-select">
          <option value="bl" ${miniPos === 'bl' ? 'selected' : ''}>Dół - Lewo</option>
          <option value="br" ${miniPos === 'br' ? 'selected' : ''}>Dół - Prawo</option>
          <option value="tl" ${miniPos === 'tl' ? 'selected' : ''}>Góra - Lewo</option>
          <option value="tr" ${miniPos === 'tr' ? 'selected' : ''}>Góra - Prawo</option>
        </select>
        <label>Kolor mini</label>
        <input type="color" id="c" value="${manualColor}" class="reit-settings-input" style="height:34px; padding:2px;">
        <label>Rozmiar mini</label>
        <input type="range" id="s" class="reit-range" min="10" max="45" value="${miniSize}">
        <label>Widoczność</label>
        <input type="range" id="o" class="reit-range" min="0" max="100" value="${miniOpacity}">
        <label>Reit/h cel</label>
        <input type="text" inputmode="numeric" id="target" value="${targetPerHour}" class="reit-settings-input">
      </div>
    </div>
    <div class="reit-card" style="margin-bottom:12px;">
      <label class="reit-toggle-label">Ignoruj NLP <input id="ignoreNLP" type="checkbox" class="reit-toggle-checkbox" ${ignoreNLP ? 'checked' : ''}></label>
      <label class="reit-toggle-label">Tempo % / h <input id="ratePercent" type="checkbox" class="reit-toggle-checkbox" ${showRatePercent ? 'checked' : ''}></label>
      <label class="reit-toggle-label">Pozostało zamiast sumy <input id="leftMode" type="checkbox" class="reit-toggle-checkbox" ${showLeftInsteadTotal ? 'checked' : ''}></label>
      <label class="reit-toggle-label">Auto-kolor tempa <input id="autoColor" type="checkbox" class="reit-toggle-checkbox" ${autoStatusColor ? 'checked' : ''}></label>
    </div>
    <div class="reit-card" style="margin-bottom:16px;">
      <div class="reit-label" style="margin-bottom:10px;">Podgląd mini widgetu</div>
      <div id="miniPreview" class="reit-preview">0 | 0.00/h</div>
    </div>
    <button id="resetOff" class="reit-btn reit-btn-reset">Reset Off Task</button>
  </div>`;

  document.body.appendChild(panel);
  const mainView = panel.querySelector('#mainView');
  const settingsView = panel.querySelector('#settingsView');
  const tableBox = panel.querySelector('#hours');
  const settingsHost = document.createElement('div');
  settingsHost.id = 'settingsOnMain';
  tableBox.replaceWith(settingsHost);
  while (settingsView.children.length > 1) settingsHost.appendChild(settingsView.children[1]);
  settingsView.appendChild(tableBox);

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cnt(txt, what) { return (txt.match(new RegExp(esc(what), 'gi')) || []).length; }
  function fmt(ms) { if (ms < 0) ms = 0; let s = Math.floor(ms / 1000); const m = Math.floor(s / 60); s %= 60; return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0'); }
  function timeNow() { return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function minOf(h) { const a = h.split(':'); return +a[0] * 60 + +a[1]; }
  function getSlot() {
    const d = new Date(); let mins = d.getHours() * 60 + d.getMinutes(); let slots = hours.map(minOf);
    if (night && mins < 360) mins += 1440;
    if (night) slots = slots.map((x) => x < 360 ? x + 1440 : x);
    for (let i = 0; i < slots.length; i++) { if (mins <= slots[i]) return hours[i]; }
    return hours[hours.length - 1];
  }
  function hourlyTotal() { return hours.reduce((s, h) => s + (parseInt(hourCounts[h]) || 0), 0); }
  function recalcTotal() { total = hourlyTotal() + (parseInt(beforeBreak) || 0); }
  function currentRate() { const h = getActiveHours(); return h > 0 ? hourlyTotal() / h : 0; }
  function shiftTarget() { return (targetPerHour * 10) + Math.round(targetPerHour / 2); }
  function markActivity() { lastActivityTime = Date.now(); offLastTick = Date.now(); }
  function miniColor(rate) {
    if (!autoStatusColor) return manualColor;
    const pct = targetPerHour > 0 ? rate / targetPerHour : 0;
    return pct >= 1 ? '#4ade80' : pct >= 0.85 ? '#fbbf24' : '#f87171';
  }
  function miniText() {
    const rate = currentRate(), left = Math.max(0, shiftTarget() - total);
    const main = showLeftInsteadTotal ? String(left) : String(total);
    const r = showRatePercent ? (targetPerHour > 0 ? ((rate / targetPerHour) * 100).toFixed(0) : '0') + '%/h' : rate.toFixed(2) + '/h';
    return main + ' | ' + r;
  }
  
  function updateHeader() {
    const hdr = panel.querySelector('#mainTitle');
    if (hdr) hdr.innerHTML = 'C-RET' + (selectedBreak > 0 ? ' <span style="font-size:11px; color:#64748b; font-weight:700;">(Przerwa: ' + selectedBreak + ')</span>' : '');
  }

  function applyMini() {
    const rate = currentRate();
    boxText.textContent = miniText();
    box.style.color = miniColor(rate);
    dot.style.background = miniColor(rate);
    dot.style.boxShadow = `0 0 12px ${miniColor(rate)}`;
    const p = panel.querySelector('#miniPreview');
    if (p) { p.textContent = miniText(); p.style.color = miniColor(rate); }
  }
  
  function addPacks(n) { 
    n = parseInt(n) || 0; if (n <= 0) return; 
    loadState();
    const slot = getSlot(); hourCounts[slot] += n; 
    recalcTotal(); lastTrigger = 'RĘCZNIE +' + n + ' ' + timeNow(); 
    markActivity(); saveState(true); render(); 
  }
  function removePack() { 
    loadState();
    const slot = getSlot(); 
    if (hourlyTotal() > 0) { 
        hourCounts[slot] = Math.max(0, hourCounts[slot] - 1); 
        recalcTotal(); lastTrigger = 'RĘCZNIE -1 ' + timeNow(); 
        saveState(true); render(); 
    } 
  }
  function addProblem(n) { 
    n = parseInt(n) || 0; if (n <= 0) return; 
    loadState();
    problemTotal += n; problemCounts[getSlot()] += n; 
    lastTrigger = 'PROBLEM ' + timeNow(); markActivity(); saveState(true); render(); 
  }
  
  function bindCountInputs() {
    panel.querySelectorAll('.hc').forEach((inp) => {
      inp.oninput = (e) => { hourCounts[e.target.getAttribute('data-h')] = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); updateTop(); };
      inp.onblur = (e) => { 
          let newVal = Math.max(0, parseInt(e.target.value) || 0);
          loadState();
          hourCounts[e.target.getAttribute('data-h')] = newVal;
          lastTrigger = 'RĘCZNIE ' + timeNow(); saveState(true); renderHours(true); render(); 
      };
    });
    const bb = panel.querySelector('#beforeBreak');
    if (bb) {
      bb.oninput = (e) => { beforeBreak = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); updateTop(); };
      bb.onblur = (e) => { 
          let newVal = Math.max(0, parseInt(e.target.value) || 0);
          loadState();
          beforeBreak = newVal;
          lastTrigger = 'RĘCZNIE ' + timeNow(); saveState(true); renderHours(true); render(); 
      };
    }
  }
  function renderHours(force) {
    const active = document.activeElement;
    if (!force && active && panel.contains(active) && (active.classList.contains('hc') || active.id === 'beforeBreak')) return;
    const visibleHours = night ? nightHours : dayHours;
    const max = Math.max(targetPerHour, beforeBreak, ...visibleHours.map((h) => hourCounts[h] || 0), 1);
    let rows = visibleHours.map((h, i) => {
      const isLastSlot = i === visibleHours.length - 1;
      const slotTarget = isLastSlot ? Math.round(targetPerHour / 2) : targetPerHour;
      const cumTarget = (i * targetPerHour) + slotTarget;
      const val = hourCounts[h] || 0, bars = Math.min(100, Math.round((val / max) * 100)), good = val >= slotTarget;
      return `<div class="reit-hour-row ${good ? 'good' : ''}">
        <b style="font-size:12px; text-align:left; color:#94a3b8;">${h}</b>
        <input class="hc" data-h="${h}" type="text" inputmode="numeric" value="${val}" class="reit-input" style="width:100%;">
        <div style="font-size:10px; color:#64748b; font-weight:900; text-align:left;">/${cumTarget}</div>
        <div class="reit-progress-bar">
          <div class="reit-progress-fill ${good ? 'green' : 'blue'}" style="width:${bars}%;"></div>
        </div>
      </

javascript:(function() {
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
  let targetPerHour = 44, beforeBreak = 0, open = true, grace = 4 * 60 * 1000;
  let offRemain = 30 * 60 * 1000, lastActivityTime = Date.now(), offLastTick = Date.now();
  
  // ОСНОВНІ ЗМІНИ ТУТ: новий тригер та прапорець для проблеми
  let triggerText = 'Produkt jest kompletny', problemText = 'Zeskanuj - PROBLEM-SOLVE', nlpText = 'Zeskanuj nowy NLP';
  let skipNextPack = false, isProblemNext = false, showRatePercent = false, showLeftInsteadTotal = false, autoStatusColor = false;
  let manualColor = '#808080', miniOpacity = 100, miniSize = 12, miniPos = 'tl', hourCounts = {}, problemCounts = {}, lastSave = 0;

  function initCounts() { hours.forEach((h) => { if (hourCounts[h] == null) hourCounts[h] = 0; if (problemCounts[h] == null) problemCounts[h] = 0; }); }

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(saveKey) || '{}');
      if (s.shift && s.shift !== shiftName) { initCounts(); return; }
      start = Number(s.start) || Date.now();
      problemTotal = Math.max(0, parseInt(s.problemTotal) || 0);
      beforeBreak = Math.max(0, parseInt(s.beforeBreak) || 0);
      targetPerHour = Math.max(1, parseInt(s.targetPerHour) || 44);
      offRemain = Math.max(0, Number(s.offRemain) || 30 * 60 * 1000);
      showRatePercent = !!s.showRatePercent;
      showLeftInsteadTotal = !!s.showLeftInsteadTotal;
      autoStatusColor = !!s.autoStatusColor;
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
    try { localStorage.setItem(saveKey, JSON.stringify({ shift: shiftName, savedAt: now, start, problemTotal, beforeBreak, targetPerHour, offRemain, showRatePercent, showLeftInsteadTotal, autoStatusColor, manualColor, miniOpacity, miniSize, miniPos, hourCounts, problemCounts, lastTrigger })); } catch (_) {}
  }

  loadState(); initCounts();

  const box = document.createElement('div');
  box.setAttribute('data-reit-counter', 'mini');
  box.style = 'position:fixed;background:transparent;color:' + manualColor + ';padding:4px 8px;font-size:' + miniSize + 'px;font-family:' + technoFont + ';z-index:999999;border-radius:12px;opacity:' + (miniOpacity / 100) + ';cursor:pointer;user-select:none;font-weight:900;letter-spacing:0;';

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
  panel.style = 'position:fixed;top:58px;bottom:24px;right:20px;background:rgba(248, 250, 252, 0.95);color:#1e293b;padding:16px;border-radius:16px;z-index:999999;font-family:' + technoFont + ';width:350px;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;backdrop-filter:blur(12px);box-shadow:0 10px 30px -5px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);scrollbar-width:thin;transform:translateX(0);opacity:1;pointer-events:auto;transition:transform .35s cubic-bezier(0.4, 0, 0.2, 1),opacity .35s ease';

  panel.innerHTML = `
  <div id="mainView" style="width:100%; box-sizing:border-box;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(0,0,0,0.06); padding-bottom:10px;">
      <div style="font-size:18px; font-weight:900; color:#0f172a; letter-spacing:0.5px; text-transform:uppercase;">C-RET</div>
      <button id="settingsBtn" title="Ustawienia" style="width:30px; height:30px; border:none; border-radius:8px; background:rgba(0,0,0,0.05); color:#0f172a; font-size:16px; cursor:pointer; transition:background 0.2s;">⚙️</button>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; width:100%; box-sizing:border-box;">
      <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:10px;">
        <div style="font-size:10px; color:#64748b; text-transform:uppercase; margin-bottom:4px; font-weight:700;">Trigger</div>
        <div id="lt" style="font-size:12px; font-weight:700; color:#1e293b; word-break:break-all; line-height:1.2;">-</div>
      </div>
      <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:10px;">
        <div style="font-size:10px; color:#64748b; text-transform:uppercase; margin-bottom:4px; font-weight:700;">Off Task</div>
        <div id="off" style="font-size:18px; font-weight:900; color:#16a34a;">30:00</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px; width:100%; box-sizing:border-box;">
      <div style="background:linear-gradient(135deg, #ef4444, #dc2626); color:white; padding:12px 8px; border-radius:10px; text-align:center; text-transform:uppercase;">
        <div style="font-size:10px; font-weight:900; opacity:0.9; margin-bottom:2px;">Problem</div>
        <div id="pb" style="font-size:22px; font-weight:900;">0</div>
      </div>
      <div style="background:linear-gradient(135deg, #3b82f6, #2563eb); color:white; padding:12px 8px; border-radius:10px; text-align:center; text-transform:uppercase;">
        <div style="font-size:10px; font-weight:900; opacity:0.9; margin-bottom:2px;">Pozostało</div>
        <div id="left" style="font-size:22px; font-weight:900;">0</div>
      </div>
    </div>
    <div id="hours" style="margin-top:8px; padding-bottom:10px; width:100%; box-sizing:border-box;"></div>
  </div>
  <div id="settingsView" style="display:none; width:100%; box-sizing:border-box;">
    <div style="display:flex; align-items:center; margin-bottom:12px; border-bottom:1px solid rgba(0,0,0,0.06); padding-bottom:10px;">
      <button id="backBtn" title="Powrót" style="width:30px; height:30px; border:none; border-radius:8px; background:rgba(0,0,0,0.05); color:#0f172a; font-size:18px; cursor:pointer; margin-right:10px; display:flex; align-items:center; justify-content:center;">‹</button>
      <div style="font-size:16px; font-weight:900; color:#0f172a; text-transform:uppercase; letter-spacing:0.5px;">Ustawienia</div>
    </div>
    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
      <div style="display:grid; grid-template-columns:105px 1fr; gap:8px; align-items:center; font-size:11px; font-weight:700; color:#475569; text-transform:uppercase; width:100%; box-sizing:border-box;">
        <label>Pozycja mini</label>
        <select id="pos" style="width:100%; height:28px; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; background:#fff; font-family:${technoFont}; font-weight:700; box-sizing:border-box; margin:0;">
          <option value="bl" ${miniPos === 'bl' ? 'selected' : ''}>Dół - Lewo</option>
          <option value="br" ${miniPos === 'br' ? 'selected' : ''}>Dół - Prawo</option>
          <option value="tl" ${miniPos === 'tl' ? 'selected' : ''}>Góra - Lewo</option>
          <option value="tr" ${miniPos === 'tr' ? 'selected' : ''}>Góra - Prawo</option>
        </select>
        <label>Kolor mini</label>
        <input type="color" id="c" value="${manualColor}" style="width:100%; height:28px; border:1px solid #e2e8f0; border-radius:6px; cursor:pointer; background:#fff; padding:0; box-sizing:border-box; margin:0;">
        <label>Rozmiar mini</label>
        <input type="range" id="s" min="10" max="45" value="${miniSize}" style="width:100%; accent-color:#3b82f6; box-sizing:border-box; margin:0;">
        <label>Widoczność</label>
        <input type="range" id="o" min="0" max="100" value="${miniOpacity}" style="width:100%; accent-color:#3b82f6; box-sizing:border-box; margin:0;">
        <label>Reit/h cel</label>
        <input type="text" inputmode="numeric" id="target" value="${targetPerHour}" style="width:100%; padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0; background:#f8fafc; color:#1e293b; font-family:${technoFont}; font-weight:900; box-sizing:border-box; outline:none; margin:0;">
      </div>
    </div>
    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
      <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:11px; font-weight:900; text-transform:uppercase; color:#1e293b; cursor:pointer;">Tempo % / h <input id="ratePercent" type="checkbox" style="width:18px; height:18px; accent-color:#3b82f6; margin:0; cursor:pointer;" ${showRatePercent ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:11px; font-weight:900; text-transform:uppercase; color:#1e293b; cursor:pointer;">Pozostało zamiast sumy <input id="leftMode" type="checkbox" style="width:18px; height:18px; accent-color:#3b82f6; margin:0; cursor:pointer;" ${showLeftInsteadTotal ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:900; text-transform:uppercase; color:#1e293b; cursor:pointer;">Auto-kolor tempa <input id="autoColor" type="checkbox" style="width:18px; height:18px; accent-color:#3b82f6; margin:0; cursor:pointer;" ${autoStatusColor ? 'checked' : ''}></label>
    </div>
    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:12px; margin-bottom:16px; width:100%; box-sizing:border-box;">
      <div style="font-size:10px; font-weight:900; text-transform:uppercase; margin-bottom:8px; color:#64748b;">Podgląd mini widgetu</div>
      <div id="miniPreview" style="font-size:20px; font-weight:900; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; text-align:center; color:#1e293b; width:100%; box-sizing:border-box;">0 | 0.00/h</div>
    </div>
    <button id="resetOff" style="width:100%; padding:10px; border:none; border-radius:8px; background:#facc15; color:#1e293b; font-family:${technoFont}; font-size:13px; font-weight:900; cursor:pointer; text-transform:uppercase; transition:background 0.2s; margin-bottom:14px; box-sizing:border-box;">Reset Off Task</button>
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
  function currentRate() { const h = (Date.now() - start) / 3600000; return h > 0 ? hourlyTotal() / h : 0; }
  function shiftTarget() { return targetPerHour * 10; }
  function markActivity() { lastActivityTime = Date.now(); offLastTick = Date.now(); }
  function miniColor(rate) {
    if (!autoStatusColor) return manualColor;
    const pct = targetPerHour > 0 ? rate / targetPerHour : 0;
    return pct >= 1 ? '#16a34a' : pct >= 0.85 ? '#d97706' : '#dc2626';
  }
  function miniText() {
    const rate = currentRate(), left = Math.max(0, shiftTarget() - total);
    const main = showLeftInsteadTotal ? String(left) : String(total);
    const r = showRatePercent ? (targetPerHour > 0 ? ((rate / targetPerHour) * 100).toFixed(0) : '0') + '%/h' : rate.toFixed(2) +

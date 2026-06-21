(() => {
  if (window.scanCounterCDPL_V29) return;
  window.scanCounterCDPL_V29 = true;
  document.querySelectorAll('[data-reit-counter]').forEach((el) => el.remove());

  const saveKey = 'scanCounterCDPL_V29State';
  const technoFont = 'Consolas,"Lucida Console","Courier New",monospace';
  const dayHours = ['7:30', '8:30', '9:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:00'];
  const nightHours = ['19:30', '20:30', '21:30', '22:30', '23:30', '00:30', '1:30', '2:30', '3:30', '4:30', '5:00'];
  const currentHour = new Date().getHours();
  const night = currentHour >= 17 || currentHour < 5;
  const hours = night ? nightHours : dayHours;
  const shiftName = night ? 'night' : 'day';

  let total = 0, seen = '', start = Date.now(), lastTrigger = '-';
  let targetPerHour = 110, beforeBreak = 0, open = true;
  let triggerText = 'Wprowadź pojemnik', nlpText = 'Zeskanuj nowy NLP';
  let skipNextPack = false, showLeftInsteadTotal = false, autoStatusColor = false;
  let manualColor = '#a0a0a0', miniOpacity = 100, miniSize = 18, miniPos = 'bl', hourCounts = {}, lastSave = 0;

  function initCounts() { hours.forEach((h) => { if (hourCounts[h] == null) hourCounts[h] = 0; }); }

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(saveKey) || '{}');
      if (s.shift !== shiftName) { initCounts(); return; }
      start = Number(s.start) || Date.now();
      beforeBreak = Math.max(0, parseInt(s.beforeBreak) || 0);
      targetPerHour = Math.max(1, parseInt(s.targetPerHour) || 110);
      showLeftInsteadTotal = !!s.showLeftInsteadTotal;
      autoStatusColor = !!s.autoStatusColor;
      manualColor = s.manualColor || '#a0a0a0';
      miniPos = s.miniPos || 'bl';
      miniOpacity = Math.min(100, Math.max(0, s.miniOpacity !== undefined ? parseInt(s.miniOpacity) : 100));
      miniSize = Math.min(45, Math.max(10, parseInt(s.miniSize) || 18));
      hourCounts = {};
      hours.forEach((h) => { hourCounts[h] = Math.max(0, parseInt(s.hourCounts && s.hourCounts[h]) || 0); });
      lastTrigger = s.lastTrigger || 'PRZYWRÓCONO';
    } catch (_) { initCounts(); }
  }

  function saveState(force) {
    const now = Date.now();
    if (!force && now - lastSave < 1500) return;
    lastSave = now;
    try { localStorage.setItem(saveKey, JSON.stringify({ shift: shiftName, savedAt: now, start, beforeBreak, targetPerHour, showLeftInsteadTotal, autoStatusColor, manualColor, miniPos, miniOpacity, miniSize, hourCounts, lastTrigger })); } catch (_) {}
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
      <div style="font-size:18px; font-weight:900; color:#0f172a; letter-spacing:0.5px; text-transform:uppercase;">Clean-Decant PL</div>
      <button id="settingsBtn" title="Ustawienia" style="width:30px; height:30px; border:none; border-radius:8px; background:rgba(0,0,0,0.05); color:#0f172a; font-size:16px; cursor:pointer; transition:background 0.2s;">⚙️</button>
    </div>
    <div style="display:grid; grid-template-columns:1fr; gap:8px; margin-bottom:10px; width:100%; box-sizing:border-box;">
      <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:10px;">
        <div style="font-size:10px; color:#64748b; text-transform:uppercase; margin-bottom:4px; font-weight:700;">Trigger</div>
        <div id="lt" style="font-size:12px; font-weight:700; color:#1e293b; word-break:break-all; line-height:1.2;">-</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr; gap:8px; margin-bottom:12px; width:100%; box-sizing:border-box;">
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
        <label>Widoczність</label>
        <input type="range" id="o" min="0" max="100" value="${miniOpacity}" style="width:100%; accent-color:#3b82f6; box-sizing:border-box; margin:0;">
        <label>Reit/h cel</label>
        <input type="text" inputmode="numeric" id="target" value="${targetPerHour}" style="width:100%; padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0; background:#f8fafc; color:#1e293b; font-family:${technoFont}; font-weight:900; box-sizing:border-box; outline:none; margin:0;">
      </div>
    </div>
    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
      <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:11px; font-weight:900; text-transform:uppercase; color:#1e293b; cursor:pointer;">Tempo % / h <input id="ratePercent" type="checkbox" style="width:18px; height:18px; accent-color:#3b82f6; margin:0; cursor:pointer;" ${showRatePercent ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:11px; font-weight:900; text-transform:uppercase; color:#1e293b; cursor:pointer;">Pozostało замість суми <input id="leftMode" type="checkbox" style="width:18px; height:18px; accent-color:#3b82f6; margin:0; cursor:pointer;" ${showLeftInsteadTotal ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:900; text-transform:uppercase; color:#1e293b; cursor:pointer;">Auto-kolor tempa <input id="autoColor" type="checkbox" style="width:18px; height:18px; accent-color:#3b82f6; margin:0; cursor:pointer;" ${autoStatusColor ? 'checked' : ''}></label>
    </div>
    <div style="background:#ffffff; border:1px solid rgba(0,0,0,0.06); border-radius:10px; padding:12px; margin-bottom:16px; width:100%; box-sizing:border-box;">
      <div style="font-size:10px; font-weight:900; text-transform:uppercase; margin-bottom:8px; color:#64748b;">Podgląd mini widgetu</div>
      <div id="miniPreview" style="font-size:20px; font-weight:900; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; text-align:center; color:#1e293b; width:100%; box-sizing:border-box;">0 | 0.00/h</div>
    </div>
  </div>`;
  
  document.body.appendChild(panel);
  const mainView = panel.querySelector('#mainView'), settingsView = panel.querySelector('#settingsView'), tableBox = panel.querySelector('#hours');
  const settingsHost = document.createElement('div'); settingsHost.id = 'settingsOnMain'; tableBox.replaceWith(settingsHost);
  while (settingsView.children.length > 1) settingsHost.appendChild(settingsView.children[1]); settingsView.appendChild(tableBox);
  
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cnt(txt, what) { return (txt.match(new RegExp(esc(what), 'gi')) || []).length; }
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
  
  function miniColor(rate) {
    if (!autoStatusColor) return manualColor;
    const pct = targetPerHour > 0 ? rate / targetPerHour : 0;
    return pct >= 1 ? '#16a34a' : pct >= 0.85 ? '#d97706' : '#dc2626';
  }
  
  function miniText() {
    const rate = currentRate(), left = Math.max(0, shiftTarget() - total);
    return (showLeftInsteadTotal ? String(left) : String(total)) + ' | ' + rate.toFixed(2) + '/h';
  }
  
  function applyMini() {
    const rate = currentRate(); box.innerHTML = miniText(); box.style.color = miniColor(rate);
    const p = panel.querySelector('#miniPreview'); if (p) { p.textContent = miniText(); p.style.color = miniColor(rate); }
  }
  
  function addPacks(n) {
    n = parseInt(n) || 0; if (n <= 0) return;
    hourCounts[getSlot()] += n; recalcTotal(); lastTrigger = 'RĘCZNIE +' + n + ' ' + timeNow(); saveState(true); render();
  }
  
  function removePack() {
    const slot = getSlot();
    if (hourlyTotal() > 0) { hourCounts[slot] = Math.max(0, hourCounts[slot] - 1); recalcTotal(); lastTrigger = 'RĘCZNIE -1 ' + timeNow(); saveState(true); render(); }
  }

  function bindCountInputs() {
    panel.querySelectorAll('.hc').forEach((inp) => {
      inp.oninput = (e) => { hourCounts[e.target.getAttribute('data-h')] = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); applyMini(); panel.querySelector('#left').textContent = Math.max(0, shiftTarget() - total); saveState(); };
      inp.onblur = (e) => { e.target.value = hourCounts[e.target.getAttribute('data-h')] || 0; lastTrigger = 'RĘCZNIE ' + timeNow(); renderHours(true); saveState(true); render(); };
    });
    const bb = panel.querySelector('#beforeBreak');
    if (bb) {
      bb.oninput = (e) => { beforeBreak = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); applyMini(); panel.querySelector('#left').textContent = Math.max(0, shiftTarget() - total); saveState(); };
      bb.onblur = (e) => { e.target.value = beforeBreak || 0; lastTrigger = 'RĘCZNIE ' + timeNow(); renderHours(true); saveState(true); render(); };
    }
  }

  function renderHours(force) {
    const active = document.activeElement;
    if (!force && active && panel.contains(active) && (active.classList.contains('hc') || active.id === 'beforeBreak')) return;
    const visibleHours = night ? nightHours : dayHours;
    const max = Math.max(targetPerHour, beforeBreak, ...visibleHours.map((h) => hourCounts[h] || 0), 1);
    let rows = visibleHours.map((h) => {
      const val = hourCounts[h] || 0, bars = Math.min(100, Math.round((val / max) * 100)), good = val >= targetPerHour;
      return \`<div style="display:grid; grid-template-columns:40px 45px 1fr; gap:10px; align-items:center; background:#ffffff; border:1px solid rgba(0,0,0,0.05); border-radius:8px; padding:6px 10px; margin-bottom:6px; border-left:4px solid \${good ? '#22c55e' : '#cbd5e1'}; width:100%; box-sizing:border-box;">
        <b style="font-size:12px; text-align:left; color:#475569;">\${h}</b>
        <input class="hc" data-h="\${h}" type="text" inputmode="numeric" value="\${val}" style="width:100%; padding:4px 6px; border:1px solid #e2e8f0; border-radius:4px; background:#f8fafc; color:#1e293b; text-align:center; font-family:\${technoFont}; font-weight:900; outline:none; font-size:12px; box-sizing:border-box;">
        <div style="height:6px; background:#f1f5f9; border-radius:999px; overflow:hidden; width:100%;">
          <div style="height:100%; width:\${bars}%; background:\${good ? '#22c55e' : '#3b82f6'}; border-radius:999px; transition:width 0.4s ease;"></div>
        </div>
      </div>\`;
    }).join('');
    const bbBars = Math.min(100, Math.round((beforeBreak / max) * 100));
    rows += \`<div style="display:grid; grid-template-columns:85px 45px 1fr; gap:10px; align-items:center; background:#f8fafc; border:1px solid rgba(0,0,0,0.06); border-radius:8px; padding:6px 10px; margin-top:12px; margin-bottom:6px; border-left:4px solid #94a3b8; width:100%; box-sizing:border-box;">
      <b style="font-size:11px; text-align:left; color:#475569;">Przed przerwą</b>
      <input id="beforeBreak" type="text" inputmode="numeric" value="\${beforeBreak}" style="width:100%; padding:4px 6px; border:1px solid #e2e8f0; border-radius:4px; background:#ffffff; color:#1e293b; text-align:center; font-family:\${technoFont}; font-weight:900; outline:none; font-size:12px; box-sizing:border-box;">
      <div style="height:6px; background:#e2e8f0; border-radius:999px; overflow:hidden; width:100%;">
        <div style="height:100%; width:\${Math.min(100, Math.round((beforeBreak / max) * 100))}%; background:#94a3b8; border-radius:999px; transition:width 0.4s ease;"></div>
      </div>
    </div>\`;
    panel.querySelector('#hours').innerHTML = rows; bindCountInputs();
  }

  function render() {
    recalcTotal();
    panel.querySelector('#lt').textContent = lastTrigger;
    panel.querySelector('#left').textContent = Math.max(0, shiftTarget() - total);
    applyMini(); renderHours(false); saveState();
  }

  function scan() {
    const txt = document.body.innerText || '';
    const m = cnt(txt, triggerText), p = cnt(seen, triggerText), nlpm = cnt(txt, nlpText), nlpp = cnt(seen, nlpText);
    
    if (nlpm > nlpp) { 
      skipNextPack = true; 
      lastTrigger = 'NLP: POMIŃ NASTĘPNĄ ' + timeNow(); 
      render(); 
    }
    
    if (m > p) { 
      let diff = m - p; 
      if (skipNextPack) { diff--; skipNextPack = false; lastTrigger = 'POMINIĘTO PO NLP ' + timeNow(); } 
      if (diff > 0) addPacks(diff); 
    }
    seen = txt;
  }

  function toggleUI() { open = !open; panel.style.transform = open ? 'translateX(0)' : 'translateX(370px)'; panel.style.opacity = open ? '1' : '0'; panel.style.pointerEvents = open ? 'auto' : 'none'; }
  function showSettings(v) { panel.querySelector('#mainView').style.display = v ? 'none' : 'block'; panel.querySelector('#settingsView').style.display = v ? 'block' : 'none'; applyMini(); }

  setInterval(scan, 1000); setInterval(render, 1000); window.addEventListener('beforeunload', () => saveState(true)); box.onclick = toggleUI;
  
  document.addEventListener('keydown', (e) => { if (e.shiftKey && e.key.toLowerCase() === 'u') toggleUI(); if (e.altKey && e.key.toLowerCase() === 'p') removePack(); if (e.altKey && e.key.toLowerCase() === 'o') addPacks(1); });
  
  panel.querySelector('#settingsBtn').onclick = () => showSettings(true); 
  panel.querySelector('#backBtn').onclick = () => showSettings(false);
  panel.querySelector('#ratePercent').checked = showRatePercent; 
  panel.querySelector('#leftMode').checked = showLeftInsteadTotal; 
  panel.querySelector('#autoColor').checked = autoStatusColor;
  
  panel.querySelector('#pos').onchange = (e) => { miniPos = e.target.value; applyMiniPos(); saveState(true); };
  panel.querySelector('#ratePercent').onchange = (e) => { showRatePercent = e.target.checked; saveState(true); applyMini(); };
  panel.querySelector('#leftMode').onchange = (e) => { showLeftInsteadTotal = e.target.checked; saveState(true); applyMini(); };
  panel.querySelector('#autoColor').onchange = (e) => { autoStatusColor = e.target.checked; saveState(true); applyMini(); };
  panel.querySelector('#c').oninput = (e) => { manualColor = e.target.value; saveState(true); applyMini(); };
  panel.querySelector('#s').oninput = (e) => { miniSize = parseInt(e.target.value) || 18; box.style.fontSize = miniSize + 'px'; saveState(true); };
  panel.querySelector('#o').oninput = (e) => { miniOpacity = parseInt(e.target.value) || 0; box.style.opacity = miniOpacity / 100; saveState(true); };
  panel.querySelector('#target').oninput = (e) => { targetPerHour = parseInt(e.target.value) || 110; saveState(true); render(); };
  
  render(); scan(); renderHours(true); applyMini();
})();

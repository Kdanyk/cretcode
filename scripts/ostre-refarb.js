(() => {
  if (window.scanCounterV29) return;
  window.scanCounterV29 = true;
  document.querySelectorAll('[data-reit-counter]').forEach((el) => el.remove());

  const saveKey = 'scanCounterV29State';
  const amazonFont = '"Amazon Ember", Arial, sans-serif';
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
  let manualColor = '#565959', miniOpacity = 100, miniSize = 13, miniPos = 'tl', hourCounts = {}, problemCounts = {}, lastSave = 0;

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
      manualColor = s.manualColor || '#565959';
      miniPos = s.miniPos || 'tl';
      miniOpacity = Math.min(100, Math.max(0, s.miniOpacity !== undefined ? parseInt(s.miniOpacity) : 100));
      miniSize = Math.min(45, Math.max(10, parseInt(s.miniSize) || 13));
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

  const box = document.createElement('div');
  box.setAttribute('data-reit-counter', 'mini');
  box.style = 'position:fixed;background:#fff;border:1px solid #d5d9d9;color:' + manualColor + ';padding:4px 8px;font-size:' + miniSize + 'px;font-family:' + amazonFont + ';z-index:999999;border-radius:3px;opacity:' + (miniOpacity / 100) + ';cursor:pointer;user-select:none;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,0.05);';

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
  panel.style = 'position:fixed;top:58px;bottom:24px;right:20px;background:#f2f2f2;color:#0f1111;padding:16px;border-radius:4px;border:1px solid #d5d9d9;z-index:999999;font-family:' + amazonFont + ';width:330px;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;box-shadow:0 4px 12px rgba(0,0,0,0.15);scrollbar-width:thin;transform:translateX(0);opacity:1;pointer-events:auto;transition:transform .25s ease,opacity .25s ease;';

  panel.innerHTML = `
  <div id="mainView" style="width:100%; box-sizing:border-box;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #d5d9d9; padding-bottom:8px;">
      <div id="mainTitle" style="font-size:16px; font-weight:700; color:#0f1111;">C-RET Counter</div>
      <button id="settingsBtn" title="Ustawienia" style="width:28px; height:28px; border:1px solid #d5d9d9; border-radius:3px; background:#e7e9ec; color:#0f1111; font-size:14px; cursor:pointer;">⚙️</button>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px; width:100%; box-sizing:border-box;">
      <div style="background:#fff; border:1px solid #d5d9d9; border-radius:3px; padding:8px;">
        <div style="font-size:11px; color:#565959; margin-bottom:2px;">Ostatni Trigger</div>
        <div id="lt" style="font-size:11px; font-weight:700; color:#0f1111; word-break:break-all; line-height:1.2;">-</div>
      </div>
      <div style="background:#fff; border:1px solid #d5d9d9; border-radius:3px; padding:8px;">
        <div style="font-size:11px; color:#565959; margin-bottom:2px;">Off Task</div>
        <div id="off" style="font-size:16px; font-weight:700; color:#007185;">30:00</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px; width:100%; box-sizing:border-box;">
      <div style="background:#fdf0f0; border:1px solid #eed3d7; padding:10px; border-radius:3px; text-align:center;">
        <div style="font-size:11px; font-weight:700; color:#c40000; margin-bottom:2px;">Problem</div>
        <div id="pb" style="font-size:20px; font-weight:700; color:#c40000;">0</div>
      </div>
      <div style="background:#fff; border:1px solid #d5d9d9; padding:10px; border-radius:3px; text-align:center;">
        <div style="font-size:11px; font-weight:700; color:#0f1111; margin-bottom:2px;">Pozostało</div>
        <div id="left" style="font-size:20px; font-weight:700; color:#0f1111;">0</div>
      </div>
    </div>
    <div id="hours" style="width:100%; box-sizing:border-box; background:#fff; border:1px solid #d5d9d9; border-radius:3px; padding:8px;"></div>
  </div>
  <div id="settingsView" style="display:none; width:100%; box-sizing:border-box;">
    <div style="display:flex; align-items:center; margin-bottom:12px; border-bottom:1px solid #d5d9d9; padding-bottom:8px;">
      <button id="backBtn" title="Powrót" style="width:28px; height:28px; border:1px solid #d5d9d9; border-radius:3px; background:#e7e9ec; color:#0f1111; font-size:16px; cursor:pointer; margin-right:10px; display:flex; align-items:center; justify-content:center;">‹</button>
      <div style="font-size:16px; font-weight:700; color:#0f1111;">Ustawienia</div>
    </div>
    <div style="background:#fff; border:1px solid #d5d9d9; border-radius:3px; padding:12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
      <div style="display:grid; grid-template-columns:105px 1fr; gap:8px; align-items:center; font-size:12px; color:#0f1111; width:100%; box-sizing:border-box;">
        <label>Wyklucz Przerwę</label>
        <select id="breakSel" style="width:100%; height:26px; border:1px solid #888c8c; border-radius:3px; background:#fff; font-family:${amazonFont}; color:#0f1111; box-sizing:border-box;">
          <option value="0" ${selectedBreak === 0 ? 'selected' : ''}>Brak</option>
          <option value="1" ${selectedBreak === 1 ? 'selected' : ''}>Przerwa 1 (11:20/23:20)</option>
          <option value="2" ${selectedBreak === 2 ? 'selected' : ''}>Przerwa 2 (11:50/23:50)</option>
          <option value="3" ${selectedBreak === 3 ? 'selected' : ''}>Przerwa 3 (12:20/00:20)</option>
          <option value="4" ${selectedBreak === 4 ? 'selected' : ''}>Przerwa 4 (12:50/00:50)</option>
        </select>
        <label>Pozycja mini</label>
        <select id="pos" style="width:100%; height:26px; border:1px solid #888c8c; border-radius:3px; background:#fff; font-family:${amazonFont}; color:#0f1111; box-sizing:border-box;">
          <option value="bl" ${miniPos === 'bl' ? 'selected' : ''}>Dół - Lewo</option>
          <option value="br" ${miniPos === 'br' ? 'selected' : ''}>Dół - Prawo</option>
          <option value="tl" ${miniPos === 'tl' ? 'selected' : ''}>Góra - Lewo</option>
          <option value="tr" ${miniPos === 'tr' ? 'selected' : ''}>Góra - Prawo</option>
        </select>
        <label>Kolor mini</label>
        <input type="color" id="c" value="${manualColor}" style="width:100%; height:26px; border:1px solid #888c8c; border-radius:3px; background:#fff; padding:1px; box-sizing:border-box;">
        <label>Rozmiar mini</label>
        <input type="range" id="s" min="10" max="45" value="${miniSize}" style="width:100%; accent-color:#007185; box-sizing:border-box;">
        <label>Widoczność</label>
        <input type="range" id="o" min="0" max="100" value="${miniOpacity}" style="width:100%; accent-color:#007185; box-sizing:border-box;">
        <label>Reit/h cel</label>
        <input type="text" inputmode="numeric" id="target" value="${targetPerHour}" style="width:100%; padding:4px 6px; border-radius:3px; border:1px solid #888c8c; background:#fff; color:#0f1111; font-family:${amazonFont}; box-sizing:border-box; outline:none;">
      </div>
    </div>
    <div style="background:#fff; border:1px solid #d5d9d9; border-radius:3px; padding:12px; margin-bottom:10px; width:100%; box-sizing:border-box;">
      <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:12px; color:#0f1111; cursor:pointer;">Ignoruj NLP <input id="ignoreNLP" type="checkbox" style="width:16px; height:16px; accent-color:#007185; margin:0; cursor:pointer;" ${ignoreNLP ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:12px; color:#0f1111; cursor:pointer;">Tempo % / h <input id="ratePercent" type="checkbox" style="width:16px; height:16px; accent-color:#007185; margin:0; cursor:pointer;" ${showRatePercent ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-size:12px; color:#0f1111; cursor:pointer;">Pozostało zamiast sumy <input id="leftMode" type="checkbox" style="width:16px; height:16px; accent-color:#007185; margin:0; cursor:pointer;" ${showLeftInsteadTotal ? 'checked' : ''}></label>
      <label style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#0f1111; cursor:pointer;">Auto-kolor tempa <input id="autoColor" type="checkbox" style="width:16px; height:16px; accent-color:#007185; margin:0; cursor:pointer;" ${autoStatusColor ? 'checked' : ''}></label>
    </div>
    <button id="resetOff" style="width:100%; padding:8px; border:1px solid #a88734; border-radius:3px; background:#ffd814; color:#111; font-family:${amazonFont}; font-size:13px; cursor:pointer; box-shadow:0 1px 0 rgba(255,255,255,0.4) inset; margin-bottom:14px;">Reset Off Task</button>
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
    return pct >= 1 ? '#008a00' : pct >= 0.85 ? '#e47911' : '#c40000';
  }
  function miniText() {
    const rate = currentRate(), left = Math.max(0, shiftTarget() - total);
    const main = showLeftInsteadTotal ? String(left) : String(total);
    const r = showRatePercent ? (targetPerHour > 0 ? ((rate / targetPerHour) * 100).toFixed(0) : '0') + '%/h' : rate.toFixed(2) + '/h';
    return main + ' | ' + r;
  }
  
  function updateHeader() {
    const hdr = panel.querySelector('#mainTitle');
    if (hdr) hdr.innerHTML = 'C-RET Counter' + (selectedBreak > 0 ? ' <span style="font-size:12px; color:#565959; font-weight:400;">(Przerwa ' + selectedBreak + ')</span>' : '');
  }

  function applyMini() {
    const rate = currentRate(); box.innerHTML = miniText(); box.style.color = miniColor(rate);
  }
  
  function addPacks(n) { 
    n = parseInt(n) || 0; if (n <= 0) return; 
    loadState();
    const slot = getSlot(); hourCounts[slot] += n; 
    recalcTotal(); lastTrigger = '+' + n + ' Ręcznie ' + timeNow(); 
    markActivity(); saveState(true); render(); 
  }
  function removePack() { 
    loadState();
    const slot = getSlot(); 
    if (hourlyTotal() > 0) { 
        hourCounts[slot] = Math.max(0, hourCounts[slot] - 1); 
        recalcTotal(); lastTrigger = '-1 Ręcznie ' + timeNow(); 
        saveState(true); render(); 
    } 
  }
  function addProblem(n) { 
    n = parseInt(n) || 0; if (n <= 0) return; 
    loadState();
    problemTotal += n; problemCounts[getSlot()] += n; 
    lastTrigger = 'Problem ' + timeNow(); markActivity(); saveState(true); render(); 
  }
  
  function bindCountInputs() {
    panel.querySelectorAll('.hc').forEach((inp) => {
      inp.oninput = (e) => { hourCounts[e.target.getAttribute('data-h')] = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); applyMini(); };
      inp.onblur = (e) => { 
          let newVal = Math.max(0, parseInt(e.target.value) || 0);
          loadState();
          hourCounts[e.target.getAttribute('data-h')] = newVal;
          lastTrigger = 'Ręczna edycja ' + timeNow(); saveState(true); renderHours(true); render(); 
      };
    });
    const bb = panel.querySelector('#beforeBreak');
    if (bb) {
      bb.oninput = (e) => { beforeBreak = Math.max(0, parseInt(e.target.value) || 0); recalcTotal(); applyMini(); };
      bb.onblur = (e) => { 
          let newVal = Math.max(0, parseInt(e.target.value) || 0);
          loadState();
          beforeBreak = newVal;
          lastTrigger = 'Ręczna edycja ' + timeNow(); saveState(true); renderHours(true); render(); 
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
      return `<div style="display:grid; grid-template-columns:40px 45px 35px 1fr; gap:6px; align-items:center; background:#fff; border-bottom:1px solid #eaeded; padding:6px 0; width:100%;">
        <b style="font-size:12px; color:#0f1111; font-weight:700;">${h}</b>
        <input class="hc" data-h="${h}" type="text" inputmode="numeric" value="${val}" style="width:100%; padding:3px; border:1px solid #888c8c; border-radius:3px; background:#fff; color:#0f1111; text-align:center; font-family:${amazonFont}; outline:none; font-size:12px;" onfocus="this.style.boxShadow='0 0 0 2px #c8f3fa', this.style.borderColor='#007185'" onblur="this.style.boxShadow='none', this.style.borderColor='#888c8c'">
        <div style="font-size:11px; color:#565959; text-align:left;">/${cumTarget}</div>
        <div style="height:6px; background:#eaeded; border-radius:3px; overflow:hidden; border:1px solid #d5d9d9;">
          <div style="height:100%; width:${bars}%; background:${good ? '#008a00' : '#007185'}; transition:width 0.3s ease;"></div>
        </div>
      </div>`;
    }).join('');
    
    rows += `<div style="display:grid; grid-template-columns:80px 45px 35px 1fr; gap:6px; align-items:center; background:#f7f7f7; border-top:1px solid #d5d9d9; padding:8px 0 0 0; margin-top:4px; width:100%;">
      <b style="font-size:11px; color:#565959;">Przed przerwą</b>
      <input id="beforeBreak" type="text" inputmode="numeric" value="${beforeBreak}" style="width:100%; padding:3px; border:1px solid #888c8c; border-radius:3px; background:#fff; color:#0f1111; text-align:center; font-family:${amazonFont}; outline:none; font-size:12px;" onfocus="this.style.boxShadow='0 0 0 2px #c8f3fa', this.style.borderColor='#007185'" onblur="this.style.boxShadow='none', this.style.borderColor='#888c8c'">
      <div style="font-size:10px; color:#565959;"></div>
      <div style="height:6px; background:#eaeded; border-radius:3px; overflow:hidden; border:1px solid #d5d9d9;">
        <div style="height:100%; width:${Math.min(100, Math.round((beforeBreak / max) * 100))}%; background:#767676; transition:width 0.3s ease;"></div>
      </div>
    </div>`;
    panel.querySelector('#hours').innerHTML = rows; bindCountInputs();
  }
  
  function render() {
    recalcTotal(); const now = Date.now();
    if (now - lastActivityTime > grace) { offRemain -= now - offLastTick; if (offRemain < 0) offRemain = 0; }
    offLastTick = now;
    
    let isBreak = isBreakActive();
    panel.querySelector('#lt').textContent = isBreak ? 'Trwa Przerwa...' : lastTrigger;
    panel.querySelector('#lt').style.color = isBreak ? '#e47911' : '#0f1111';
    
    panel.querySelector('#off').textContent = fmt(offRemain);
    panel.querySelector('#pb').textContent = problemTotal; panel.querySelector('#left').textContent = Math.max(0, shiftTarget() - total);
    
    updateHeader();
    applyMini(); renderHours(false); 
  }
  
  function scan() {
    const txt = document.body.innerText || '', m = cnt(txt, triggerText), p = cnt(seen, triggerText), pm = cnt(txt, problemText), pp = cnt(seen, problemText), nlpm = cnt(txt, nlpText), nlpp = cnt(seen, nlpText);
    
    if (!ignoreNLP && nlpm > nlpp) { 
        skipNextPack = true; 
        lastTrigger = 'NLP (Pominięto) ' + timeNow(); 
        markActivity(); saveState(true); render(); 
    }
    
    if (pm > pp) addProblem(pm - pp);
    else if (m > p) { 
      let diff = m - p; 
      if (skipNextPack) { diff--; skipNextPack = false; lastTrigger = 'Zignorowano po NLP ' + timeNow(); } 
      if (diff > 0) { 
        if (isBreakActive()) {
          lastTrigger = 'Przerwa (Ignoruję ' + diff + ')';
          markActivity(); saveState(true); render();
        } else {
          addPacks(diff); 
        }
      } 
    }
    seen = txt;
  }
  
  function toggleUI() { open = !open; panel.style.transform = open ? 'translateX(0)' : 'translateX(350px)'; panel.style.opacity = open ? '1' : '0'; panel.style.pointerEvents = open ? 'auto' : 'none'; }
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
  panel.querySelector('#s').oninput = (e) => { miniSize = parseInt(e.target.value) || 12; box.style.fontSize = miniSize + 'px'; saveState(true); };
  panel.querySelector('#o').oninput = (e) => { miniOpacity = parseInt(e.target.value) || 0; box.style.opacity = miniOpacity / 100; saveState(true); };
  panel.querySelector('#target').oninput = (e) => { targetPerHour = parseInt(e.target.value) || 28; saveState(true); render(); };
  
  window.addEventListener('storage', (e) => {
    if (e.key === saveKey) {
      loadState();
      render();
    }
  });

  render(); scan(); renderHours(true); applyMini(); updateHeader();
})();

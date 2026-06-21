// ==UserScript==
// @name         C-RET Minimal (Tampermonkey)
// @namespace    http://tampermonkey.net/
// @version      6.3
// @description  Minimalny licznik C-RET z poprawionymi slotami zmian: 6:30->7:30 i 18:30->19:30, potem co godzine, ostatni slot 30 min.
// @author       You
// @include      *
// @match        *://*/*
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (window.cRetMinimalV6_3) return;
  window.cRetMinimalV6_3 = true;
  document.querySelectorAll('[data-reit-counter]').forEach((el) => el.remove());

  const saveKey = 'cRetMinimalStateV6_3';
  const legacySaveKey = 'cRetMinimalStateV6_2';
  const technoFont = 'Consolas,"Lucida Console","Courier New",monospace';
  const triggerText = 'Przedmiot jest kompletny';

  const shiftConfig = {
    day: {
      name: 'day',
      startLabel: '6:30',
      startMinutes: 6 * 60 + 30,
      endMinutes: 18 * 60 + 30,
      slots: [
        { label: '7:30', minutes: 7 * 60 + 30 },
        { label: '8:30', minutes: 8 * 60 + 30 },
        { label: '9:30', minutes: 9 * 60 + 30 },
        { label: '10:30', minutes: 10 * 60 + 30 },
        { label: '11:30', minutes: 11 * 60 + 30 },
        { label: '12:30', minutes: 12 * 60 + 30 },
        { label: '13:30', minutes: 13 * 60 + 30 },
        { label: '14:30', minutes: 14 * 60 + 30 },
        { label: '15:30', minutes: 15 * 60 + 30 },
        { label: '16:30', minutes: 16 * 60 + 30 },
        { label: '17:00', minutes: 17 * 60 },
      ],
    },
    night: {
      name: 'night',
      startLabel: '18:30',
      startMinutes: 18 * 60 + 30,
      endMinutes: 6 * 60 + 30,
      slots: [
        { label: '19:30', minutes: 19 * 60 + 30 },
        { label: '20:30', minutes: 20 * 60 + 30 },
        { label: '21:30', minutes: 21 * 60 + 30 },
        { label: '22:30', minutes: 22 * 60 + 30 },
        { label: '23:30', minutes: 23 * 60 + 30 },
        { label: '0:30', minutes: 24 * 60 + 30 },
        { label: '1:30', minutes: 25 * 60 + 30 },
        { label: '2:30', minutes: 26 * 60 + 30 },
        { label: '3:30', minutes: 27 * 60 + 30 },
        { label: '4:30', minutes: 28 * 60 + 30 },
        { label: '5:00', minutes: 29 * 60 },
      ],
    },
  };

  function minutesNow() {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  function getShiftName() {
    const mins = minutesNow();
    return mins >= shiftConfig.night.startMinutes || mins < shiftConfig.day.startMinutes ? 'night' : 'day';
  }

  let shiftName = getShiftName();
  let shift = shiftConfig[shiftName];
  let hours = shift.slots.map((slot) => slot.label);

  let total = 0;
  let seen = '';
  let start = Date.now();
  let hourCounts = {};

  let targetPerHour = 44;
  let showPercentage = false;
  let idleOpacity = 0.01;
  let accentColor = '#35d66b';
  let position = { left: 20, top: null };

  let tableOpen = false;
  let settingsOpen = false;

  function normalizeSlotMinutes(slotMinutes) {
    return shiftName === 'night' && slotMinutes < 12 * 60 ? slotMinutes + 24 * 60 : slotMinutes;
  }

  function normalizeCurrentMinutes(currentMinutes) {
    return shiftName === 'night' && currentMinutes < shiftConfig.day.startMinutes
      ? currentMinutes + 24 * 60
      : currentMinutes;
  }

  function getDefaultShiftStart() {
    const d = new Date();
    const [h, m] = shift.startLabel.split(':').map(Number);
    d.setHours(h, m, 0, 0);

    if (shiftName === 'night' && minutesNow() < shiftConfig.day.startMinutes) {
      d.setDate(d.getDate() - 1);
    }

    if (d.getTime() > Date.now()) {
      d.setDate(d.getDate() - 1);
    }

    return d.getTime();
  }

  function initCounts() {
    hourCounts = {};
    hours.forEach((h) => { hourCounts[h] = 0; });
    start = getDefaultShiftStart();
    total = 0;
  }

  function readStoredState() {
    return JSON.parse(localStorage.getItem(saveKey) || localStorage.getItem(legacySaveKey) || '{}');
  }

  function loadState() {
    try {
      const s = readStoredState();
      if (s.shift !== shiftName) {
        initCounts();
        return;
      }

      start = Number(s.start) || getDefaultShiftStart();
      targetPerHour = Math.max(1, parseInt(s.targetPerHour, 10) || 44);
      showPercentage = !!s.showPercentage;
      idleOpacity = s.idleOpacity !== undefined ? parseFloat(s.idleOpacity) : 0.01;
      accentColor = s.accentColor || '#35d66b';
      position = s.position || position;

      hourCounts = {};
      hours.forEach((h) => {
        hourCounts[h] = Math.max(0, parseInt(s.hourCounts && s.hourCounts[h], 10) || 0);
      });
    } catch (_) {
      initCounts();
    }
  }

  function saveState() {
    localStorage.setItem(saveKey, JSON.stringify({
      shift: shiftName,
      start,
      targetPerHour,
      showPercentage,
      idleOpacity,
      accentColor,
      position,
      hourCounts,
    }));
  }

  loadState();

  function refreshShiftIfNeeded() {
    const nextShiftName = getShiftName();
    if (nextShiftName === shiftName) return;

    shiftName = nextShiftName;
    shift = shiftConfig[shiftName];
    hours = shift.slots.map((slot) => slot.label);
    initCounts();
    saveState();
    render();
    if (tableOpen) renderFullTable();
  }

  function getStartTimeStr() {
    const d = new Date(start);
    if (Number.isNaN(d.getTime())) return '00:00';
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function getSlot() {
    const mins = normalizeCurrentMinutes(minutesNow());
    for (const slot of shift.slots) {
      if (mins <= normalizeSlotMinutes(slot.minutes)) return slot.label;
    }
    return shift.slots[shift.slots.length - 1].label;
  }

  function calcTotal() {
    total = hours.reduce((acc, h) => acc + (hourCounts[h] || 0), 0);
  }

  function getRate() {
    const h = Math.max(0, (Date.now() - start) / 3600000);
    return h > 0 ? total / h : 0;
  }

  function addPacks(n) {
    if (n === 0) return;
    refreshShiftIfNeeded();
    const slot = getSlot();
    hourCounts[slot] = Math.max(0, (hourCounts[slot] || 0) + n);
    calcTotal();
    saveState();
    render();
    if (tableOpen) renderFullTable();
  }

  const uiContainer = document.createElement('div');
  uiContainer.setAttribute('data-reit-counter', 'true');

  const widgetWrapper = document.createElement('div');
  const topValue = position.top === null ? '30%' : `${position.top}px`;
  widgetWrapper.style = `
    position: fixed; left: ${position.left}px; top: ${topValue}; display: flex; flex-direction: row; align-items: flex-start;
    z-index: 999999; opacity: ${idleOpacity}; transition: opacity 0.4s ease; pointer-events: auto;
  `;
  uiContainer.appendChild(widgetWrapper);

  const widget = document.createElement('div');
  widget.style = `
    position: relative; width: 170px; min-height: 120px; background: rgba(25, 25, 28, 0.95); color: #fff;
    font-family: ${technoFont}; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column;
    cursor: move;
  `;

  widget.innerHTML = `
    <div id="btn-open-settings" style="position: absolute; top: 8px; right: 8px; font-size: 14px; color: #888; cursor: pointer; transition: color 0.2s; z-index: 10;" title="Ustawienia (Alt+Z)"
         onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#888'">⚙</div>
    <div style="padding: 15px 12px 12px 12px; display: flex; flex-direction: column; gap: 8px; flex-grow: 1;">
      <div id="w-packs" style="font-size: 44px; font-weight: 900; text-align: center; line-height: 1; margin-top: 5px;">0</div>
      <div id="w-rate" style="font-size: 22px; font-weight: bold; text-align: center; color: #ffd166;">0.00</div>
      <div style="flex-grow: 1;"></div>
      <div style="height: 1px; background: rgba(255,255,255,0.2); margin: 6px 0;"></div>
      <div id="w-hour-row" style="font-size: 13px; cursor: pointer; padding: 4px; border-radius: 6px; transition: background 0.2s;"
           onmouseover="this.style.background='rgba(255,255,255,0.1)'"
           onmouseout="this.style.background='transparent'"></div>
    </div>
  `;
  widgetWrapper.appendChild(widget);

  const tablePanel = document.createElement('div');
  tablePanel.style = `
    width: 0px; margin-left: 0px; background: rgba(25, 25, 28, 0.95); color: #fff; font-family: ${technoFont};
    border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;
    transition: all 0.3s ease; border: 0px solid rgba(255,255,255,0.1);
  `;
  tablePanel.innerHTML = `<div id="table-content" style="width: 280px; padding: 15px; box-sizing: border-box;"></div>`;
  widgetWrapper.appendChild(tablePanel);

  const settingsPanel = document.createElement('div');
  settingsPanel.style = `
    width: 0px; margin-left: 0px; background: rgba(25, 25, 28, 0.95); color: #fff; font-family: ${technoFont};
    border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;
    transition: all 0.3s ease; border: 0px solid rgba(255,255,255,0.1);
  `;
  settingsPanel.innerHTML = `
    <div style="width: 270px; padding: 15px; box-sizing: border-box;">
      <div style="font-size: 16px; font-weight: 900; margin-bottom: 12px; text-align: center; color: #fff;">USTAWIENIA</div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <div>
          <label style="display: block; font-size: 11px; font-weight: bold; margin-bottom: 3px; color: #ccc;">Cel (szt/h)</label>
          <input id="set-target" type="number" value="${targetPerHour}" style="width: 100%; padding: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; border-radius: 6px; box-sizing: border-box; font-family: ${technoFont}; font-weight: bold;">
        </div>
        <div>
          <label style="display: block; font-size: 11px; font-weight: bold; margin-bottom: 3px; color: #ccc;">Kolor sukcesu</label>
          <input id="set-color" type="color" value="${accentColor}" style="width: 100%; height: 28px; border: none; border-radius: 6px; cursor: pointer; padding: 0; background: transparent;">
        </div>
      </div>

      <label style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: bold; margin-bottom: 12px; cursor: pointer; color: #ccc;">
        Pokaz tempo w %
        <input id="set-percent" type="checkbox" style="width: 16px; height: 16px;" ${showPercentage ? 'checked' : ''}>
      </label>

      <label style="display: block; font-size: 11px; font-weight: bold; margin-bottom: 5px; color: #ccc;">Przezroczystosc w spoczynku</label>
      <input id="set-opacity" type="range" min="0.01" max="0.8" step="0.05" value="${idleOpacity}" style="width: 100%; margin-bottom: 15px;">

      <div style="margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
        <label style="display: block; font-size: 11px; font-weight: bold; margin-bottom: 5px; color: #ccc;">Od kiedy liczyc tempo? (Start)</label>
        <div style="display: flex; gap: 5px;">
          <input id="set-custom-time" type="time" value="${getStartTimeStr()}" style="flex: 1; padding: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); color: #fff; border-radius: 6px; font-family: ${technoFont}; color-scheme: dark;">
          <button id="btn-set-time" style="padding: 6px 12px; background: #3daee9; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: background 0.2s;">Ustaw</button>
        </div>
      </div>

      <button id="btn-break" style="width: 100%; padding: 8px; background: #f39c12; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 15px;">Przerwa 30 min</button>

      <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <button id="btn-minus" style="flex: 1; padding: 8px; background: rgba(255, 77, 77, 0.8); color: white; border: 1px solid rgba(255,77,77,1); border-radius: 6px; cursor: pointer; font-weight: bold;">-1 Sztuka</button>
        <button id="btn-plus" style="flex: 1; padding: 8px; background: rgba(53, 214, 107, 0.8); color: white; border: 1px solid rgba(53,214,107,1); border-radius: 6px; cursor: pointer; font-weight: bold;">+1 Sztuka</button>
      </div>

      <button id="btn-reset" style="width: 100%; padding: 8px; background: rgba(217, 83, 79, 0.3); color: #ff6b6b; border: 1px solid #ff6b6b; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 10px;">Resetuj zmiane</button>
      <button id="set-close" style="width: 100%; padding: 8px; background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; cursor: pointer; font-family: ${technoFont}; font-weight: bold;">ZAMKNIJ</button>
    </div>
  `;
  widgetWrapper.appendChild(settingsPanel);
  document.body.appendChild(uiContainer);

  function updatePanels() {
    tablePanel.style.width = tableOpen ? '300px' : '0px';
    tablePanel.style.marginLeft = tableOpen ? '10px' : '0px';
    tablePanel.style.borderWidth = tableOpen ? '1px' : '0px';

    settingsPanel.style.width = settingsOpen ? '270px' : '0px';
    settingsPanel.style.marginLeft = settingsOpen ? '10px' : '0px';
    settingsPanel.style.borderWidth = settingsOpen ? '1px' : '0px';
  }

  function toggleSettings() {
    settingsOpen = !settingsOpen;
    if (settingsOpen) {
      tableOpen = false;
      settingsPanel.querySelector('#set-custom-time').value = getStartTimeStr();
    }
    updatePanels();
  }

  widget.querySelector('#btn-open-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    toggleSettings();
  });

  widget.querySelector('#w-hour-row').addEventListener('click', (e) => {
    e.stopPropagation();
    tableOpen = !tableOpen;
    if (tableOpen) {
      settingsOpen = false;
      renderFullTable();
    }
    updatePanels();
  });

  function renderFullTable() {
    let html = `<div style="text-align: center; font-size: 15px; font-weight: bold; margin-bottom: 4px; color: #fff;">Tabela (${shiftName})</div>`;
    html += `<div style="text-align: center; font-size: 11px; margin-bottom: 12px; color: #aaa;">Start ${shift.startLabel}; wiersz pokazuje wynik do godziny</div>`;

    const curSlot = getSlot();
    let cumulativeTarget = 0;

    shift.slots.forEach((slot, index) => {
      const h = slot.label;
      const val = hourCounts[h] || 0;
      const isCurrent = h === curSlot;
      const isHalfHour = index === shift.slots.length - 1;
      const slotTarget = isHalfHour ? Math.round(targetPerHour / 2) : targetPerHour;
      cumulativeTarget += slotTarget;
      const good = val >= slotTarget;
      const pct = Math.min(100, Math.round((val / slotTarget) * 100));
      const color = good ? accentColor : '#3daee9';
      const bg = isCurrent ? 'rgba(255,255,255,0.15)' : 'transparent';
      const slotNote = isHalfHour ? '30m' : '1h';

      html += `
        <div style="background: ${bg}; padding: 6px 8px; border-radius: 6px; margin-bottom: 4px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; align-items: center;">
            <span style="color: ${isCurrent ? '#fff' : '#aaa'}; font-weight: ${isCurrent ? 'bold' : 'normal'}">${h} <span style="color:#777; font-size:10px;">${slotNote}</span></span>
            <span>
              <span style="font-weight: bold; color: #fff;">${val}</span>
              <span style="color: #888; font-size: 11px;"> / ${slotTarget} <span style="color:#aaa;">(sum ${cumulativeTarget})</span></span>
            </span>
          </div>
          <div style="height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
            <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 2px;"></div>
          </div>
        </div>
      `;
    });

    tablePanel.querySelector('#table-content').innerHTML = html;
  }

  let fadeTimer;
  let secondaryFadeTimer;

  function startFadeOutSequence() {
    widgetWrapper.style.opacity = '0.5';
    secondaryFadeTimer = setTimeout(() => {
      widgetWrapper.style.opacity = idleOpacity;
    }, 3000);
  }

  widgetWrapper.addEventListener('mouseenter', () => {
    clearTimeout(fadeTimer);
    clearTimeout(secondaryFadeTimer);
    widgetWrapper.style.opacity = '1';
  });

  widgetWrapper.addEventListener('mouseleave', () => {
    startFadeOutSequence();
  });

  let isDragging = false;
  let dx = 0;
  let dy = 0;

  widgetWrapper.addEventListener('mousedown', (e) => {
    if (e.target.closest('button, input, #w-hour-row, #table-content, label, #btn-open-settings')) return;
    isDragging = true;
    const rect = widgetWrapper.getBoundingClientRect();
    dx = e.clientX - rect.left;
    dy = e.clientY - rect.top;
    widgetWrapper.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    position = {
      left: Math.max(0, e.clientX - dx),
      top: Math.max(0, e.clientY - dy),
    };
    widgetWrapper.style.left = `${position.left}px`;
    widgetWrapper.style.top = `${position.top}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      widgetWrapper.style.transition = 'opacity 0.4s ease';
      saveState();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      toggleSettings();
    }
    if (e.shiftKey && e.key.toLowerCase() === 'x') {
      e.preventDefault();
      clearTimeout(fadeTimer);
      clearTimeout(secondaryFadeTimer);
      widgetWrapper.style.opacity = '1';
      fadeTimer = setTimeout(() => { startFadeOutSequence(); }, 5000);
    }
  });

  settingsPanel.querySelector('#set-close').onclick = () => {
    settingsOpen = false;
    updatePanels();
  };

  settingsPanel.querySelector('#set-target').oninput = (e) => {
    targetPerHour = parseInt(e.target.value, 10) || 44;
    saveState();
    render();
    if (tableOpen) renderFullTable();
  };

  settingsPanel.querySelector('#set-percent').onchange = (e) => {
    showPercentage = e.target.checked;
    saveState();
    render();
  };

  settingsPanel.querySelector('#set-opacity').oninput = (e) => {
    idleOpacity = parseFloat(e.target.value);
    widgetWrapper.style.opacity = idleOpacity;
    saveState();
  };

  settingsPanel.querySelector('#set-color').oninput = (e) => {
    accentColor = e.target.value;
    saveState();
    render();
    if (tableOpen) renderFullTable();
  };

  settingsPanel.querySelector('#btn-set-time').onclick = () => {
    const timeStr = settingsPanel.querySelector('#set-custom-time').value;
    if (!timeStr) return;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);

    if (d.getTime() > Date.now()) {
      d.setDate(d.getDate() - 1);
    }

    start = d.getTime();
    saveState();
    render();

    const btn = settingsPanel.querySelector('#btn-set-time');
    const oldText = btn.innerHTML;
    btn.innerHTML = 'OK';
    btn.style.background = '#27ae60';
    setTimeout(() => {
      btn.innerHTML = oldText;
      btn.style.background = '#3daee9';
    }, 2000);
  };

  settingsPanel.querySelector('#btn-break').onclick = () => {
    start += 30 * 60 * 1000;
    saveState();
    render();

    const btn = settingsPanel.querySelector('#btn-break');
    const oldText = btn.innerHTML;
    btn.innerHTML = 'OK (-30m)';
    btn.style.background = '#27ae60';
    setTimeout(() => {
      btn.innerHTML = oldText;
      btn.style.background = '#f39c12';
    }, 2000);
  };

  settingsPanel.querySelector('#btn-plus').onclick = () => addPacks(1);
  settingsPanel.querySelector('#btn-minus').onclick = () => addPacks(-1);

  settingsPanel.querySelector('#btn-reset').onclick = () => {
    if (confirm('Czy na pewno chcesz zresetowac statystyki zmiany?')) {
      initCounts();
      saveState();
      settingsPanel.querySelector('#set-custom-time').value = getStartTimeStr();
      render();
      if (tableOpen) renderFullTable();
    }
  };

  function esc(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function cnt(txt, what) {
    return (txt.match(new RegExp(esc(what), 'gi')) || []).length;
  }

  function getCurrentSlotTarget(slotLabel) {
    const isLastSlot = slotLabel === shift.slots[shift.slots.length - 1].label;
    return isLastSlot ? Math.round(targetPerHour / 2) : targetPerHour;
  }

  function render() {
    refreshShiftIfNeeded();
    calcTotal();
    const rate = getRate();
    const curSlot = getSlot();
    const slotPacks = hourCounts[curSlot] || 0;
    const slotTarget = getCurrentSlotTarget(curSlot);

    uiContainer.querySelector('#w-packs').textContent = total;

    if (showPercentage) {
      const pctRate = targetPerHour > 0 ? (rate / targetPerHour) * 100 : 0;
      uiContainer.querySelector('#w-rate').textContent = `${pctRate.toFixed(0)}%`;
    } else {
      uiContainer.querySelector('#w-rate').textContent = `${rate.toFixed(2)}/h`;
    }

    const pct = Math.min(100, Math.round((slotPacks / slotTarget) * 100));
    const good = slotPacks >= slotTarget;

    uiContainer.querySelector('#w-hour-row').innerHTML = `
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: bold; align-items: center;">
        <span style="color: #ccc;">do ${curSlot}</span>
        <span>${slotPacks} <span style="color:#777; font-size: 11px;">/ ${slotTarget}</span></span>
      </div>
      <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: ${good ? accentColor : '#3daee9'}; border-radius: 4px; transition: width 0.3s, background 0.3s;"></div>
      </div>
    `;
  }

  function scan() {
    const txt = document.body.innerText || '';
    const currentMatches = cnt(txt, triggerText);
    const previousMatches = cnt(seen, triggerText);

    if (currentMatches > previousMatches) {
      addPacks(currentMatches - previousMatches);
    }
    seen = txt;
  }

  setInterval(scan, 1000);
  setInterval(() => {
    refreshShiftIfNeeded();
    render();
    if (tableOpen) renderFullTable();
  }, 1000);
  window.addEventListener('beforeunload', saveState);

  render();
})();

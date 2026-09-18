(() => {
  if (window.__cretCounterLoaded) return;
  window.__cretCounterLoaded = true;

  const SAVE_KEY = 'scanCounterV29State';
  const NATIVE_FONT = '"Amazon Ember", Arial, sans-serif';

  const dayHours = [
    '7:30', '8:30', '9:30', '10:30', '11:30',
    '12:30', '13:30', '14:30', '15:30', '16:30', '17:00'
  ];

  const nightHours = [
    '19:30', '20:30', '21:30', '22:30', '23:30',
    '00:30', '1:30', '2:30', '3:30', '4:30', '5:00'
  ];

  const currentHour = new Date().getHours();
  const night = currentHour >= 17 || currentHour < 5;
  const hours = night ? nightHours : dayHours;
  const shiftName = night ? 'night' : 'day';

  const TARGET_TEXTS = [
    'перепризначте lpn',
    'przypisz ponownie lpn'
  ];

  const IGNORED_PREFIXES = new Set(['t', '1', '0', '2']);

  let active = false;

  let total = 0;
  let problemTotal = 0;
  let seen = '';
  let start = Date.now();
  let lastTrigger = '-';

  let targetPerHour = 28;
  let beforeBreak = 0;
  let selectedBreak = 1;

  let offRemain = 30 * 60 * 1000;
  let lastActivityTime = Date.now();
  let offLastTick = Date.now();

  let skipNextPack = false;

  let showRatePercent = false;
  let showLeftInsteadTotal = false;
  let autoStatusColor = false;
  let ignoreNLP = false;
  let autoLpnEnabled = true;

  let manualColor = '#0f1111';
  let miniOpacity = 100;
  let miniSize = 13;
  let miniPos = 'tl';

  let hourCounts = {};
  let problemCounts = {};

  let cooldownUntil = 0;
  let lastSave = 0;

  let scanTimer = null;
  let renderTimer = null;
  let lpnTimer = null;

  let box = null;

  function initCounts() {
    hours.forEach(h => {
      if (hourCounts[h] == null) hourCounts[h] = 0;
      if (problemCounts[h] == null) problemCounts[h] = 0;
    });
  }

  function loadState() {
    try {
      const s = JSON.parse(
        localStorage.getItem(SAVE_KEY) || '{}'
      );

      if (s.shift && s.shift !== shiftName) {
        initCounts();
        return;
      }

      start = Number(s.start) || Date.now();

      problemTotal = Math.max(
        0,
        parseInt(s.problemTotal) || 0
      );

      beforeBreak = Math.max(
        0,
        parseInt(s.beforeBreak) || 0
      );

      targetPerHour = Math.max(
        1,
        parseInt(s.targetPerHour) || 28
      );

      selectedBreak =
        s.selectedBreak !== undefined
          ? parseInt(s.selectedBreak)
          : 1;

      offRemain = Math.max(
        0,
        Number(s.offRemain) || 30 * 60 * 1000
      );

      showRatePercent = !!s.showRatePercent;
      showLeftInsteadTotal = !!s.showLeftInsteadTotal;
      autoStatusColor = !!s.autoStatusColor;
      ignoreNLP = !!s.ignoreNLP;
      autoLpnEnabled =
        s.autoLpnEnabled !== undefined
          ? !!s.autoLpnEnabled
          : true;

      manualColor = s.manualColor || '#0f1111';

      miniPos = s.miniPos || 'tl';

      miniOpacity = Math.min(
        100,
        Math.max(
          0,
          s.miniOpacity !== undefined
            ? parseInt(s.miniOpacity)
            : 100
        )
      );

      miniSize = Math.min(
        45,
        Math.max(
          10,
          parseInt(s.miniSize) || 13
        )
      );

      hourCounts = {};
      problemCounts = {};

      hours.forEach(h => {
        hourCounts[h] = Math.max(
          0,
          parseInt(
            s.hourCounts && s.hourCounts[h]
          ) || 0
        );

        problemCounts[h] = Math.max(
          0,
          parseInt(
            s.problemCounts && s.problemCounts[h]
          ) || 0
        );
      });

      lastTrigger = s.lastTrigger || 'ВІДНОВЛЕНО';
    } catch (_) {
      initCounts();
    }
  }

  function saveState(force = false) {
    const now = Date.now();

    if (!force && now - lastSave < 1500) {
      return;
    }

    lastSave = now;

    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          shift: shiftName,
          savedAt: now,
          start,
          problemTotal,
          beforeBreak,
          targetPerHour,
          selectedBreak,
          offRemain,
          showRatePercent,
          showLeftInsteadTotal,
          autoStatusColor,
          ignoreNLP,
          autoLpnEnabled,
          manualColor,
          miniOpacity,
          miniSize,
          miniPos,
          hourCounts,
          problemCounts,
          lastTrigger
        })
      );
    } catch (_) {}
  }

  function getBreakTimestamps() {
    if (selectedBreak === 0) {
      return { start: 0, end: 0 };
    }

    const times = night
      ? [
          { h: 23, m: 20 },
          { h: 23, m: 50 },
          { h: 0, m: 20 },
          { h: 0, m: 50 }
        ]
      : [
          { h: 11, m: 20 },
          { h: 11, m: 50 },
          { h: 12, m: 20 },
          { h: 12, m: 50 }
        ];

    const t = times[selectedBreak - 1];

    const d = new Date();
    d.setHours(t.h, t.m, 0, 0);

    if (night) {
      const ch = new Date().getHours();

      if (ch >= 17 && t.h < 12) {
        d.setDate(d.getDate() + 1);
      }

      if (ch < 12 && t.h >= 17) {
        d.setDate(d.getDate() - 1);
      }
    }

    const startTs = d.getTime();

    return {
      start: startTs,
      end: startTs + 30 * 60000
    };
  }

  function isBreakActive() {
    if (selectedBreak === 0) return false;

    const bt = getBreakTimestamps();
    const now = Date.now();

    return now >= bt.start && now < bt.end;
  }

  function getActiveHours() {
    let ms = Date.now() - start;

    if (selectedBreak > 0) {
      const bt = getBreakTimestamps();
      let overlap = 0;

      if (
        start < bt.end &&
        Date.now() > bt.start
      ) {
        const startOverlap =
          Math.max(start, bt.start);

        const endOverlap =
          Math.min(Date.now(), bt.end);

        overlap = Math.max(
          0,
          endOverlap - startOverlap
        );
      }

      ms -= overlap;
    }

    return ms > 0 ? ms / 3600000 : 0;
  }

  function hourlyTotal() {
    return hours.reduce(
      (sum, h) =>
        sum + (parseInt(hourCounts[h]) || 0),
      0
    );
  }

  function recalcTotal() {
    total =
      hourlyTotal() +
      (parseInt(beforeBreak) || 0);
  }

  function currentRate() {
    const h = getActiveHours();

    return h > 0
      ? hourlyTotal() / h
      : 0;
  }

  function shiftTarget() {
    return (
      targetPerHour * 10 +
      Math.round(targetPerHour / 2)
    );
  }

  function markActivity() {
    lastActivityTime = Date.now();
    offLastTick = Date.now();
  }

  function miniColor(rate) {
    if (!autoStatusColor) {
      return manualColor;
    }

    const pct =
      targetPerHour > 0
        ? rate / targetPerHour
        : 0;

    if (pct >= 1) return '#007600';
    if (pct >= 0.85) return '#e77600';

    return '#c40000';
  }

  function miniText() {
    const rate = currentRate();

    const left = Math.max(
      0,
      shiftTarget() - total
    );

    const main = showLeftInsteadTotal
      ? String(left)
      : String(total);

    const rateText = showRatePercent
      ? (
          targetPerHour > 0
            ? (rate / targetPerHour * 100)
                .toFixed(0)
            : '0'
        ) + '%/h'
      : rate.toFixed(2) + '/h';

    return `${main} | ${rateText}`;
  }

  function createMini() {
    if (box) return;

    box = document.createElement('div');

    box.setAttribute(
      'data-reit-counter',
      'mini'
    );

    box.style.cssText = `
      position: fixed;
      z-index: 999999;
      padding: 3px 7px;
      background: rgba(255,255,255,.85);
      border: 1px solid #dadce0;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
      font-family: ${NATIVE_FONT};
      font-size: ${miniSize}px;
      font-weight: 600;
      user-select: none;
      cursor: pointer;
      opacity: ${miniOpacity / 100};
      white-space: nowrap;
    `;

    applyMiniPosition();

    box.onclick = () => {
      const panel =
        document.getElementById('sh-panel');

      if (panel) {
        panel.classList.toggle('sh-open');
      }
    };

    document.body.appendChild(box);

    updateMini();
  }

  function applyMiniPosition() {
    if (!box) return;

    box.style.top = 'auto';
    box.style.bottom = 'auto';
    box.style.left = 'auto';
    box.style.right = 'auto';

    if (miniPos === 'bl') {
      box.style.bottom = '34px';
      box.style.left = '300px';
    }

    if (miniPos === 'br') {
      box.style.bottom = '34px';
      box.style.right = '360px';
    }

    if (miniPos === 'tl') {
      box.style.top = '10px';
      box.style.left = '300px';
    }

    if (miniPos === 'tr') {
      box.style.top = '10px';
      box.style.right = '360px';
    }
  }

  function updateMini() {
    if (!box) return;

    recalcTotal();

    box.textContent = miniText();
    box.style.color =
      miniColor(currentRate());

    box.style.fontSize =
      `${miniSize}px`;

    box.style.opacity =
      miniOpacity / 100;
  }

  function removeMini() {
    if (!box) return;

    box.remove();
    box = null;
  }

  function esc(s) {
    return s.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
  }

  function cnt(txt, what) {
    return (
      txt.match(
        new RegExp(esc(what), 'gi')
      ) || []
    ).length;
  }

  function timeNow() {
    return new Date().toLocaleTimeString(
      'en-GB',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }
    );
  }

  function minOf(h) {
    const a = h.split(':');

    return (
      +a[0] * 60 +
      +a[1]
    );
  }

  function getSlot() {
    const d = new Date();

    let mins =
      d.getHours() * 60 +
      d.getMinutes();

    let slots = hours.map(minOf);

    if (night && mins < 360) {
      mins += 1440;
    }

    if (night) {
      slots = slots.map(
        x => x < 360 ? x + 1440 : x
      );
    }

    for (
      let i = 0;
      i < slots.length;
      i++
    ) {
      if (mins <= slots[i]) {
        return hours[i];
      }
    }

    return hours[hours.length - 1];
  }

  function addPacks(n) {
    n = parseInt(n) || 0;

    if (n <= 0) return;

    loadState();

    const slot = getSlot();

    hourCounts[slot] += n;

    recalcTotal();

    lastTrigger =
      `ВРУЧНУ +${n} ${timeNow()}`;

    markActivity();

    saveState(true);
  }

  function addProblem(n) {
    n = parseInt(n) || 0;

    if (n <= 0) return;

    loadState();

    problemTotal += n;
    problemCounts[getSlot()] += n;

    lastTrigger =
      `ПРОБЛЕМА ${timeNow()}`;

    markActivity();

    saveState(true);
  }

  function removePack() {
    loadState();

    const slot = getSlot();

    if (hourlyTotal() <= 0) {
      return;
    }

    hourCounts[slot] =
      Math.max(
        0,
        hourCounts[slot] - 1
      );

    recalcTotal();

    lastTrigger =
      `ВРУЧНУ -1 ${timeNow()}`;

    saveState(true);
  }

  function scan() {
    if (!active) return;

    const txt =
      document.body.innerText || '';

    const m = cnt(
      txt,
      'Wprowadź pojemnik'
    );

    const p = cnt(
      seen,
      'Wprowadź pojemnik'
    );

    const pm = cnt(
      txt,
      'Zeskanuj - PROBLEM-SOLVE'
    );

    const pp = cnt(
      seen,
      'Zeskanuj - PROBLEM-SOLVE'
    );

    const nlpm = cnt(
      txt,
      'Zeskanuj nowy NLP'
    );

    const nlpp = cnt(
      seen,
      'Zeskanuj nowy NLP'
    );

    if (!ignoreNLP && nlpm > nlpp) {
      skipNextPack = true;

      lastTrigger =
        `NLP: ПРОПУСТИТИ НАСТУПНУ ${timeNow()}`;

      markActivity();
      saveState(true);
    }

    if (pm > pp) {
      addProblem(pm - pp);
    }

    else if (m > p) {
      let diff = m - p;

      if (skipNextPack) {
        diff--;
        skipNextPack = false;

        lastTrigger =
          `ПРОПУЩЕНО ПІСЛЯ NLP ${timeNow()}`;
      }

      if (diff > 0) {
        if (isBreakActive()) {
          lastTrigger =
            `ПЕРЕРВА - ІГНОРУЮ ${diff}`;

          markActivity();
          saveState(true);
        } else {
          addPacks(diff);
        }
      }
    }

    seen = txt;
  }

  function findLpnButton() {
    const selector =
      'button, a, div[role="button"]';

    return Array.from(
      document.querySelectorAll(selector)
    ).find(el => {
      if (
        el.disabled ||
        el.offsetParent === null ||
        !el.textContent
      ) {
        return false;
      }

      const text =
        el.textContent
          .toLowerCase()
          .replace(/\s+/g, ' ');

      return TARGET_TEXTS.some(
        target =>
          text.includes(target)
      );
    });
  }

  function checkInputAndTrigger() {
    if (
      !active ||
      !autoLpnEnabled
    ) {
      return;
    }

    const now = Date.now();

    if (now < cooldownUntil) {
      return;
    }

    const btn =
      findLpnButton();

    if (!btn) {
      cooldownUntil =
        now + 1500;

      return;
    }

    const inputs =
      document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([disabled])'
      );

    for (const input of inputs) {
      if (
        input.offsetParent === null
      ) {
        continue;
      }

      const cleanValue =
        input.value
          .replace(/[^\x20-\x7E]/g, '')
          .trim()
          .toLowerCase();

      if (!cleanValue) {
        continue;
      }

      cooldownUntil =
        now + 15000;

      if (
        !IGNORED_PREFIXES.has(
          cleanValue.charAt(0)
        )
      ) {
        btn.click();
      }

      break;
    }
  }

  function renderTick() {
    if (!active) return;

    const now = Date.now();

    recalcTotal();

    if (
      now - lastActivityTime >
      4 * 60 * 1000
    ) {
      offRemain -=
        now - offLastTick;

      if (offRemain < 0) {
        offRemain = 0;
      }
    }

    offLastTick = now;

    updateMini();
  }

  function startTimers() {
    stopTimers();

    scanTimer =
      setInterval(scan, 1000);

    renderTimer =
      setInterval(renderTick, 1000);

    lpnTimer =
      setInterval(
        checkInputAndTrigger,
        80
      );
  }

  function stopTimers() {
    if (scanTimer) {
      clearInterval(scanTimer);
      scanTimer = null;
    }

    if (renderTimer) {
      clearInterval(renderTimer);
      renderTimer = null;
    }

    if (lpnTimer) {
      clearInterval(lpnTimer);
      lpnTimer = null;
    }
  }

  function enable() {
    if (active) return;

    active = true;

    loadState();
    initCounts();

    createMini();
    startTimers();

    scan();
    renderTick();
  }

  function disable() {
    if (!active) return;

    active = false;

    stopTimers();
    saveState(true);

    removeMini();
  }

  function getSettings() {
    return {
      selectedBreak,
      miniPos,
      manualColor,
      miniSize,
      miniOpacity,
      targetPerHour,
      ignoreNLP,
      showRatePercent,
      showLeftInsteadTotal,
      autoStatusColor,
      autoLpnEnabled,
      beforeBreak,
      total,
      problemTotal,
      rate: currentRate()
    };
  }

  function updateSettings(settings) {
    if (!settings) return;

    if (
      settings.selectedBreak !== undefined
    ) {
      selectedBreak =
        parseInt(
          settings.selectedBreak
        ) || 0;
    }

    if (
      settings.miniPos !== undefined
    ) {
      miniPos = settings.miniPos;
    }

    if (
      settings.manualColor !== undefined
    ) {
      manualColor =
        settings.manualColor;
    }

    if (
      settings.miniSize !== undefined
    ) {
      miniSize =
        Math.min(
          45,
          Math.max(
            10,
            parseInt(
              settings.miniSize
            ) || 13
          )
        );
    }

    if (
      settings.miniOpacity !== undefined
    ) {
      miniOpacity =
        Math.min(
          100,
          Math.max(
            0,
            parseInt(
              settings.miniOpacity
            ) || 0
          )
        );
    }

    if (
      settings.targetPerHour !== undefined
    ) {
      targetPerHour =
        Math.max(
          1,
          parseInt(
            settings.targetPerHour
          ) || 28
        );
    }

    if (
      settings.ignoreNLP !== undefined
    ) {
      ignoreNLP =
        !!settings.ignoreNLP;
    }

    if (
      settings.showRatePercent !== undefined
    ) {
      showRatePercent =
        !!settings.showRatePercent;
    }

    if (
      settings.showLeftInsteadTotal !== undefined
    ) {
      showLeftInsteadTotal =
        !!settings.showLeftInsteadTotal;
    }

    if (
      settings.autoStatusColor !== undefined
    ) {
      autoStatusColor =
        !!settings.autoStatusColor;
    }

    if (
      settings.autoLpnEnabled !== undefined
    ) {
      autoLpnEnabled =
        !!settings.autoLpnEnabled;
    }

    saveState(true);

    if (box) {
      applyMiniPosition();
      updateMini();
    }
  }

  function resetOffTask() {
    offRemain =
      30 * 60 * 1000;

    lastActivityTime =
      Date.now();

    offLastTick =
      Date.now();

    saveState(true);
  }

  window.__cretCounter = {
    enable,
    disable,
    isActive: () => active,

    getSettings,
    updateSettings,

    getCount: () => {
      recalcTotal();
      return total;
    },

    getProblemCount: () =>
      problemTotal,

    getRate: () =>
      currentRate(),

    getHourCounts: () =>
      ({ ...hourCounts }),

    addPacks,
    removePack,
    addProblem,

    resetOffTask
  };

  window.addEventListener(
    'beforeunload',
    () => saveState(true)
  );

  loadState();
  initCounts();
})();
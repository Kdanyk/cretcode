// Зберігаємо код Tampermonkey глобально для кнопки копіювання
let tampermonkeyRawCode = "";

document.addEventListener("DOMContentLoaded", async () => {
  
  // --- Логіка перемикання вкладок Ostre ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Знімаємо активний клас з усіх кнопок та контенту
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      // Додаємо активний клас натиснутій кнопці та відповідному контенту
      button.classList.add('active');
      const tabId = button.getAttribute('data-tab');
      const targetContent = document.getElementById(tabId);
      if (targetContent) targetContent.classList.add('active');
    });
  });
  // ----------------------------------------

  // Функція для створення букмарклету
  function makeBookmarklet(rawCode) {
    let cleanCode = rawCode.replace(/\s+/g, ' ').trim();
    cleanCode = cleanCode.replace(/%/g, '%25').replace(/#/g, '%23').replace(/&/g, '%26').replace(/\+/g, '%2B');
    return "javascript:" + cleanCode;
  }

  try {
    // Асинхронно завантажуємо всі скрипти з папки scripts/
    const [cretRes, cdPlRes, cdUaRes, tmRes, ostreCretRes, ostreWhdRes, ostreRefarbRes] = await Promise.all([
      fetch('scripts/cret.js'),
      fetch('scripts/clean-decant-pl.js'),
      fetch('scripts/clean-decant-ua.js'),
      fetch('scripts/tampermonkey.js'),
      fetch('scripts/ostre-cret.js'),   // Скрипт для C-Ret
      fetch('scripts/ostre-whd.js'),    // Скрипт для WHD
      fetch('scripts/ostre-refarb.js')  // Скрипт для Refarb
    ]);

    // Отримуємо текст
    const cretRaw = await cretRes.text();
    const cdPlRaw = await cdPlRes.text();
    const cdUaRaw = await cdUaRes.text();
    const ostreCretRaw = await ostreCretRes.text();
    const ostreWhdRaw = await ostreWhdRes.text();
    const ostreRefarbRaw = await ostreRefarbRes.text();
    tampermonkeyRawCode = await tmRes.text(); // Зберігаємо для копіювання

    // Призначаємо букмарклети кнопкам C-Ret та Clean-Decant
    const btnCret = document.getElementById('cret-bookmark-btn');
    if(btnCret) { 
      btnCret.href = makeBookmarklet(cretRaw); 
      btnCret.textContent = "🔖 Przeciągnij do paska zakładek"; 
    }

    const btnCdPl = document.getElementById('cd-pl-bookmark-btn');
    if(btnCdPl) { 
      btnCdPl.href = makeBookmarklet(cdPlRaw); 
      btnCdPl.textContent = "🔖 Przeciągnij do paska (PL)"; 
    }

    const btnCdUa = document.getElementById('cd-ua-bookmark-btn');
    if(btnCdUa) { 
      btnCdUa.href = makeBookmarklet(cdUaRaw); 
      btnCdUa.textContent = "🔖 Перетягнути до закладок (UA)"; 
    }

    // Призначаємо букмарклети для кнопок вкладок Ostre
    const btnOstreCret = document.getElementById('ostre-cret-btn');
    if(btnOstreCret) { 
      btnOstreCret.href = makeBookmarklet(ostreCretRaw); 
      btnOstreCret.textContent = "🔖 Przeciągnij do paska (C-Ret)"; 
    }

    const btnOstreWhd = document.getElementById('ostre-whd-btn');
    if(btnOstreWhd) { 
      btnOstreWhd.href = makeBookmarklet(ostreWhdRaw); 
      btnOstreWhd.textContent = "🔖 Przeciągnij do paska (🪛WHD)"; 
    }

    const btnOstreRefarb = document.getElementById('ostre-refarb-btn');
    if(btnOstreRefarb) { 
      btnOstreRefarb.href = makeBookmarklet(ostreRefarbRaw); 
      btnOstreRefarb.textContent = "🔖 Przeciągnij do paska (🐦‍🔥Refarb)"; 
    }

  } catch (error) {
    console.error("Помилка завантаження скриптів:", error);
    alert("Не вдалося завантажити скрипти. Переконайтеся, що ви використовуєте локальний сервер.");
  }
});

// Функція копіювання коду Tampermonkey
window.copyTampermonkeyCode = function() {
  const status = document.getElementById('status');
  
  if (!tampermonkeyRawCode) {
    status.textContent = '❌ Код ще не завантажено.';
    return;
  }
  
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(tampermonkeyRawCode).then(() => {
      status.textContent = '✅ Skopiowano! Wklej w Tampermonkey (Ctrl+S).';
      setTimeout(() => { status.textContent = ''; }, 5000);
    }).catch(e => {
      fallbackCopyTextToClipboard(tampermonkeyRawCode, status);
    });
  } else {
    fallbackCopyTextToClipboard(tampermonkeyRawCode, status);
  }
};

function fallbackCopyTextToClipboard(text, status) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.top = "0";
  textArea.style.left = "0";
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand('copy');
    status.textContent = '✅ Skopiowano! Wklej w Tampermonkey (Ctrl+S).';
    setTimeout(() => { status.textContent = ''; }, 5000);
  } catch (err) {
    status.textContent = '❌ Błąd kopiowania. Zaznacz kod ręcznie.';
    setTimeout(() => { status.textContent = ''; }, 3000);
  }
  document.body.removeChild(textArea);
}

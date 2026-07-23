(() => {
    if (window.isolatedAutoContinueV1) return;
    window.isolatedAutoContinueV1 = true;

    const KEY = "isolatedAutoContinueSettings";
    let settings = JSON.parse(localStorage.getItem(KEY) || "{}");

    settings.delay = settings.delay || 1;
    settings.enabled = settings.enabled ?? true;

    let panel = document.createElement("div");
    panel.id = "iso_acPanel";
    panel.style.cssText = `
        position:fixed;
        top:20px;
        right:20px;
        width:220px;
        background:#111;
        color:#fff;
        padding:10px;
        border-radius:8px;
        font:13px Arial;
        z-index:2147483647; /* Максимальний пріоритет поверх інших скриптів */
        box-shadow:0 0 10px rgba(0,0,0,0.8);
    `;

    panel.innerHTML = `
        <b style="color:#3b82f6;">Auto Continue</b><br><br>

        Затримка (хв):
        <input id="iso_acDelay" type="number" min="0" value="${settings.delay}" style="width:60px; color:#000; padding:2px; border-radius:4px;"><br><br>

        <label style="cursor:pointer;">
            <input id="iso_acEnabled" type="checkbox" ${settings.enabled ? "checked" : ""}>
            Увімкнено
        </label>

        <hr style="border-color:#333; margin:10px 0;">

        <div id="iso_acStatus" style="font-weight:bold; color:#fbbf24;">Очікування...</div>

        <div style="margin-top:8px; font-size:10px; color:#888;">Сховати панель: <b>Alt + A</b></div>
    `;

    document.body.appendChild(panel);

    const status = panel.querySelector("#iso_acStatus");

    function save() {
        settings.delay = Number(panel.querySelector("#iso_acDelay").value);
        settings.enabled = panel.querySelector("#iso_acEnabled").checked;
        localStorage.setItem(KEY, JSON.stringify(settings));
    }

    panel.querySelector("#iso_acDelay").oninput = save;
    panel.querySelector("#iso_acEnabled").onchange = save;

    let running = false;
    let timer = null;

    function findTextNode(text) {
        return [...document.querySelectorAll("*")]
            .find(el => el.innerText && el.innerText.includes(text));
    }

    setInterval(() => {
        if (!settings.enabled) {
            status.innerHTML = "⏸ Вимкнено";
            running = false;
            return;
        }
        if (running) return;

        const textElement = findTextNode("Kontynuuj [Enter]");

        if (!textElement) {
            status.innerHTML = "Очікування тексту...";
            return;
        }

        running = true;
        let seconds = settings.delay * 60;

        timer = setInterval(() => {
            if (!settings.enabled) {
                clearInterval(timer);
                running = false;
                status.innerHTML = "⏸ Вимкнено";
                return;
            }

            status.innerHTML = `⏳ Клік через <span style="color:#ef4444;">${seconds} с</span>`;

            if (seconds <= 0) {
                clearInterval(timer);

                let button =
                    textElement.closest("div")?.querySelector("button,input[type=button],input[type=submit]") ||
                    document.querySelector("button,input[type=button],input[type=submit]");

                if (button) {
                    button.click();
                    status.innerHTML = "✅ Натиснуто";
                } else {
                    status.innerHTML = "❌ Кнопку не знайдено";
                }

                // Пауза перед наступним циклом пошуку
                setTimeout(() => { running = false; }, 3000);
            }
            seconds--;
        }, 1000);

    }, 1000);

    // Змінено комбінацію на Alt + A для уникнення конфліктів
    document.addEventListener("keydown", e => {
        if (e.altKey && (e.code === "KeyA" || e.key.toLowerCase() === "a")) {
            panel.style.display = panel.style.display === "none" ? "block" : "none";
        }
    });

})();

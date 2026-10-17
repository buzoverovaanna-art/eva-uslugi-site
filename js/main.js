(function () {
    /* ==== Появление блоков при скролле ==== */
    var revealElements = document.querySelectorAll(".reveal");

    function revealCheck() {
        revealElements.forEach(function (el) {
            var rect = el.getBoundingClientRect();
            if (rect.top < window.innerHeight - 60) {
                el.classList.add("visible");
            }
        });
    }

    if (revealElements.length) {
        revealCheck();
        window.addEventListener("scroll", revealCheck, { passive: true });
    }

    /* ==== Плашка про cookie ====
       Показываем, пока посетитель не нажал «Понятно».
       Если браузер не даёт запомнить ответ — плашка просто
       покажется снова, сайт от этого не ломается. */
    var cookie = document.getElementById("cookie");
    if (cookie) {
        var KLYUCH = "cookie-ok";
        var uzheVidela = false;
        try { uzheVidela = localStorage.getItem(KLYUCH) === "1"; } catch (e) {}
        if (!uzheVidela) cookie.hidden = false;
        document.getElementById("cookie-ok").addEventListener("click", function () {
            cookie.hidden = true;
            try { localStorage.setItem(KLYUCH, "1"); } catch (e) {}
        });
    }

    /* ==== Цели Яндекс Метрики ====
       Отмечаем важные действия посетителя: переход в Telegram
       или MAX и успешную отправку заявки.
       Идентификаторы (telegram, max, zayavka) должны совпадать
       с целями типа «Целевое событие» в Метрике.
       Клик по телефону Метрика ловит сама — цель «Клик по номеру
       телефона», код для неё не нужен. */
    var METRIKA_ID = 113657439; // номер счётчика Метрики сайта услуг (ещё и в index.html)

    function cel(nazvanie) {
        if (METRIKA_ID && typeof window.ym === "function") {
            window.ym(METRIKA_ID, "reachGoal", nazvanie);
        }
    }

    document.addEventListener("click", function (e) {
        var link = e.target.closest ? e.target.closest("a[href]") : null;
        if (!link) return;
        var href = link.getAttribute("href");
        if (href.indexOf("t.me/") !== -1) cel("telegram");
        else if (href.indexOf("max.ru/") !== -1) cel("max");
        else if (href.indexOf("wa.me/") !== -1) cel("whatsapp");
    });

    /* ==== Отправка заявки ==== */
    var form = document.getElementById("zayavka-form");
    if (!form) return;

    /* Адрес скрипта Google, который принимает заявки:
       пишет строку в таблицу и присылает сообщение в Telegram.
       Если строку очистить — форма вернётся к запасному пути
       и будет открывать Telegram с готовым текстом. */
    var WEBAPP_URL = "https://script.google.com/macros/s/AKfycbwGit4dua7OS0McSGK-kIafPsNeOs6aexvMZm1MAyynRi4V335aa2WVgv3RTVUcYNr39g/exec";

    /* Запасной путь, если скрипт не отвечает */
    var TELEGRAM = "https://t.me/Annet_Shine";

    var button = form.querySelector('button[type="submit"]');
    var status = document.getElementById("form-status");
    var pole = form.querySelector('[name="contact"]');

    /* ================================================================
       УМНАЯ МАСКА ТЕЛЕФОНА

       Поле называется «телефон или мессенджер», поэтому маска
       не навязывается: она включается, только если человек начал
       с цифры или плюса. Начал с буквы, собаки или пробела —
       поле остаётся обычным, свободным.
       ================================================================ */

    var rezhim = "net";        // "net" | "telefon" | "svobodno"
    var podskazka = false;     // мы сами подставили «+7 », цифр ещё нет

    function tolkoCifry(text) {
        return String(text).replace(/\D/g, "");
    }

    /* Приводим любой ввод к виду 7XXXXXXXXXX.
       Возвращаем ещё и признак: пришлось ли дописать семёрку спереди —
       без него каретка будет прыгать. */
    function normalizovat(cifry) {
        var dobavili = false;

        if (!cifry) return { cifry: "", dobavili: false };

        if (cifry.charAt(0) === "8") {
            cifry = "7" + cifry.slice(1);          // 8 999… -> 7 999…
        } else if (cifry.charAt(0) !== "7") {
            cifry = "7" + cifry;                   // 999… -> 7 999…
            dobavili = true;
        }

        return { cifry: cifry.slice(0, 11), dobavili: dobavili };
    }

    /* 7 999 123 45 67  ->  +7 999 123-45-67 */
    function oformit(cifry) {
        var n = cifry.slice(1);
        if (!n) return "+7 ";

        var out = "+7 " + n.slice(0, 3);
        if (n.length > 3) out += " " + n.slice(3, 6);
        if (n.length > 6) out += "-" + n.slice(6, 8);
        if (n.length > 8) out += "-" + n.slice(8, 10);
        return out;
    }

    /* Сколько цифр слева от каретки */
    function cifrSleva(text, poz) {
        return tolkoCifry(text.slice(0, poz)).length;
    }

    /* Куда поставить каретку, чтобы слева от неё было столько же цифр */
    function karetkaPosle(text, skolko) {
        if (skolko <= 0) return text.length;
        var n = 0;
        for (var i = 0; i < text.length; i++) {
            if (text.charAt(i) >= "0" && text.charAt(i) <= "9") {
                n++;
                if (n === skolko) return i + 1;
            }
        }
        return text.length;
    }

    function obrabotatVvod(tipDeystviya) {
        var znach = pole.value;
        var udalenie = tipDeystviya && tipDeystviya.indexOf("delete") === 0;

        /* Поле опустело — начинаем с чистого листа */
        if (znach === "") {
            rezhim = "net";
            podskazka = false;
            return;
        }

        /* Режим определяем по первому символу — и больше не пересматриваем,
           пока поле не очистят */
        if (rezhim === "net") {
            var pervyy = znach.charAt(0);
            rezhim = (pervyy === "+" || (pervyy >= "0" && pervyy <= "9"))
                ? "telefon"
                : "svobodno";
        }

        if (rezhim === "svobodno") return;

        /* В телефон затесались буквы или собака — значит, человек передумал
           и пишет ник. Отдаём поле ему и убираем нашу подсказку «+7 ». */
        if (/[^\d\s+\-()]/.test(znach)) {
            rezhim = "svobodno";
            if (podskazka) {
                pole.value = znach.replace(/^\+7\s*/, "");
                podskazka = false;
            }
            return;
        }

        var poz = pole.selectionStart;
        var sleva = cifrSleva(znach, poz);
        var cifry = tolkoCifry(znach);

        /* Напечатан только «+» — цифр ещё нет, ничего не навязываем */
        if (!cifry) {
            podskazka = true;
            return;
        }

        /* Backspace дошёл до «+7» — не залипаем, очищаем поле целиком */
        if (udalenie && cifry.replace(/^7/, "") === "") {
            pole.value = "";
            rezhim = "net";
            podskazka = false;
            return;
        }

        /* Стоит наша подсказка «+7 », а человек по привычке набирает номер
           целиком — 8 999… или 7 999…. Убираем свою семёрку, иначе выйдет
           «+7 899…». */
        if (podskazka && cifry.length > 1) {
            cifry = cifry.slice(1);
            sleva -= 1;
        }

        var norm = normalizovat(cifry);
        if (norm.dobavili) sleva += 1;

        var novoe = oformit(norm.cifry);
        pole.value = novoe;
        podskazka = (norm.cifry.length <= 1);

        try {
            pole.setSelectionRange(karetkaPosle(novoe, sleva), karetkaPosle(novoe, sleva));
        } catch (err) { /* некоторые браузеры не дают — не страшно */ }
    }

    if (pole) {
        /* Кликнули в пустое поле — сразу показываем «+7 » */
        pole.addEventListener("focus", function () {
            if (pole.value === "") {
                pole.value = "+7 ";
                rezhim = "telefon";
                podskazka = true;
                try { pole.setSelectionRange(3, 3); } catch (err) {}
            }
        });

        /* Ушли из поля, ничего не введя — убираем «+7 », чтобы вернулась
           подсказка-placeholder и поле не считалось заполненным */
        pole.addEventListener("blur", function () {
            if (podskazka || pole.value.trim() === "+7") {
                pole.value = "";
                rezhim = "net";
                podskazka = false;
            }
        });

        pole.addEventListener("input", function (e) {
            snyatOshibku();
            obrabotatVvod(e && e.inputType);
        });
    }

    /* Номер введён не до конца? */
    function nomerNepolnyy() {
        if (!pole) return false;
        var znach = pole.value.trim();
        if (!znach) return false;

        var pervyy = znach.charAt(0);
        var etoTelefon = (pervyy === "+" || (pervyy >= "0" && pervyy <= "9"));
        if (!etoTelefon) return false;          // ник — не наше дело

        return tolkoCifry(znach).length !== 11;
    }

    function pokazatOshibku(text) {
        if (pole) pole.classList.add("pole-oshibka");
        pokazat(text, "err");
        if (pole) pole.focus();
    }

    function snyatOshibku() {
        if (pole) pole.classList.remove("pole-oshibka");
    }


    function pokazat(text, klass) {
        if (!status) return;
        status.textContent = text;
        status.className = "form-status" + (klass ? " " + klass : "");
    }

    /* Откуда пришла заявка. Берём метку utm_source из ссылки
       (Яндекс Карты, Google Карты), если её нет — адрес сайта,
       с которого перешли (поиск Яндекса или Google). Запоминаем
       на время визита, чтобы источник не терялся при переходе
       между страницами. */
    function istochnik() {
        var KLYUCH = "istochnik";
        var zapomneno = "";
        try { zapomneno = sessionStorage.getItem(KLYUCH) || ""; } catch (e) {}
        if (zapomneno) return zapomneno;

        var nazvaniya = { yandex: "Яндекс", google: "Google", "2gis": "2ГИС", vk: "ВК", telegram: "Telegram" };
        var params = new URLSearchParams(location.search);
        var utm = (params.get("utm_source") || "").toLowerCase();
        var itog = "";

        if (utm) {
            itog = nazvaniya[utm] || utm;
            var kanal = params.get("utm_medium");
            if (kanal === "maps") itog += " Карты";
            else if (kanal) itog += " (" + kanal + ")";
        } else {
            var host = "";
            try { host = new URL(document.referrer).hostname; } catch (e) {}
            if (/yandex|ya\.ru/.test(host)) itog = "Яндекс (поиск)";
            else if (/google/.test(host)) itog = "Google (поиск)";
            else if (/vk\.com/.test(host)) itog = "ВК";
            else if (/t\.me|telegram/.test(host)) itog = "Telegram";
            else if (host) itog = host;
            else itog = "не определён";
        }

        try { sessionStorage.setItem(KLYUCH, itog); } catch (e) {}
        return itog;
    }
    istochnik();

    /* На странице онлайн-курса в форме есть скрытое поле kurs —
       его название встаёт в начало комментария, чтобы в таблице
       и в Telegram было видно, на какой курс заявка. */
    function sobratZayavku() {
        var usluga = form.querySelector('[name="usluga"]');
        var comment = form.querySelector('[name="comment"]').value.trim();
        if (usluga) comment = "[" + usluga.value + "] " + comment;
        comment = "[Услуги] " + comment;
        comment = "[Источник: " + istochnik() + "] " + comment;
        return {
            name: form.querySelector('[name="name"]').value.trim(),
            contact: form.querySelector('[name="contact"]').value.trim(),
            comment: comment.trim()
        };
    }

    function tekstDlyaTelegrama(z) {
        return "Здравствуйте! Хочу записаться на маникюр.\n\n" +
            "Имя: " + z.name + "\n" +
            "Связь: " + z.contact + "\n" +
            (z.comment ? "Комментарий: " + z.comment + "\n" : "") +
            "\nОтправлено с сайта";
    }

    function otkrytTelegram(z) {
        cel("telegram");
        window.open(TELEGRAM + "?text=" + encodeURIComponent(tekstDlyaTelegrama(z)), "_blank");
    }

    form.addEventListener("submit", function (e) {
        e.preventDefault();

        /* Номер начат, но не закончен — вежливо просим дописать */
        if (nomerNepolnyy()) {
            pokazatOshibku("Кажется, номер введён не полностью. Допишите его — или напишите ник в мессенджере.");
            return;
        }
        snyatOshibku();

        var zayavka = sobratZayavku();

        /* Скрипт ещё не подключён — старый путь через Telegram */
        if (!WEBAPP_URL) {
            otkrytTelegram(zayavka);
            pokazat("Открыла Telegram — осталось нажать «Отправить» в переписке.");
            return;
        }

        if (button) {
            button.disabled = true;
            button.dataset.label = button.textContent;
            button.textContent = "Отправляю…";
        }
        pokazat("Отправляю заявку…");

        /* Content-Type специально не ставим: браузер поставит text/plain,
           и запрос уйдёт без предварительной проверки — иначе скрипт Google
           его отклонит. */
        fetch(WEBAPP_URL, {
            method: "POST",
            body: JSON.stringify(zayavka)
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (!data || !data.ok) throw new Error("Скрипт вернул отказ");
                cel("zayavka");
                form.reset();
                rezhim = "net";
                podskazka = false;
                snyatOshibku();
                pokazat("Спасибо! Заявка отправлена — я свяжусь с вами лично.", "ok");
            })
            .catch(function () {
                pokazat("Не получилось отправить автоматически. Открываю Telegram — там нужно нажать «Отправить».", "err");
                otkrytTelegram(zayavka);
            })
            .then(function () {
                if (button) {
                    button.disabled = false;
                    button.textContent = button.dataset.label || "Отправить";
                }
            });
    });
})();

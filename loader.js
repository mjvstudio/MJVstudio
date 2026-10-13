/* =====================================================================
   CARGADOR DE LA PORTADA — MJV Studio

   Qué hace
   - Tapa la portada con la casita (el primer cuadro del logo) girando en saltos de 90° igual que la animación del logo, justo donde va a quedar
     el logo. No muestra texto ni porcentaje.
   - El avance sigue siendo REAL: se espera a que se descargue lo que la portada necesita (las
     fuentes, el logo animado del idioma, las fotos de los proyectos y del equipo y el aviso de
     "página cargada").
   - Al llegar a 100 % la casita sigue girando (saltos de 90°) hasta quedar derecha. Ahí el
     fondo se desvanece y, a la vez, arranca la animación del logo de la portada (aviso
     "mjvloaderdone", lo recibe logo-replay.js): la casita se transforma en el logo y aparece el
     texto. La casita de relleno de la portada ya está debajo, en el mismo lugar, así que no hay salto.
   - El cargador de los modelos 3D de los proyectos es otro: model-loader.js.

   Se salta (sin cargador) cuando:
   - se entra por index.html#architecture (volviendo desde un proyecto abierto en su propia pestaña),
   - la portada está dentro de otro marco (iframe).

   Qué se puede ajustar (constantes de abajo)
     MIN_MS    tiempo mínimo que se ve el cargador, aunque todo ya estuviera en memoria
     MAX_MS    tiempo máximo: si algo tarda más (o falla), se sigue igual
     STEP_MS   lo que dura cada cuadro del giro (saltos de 90°); igual que en el SVG del logo
     EXIT_MS   duración del desvanecido final; tiene que ser igual a --ml-exit en styles.css

   Lo que expone
     window.mjvLoader = { active, texts }
        active  true mientras el cargador está en pantalla
        texts   copia en memoria de los logos descargados (logo-replay.js la reutiliza)
     evento 'mjvloaderdone' (document): el cargador ya casi terminó de irse
   ===================================================================== */
(function () {
    'use strict';

    var MIN_MS = 1500;
    var MAX_MS = 12000;
    var EXIT_MS = 450;
    var STEP_MS = 500;             // lo que dura cada cuadro del giro (igual que la animación del logo: 4,65 s × 10,75 %)
    var DONE_AT = 0.02;             // el aviso "mjvloaderdone" sale cuando el desvanecido va en ese punto (0 a 1)

    var root = document.getElementById('mjv-loader');
    var state = window.mjvLoader = { active: false, texts: {} };
    if (!root) return;

    // ---- ¿corresponde mostrarlo? ----
    var skip = false;
    try { skip = window.self !== window.top; } catch (e) { skip = true; }
    if (/(^|#)architecture\b/.test(location.hash)) skip = true;
    if (skip) { root.parentNode.removeChild(root); return; }

    state.active = true;

    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduced) { MIN_MS = 500; EXIT_MS = 350; }

    var casita = root.querySelector('.ml-casita');
    var lang = 'es';
    try { var saved = localStorage.getItem('mjv-lang'); if (/^(es|en|fr|pt)$/.test(saved)) lang = saved; } catch (e) {}
    var LABELS = { es: 'Cargando', en: 'Loading', fr: 'Chargement', pt: 'Carregando' };
    root.setAttribute('aria-label', LABELS[lang]);
    function paint(n) { root.setAttribute('aria-valuenow', String(n)); }
    paint(0);
    root.style.setProperty('--ml-exit', EXIT_MS + 'ms');

    // Mientras carga, la casita va en el CENTRO de la pantalla (mismo tamaño que tendrá en el logo). Cuando termina de
    // cargar, se desliza hasta su lugar en el logo de la portada (justo encima de la casita de relleno) y recién ahí
    // se desvanece el fondo: no hay salto.
    var phase = 'center';              // 'center' = cargando; 'glide' = yendo a su lugar en el logo
    function place() {
        var ref = document.querySelector('.logo-casita');
        if (!ref || !casita) return;
        var r = ref.getBoundingClientRect();
        if (!r.width) return;
        casita.classList.add('is-placed');
        casita.style.width = r.width + 'px';
        if (phase === 'glide') {
            casita.style.left = r.left + 'px';
            casita.style.top = r.top + 'px';
            return;
        }
        var h = r.height || r.width * 720 / 1280;
        casita.style.left = Math.round((window.innerWidth - r.width) / 2) + 'px';
        casita.style.top = Math.round((window.innerHeight - h) / 2) + 'px';
    }
    place();
    window.addEventListener('resize', place);
    document.addEventListener('DOMContentLoaded', place);
    var GLIDE_MS = 520;
    var exiting = false;
    function exit() {                  // lleva la casita a su lugar y después sale
        if (exiting || left) return;
        exiting = true;
        clearTimeout(stepTimer);
        if (!casita || !casita.classList.contains('is-placed')) { leave(); return; }
        if (angle !== 0 && casita) { casita.style.rotate = '0deg'; angle = 0; }
        casita.style.transition = 'left ' + GLIDE_MS + 'ms cubic-bezier(.65,0,.2,1), top ' + GLIDE_MS + 'ms cubic-bezier(.65,0,.2,1)';
        phase = 'glide';
        place();
        setTimeout(leave, reduced ? 0 : GLIDE_MS + 40);
    }

    // Giro EN SALTOS DE 90°, igual que en la animación del logo (assets/mjv-logo-xx.svg): cada cuadro dura
    // STEP_MS (0,5 s) y la casita avanza un cuarto de vuelta hacia la derecha. Derecha (0°) = la posición del logo.
    var left = false;
    var angle = 0, stepTimer = 0, ready = false, stepAt = performance.now();
    function step() {
        angle = (angle + 90) % 360;
        stepAt = performance.now();
        if (casita) casita.style.rotate = angle + 'deg';
        if (angle === 0 && ready) { exit(); return; }          // volvió a la posición del logo: ahí sigue el logo animado
        stepTimer = setTimeout(step, STEP_MS);
    }
    if (!reduced) stepTimer = setTimeout(step, STEP_MS);

    // ---- qué se espera, y cuánto pesa cada cosa en el porcentaje ----
    var doneW = 0, totalW = 0;
    var started = Date.now();

    function track(weight) {          // devuelve la función que hay que llamar al terminar
        totalW += weight;
        var finished = false;
        return function () { if (!finished) { finished = true; doneW += weight; } };
    }

    // 1) fuentes
    (function () {
        var done = track(1);
        try {
            if (document.fonts && document.fonts.load) {
                Promise.all([document.fonts.load('1em titulos'), document.fonts.load('1em texto')])
                    .then(function () { return document.fonts.ready; })
                    .then(done, done);
            } else done();
        } catch (e) { done(); }
    })();

    // 2) el logo animado del idioma (es lo más pesado: se guarda una copia para logo-replay.js)
    (function () {
        var done = track(3);
        var file = 'assets/mjv-logo-' + lang + '.svg';
        try {
            fetch(file).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
                .then(function (t) { state.texts[file] = t; done(); }, done);
        } catch (e) { done(); }
    })();

    // 3) la página ya armada (DOM) y 4) todo cargado (evento "load")
    var doneDom = track(1);
    var doneLoad = track(2);
    if (document.readyState !== 'loading') domReady(); else document.addEventListener('DOMContentLoaded', domReady);
    if (document.readyState === 'complete') doneLoad(); else window.addEventListener('load', doneLoad);

    function domReady() {
        doneDom();
        // Mientras está el cargador, lo de abajo no responde a teclado, rueda ni toques
        Array.prototype.forEach.call(document.querySelectorAll('.swiper-container, .utility-buttons'), function (el) {
            try { el.inert = true; } catch (e) {}
        });
        // 5) las fotos que la portada ya pide (proyectos, equipo, íconos)
        Array.prototype.forEach.call(document.images, function (img) {
            var done = track(1);
            if (img.complete) { done(); return; }
            img.addEventListener('load', done);
            img.addEventListener('error', done);
        });
    }

    // Bloquea las flechas y demás teclas de Swiper mientras el cargador está a la vista
    function blockKeys(e) { e.stopPropagation(); }
    document.addEventListener('keydown', blockKeys, true);

    // ---- progreso mostrado: suavizado, sin retrocesos y sin pasar de lo real ni del tiempo mínimo ----
    var shown = 0;
    var last = performance.now();
    var leaving = false;
    var maxReal = 0;

    function target(now) {
        var real = totalW ? doneW / totalW : 0;
        if (Date.now() - started >= MAX_MS) real = 1;               // tope: se sigue igual
        maxReal = Math.max(maxReal, real);
        var byTime = Math.min(1, (Date.now() - started) / MIN_MS);  // el tiempo mínimo también "frena" el avance
        return Math.min(maxReal, byTime) * 100;
    }

    function tick(now) {
        if (leaving) return;
        place();
        var dt = Math.min(100, now - last); last = now;
        var t = target(now);
        if (t > shown) shown += Math.max((t - shown) * (1 - Math.exp(-dt / 140)), dt * 0.012);
        if (shown > t) shown = t;
        var n = Math.min(100, Math.floor(shown + 0.0001));
        if (t >= 100 && shown >= 99.4) { shown = 100; n = 100; }
        paint(n);
        if (n >= 100) { leaving = true; finishSpin(); return; }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // Si la pestaña está en segundo plano el navegador pausa las animaciones: este reloj sigue igual
    setTimeout(function () { if (!leaving) { leaving = true; paint(100); finishSpin(); } }, MAX_MS + 1500);

    // Al 100 %: la casita sigue girando hasta quedar en la posición del logo (0°) y recién ahí se sale
    function finishSpin() {
        ready = true;
        if (reduced) { exit(); return; }
        if (angle === 0 && performance.now() - stepAt < 150) { exit(); return; }   // justo acaba de llegar
        setTimeout(function () { exit(); }, STEP_MS * 5 + 400);   // red de seguridad (pestaña en segundo plano)
    }

    // ---- salida ----
    function leave() {
        if (left) return;
        left = true;
        document.removeEventListener('keydown', blockKeys, true);
        Array.prototype.forEach.call(document.querySelectorAll('.swiper-container, .utility-buttons'), function (el) {
            try { el.inert = false; } catch (e) {}
        });
        root.classList.add('is-leaving');
        setTimeout(function () {
            state.active = false;
            document.dispatchEvent(new CustomEvent('mjvloaderdone'));
        }, Math.round(EXIT_MS * DONE_AT));
        setTimeout(function () {
            if (root.parentNode) root.parentNode.removeChild(root);
        }, EXIT_MS + 80);
    }
})();

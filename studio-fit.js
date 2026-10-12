/* =====================================================================
   SECCIÓN ESTUDIO: AJUSTE DEL MOSAICO Y DEL TEXTO — MJV Studio

   Qué hace
   - Las tarjetas del equipo son CUADRADAS o VERTICALES (nunca horizontales: las fotos de las
     personas son retratos y si no quedan recortadas).
   - El texto nunca lleva barra de desplazamiento: se lee completo siempre. Para eso, el ANCHO del
     panel de texto se agranda y el mosaico de fotos se angosta en sentido horizontal (las tarjetas
     pasan de cuadradas a más verticales) hasta que el texto más largo entra entero. Si ni con el
     mosaico más angosto alcanza, recién ahí se achica un poco la letra.
   - El ancho se calcula con el texto MÁS LARGO de todos (Estudio, Majo, Martín, Gonza y María,
     en el idioma actual), así al pasar el mouse de una tarjeta a otra el mosaico NO se mueve.
   - En pantallas verticales (celular): el mosaico queda arriba y el texto abajo; lo que se
     angosta es el mosaico (y con él su alto) para dejarle más lugar al texto.

   Se recalcula al cargar, al cambiar el tamaño de la ventana, al cambiar el idioma y al
   terminar de cargar las fuentes. Los cambios de ancho se animan.

   Qué se puede ajustar (constantes de abajo)
     MIN_FRAC   cuánto se puede angostar el mosaico (1 = cuadradas; 0,55 = bien verticales); MIN_FRAC_PORTRAIT: lo mismo en celular
     FONT_STEPS tamaños de letra que se prueban (en rem), del normal al más chico
     MIN_TEXT_W ancho mínimo del texto en pantallas horizontales (px)
   ===================================================================== */
(function () {
    'use strict';

    var MIN_FRAC = 0.35;           // pantallas horizontales
    var MIN_FRAC_PORTRAIT = 0.5;   // celulares (el mosaico se puede angostar más)
    var FONT_STEPS = [0.9, 0.85, 0.8, 0.76, 0.72];
    var MIN_TEXT_W = 240;
    var GAP = 20;                  // separación entre mosaico y texto (= "gap" de .studio-container)

    var box = document.querySelector('.studio-container');
    var grid = box && box.querySelector('.team-grid');
    var panel = box && box.querySelector('.info-panel');
    var textEl = document.getElementById('info-panel-text');
    var more = document.getElementById('more-link');
    if (!box || !grid || !panel || !textEl) return;

    var texts = [];                // los textos de todos los miembros (idioma actual)
    var firstFit = true;
    var members = Array.prototype.map.call(document.querySelectorAll('.team-card'), function (c) { return c.dataset.member; });

    function suffix() { return window.mjvLang ? window.mjvLang.suffix() : ''; }

    function loadTexts() {
        var sfx = suffix();
        return Promise.all(members.map(function (m) {
            return fetch('team/' + m + sfx + '.txt').then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; });
        })).then(function (all) {
            if (sfx !== suffix()) return;                     // cambió el idioma mientras tanto
            texts = all.filter(Boolean);
        });
    }

    // Caja invisible para medir cuánto ocupa cada texto con el ancho y la letra actuales del panel
    var probe = document.createElement('div');
    probe.className = 'info-panel-text info-probe';
    probe.setAttribute('aria-hidden', 'true');
    panel.appendChild(probe);

    function isPortrait() { return getComputedStyle(box).flexDirection === 'column'; }

    // ¿Entran todos los textos sin barra?
    function fits() {
        var cs = getComputedStyle(textEl);
        probe.style.width = (textEl.getBoundingClientRect().width - 1) + 'px';   // 1 px menos: las fracciones de píxel pueden sumar una línea
        // alto disponible para el texto = el del panel menos el padding y la fila de "more"
        var pcs = getComputedStyle(panel);
        var avail = panel.clientHeight - parseFloat(pcs.paddingTop) - parseFloat(pcs.paddingBottom)
                  - (more ? more.offsetHeight + parseFloat(getComputedStyle(more).marginTop) : 0);
        var list = texts.length ? texts : [textEl.textContent];
        for (var i = 0; i < list.length; i++) {
            probe.textContent = list[i];
            if (probe.scrollHeight > avail - 4) return false;      // 4 px de margen
        }
        return true;
    }

    function setW(px) { box.style.setProperty('--team-w', Math.round(px) + 'px'); }

    // proporción (ancho / alto) de la foto del Estudio: el recuadro la respeta, así no se recorta nada
    var estImg = grid.querySelector('.card-estudio img');
    // Se toma SOLO de la foto principal (la primera): las que rotan al pasar el mouse se ajustan al recuadro (cover) y
    // la distribución de la sección no cambia nunca.
    var estSrc = estImg ? estImg.getAttribute('src') : '';
    var estR = 0;
    function estRatio() {
        if (!estR && estImg && estImg.getAttribute('src') === estSrc && estImg.naturalWidth && estImg.naturalHeight) estR = estImg.naturalWidth / estImg.naturalHeight;
        return estR || 0.68;
    }
    var SG = 10;                   // separación entre tarjetas (= "gap" de .team-grid)
    // Geometría del mosaico para un alto H: foto del Estudio con su proporción + columna del equipo (4 tarjetas;
    // cuadradas con colFrac = 1, más verticales con colFrac < 1)
    function geom(H, colFrac) {
        var est = estRatio() * H, col = ((H - 3 * SG) / 4) * colFrac, total = est + SG + col;
        grid.style.setProperty('--est-w', est.toFixed(1) + 'px');
        grid.style.setProperty('--col-w', col.toFixed(1) + 'px');
        setW(total);
        return total;
    }
    function setLayout(colFrac, pw, H) { var t = geom(H, colFrac); box.style.setProperty('--studio-w', Math.round(t + GAP + pw) + 'px'); }

    function fit() {
        box.classList.add('is-fitting');                      // sin animación mientras se mide
        var portrait = isPortrait();
        var bh = box.clientHeight, bw, found = false, f, k, a, b, mid;
        box.style.removeProperty('--studio-w');
        bw = box.clientWidth;                                  // ancho máximo = el de la galería (65 vw)
        if (!portrait) {
            box.style.removeProperty('--team-h');
            var tot1 = geom(bh, 1);
            var cf = 1;
            if (tot1 > bw - GAP - MIN_TEXT_W) cf = Math.max(0.3, (bw - GAP - MIN_TEXT_W - (tot1 - ((bh - 3 * SG) / 4)) ) / ((bh - 3 * SG) / 4));
            for (f = 0; f < FONT_STEPS.length && !found; f++) {
                box.style.setProperty('--info-fs', FONT_STEPS[f] + 'rem');
                var tot = geom(bh, cf), pwMax = bw - GAP - tot;
                setLayout(cf, pwMax, bh);
                if (fits()) {
                    // todo el mosaico cabe: se angosta el TEXTO (y con él toda la sección) hasta que el texto más largo
                    // llena el recuadro, sin pasar del ancho de la galería
                    a = MIN_TEXT_W; b = pwMax;
                    setLayout(cf, a, bh);
                    if (fits()) b = a;
                    else for (k = 0; k < 10; k++) { mid = (a + b) / 2; setLayout(cf, mid, bh); if (fits()) b = mid; else a = mid; }
                    setLayout(cf, b, bh);
                    found = true; break;
                }
                // ni con todo el ancho: se angosta la columna del equipo (tarjetas más verticales)
                var lo = cf * MIN_FRAC;
                setLayout(lo, bw - GAP - geom(bh, lo), bh);
                if (!fits()) continue;
                a = lo; b = cf;
                for (k = 0; k < 9; k++) { mid = (a + b) / 2; setLayout(mid, bw - GAP - geom(bh, mid), bh); if (fits()) a = mid; else b = mid; }
                setLayout(a, bw - GAP - geom(bh, a), bh);
                found = true;
            }
            if (!found) { box.style.setProperty('--info-fs', FONT_STEPS[FONT_STEPS.length - 1] + 'rem'); var l2 = MIN_FRAC; setLayout(l2, bw - GAP - geom(bh, l2), bh); }
        } else {
            // En vertical (celular) el mosaico va arriba, GRANDE (todo el ancho disponible, hasta ~60 % del alto), y el
            // texto queda abajo, en su propio recuadro, como el texto de los proyectos. Si el texto es largo, se
            // desplaza dentro de ese recuadro (en vez de achicar las fotos).
            var r = estRatio();
            var Hmax = Math.min(bh - GAP - 120, (bw - SG + 0.75 * SG) / (r + 0.25));
            var H = Math.max(120, Math.min(Hmax, bh * 0.6 - GAP));
            box.style.setProperty('--team-h', Math.round(H) + 'px');
            geom(H, 1);
            box.style.setProperty('--info-fs', '0.9rem');
            found = fits();
            if (!found) {
                // se prueba con letra un poco más chica antes de dejar el desplazamiento
                for (f = 0; f < FONT_STEPS.length && !found; f++) {
                    box.style.setProperty('--info-fs', FONT_STEPS[f] + 'rem');
                    found = fits();
                }
                if (!found) box.style.setProperty('--info-fs', '0.85rem');
            }
        }
        box.classList.toggle('studio-scroll', !found);
        textEl.classList.toggle('swiper-no-swiping', !found);   // si el texto se desplaza, el dedo lo mueve a él y no cambia de sección       // último recurso: si de verdad no entra, vuelve la barra (finita)
        void box.offsetWidth;
        if (firstFit) { firstFit = false; requestAnimationFrame(function () { box.classList.remove('is-fitting'); }); }
        else box.classList.remove('is-fitting');
    }

    var timer = 0;
    function later() { clearTimeout(timer); timer = setTimeout(fit, 60); }

    function start() {
        loadTexts().then(fit);
        if (window.ResizeObserver) new ResizeObserver(later).observe(box);
        else window.addEventListener('resize', later);
        document.addEventListener('mjvlangchange', function () { loadTexts().then(fit); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
        window.addEventListener('load', later);
        if (estImg) estImg.addEventListener('load', function () { if (!estR) later(); });
        document.addEventListener('mjvsectionsettled', later);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

    window.mjvStudioFit = { refit: fit };
})();

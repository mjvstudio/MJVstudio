/* =====================================================================
   GRILLA DE PROYECTOS — MJV Studio

   Qué hace
   1) MOSAICO QUE LLENA TODO EL ESPACIO. Los proyectos ya no son una grilla pareja de 5×4:
      el espacio de la sección se reparte en celdas cuadradas y cada proyecto ocupa un
      rectángulo de 1, 2, 3… celdas. Siempre se llena TODO el espacio, sin huecos.
      - Cada proyecto tiene un "peso" (data-weight en su <a class="project"> en index.html;
        si no lo tiene vale 3). Más peso = más celdas. Si hace falta, los proyectos se
        agrandan o achican en proporción para que todo encaje.
      - Para sumar un proyecto alcanza con agregar su <a class="project"> en index.html:
        el mosaico se reacomoda solo.

   2) CUATRO MODOS, GLOBALES. Hay 4 acomodos fijos (MODES, abajo). El modo que se ve lo decide
      el RELOJ: cada SLOT_MIN minutos (15) toca el siguiente (1, 2, 3, 4, 1…). Como sale de la
      hora y no de un servidor, todas las personas ven el mismo modo a la vez. (Si el reloj de
      la compu está mal, se corrige con la hora del servidor del sitio.) Al cambiar de turno,
      los proyectos se deslizan a su lugar nuevo.

   3) ARRASTRAR. Cada persona puede arrastrar un proyecto: mientras se arrastra, los demás
      se reacomodan en vivo (el proyecto arrastrado toma el lugar de aquel sobre el que se
      lo suelta y los otros se reparten de nuevo). En celular, se arrastra manteniendo
      presionado. El acomodo propio queda guardado en ese navegador, pero solo hasta el
      próximo cambio de turno: ahí todos vuelven al modo global.

   4) BOTÓN "REACOMODAR" (barra de preferencias): es para jugar. Cada clic pasa al SIGUIENTE de los 4 modos (A→B→C→D→A…),
      con la categoría que esté elegida (si hay un filtro, solo se reacomodan los proyectos que se ven). Ese modo dura
      hasta el próximo cambio de turno del reloj, que vuelve al modo global. (window.mjvGrid.reset() vuelve al modo del reloj.)

   5) FILTROS. Al elegir una categoría, los proyectos que salen se van hacia afuera
      y se esfuman; después los que quedan se reacomodan para ocupar todo el espacio y
      los que entran aparecen.

   Cómo se acomoda (para ajustar)
   - El espacio es una grilla de COLUMNAS×FILAS según la forma de la pantalla (ver dimsFor).
   - tile() parte el rectángulo en dos, una y otra vez, repartiendo las celdas según el peso
     de cada proyecto (como un "treemap"). La "semilla" del modo decide el orden y los
     cortes; se prueban varios cortes y se elige el que da rectángulos más parejos.
   - Un modo = una semilla (seed) + cuánto varía el tamaño de cada proyecto (jitter).
     Para cambiar cómo se ve un modo, cambiá su seed. Para ver varios: tools/preview-modos.html.
   - Todo es determinista: la misma semilla y los mismos proyectos dan siempre el mismo acomodo.

   Lo que expone: window.mjvGrid = { setFilter, reset, state, nextChangeIn }
   ===================================================================== */
(function (root) {
    'use strict';

    /* ---------------------------------------------------------------
       AJUSTES
       --------------------------------------------------------------- */
    var CFG = {
        SLOT_MIN: 15,                 // cada cuántos minutos cambia el modo (para todo el mundo a la vez)
        MODES: [                      // los 4 modos (se repiten en este orden)
            { name: 'A', seed: 11, jitter: 0 },
            { name: 'B', seed: 23, jitter: 0.35 },
            { name: 'C', seed: 37, jitter: 0.5 },
            { name: 'D', seed: 41, jitter: 0.25 }
        ],
        DEFAULT_WEIGHT: 3,            // peso de un proyecto sin data-weight
        ATTEMPTS: 70,                // cuántos cortes se prueban para cada acomodo
        ASPECT_LEVELS: [[0.95, 3], [0.85, 3.6], [0.7, 5], [0, 99]],   // [mínimo, máximo] de ancho/alto de cada proyecto; se prueba en orden
        GOOD_SCORE: 2.2,              // con un puntaje menor a este se da por bueno y se deja de probar
        LEAVE_MS: 420,                // cuánto dura la salida (hacia afuera y esfumarse) al filtrar
        LEAVE_DISTANCE: 90,           // cuántos px salen hacia afuera
        DRAG_THRESHOLD: 6,            // px que hay que mover el mouse para que empiece el arrastre
        LONGPRESS_MS: 380,            // en celular: cuánto hay que mantener presionado
        TOUCH_SLOP: 7,                // en celular: si se mueve más que esto antes, es un deslizamiento normal
        HOVER_GROW_PX: 5,             // cuánto crece cada lado de un proyecto al pasar el mouse
        STORAGE_KEY: 'mjv-grid-v1'
    };

    /* ===============================================================
       PARTE 1 — EL ALGORITMO (sin pantalla: también se prueba desde Node)
       =============================================================== */

    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function hashStr(s) {
        var h = 2166136261;
        for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    function shuffled(arr, rnd) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(rnd() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    /* Cuántas columnas y filas de celdas (cuadradas) según la forma del espacio.
       Son 4 formas fijas: así todas las pantallas parecidas ven el mismo mosaico.
       Si hay muchos proyectos, la grilla se hace más fina. */
    function dimsFor(widthPx, heightPx, n) {
        var ratio = widthPx / heightPx, c, r;
        if (ratio >= 1.35) { c = 10; r = 6; }
        else if (ratio >= 0.9) { c = 9; r = 8; }
        else if (ratio >= 0.6) { c = 6; r = 9; }
        else { c = 6; r = 14; }
        var k = 1;
        while (c * r * k * k < n * 2.5) k++;
        return { cols: c * k, rows: r * k };
    }

    /* Parte el rectángulo (x,y,w,h) entre los proyectos de "items" (en ese orden).
       Devuelve true si pudo y deja los rectángulos en "out". */
    function split(items, x, y, w, h, rnd, out, ctx) {
        var n = items.length;
        if (++ctx.calls > ctx.budget) return false;                 // se corta si se complica demasiado (se prueba con otra semilla)
        if (n === 1) {
            var ar = w * ctx.ca / h;                                 // forma real en píxeles: ancho / alto
            if (ar < ctx.minAr || ar > ctx.maxAr) return false;      // solo cuadrados u horizontales (no verticales)
            out.push({ id: items[0].id, x: x, y: y, w: w, h: h });
            return true;
        }

        var tot = 0, i;
        for (i = 0; i < n; i++) tot += items[i].w;

        // Se corta casi siempre el lado más largo; a veces el otro (más variedad)
        var first = w > h ? 'V' : (h > w ? 'H' : (rnd() < 0.5 ? 'V' : 'H'));
        if (rnd() < 0.18) first = first === 'V' ? 'H' : 'V';
        var dirs = [first, first === 'V' ? 'H' : 'V'];

        // Cuánto del peso queda de un lado: cerca de la mitad, con algo de azar
        var target = 0.5 + (rnd() - 0.5) * 0.34;

        var cum = [0];
        for (i = 0; i < n; i++) cum.push(cum[i] + items[i].w / tot);

        for (var d = 0; d < 2; d++) {
            var dir = dirs[d];
            var L = dir === 'V' ? w : h;     // lado que se corta
            var O = dir === 'V' ? h : w;     // lado que queda entero
            if (L < 2) continue;

            // Posibles puntos de corte (cuántos proyectos van al primer lado), del más parejo al menos
            var ks = [];
            for (var k = 1; k < n; k++) ks.push(k);
            ks.sort(function (a, b) { return Math.abs(cum[a] - target) - Math.abs(cum[b] - target); });

            for (var q = 0; q < ks.length; q++) {
                var kk = ks[q];
                var lo = Math.ceil(kk / O);              // mínimo de celdas para los kk del primer lado
                var hi = L - Math.ceil((n - kk) / O);    // máximo, para que a los otros les alcancen
                if (lo > hi) continue;
                var p = Math.round(L * cum[kk]);
                if (p < lo) p = lo; if (p > hi) p = hi;
                var mark = out.length;
                var okA, okB;
                if (dir === 'V') {
                    okA = split(items.slice(0, kk), x, y, p, h, rnd, out, ctx);
                    okB = okA && split(items.slice(kk), x + p, y, w - p, h, rnd, out, ctx);
                } else {
                    okA = split(items.slice(0, kk), x, y, w, p, rnd, out, ctx);
                    okB = okA && split(items.slice(kk), x, y + p, w, h - p, rnd, out, ctx);
                }
                if (okA && okB) return true;
                out.length = mark;
            }
        }
        return false;
    }

    /* Puntaje de un acomodo (menor = mejor): rectángulos parejos (ni tiras finas) y de un
       tamaño parecido al que le tocaba a cada proyecto por su peso. "ca" = ancho/alto de una celda en píxeles. */
    function score(rects, items, cells, ca) {
        ca = ca || 1;
        var tot = 0, i;
        for (i = 0; i < items.length; i++) tot += items[i].w;
        var wt = {};
        for (i = 0; i < items.length; i++) wt[items[i].id] = items[i].w / tot * cells;
        var maxA = 1, dev = 0, thin = 0;
        for (i = 0; i < rects.length; i++) {
            var r = rects[i];
            var ar = r.w * ca / r.h;
            var a = Math.max(ar, 1 / ar);
            if (a > maxA) maxA = a;
            if (a > 3) thin++;
            dev += Math.abs(r.w * r.h / wt[r.id] - 1);
        }
        return maxA + 1.5 * (dev / rects.length) + 0.3 * thin;
    }

    /* Reparte la grilla cols×rows entre "items" ([{id, w}] en orden). Devuelve { id: {x,y,w,h} }
       en unidades de celda. Siempre llena todo el espacio (si caben: items <= cols*rows).
       "ca" = ancho/alto de una celda en píxeles. Los proyectos salen cuadrados u horizontales (ancho ≥ alto, con un
       poco de tolerancia: ASPECT_LEVELS); si con las fotos que hay no se puede, se va aflojando de a poco. */
    function tile(items, cols, rows, seed, ca) {
        ca = ca || 1;
        var res = {};
        var n = items.length;
        if (!n) return res;
        var best = null;
        for (var lv = 0; lv < CFG.ASPECT_LEVELS.length && !best; lv++) {
            var L = CFG.ASPECT_LEVELS[lv];
            for (var a = 0; a < CFG.ATTEMPTS; a++) {
                var rnd = mulberry32((Math.imul(seed, 1000003) + Math.imul(a + 1, 7919)) >>> 0);
                var out = [], ctx = { ca: ca, minAr: L[0] > 0 ? Math.min(L[0], ca * 0.99) : 0, maxAr: L[1], calls: 0, budget: 2000 };   // (una celda sola siempre vale)
                if (!split(items, 0, 0, cols, rows, rnd, out, ctx)) continue;
                var sc = score(out, items, cols * rows, ca);
                if (!best || sc < best.sc) best = { sc: sc, rects: out };
                if (sc < CFG.GOOD_SCORE) break;
            }
        }
        if (!best) {                       // (solo si hay más proyectos que celdas) filas simples
            var out2 = [], per = Math.ceil(n / rows), hh = 1;
            for (var i = 0; i < n; i++) out2.push({ id: items[i].id, x: i % per, y: Math.floor(i / per), w: 1, h: hh });
            best = { rects: out2 };
        }
        for (var j = 0; j < best.rects.length; j++) {
            var r = best.rects[j];
            res[r.id] = { x: r.x, y: r.y, w: r.w, h: r.h };
        }
        return res;
    }

    // Orden "de fábrica" de un modo (los mismos proyectos en el mismo orden para todos)
    function modeOrder(ids, mode) {
        return shuffled(ids, mulberry32(mode.seed * 7777 + 1));
    }

    // Peso de cada proyecto en un modo: el suyo, con una variación propia de ese modo
    function modeWeight(id, base, mode) {
        if (!mode.jitter) return base;
        var r = mulberry32(hashStr(id) ^ Math.imul(mode.seed, 2654435761))();
        return base * (1 + mode.jitter * (r * 2 - 1));
    }

    function slotOf(ms) { return Math.floor(ms / (CFG.SLOT_MIN * 60000)); }
    function modeIndexOf(slot) { var n = CFG.MODES.length; return ((slot % n) + n) % n; }

    var api = {
        CFG: CFG, mulberry32: mulberry32, hashStr: hashStr, dimsFor: dimsFor, tile: tile,
        score: score, modeOrder: modeOrder, modeWeight: modeWeight, slotOf: slotOf, modeIndexOf: modeIndexOf
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;

    /* ===============================================================
       PARTE 2 — LA PÁGINA
       =============================================================== */
    if (typeof document === 'undefined') return;
    var gallery = document.querySelector('.gallery');
    if (!gallery) return;
    var tiles = Array.prototype.slice.call(gallery.querySelectorAll('a.project'));
    if (!tiles.length) return;

    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var byId = {};                      // id (href) → <a>
    var weights = {};                   // id → peso base
    var allIds = [];
    tiles.forEach(function (el) {
        var id = el.getAttribute('href');
        byId[id] = el;
        allIds.push(id);
        var w = parseFloat(el.getAttribute('data-weight'));
        weights[id] = w > 0 ? w : CFG.DEFAULT_WEIGHT;
        el.setAttribute('draggable', 'false');
        var im = el.querySelector('img');
        if (im) im.setAttribute('draggable', 'false');
    });
    function idOf(el) { return el.getAttribute('href'); }

    gallery.classList.add('is-grid');

    /* ---------- Reloj ---------- */
    var clockOffset = 0;               // diferencia entre la hora del servidor y la de la compu
    function now() { return Date.now() + clockOffset; }
    function currentSlot() { return slotOf(now()); }
    function nextChangeIn() { var s = CFG.SLOT_MIN * 60000; return s - (now() % s); }

    /* ---------- Estado ---------- */
    var slot = currentSlot();
    var filter = 'all';
    var userOrder = null;               // orden propio de esta persona (null = el del modo)
    var layout = { cols: 0, rows: 0, rects: {} };     // el acomodo que se está mostrando
    var gw = 0, gh = 0;                 // tamaño de la galería en px
    var gap = 10;
    var drag = null;
    var pendingSlotChange = false;
    var moveToken = 0;

    var modeOverride = null;            // modo elegido con el botón (null = el del reloj); vale hasta el próximo turno
    function mode() { return CFG.MODES[modeOverride !== null ? modeOverride : modeIndexOf(slot)]; }

    function readMetrics() {
        var cs = getComputedStyle(gallery);
        gap = parseFloat(cs.getPropertyValue('--gap')) || 10;
        gw = gallery.clientWidth;        // incluye el margen de medio --gap por lado
        gh = gallery.clientHeight;
    }

    /* ---------- Guardado del acomodo propio (solo vale en el turno en que se hizo) ---------- */
    function load() {
        try {
            var s = JSON.parse(localStorage.getItem(CFG.STORAGE_KEY) || 'null');
            if (s && s.slot === slot) {
                if (Array.isArray(s.order)) userOrder = s.order;
                if (typeof s.mode === 'number' && s.mode >= 0 && s.mode < CFG.MODES.length) modeOverride = s.mode;
            }
        } catch (e) {}
    }
    function save() {
        try {
            if (userOrder || modeOverride !== null) localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify({ slot: slot, order: userOrder, mode: modeOverride }));
            else localStorage.removeItem(CFG.STORAGE_KEY);
        } catch (e) {}
    }

    /* ---------- Orden y acomodo ---------- */
    function baseOrder() { return modeOrder(allIds, mode()); }

    // Orden completo actual: el propio (si hay) con los proyectos que falten al final
    function currentOrder() {
        var base = baseOrder();
        if (!userOrder) return base;
        var seen = {}, out = [];
        userOrder.forEach(function (id) { if (byId[id] && !seen[id]) { seen[id] = 1; out.push(id); } });
        base.forEach(function (id) { if (!seen[id]) out.push(id); });
        return out;
    }

    function matches(el) {
        return filter === 'all' || el.classList.contains(filter);
    }

    var computeCache = {}, computeCacheN = 0;     // acomodos ya calculados (al arrastrar se repiten mucho)
    function compute(order) {
        var visible = order.filter(function (id) { return matches(byId[id]); });
        var m = mode();
        var items = visible.map(function (id) { return { id: id, w: modeWeight(id, weights[id], m) }; });
        var d = dimsFor(gw, gh, allIds.length);
        var ca = (gw / d.cols) / (gh / d.rows);
        var key = m.seed + '|' + d.cols + 'x' + d.rows + '|' + ca.toFixed(2) + '|' + items.map(function (it) { return it.id + ':' + it.w.toFixed(2); }).join(',');
        var hit = computeCache[key];
        if (!hit) {
            if (computeCacheN++ > 150) { computeCache = {}; computeCacheN = 0; }
            hit = computeCache[key] = tile(items, d.cols, d.rows, m.seed, ca);
        }
        return { cols: d.cols, rows: d.rows, rects: hit, visible: visible };
    }

    function pct(v, total) { return (v / total * 100) + '%'; }

    function place(el, r, L) {
        var s = el.style;
        s.left = 'calc(' + pct(r.x, L.cols) + ' + var(--gap) / 2)';
        s.top = 'calc(' + pct(r.y, L.rows) + ' + var(--gap) / 2)';
        s.width = 'calc(' + pct(r.w, L.cols) + ' - var(--gap))';
        s.height = 'calc(' + pct(r.h, L.rows) + ' - var(--gap))';
        // Al pasar el mouse crece lo mismo (en px) cada proyecto, sea grande o chico
        var wpx = r.w / L.cols * gw - gap, hpx = r.h / L.rows * gh - gap;
        var hs = 1 + 2 * CFG.HOVER_GROW_PX / Math.max(40, Math.min(wpx, hpx));
        s.setProperty('--hs', hs.toFixed(4));
    }

    function noAnim(fn) {
        gallery.classList.add('no-anim');
        fn();
        void gallery.offsetWidth;
        gallery.classList.remove('no-anim');
    }

    /* Muestra "L" (un resultado de compute). opts: animate (se desliza), stagger (cada uno sale
       con un pequeño retraso), skip (id que se está arrastrando: no se toca su posición libre) */
    function apply(L, opts) {
        opts = opts || {};
        layout = L;
        var run = function () {
            tiles.forEach(function (el) {
                var id = idOf(el), r = L.rects[id];
                if (!r) return;
                if (opts.stagger && !reduced) {
                    var d = (hashStr(id + slot) % 260) / 1000;
                    el.style.setProperty('--d', d + 's');
                } else {
                    el.style.removeProperty('--d');
                }
                place(el, r, L);
            });
        };
        if (opts.animate && !reduced) run(); else noAnim(run);
        if (opts.stagger) {
            clearTimeout(apply._t);
            apply._t = setTimeout(function () {
                tiles.forEach(function (el) { el.style.removeProperty('--d'); });
            }, 1300);
        }
    }

    /* ---------- Cambio de turno (modo global) ---------- */
    function startSlotChange() {
        if (drag && drag.active) { pendingSlotChange = true; return; }
        var animate = galleryVisible();
        userOrder = null; modeOverride = null; save();
        finishFilterNow();
        apply(compute(currentOrder()), { animate: animate, stagger: true });
        if (animate && window.mjvSound && window.mjvSound.transition) { try { window.mjvSound.transition(); } catch (e) {} }
        document.dispatchEvent(new CustomEvent('mjvgridmode', { detail: { mode: mode().name, slot: slot } }));
    }

    function checkSlot() {
        var s = currentSlot();
        if (s === slot) return;
        if (drag && drag.active) { pendingSlotChange = true; return; }   // se aplica al soltar (el modo no cambia a mitad del arrastre)
        slot = s;
        startSlotChange();
    }
    function scheduleTick() {
        clearTimeout(scheduleTick._t);
        scheduleTick._t = setTimeout(function () { checkSlot(); scheduleTick(); }, Math.min(nextChangeIn() + 60, 30000));
    }

    // ¿Se está viendo la sección de proyectos? (si no, el cambio se hace sin animar)
    function galleryVisible() {
        var r = gallery.getBoundingClientRect();
        return r.right > 0 && r.left < window.innerWidth && !document.hidden;
    }

    /* ---------- Filtros: salen hacia afuera y se esfuman; los demás se reacomodan; los nuevos aparecen ---------- */
    var pendingFilter = null;           // { timer, finish }
    function finishFilterNow() {
        if (!pendingFilter) return;
        clearTimeout(pendingFilter.timer);
        var f = pendingFilter.finish;
        pendingFilter = null;
        f();
    }

    function setFilter(f, opts) {
        opts = opts || {};
        f = f || 'all';
        if (f === filter) return;
        finishFilterNow();
        filter = f;
        var animate = opts.animate !== false && !reduced && galleryVisible();

        var leaving = [], entering = [];
        tiles.forEach(function (el) {
            var was = !el.classList.contains('is-hidden');
            var will = matches(el);
            if (was && !will) leaving.push(el);
            if (!was && will) entering.push(el);
        });

        var finish = function () {
            leaving.forEach(function (el) { el.classList.remove('is-leaving'); el.classList.add('is-hidden'); });
            var L = compute(currentOrder());
            // Los que entran arrancan invisibles, ya en su lugar nuevo
            noAnim(function () {
                entering.forEach(function (el) {
                    el.classList.remove('is-hidden');
                    if (animate) el.classList.add('is-entering');
                    place(el, L.rects[idOf(el)], L);
                });
            });
            apply(L, { animate: animate });
            if (animate) {
                void gallery.offsetWidth;
                requestAnimationFrame(function () {
                    entering.forEach(function (el) { el.classList.remove('is-entering'); });
                });
            }
        };

        if (animate && leaving.length) {
            var cx = gallery.clientWidth / 2, cy = gallery.clientHeight / 2;
            leaving.forEach(function (el) {
                var dx = el.offsetLeft + el.offsetWidth / 2 - cx;
                var dy = el.offsetTop + el.offsetHeight / 2 - cy;
                var len = Math.max(1, Math.hypot(dx, dy));
                el.style.setProperty('--ox', (dx / len * CFG.LEAVE_DISTANCE).toFixed(1) + 'px');
                el.style.setProperty('--oy', (dy / len * CFG.LEAVE_DISTANCE).toFixed(1) + 'px');
                el.classList.add('is-leaving');
            });
            pendingFilter = { finish: finish, timer: setTimeout(function () { pendingFilter = null; finish(); }, CFG.LEAVE_MS) };
        } else {
            finish();
        }
    }

    /* ---------- Botón "reacomodar" ---------- */
    function reset() {
        finishFilterNow();
        var had = !!userOrder || modeOverride !== null;
        userOrder = null; modeOverride = null; save();
        apply(compute(currentOrder()), { animate: galleryVisible(), stagger: true });
        return had;
    }

    // Botón: pasa al siguiente modo (con la categoría actual)
    function shuffle() {
        if (drag && drag.active) return;
        finishFilterNow();
        var cur = modeOverride !== null ? modeOverride : modeIndexOf(slot);
        modeOverride = (cur + 1) % CFG.MODES.length;
        userOrder = null; save();
        apply(compute(currentOrder()), { animate: galleryVisible(), stagger: true });
        if (window.mjvSound && window.mjvSound.transition) { try { window.mjvSound.transition(); } catch (e) {} }
        document.dispatchEvent(new CustomEvent('mjvgridmode', { detail: { mode: mode().name, slot: slot, manual: true } }));
    }

    var LABELS = {
        es: 'Reacomodar proyectos', en: 'Rearrange projects',
        fr: 'Réorganiser les projets', pt: 'Reorganizar projetos'
    };
    function updateResetLabel() {
        var l = window.mjvLang ? window.mjvLang.current() : 'es';
        var text = LABELS[l] || LABELS.es;
        document.querySelectorAll('.js-grid-reset').forEach(function (b) {
            b.title = text;
            b.setAttribute('aria-label', text);
        });
    }
    function initResetButton() {
        updateResetLabel();
        document.addEventListener('mjvlangchange', updateResetLabel);
        document.querySelectorAll('.js-grid-reset').forEach(function (b) {
            b.addEventListener('click', function () {
                shuffle();
                b.classList.remove('is-spinning');
                void b.offsetWidth;
                b.classList.add('is-spinning');
            });
        });
        // El botón solo se ve en la sección de proyectos (la 2.ª)
        var bar = document.querySelector('.utility-buttons');
        function sync(idx) { if (bar) bar.classList.toggle('on-architecture', idx === 1); }
        document.addEventListener('mjvsectionchange', function (e) { sync(e.detail && e.detail.index); });
        var sw = document.querySelector('.swiper-container');
        sync(sw && sw.swiper ? sw.swiper.realIndex : (location.hash === '#architecture' ? 1 : 0));
    }

    /* ---------- Arrastrar ---------- */
    function cellOf(clientX, clientY) {
        var g = gallery.getBoundingClientRect();
        var x = clientX - g.left, y = clientY - g.top;
        if (x < 0 || y < 0 || x > gw || y > gh) return null;
        return { x: x / gw * layout.cols, y: y / gh * layout.rows };
    }
    function tileAt(clientX, clientY) {
        var c = cellOf(clientX, clientY);
        if (!c) return null;
        var ids = Object.keys(layout.rects);
        for (var i = 0; i < ids.length; i++) {
            var r = layout.rects[ids[i]];
            if (c.x >= r.x && c.x < r.x + r.w && c.y >= r.y && c.y < r.y + r.h) return ids[i];
        }
        return null;
    }
    function slotPx(id) {
        var r = layout.rects[id], g = gallery.getBoundingClientRect();
        return {
            left: g.left + gap / 2 + r.x / layout.cols * gw,
            top: g.top + gap / 2 + r.y / layout.rows * gh,
            w: r.w / layout.cols * gw - gap, h: r.h / layout.rows * gh - gap
        };
    }

    function lockSwiper(lock) {
        var sw = document.querySelector('.swiper-container');
        sw = sw && sw.swiper;
        if (!sw) return;
        if (lock) {
            drag.swiperWas = sw.allowTouchMove;
            sw.allowTouchMove = false;
            try { sw.touchEventsData.isTouched = false; sw.touchEventsData.isMoved = false; } catch (e) {}
        } else if (drag && drag.swiperWas !== undefined) {
            sw.allowTouchMove = drag.swiperWas;
        }
    }

    function activate(x, y) {
        if (!drag || drag.active) return;
        clearTimeout(drag.timer);
        drag.active = true;
        var p = slotPx(drag.id);
        drag.grabX = x - p.left;
        drag.grabY = y - p.top;
        drag.startOrder = currentOrder();
        drag.lastOver = drag.id;
        finishFilterNow();
        lockSwiper(true);
        gallery.classList.add('is-dragging');
        drag.el.classList.add('is-dragging');
        try { drag.el.setPointerCapture(drag.pid); } catch (e) {}
        if (drag.type === 'touch' && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
        if (window.mjvSound && window.mjvSound.pop) { try { window.mjvSound.pop(); } catch (e) {} }
        updateSlotGhost();
        moveDrag(x, y);
    }

    /* Orden con el proyecto arrastrado metido "antes del k-ésimo proyecto visible" (k = cantidad de visibles = al final) */
    function orderWithDragAt(k) {
        var others = currentOrder().filter(function (id) { return id !== drag.id; });
        var seen = 0, pos = others.length;
        for (var i = 0; i < others.length; i++) {
            if (matches(byId[others[i]])) { if (seen === k) { pos = i; break; } seen++; }
        }
        others.splice(pos, 0, drag.id);
        return others;
    }
    function visibleOthers() {
        return currentOrder().filter(function (id) { return id !== drag.id && matches(byId[id]); });
    }
    function distToRect(c, r) {
        var dx = Math.max(r.x - c.x, 0, c.x - (r.x + r.w)), dy = Math.max(r.y - c.y, 0, c.y - (r.y + r.h));
        return Math.hypot(dx, dy);
    }

    /* El hueco del proyecto arrastrado va hacia donde está el puntero: se prueban acomodos con el proyecto
       metido en distintos lugares del orden y se elige donde su hueco queda debajo del puntero. */
    function findHole(x, y) {
        var c = cellOf(x, y);
        if (!c) return null;
        var cur = layout.rects[drag.id];
        if (cur && c.x >= cur.x && c.x < cur.x + cur.w && c.y >= cur.y && c.y < cur.y + cur.h) return null;   // ya está en su hueco
        var vis = visibleOthers(), m = vis.length;
        var over = tileAt(x, y), cands = [];
        if (over && over !== drag.id) {
            var oi = vis.indexOf(over);
            [oi - 1, oi, oi + 1, oi + 2].forEach(function (k) { if (k >= 0 && k <= m && cands.indexOf(k) < 0) cands.push(k); });
        }
        var best = null;
        function tryList(list) {
            list.forEach(function (k) {
                var ord = orderWithDragAt(k), L = compute(ord), r = L.rects[drag.id];
                if (!r) return;
                var d = distToRect(c, r), cd = Math.hypot(c.x - (r.x + r.w / 2), c.y - (r.y + r.h / 2));
                if (!best || d < best.d - 1e-6 || (Math.abs(d - best.d) < 1e-6 && cd < best.cd)) best = { d: d, cd: cd, ord: ord, L: L };
            });
        }
        tryList(cands);
        if (!best || best.d > 0) {            // ninguno la deja bajo el puntero: se prueban todos los lugares
            var all = []; for (var k = 0; k <= m; k++) if (cands.indexOf(k) < 0) all.push(k);
            tryList(all);
        }
        if (!best || best.d > 0) {            // todavía no: también se prueba intercambiar el lugar con cada otro proyecto
            var base = currentOrder(), ia = base.indexOf(drag.id);
            vis.forEach(function (id) {
                var ord = base.slice(), ib = ord.indexOf(id);
                ord[ia] = id; ord[ib] = drag.id;
                var L = compute(ord), r = L.rects[drag.id];
                if (!r) return;
                var d = distToRect(c, r), cd = Math.hypot(c.x - (r.x + r.w / 2), c.y - (r.y + r.h / 2));
                if (!best || d < best.d - 1e-6 || (Math.abs(d - best.d) < 1e-6 && cd < best.cd)) best = { d: d, cd: cd, ord: ord, L: L };
            });
        }
        return best;
    }

    function moveDrag(x, y) {
        var p = slotPx(drag.id);
        drag.el.style.translate = (x - drag.grabX - p.left) + 'px ' + (y - drag.grabY - p.top) + 'px';
        drag.lx = x; drag.ly = y;
        var t = performance.now();
        if (t - (drag.lastSearch || 0) < 90) {                         // no se busca en cada movimiento
            clearTimeout(drag.searchTimer);
            drag.searchTimer = setTimeout(function () { if (drag && drag.active) moveDrag(drag.lx, drag.ly); }, 100);
            return;
        }
        drag.lastSearch = t;
        var best = findHole(x, y);
        if (best && best.ord.join() !== currentOrder().join()) {
            userOrder = best.ord;
            apply(best.L, { animate: true });
            updateSlotGhost();
            var p2 = slotPx(drag.id);                                  // el hueco cambió: el proyecto sigue pegado al puntero
            drag.el.style.translate = (x - drag.grabX - p2.left) + 'px ' + (y - drag.grabY - p2.top) + 'px';
            if (window.mjvSound && window.mjvSound.hover) { try { window.mjvSound.hover(drag.el); } catch (e) {} }
        }
    }

    /* El hueco se ve: un recuadro tenue en el lugar donde va a quedar el proyecto al soltarlo */
    function updateSlotGhost() {
        if (!drag || !drag.active) return;
        var r = layout.rects[drag.id];
        if (!r) return;
        if (!drag.ghost) {
            drag.ghost = document.createElement('div');
            drag.ghost.className = 'grid-slot';
            drag.ghost.setAttribute('aria-hidden', 'true');
            gallery.insertBefore(drag.ghost, gallery.firstChild);
            noAnim(function () { place(drag.ghost, r, layout); });
            return;
        }
        place(drag.ghost, r, layout);
    }

    function endDrag(commit) {
        if (!drag) return;
        var d = drag;
        drag = null;
        clearTimeout(d.timer);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.removeEventListener('keydown', onKey, true);
        clearTimeout(d.searchTimer);
        if (!d.active) return;
        if (d.ghost) { var gh_ = d.ghost; gh_.classList.add('is-out'); setTimeout(function () { if (gh_.parentNode) gh_.parentNode.removeChild(gh_); }, 400); }

        d.el.classList.remove('is-dragging');
        d.el.classList.add('is-dropping');
        d.el.style.translate = '';
        try { d.el.releasePointerCapture(d.pid); } catch (e) {}
        gallery.classList.remove('is-dragging');
        lockSwiper.call(null, false);
        (function () {
            var sw = document.querySelector('.swiper-container'); sw = sw && sw.swiper;
            if (sw && d.swiperWas !== undefined) sw.allowTouchMove = d.swiperWas;
        })();
        setTimeout(function () { d.el.classList.remove('is-dropping'); }, 600);

        if (!commit) {                                            // Esc: vuelve a como estaba
            userOrder = d.startOrder.join() === baseOrder().join() ? null : d.startOrder;
            apply(compute(currentOrder()), { animate: true });
        } else {
            var base = baseOrder().join();
            if (userOrder && userOrder.join() === base) userOrder = null;
        }
        save();
        if (window.mjvSound && window.mjvSound.click) { try { window.mjvSound.click(); } catch (e) {} }

        // El clic que sigue a soltar no debe abrir el proyecto
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 350);

        if (pendingSlotChange) { pendingSlotChange = false; checkSlot(); }
    }

    var suppressClick = false;
    window.addEventListener('click', function (e) {
        if (!suppressClick) return;
        if (e.target && e.target.closest && e.target.closest('a.project')) {
            e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        }
        suppressClick = false;
    }, true);

    function onKey(e) {
        if (e.key === 'Escape' && drag && drag.active) { e.stopPropagation(); endDrag(false); }
    }

    function onDown(e) {
        if (drag) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var el = e.target.closest && e.target.closest('a.project');
        if (!el || el.classList.contains('is-hidden') || !gallery.contains(el)) return;
        drag = { el: el, id: idOf(el), pid: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY,
                 type: e.pointerType, active: false, timer: 0 };
        if (e.pointerType === 'mouse') {
            // Con el mouse, arrastrar un proyecto no debe mover las secciones (Swiper)
            e.stopPropagation();
        } else {
            drag.timer = setTimeout(function () { if (drag) activate(drag.x, drag.y); }, CFG.LONGPRESS_MS);
        }
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        document.addEventListener('keydown', onKey, true);
    }

    function onMove(e) {
        if (!drag || e.pointerId !== drag.pid) return;
        drag.x = e.clientX; drag.y = e.clientY;
        if (!drag.active) {
            var dist = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
            if (drag.type === 'touch') {
                if (dist > CFG.TOUCH_SLOP) endDrag(false);      // era un deslizamiento: no es un arrastre
            } else if (dist > CFG.DRAG_THRESHOLD) {
                activate(e.clientX, e.clientY);
            }
            return;
        }
        if (e.cancelable) e.preventDefault();
        moveDrag(e.clientX, e.clientY);
    }

    function onUp(e) {
        if (!drag || e.pointerId !== drag.pid) return;
        endDrag(true);
    }

    gallery.addEventListener('pointerdown', onDown);
    // Con el dedo, una vez que el arrastre empezó, la pantalla no debe desplazarse
    gallery.addEventListener('touchmove', function (e) {
        if (drag && drag.active && drag.type === 'touch' && e.cancelable) e.preventDefault();
    }, { passive: false });
    gallery.addEventListener('contextmenu', function (e) { if (drag && drag.type === 'touch') e.preventDefault(); });
    gallery.addEventListener('dragstart', function (e) { e.preventDefault(); });

    /* ---------- Tamaño de pantalla ---------- */
    var lastDims = '';
    function relayoutOnResize() {
        readMetrics();
        var d = dimsFor(gw, gh, allIds.length);
        var key = d.cols + 'x' + d.rows;
        if (drag && drag.active) return;
        if (key !== lastDims || !layout.cols) {
            lastDims = key;
            finishFilterNow();
            apply(compute(currentOrder()), { animate: false });
        } else {
            // misma grilla: solo se actualizan los tamaños en px (el crecimiento al pasar el mouse)
            Object.keys(layout.rects).forEach(function (id) { place(byId[id], layout.rects[id], layout); });
        }
    }

    /* ---------- Hora del servidor ---------- */
    function syncClock() {
        if (typeof fetch !== 'function' || location.protocol === 'file:') return;
        var t0 = Date.now();
        fetch(location.pathname, { method: 'HEAD', cache: 'no-store' }).then(function (r) {
            var h = r.headers.get('Date');
            if (!h) return;
            var server = new Date(h).getTime();
            if (!isFinite(server)) return;
            clockOffset = server - (t0 + (Date.now() - t0) / 2);
            if (Math.abs(clockOffset) < 1500) clockOffset = 0;          // diferencia chica: no vale la pena
            var s = currentSlot();
            if (s !== slot) { slot = s; userOrder = null; save(); apply(compute(currentOrder()), { animate: false }); }
            scheduleTick();
        }).catch(function () {});
    }

    /* ---------- Arranque ---------- */
    readMetrics();
    load();
    var d0 = dimsFor(gw, gh, allIds.length);
    lastDims = d0.cols + 'x' + d0.rows;
    apply(compute(currentOrder()), { animate: false });

    if (window.ResizeObserver) new ResizeObserver(relayoutOnResize).observe(gallery);
    else window.addEventListener('resize', relayoutOnResize);

    document.addEventListener('visibilitychange', function () { if (!document.hidden) { checkSlot(); scheduleTick(); } });
    scheduleTick();
    setInterval(checkSlot, 5000);       // por si el navegador demora los temporizadores
    syncClock();

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initResetButton);
    else initResetButton();

    root.mjvGrid = {
        setFilter: setFilter,
        reset: reset,
        shuffle: shuffle,
        nextChangeIn: nextChangeIn,
        state: function () {
            return { slot: slot, mode: mode().name, filter: filter, cols: layout.cols, rows: layout.rows,
                     rects: layout.rects, userOrder: userOrder, override: modeOverride, dragging: !!(drag && drag.active), offset: clockOffset };
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);

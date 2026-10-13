/* ==========================================================================
   PROYECTOS ABIERTOS ENCIMA DE LA PORTADA — MJV Studio

   Antes, entrar a un proyecto era cargar otra página: el navegador destruye la
   portada (y con ella el audio) y arma una nueva, así que el sonido ambiente
   se cortaba SÍ o SÍ por un momento. Ahora el proyecto se abre en una capa a
   pantalla completa ENCIMA de la portada, que sigue viva por debajo con su audio:
   el ambiente no se interrumpe nunca.

   Lo que se mantiene igual:
   - La página del proyecto es la misma de siempre (projects/projectN/projectN.html).
     También se puede abrir sola, escribiendo la dirección: funciona igual.
   - La dirección del navegador cambia a la del proyecto y el botón "atrás" del
     navegador cierra la capa (como si volvieras de una página).
   - Ctrl/Cmd+clic, clic con la rueda o "abrir en pestaña nueva" abren el proyecto
     en una pestaña aparte, como siempre.
   - Si el proyecto todavía no tiene página (los que están por armarse), el
     enlace se comporta como antes.

   Lo nuevo:
   - Al cerrar el proyecto, la portada está exactamente como se dejó (misma
     sección, mismo filtro): no se recarga.
   - El tema (claro/oscuro) y el idioma que se cambien dentro del proyecto se
     reflejan también en la portada.
   - El volumen y el silencio los maneja la portada (ver sound.js, "embedded").

   API: window.mjvProjectLayer.open(href) / .close() / .isOpen()
   ========================================================================== */

(function () {
    'use strict';

    var FADE_MS = 520;                       // tiene que coincidir con la transición de .project-layer (styles.css)
    var LOAD_TIMEOUT_MS = 15000;             // si el proyecto tarda demasiado en cargar, igual se muestra

    var root = document.documentElement;
    var frame = null;                        // el <iframe> abierto (si hay uno)
    var trigger = null;                      // el enlace que lo abrió (para devolverle el foco)
    var busy = false;                        // comprobando que exista / cargando
    var pushed = false;                      // ¿se agregó una entrada al historial del navegador?
    var baseTitle = document.title;
    var loadTimer = 0;
        var openedAt = 0;
    var SHOW_AFTER_MS = 700;                 // el proyecto aparece cuando los cuadros ya empezaron a abrirse

    var reduce = function () {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };


    /* ---------- Animación de los cuadros de la portada ----------
       Al abrir: el cuadro elegido se agranda y se esfuma, y los demás salen hacia afuera (cada uno en la dirección
       en que está respecto al elegido) y se esfuman, uno tras otro. Al volver (atrás): hacen el camino inverso y se
       reacomodan en su lugar. Usa las propiedades "translate" / "scale" / "opacity", que se suman a lo que grid.js
       ya les puso, sin pisarlo. En pantallas táctiles y en computadora funciona igual. */
    function visibleTiles(sel) {
        var vw = window.innerWidth, vh = window.innerHeight;
        return Array.prototype.filter.call(document.querySelectorAll(sel), function (el) {
            var r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.right > 0 && r.left < vw && r.bottom > 0 && r.top < vh;
        });
    }
    function planOf(sel, chosenEl) {
        var tiles = visibleTiles(sel);
        if (!tiles.length) return [];
        var vw = window.innerWidth, vh = window.innerHeight;
        var c = chosenEl && chosenEl.getBoundingClientRect ? chosenEl.getBoundingClientRect() : null;
        var cx = c ? c.left + c.width / 2 : vw / 2, cy = c ? c.top + c.height / 2 : vh / 2;
        var dist = Math.min(vw, vh) * 0.42;
        var items = tiles.map(function (el) {
            var r = el.getBoundingClientRect();
            var dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
            var d = Math.sqrt(dx * dx + dy * dy);
            var chosen = el === chosenEl || (chosenEl && chosenEl.contains && chosenEl.contains(el));
            var ux = d > 1 ? dx / d : 0, uy = d > 1 ? dy / d : 0;
            return { el: el, d: d, chosen: chosen, x: chosen ? 0 : ux * dist, y: chosen ? 0 : uy * dist };
        });
        var maxD = Math.max.apply(null, items.map(function (i) { return i.d; })) || 1;
        items.forEach(function (i) { i.t = i.d / maxD; });
        return items;
    }
    function outState(i) {
        return i.chosen ? { translate: '0px 0px', scale: 1.12, opacity: 0 }
                        : { translate: i.x + 'px ' + i.y + 'px', scale: 0.55, opacity: 0 };
    }
    /* Efecto reutilizable: fx(selector, elegido).out() saca los cuadros; .back() los devuelve. */
    function makeFx(sel, getChosen) {
        var anims = [];
        function cancel() { anims.forEach(function (a) { try { a.cancel(); } catch (e) {} }); anims = []; }
        return {
            active: function () { return anims.length > 0; },
            out: function () {
                cancel();
                if (reduce() || !Element.prototype.animate) return;
                anims = planOf(sel, getChosen()).map(function (i) {
                    return i.el.animate([{ translate: '0px 0px', scale: 1, opacity: 1 }, outState(i)],
                        { duration: 750, delay: i.t * 220, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' });
                });
            },
            back: function () {
                var had = anims.length > 0;
                cancel();                                   // primero se sueltan, para medir las posiciones reales
                if (!had || reduce() || !Element.prototype.animate) return;
                planOf(sel, getChosen()).forEach(function (i) {
                    i.el.animate([outState(i), { translate: '0px 0px', scale: 1, opacity: 1 }],
                        { duration: 950, delay: 120 + (1 - i.t) * 260, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
                });
            }
        };
    }
    var tileFx = makeFx('.gallery .project', function () { return trigger; });
    window.mjvFx = { make: makeFx };

    /* El resto de la página no debe poder recibir foco ni clics mientras el proyecto está arriba */
    function setInert(flag) {
        Array.prototype.forEach.call(document.body.children, function (el) {
            if (el === frame || el.tagName === 'SCRIPT' || el.tagName === 'NOSCRIPT') return;
            if (flag) el.setAttribute('inert', ''); else el.removeAttribute('inert');
        });
    }

    /* ¿Existe la página del proyecto? (los que todavía no tienen página siguen yendo por el camino de siempre) */
    function exists(href) {
        if (typeof fetch !== 'function') return Promise.resolve(false);
        return fetch(href, { method: 'HEAD', cache: 'no-cache' })
            .then(function (r) { return r.ok; })
            .catch(function () { return false; });
    }

    function onFrameLoad() {
        clearTimeout(loadTimer);
        if (!frame) return;
        try {
            var doc = frame.contentDocument;
            doc.documentElement.classList.add('is-embedded');
            // El botón "volver a proyectos" cierra la capa (en vez de recargar la portada)
            doc.addEventListener('click', function (e) {
                var back = e.target && e.target.closest && e.target.closest('.back-to-projects-btn');
                if (!back || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                close();
            }, true);
            if (doc.title) document.title = doc.title;
        } catch (err) { /* sin acceso al contenido: la capa igual funciona */ }
        show();
    }

    function show() {
        if (!frame) return;
        busy = false;
        root.classList.remove('project-loading');
        var f = frame;
        var wait = tileFx.active() ? Math.max(0, SHOW_AFTER_MS - (Date.now() - openedAt)) : 0;
        setTimeout(function () {
            if (frame !== f) return;
            f.classList.add('is-open');
            try { f.contentWindow.focus(); } catch (e) {}
        }, wait);
    }

    function openLayer(href, push) {
        frame = document.createElement('iframe');
        frame.className = 'project-layer';
        frame.setAttribute('title', (trigger && trigger.querySelector('img') && trigger.querySelector('img').alt) || 'Proyecto');
        frame.addEventListener('load', onFrameLoad, { once: true });
        frame.src = href;
        document.body.appendChild(frame);
        setInert(true);
        loadTimer = setTimeout(show, LOAD_TIMEOUT_MS);
        if (push) {
            try { history.pushState({ mjvProject: href }, '', href); pushed = true; } catch (e) { pushed = false; }
        }
    }

    /* Cierra la capa. Si se había agregado una entrada al historial, se vuelve atrás
       en el historial (y de ahí se cierra, ver "popstate"): así el botón del navegador
       y el botón de la página hacen exactamente lo mismo. */
    function close() {
        if (!frame) return;
        if (pushed) {
            try { history.back(); } catch (e) { closeLayer(); return; }
            setTimeout(function () { if (frame) closeLayer(); }, 400);     // por si el navegador no avisa
        } else {
            closeLayer();
        }
    }

    function closeLayer() {
        if (!frame) return;
        var f = frame;
        frame = null; pushed = false; busy = false;
        clearTimeout(loadTimer);
        root.classList.remove('project-loading');
        f.classList.remove('is-open');
        tileFx.back();
        setInert(false);
        document.title = baseTitle;
        if (trigger && trigger.focus) { try { trigger.focus({ preventScroll: true }); } catch (e) {} }
        setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, reduce() ? 0 : FADE_MS);   // se libera la memoria (3D, fotos)
    }

    function open(href) {
        if (frame || busy) return;
        busy = true;
        root.classList.add('project-loading');
        exists(href).then(function (ok) {
            if (!ok) { busy = false; root.classList.remove('project-loading'); location.href = href; return; }
            openedAt = Date.now();
            tileFx.out();
            setTimeout(function () { openLayer(href, true); }, tileFx.active() ? 380 : 0);
        });
    }

    /* Clic en un proyecto de la portada */
    document.addEventListener('click', function (e) {
        var a = e.target && e.target.closest && e.target.closest('a.project');
        if (!a || e.defaultPrevented) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;           // pestaña nueva, etc.: como siempre
        if (a.target && a.target !== '_self') return;
        var url;
        try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
        if (url.origin !== location.origin) return;
        e.preventDefault();
        trigger = a;
        open(url.href);
    });

    /* Botón "atrás" / "adelante" del navegador */
    window.addEventListener('popstate', function (e) {
        if (frame) { closeLayer(); return; }
        if (e.state && e.state.mjvProject && !busy) {                                               // "adelante": se vuelve a abrir
            busy = true; root.classList.add('project-loading');
            openLayer(e.state.mjvProject, false); pushed = true;
        }
    });

    /* Lo que se cambie DENTRO del proyecto (tema, idioma) se refleja en la portada.
       (Este aviso lo recibe solo la otra página: la que NO hizo el cambio.) */
    window.addEventListener('storage', function (e) {
        if (e.key === 'mjv-theme') {
            if (e.newValue === 'dark') root.setAttribute('data-theme', 'dark'); else root.removeAttribute('data-theme');
            if (typeof window.updateMjvThemeButtons === 'function') window.updateMjvThemeButtons();
        } else if (e.key === 'mjv-lang' && e.newValue && window.mjvLang && window.mjvLang.current() !== e.newValue) {
            window.mjvLang.set(e.newValue);
        }
    });

    window.mjvProjectLayer = { open: open, close: close, isOpen: function () { return !!frame; } };
})();

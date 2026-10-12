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

    var reduce = function () {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    };

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
        frame.classList.add('is-open');
        try { frame.contentWindow.focus(); } catch (e) {}
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
            openLayer(href, true);
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

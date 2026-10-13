/* =====================================================================
   ESTADÍSTICAS (Umami Cloud) — MJV Studio

   QUÉ HACE
   - Carga el rastreador de Umami SOLO en tus dominios reales (así tus pruebas
     en 127.0.0.1 / localhost no ensucian los números).
   - Cuenta cada página vista automáticamente (portada y cada proyecto).
   - Registra los eventos de abajo. Si algo falla (Umami caído, bloqueador de
     anuncios, tope del plan), el sitio sigue funcionando igual.

   PARA ACTIVARLO
   1) En Umami: Settings > Websites > tu sitio > "Edit" (o "Tracking code").
      Copiá el "Website ID" (son letras y números separados por guiones).
   2) Pegalo más abajo, entre las comillas de la línea que empieza con
      websiteId, y publicá el sitio.

   EVENTOS QUE SE REGISTRAN (en tu panel de Umami > Events)
     project-open          clic en un proyecto de la portada   [lleva el nombre]
     filter-<categoría>    filtro de Architecture (ej. filter-residencial)
     section-architecture  la persona llegó a Architecture     [1 vez por visita]
     section-studio        la persona llegó a Studio           [1 vez por visita]
     language-<es|en|fr|pt> cambió de idioma
     theme-dark / theme-light  cambió el modo claro/oscuro
     photo-open            abrió una foto ampliada de un proyecto
     viewer-3d-use         tocó/giró el modelo 3D              [1 vez por proyecto y visita]
     contact-form-open     abrió el formulario de contacto
     contact-form-sent     ENVIÓ el formulario (la conversión más importante)
     contact-whatsapp      tocó WhatsApp
     contact-instagram     tocó Instagram

   Solo "project-open" lleva un dato extra (el nombre del proyecto), porque
   Umami cuenta cada dato guardado como un evento más del plan.

   HERRAMIENTAS PARA VOS
   - ?notrack=1   en la dirección del sitio: ese navegador deja de contarse
                  (usalo una vez en tu compu y tu celular). ?notrack=0 lo revierte.
   - ?mjvdebug=1  muestra en la consola (F12) cada evento que se dispara, aunque
                  estés probando en tu compu. ?mjvdebug=0 lo apaga.
   ===================================================================== */

var MJV_ANALYTICS = {
    websiteId: 'a8e0cb79-93f4-4bba-b0a9-206c45b722b1',   // ← pegá acá tu "Website ID" de Umami
    scriptUrl: 'https://cloud.umami.is/script.js',
    // Solo se cuenta en estos dominios (agregá otro si publicás en uno nuevo)
    hostnames: ['www.mjvstudio.com', 'mjvstudio.com'],
    // true = no se cuenta a quien tenga activado "No rastrear" en su navegador
    respectDoNotTrack: true
};

(function () {
    'use strict';
    var cfg = MJV_ANALYTICS;

    /* ---------- Estado: ¿hay que medir en este navegador? ---------- */
    function store(key, value) {            // lee (sin value) o escribe (con value; null borra)
        try {
            if (value === undefined) return localStorage.getItem(key);
            if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
        } catch (e) { return null; }
    }
    try {
        var qs = new URLSearchParams(window.location.search);
        if (qs.get('notrack') === '1') store('mjv-notrack', '1');
        if (qs.get('notrack') === '0') store('mjv-notrack', null);
        if (qs.get('mjvdebug') === '1') store('mjv-analytics-debug', '1');
        if (qs.get('mjvdebug') === '0') store('mjv-analytics-debug', null);
    } catch (e) {}

    var debug = store('mjv-analytics-debug') === '1';
    var reason = '';
    if (!cfg.websiteId) reason = 'falta pegar el Website ID';
    else if (cfg.hostnames.indexOf(window.location.hostname) === -1) reason = 'dominio de pruebas (' + window.location.hostname + ')';
    else if (store('mjv-notrack') === '1') reason = 'este navegador está excluido (?notrack=1)';
    var enabled = reason === '';

    /* ---------- Envío (con cola mientras Umami termina de cargar) ---------- */
    var queue = [];
    function deliver(name, data) {
        try {
            if (data) window.umami.track(name, data); else window.umami.track(name);
        } catch (e) { /* una falla de estadísticas nunca debe romper el sitio */ }
    }
    function track(name, data) {
        try {
            if (debug) console.log('[mjv-analytics]', name, data || '', enabled ? '(enviado)' : '(NO se envía: ' + reason + ')');
            if (!enabled) return;
            if (window.umami && typeof window.umami.track === 'function') deliver(name, data);
            else if (queue.length < 50) queue.push([name, data]);
        } catch (e) {}
    }

    // Eventos "una sola vez por visita" (por pestaña); si el navegador no deja
    // guardar, se recuerda mientras la página siga abierta.
    var seen = {};
    function once(key, name, data) {
        try {
            var k = 'mjv-ev:' + key;
            if (seen[k]) return;
            seen[k] = true;
            try {
                if (sessionStorage.getItem(k)) return;
                sessionStorage.setItem(k, '1');
            } catch (e) {}
            track(name, data);
        } catch (e) {}
    }

    /* ---------- Carga del rastreador de Umami ---------- */
    if (enabled) {
        try {
            var s = document.createElement('script');
            s.defer = true;
            s.src = cfg.scriptUrl;
            s.setAttribute('data-website-id', cfg.websiteId);
            s.setAttribute('data-domains', cfg.hostnames.join(','));   // refuerzo del filtro de dominio
            if (cfg.respectDoNotTrack) s.setAttribute('data-do-not-track', 'true');
            s.onload = function () {
                var q = queue.splice(0, queue.length);
                q.forEach(function (e) { deliver(e[0], e[1]); });
            };
            s.onerror = function () { queue.length = 0; };             // bloqueado: se descarta, sin errores
            document.head.appendChild(s);
        } catch (e) {}
    }

    /* ---------- Qué medir ---------- */
    function ascii(txt) {
        return String(txt).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    function closest(e, selector) {
        return e.target && e.target.closest ? e.target.closest(selector) : null;
    }

    document.addEventListener('click', function (e) {
        try {
            var el;
            // Proyecto abierto desde la portada
            if ((el = closest(e, 'a.project'))) {
                var m = (el.getAttribute('href') || '').match(/project(\d+)\//);
                var img = el.querySelector('img');
                track('project-open', { project: (m ? m[1] : '?') + ' - ' + (img && img.alt ? img.alt : 'sin nombre') });
                return;
            }
            // Filtro de categoría (Architecture)
            if ((el = closest(e, '.filter[data-filter]'))) {
                track('filter-' + ascii(el.getAttribute('data-filter')));
                return;
            }
            // Modo claro / oscuro (el botón ya cambió el tema cuando llega acá)
            if (closest(e, '.js-theme-toggle')) {
                track(document.documentElement.getAttribute('data-theme') === 'dark' ? 'theme-dark' : 'theme-light');
                return;
            }
            // Contacto
            if (closest(e, '#open-contact-form')) { track('contact-form-open'); return; }
            if ((el = closest(e, '.contact-dropdown-content a'))) {
                var href = el.getAttribute('href') || '';
                if (/wa\.me|whatsapp/i.test(href)) track('contact-whatsapp');
                else if (/instagram\.com/i.test(href)) track('contact-instagram');
                return;
            }
            // Foto ampliada en una página de proyecto
            if (closest(e, '.gallery-item')) { track('photo-open'); return; }
        } catch (err) {}
    });

    // Modelo 3D: se cuenta la primera vez que alguien lo toca o lo gira
    document.addEventListener('pointerdown', function (e) {
        try {
            if (closest(e, '.modelo-3d-wrapper')) once('viewer3d:' + window.location.pathname, 'viewer-3d-use');
        } catch (err) {}
    }, true);

    // Avisos que mandan los otros archivos del sitio
    document.addEventListener('mjvlangchange', function (e) {
        try { track('language-' + ascii(e.detail && e.detail.lang)); } catch (err) {}
    });
    document.addEventListener('mjvformsent', function () { track('contact-form-sent'); });
    document.addEventListener('mjvsectionchange', function (e) {
        try {
            var name = ['logo', 'architecture', 'studio'][e.detail && e.detail.index];
            if (name && name !== 'logo') once('section:' + name, 'section-' + name);
        } catch (err) {}
    });

    // Para consultar el estado desde la consola: mjvAnalytics.enabled
    window.mjvAnalytics = { enabled: enabled, reason: reason, track: track };
    if (debug) console.log('[mjv-analytics]', enabled ? 'ACTIVO' : 'inactivo: ' + reason);
})();

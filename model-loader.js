/* =====================================================================
   CARGADOR DE MODELOS 3D — MJV Studio

   Qué hace
   - Cuando una página de proyecto tiene un visor 3D (<model-viewer>), tapa el visor con un
     cargador: el símbolo de las casitas (M, J y base de la V) armándose en bucle y, debajo,
     "Cargando modelo… N %" en el idioma de la persona. El porcentaje es REAL (evento "progress"
     del visor), se muestra suavizado y nunca retrocede.
   - Al llegar a 100 % el símbolo se agranda y se desvanece junto con el fondo, y aparece el modelo.
   - Si el modelo falla, se muestra "No se pudo cargar el modelo." en lugar del cargador.
   - Reemplaza al texto simple ".loading-status" (se oculta solo si existe).

   Cómo usarlo en un proyecto nuevo con modelo 3D
   - Alcanza con agregar en el <head> de su página (junto a los otros scripts):
        <script src="../../model-loader.js" defer></script>
     No hace falta tocar nada más: busca solo todos los <model-viewer> de la página.

   Qué se puede ajustar (constantes de abajo)
     MIN_MS    tiempo mínimo a la vista (aunque el modelo ya estuviera en memoria)
     EXIT_MS   duración de la salida (agrandar + desvanecer)
     GROW      cuánto se agranda el símbolo al salir
     LOOP_MS   duración de cada vuelta del bucle del símbolo
   ===================================================================== */
(function () {
    'use strict';

    var SELF = document.currentScript && document.currentScript.src;
    var MIN_MS = 1100;
    var EXIT_MS = 800;
    var GROW = 1.45;
    var LOOP_MS = 2400;

    var PATH_M = "M89,1 L167,1 L167,2 L175,2 L175,3 L179,3 L179,4 L183,4 L183,5 L192,7 L192,8 L197,9 L197,10 L205,13 L206,15 L210,16 L215,21 L217,21 L393,197 L550,40 L552,40 L554,38 L561,40 L562,43 L563,43 L563,288 L562,288 L562,290 L440,412 L440,414 L397,456 L389,455 L197,262 L196,262 L196,390 L195,390 L193,395 L191,395 L191,396 L5,396 L1,392 L1,124 L0,124 L1,93 L2,93 L2,84 L3,84 L4,74 L5,74 L5,70 L6,70 L8,61 L10,59 L10,56 L11,56 L13,50 L15,49 L15,47 L17,46 L18,42 L21,40 L21,38 L36,23 L38,23 L40,20 L42,20 L43,18 L45,18 L49,14 L51,14 L51,13 L53,13 L53,12 L55,12 L59,9 L62,9 L64,7 L67,7 L67,6 L70,6 L70,5 L73,5 L73,4 L77,4 L77,3 L81,3 L81,2 L89,2Z";
    var PATH_J = "M648,0 L682,0 L682,1 L702,2 L702,3 L707,3 L707,4 L719,6 L721,8 L727,9 L727,10 L739,15 L740,17 L742,17 L743,19 L748,21 L751,25 L753,25 L763,35 L763,37 L767,40 L767,42 L770,44 L771,48 L773,49 L775,55 L778,58 L778,61 L781,65 L783,75 L784,75 L784,78 L785,78 L786,93 L787,93 L787,458 L786,458 L785,478 L784,478 L782,491 L781,491 L780,497 L778,499 L778,502 L777,502 L774,510 L772,511 L770,516 L767,518 L767,520 L761,525 L761,527 L750,537 L750,539 L748,539 L746,541 L746,543 L718,571 L716,571 L692,596 L690,596 L461,826 L459,826 L455,831 L453,831 L452,833 L450,833 L449,835 L445,836 L442,839 L439,839 L439,840 L437,840 L433,843 L429,843 L429,844 L426,844 L426,845 L423,845 L423,846 L416,847 L416,846 L413,846 L410,842 L410,608 L593,425 L593,9 L594,9 L595,6 L598,6 L598,5 L601,5 L601,4 L604,4 L604,3 L609,3 L609,2 L616,2 L616,1 L648,1Z";
    var PATH_B = "M4,426 L197,426 L199,429 L201,429 L201,431 L203,433 L205,433 L206,436 L209,437 L210,440 L213,441 L214,444 L217,445 L218,448 L221,449 L222,452 L225,453 L226,456 L228,456 L229,459 L232,460 L233,463 L236,464 L237,467 L240,468 L241,471 L244,472 L245,475 L248,476 L249,479 L251,479 L252,482 L255,483 L256,486 L259,487 L260,490 L263,491 L264,494 L267,495 L268,498 L271,499 L272,502 L275,503 L275,505 L278,506 L279,509 L282,510 L283,513 L286,514 L287,517 L290,518 L291,521 L294,522 L295,525 L298,526 L299,529 L301,529 L302,532 L305,533 L306,536 L309,537 L310,540 L313,541 L314,544 L317,545 L318,548 L321,549 L322,552 L324,552 L325,555 L328,556 L329,559 L332,560 L333,563 L336,564 L337,567 L340,568 L341,571 L344,572 L345,575 L348,576 L348,578 L351,579 L352,582 L355,583 L356,586 L359,587 L360,590 L363,591 L364,594 L367,595 L368,598 L371,599 L372,602 L374,602 L375,605 L377,605 L377,607 L379,609 L379,736 L380,736 L380,839 L377,843 L370,844 L370,843 L364,842 L362,840 L356,839 L356,838 L350,836 L349,834 L347,834 L346,832 L344,832 L343,830 L341,830 L340,828 L338,828 L328,818 L326,818 L296,788 L296,786 L236,727 L236,725 L216,705 L214,705 L209,700 L209,698 L197,687 L196,687 L196,771 L195,771 L194,793 L193,793 L190,808 L188,810 L188,813 L187,813 L184,821 L182,822 L182,824 L178,828 L178,830 L173,834 L173,836 L167,842 L165,842 L161,847 L159,847 L157,850 L153,851 L149,855 L147,855 L147,856 L145,856 L141,859 L138,859 L134,862 L131,862 L131,863 L127,863 L127,864 L120,865 L120,866 L114,866 L114,867 L85,867 L85,866 L79,866 L79,865 L75,865 L75,864 L72,864 L72,863 L68,863 L68,862 L65,862 L61,859 L56,858 L55,856 L53,856 L53,855 L49,854 L48,852 L46,852 L45,850 L43,850 L40,846 L38,846 L27,835 L27,833 L23,830 L23,828 L21,827 L21,825 L17,821 L17,819 L16,819 L15,815 L13,814 L13,811 L12,811 L12,809 L9,805 L9,802 L8,802 L8,799 L7,799 L7,796 L6,796 L6,793 L5,793 L4,785 L3,785 L2,770 L1,770 L1,429Z";

    var TEXT = {
        es: { load: 'Cargando modelo…', err: 'No se pudo cargar el modelo.' },
        en: { load: 'Loading model…', err: 'Could not load the model.' },
        fr: { load: 'Chargement du modèle…', err: 'Impossible de charger le modèle.' },
        pt: { load: 'Carregando modelo…', err: 'Não foi possível carregar o modelo.' }
    };
    function lang() {
        try { if (window.mjvLang && window.mjvLang.current) { var c = window.mjvLang.current(); if (TEXT[c]) return c; } } catch (e) {}
        try { var s = localStorage.getItem('mjv-lang'); if (TEXT[s]) return s; } catch (e) {}
        return 'es';
    }
    function fmt(n) { return lang() === 'fr' ? n + ' %' : n + '%'; }

    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /* ---------- Estilo (propio, para no depender del CSS de cada proyecto) ---------- */
    var css = [
        '.mjv-mloader{--mm-size:clamp(64px,7vw,104px);position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;',
        'background:var(--page-bg,#fff);color:#000;user-select:none;-webkit-user-select:none;pointer-events:none;}',
        '[data-theme="dark"] .mjv-mloader{color:#fff;}',
        '@media (orientation:portrait){.mjv-mloader{--mm-size:clamp(72px,20vw,110px);}}',
        '.mjv-mloader .mm-center{display:flex;flex-direction:column;align-items:center;gap:clamp(14px,2.6vh,24px);}',
        '.mjv-mloader .mm-logo{display:block;width:var(--mm-size);height:auto;overflow:visible;fill:currentColor;transform-origin:50% 50%;}',
        '.mjv-mloader .mm-piece{fill-rule:evenodd;opacity:0;animation:mmPiece ' + LOOP_MS + 'ms cubic-bezier(.22,1,.36,1) infinite;}',
        '.mjv-mloader .mm-j{animation-delay:calc(' + LOOP_MS + 'ms * .10);}',
        '.mjv-mloader .mm-b{animation-delay:calc(' + LOOP_MS + 'ms * .20);}',
        '@keyframes mmPiece{0%{opacity:0;transform:translateY(60px);}16%{opacity:1;transform:none;}80%{opacity:1;transform:none;}94%,100%{opacity:0;transform:none;}}',
        '.mjv-mloader .mm-text{margin:0;font-family:"texto","Helvetica Neue",Arial,sans-serif;font-size:clamp(.78rem,1vw,.95rem);letter-spacing:.08em;line-height:1;white-space:nowrap;opacity:.8;}',
        '.mjv-mloader .mm-pct{display:inline-block;min-width:3.4em;text-align:left;font-variant-numeric:tabular-nums;}',
        '.mjv-mloader.is-leaving{animation:mmFade ' + EXIT_MS + 'ms cubic-bezier(.4,0,.6,1) forwards;}',
        '.mjv-mloader.is-leaving .mm-logo{animation:mmGrow ' + EXIT_MS + 'ms cubic-bezier(.4,0,.2,1) forwards,mmOut ' + Math.round(EXIT_MS * 0.7) + 'ms ease-in forwards;}',
        '.mjv-mloader.is-leaving .mm-text{animation:mmOut ' + Math.round(EXIT_MS * 0.45) + 'ms ease forwards;}',
        '@keyframes mmFade{to{opacity:0;}}',
        '@keyframes mmGrow{to{transform:scale(' + GROW + ');}}',
        '@keyframes mmOut{to{opacity:0;}}',
        '.mjv-mloader.is-error .mm-logo{display:none;}',
        '@media (prefers-reduced-motion: reduce){.mjv-mloader .mm-piece{animation:none;opacity:1;}.mjv-mloader.is-leaving .mm-logo{animation:none;}}'
    ].join('\n');
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    function build() {
        var d = document.createElement('div');
        d.className = 'mjv-mloader';
        d.setAttribute('role', 'progressbar');
        d.setAttribute('aria-valuemin', '0');
        d.setAttribute('aria-valuemax', '100');
        d.setAttribute('aria-valuenow', '0');
        d.innerHTML =
            '<div class="mm-center">' +
            '<svg class="mm-logo" viewBox="0 0 787 868" aria-hidden="true" focusable="false">' +
            '<path class="mm-piece mm-m" d="' + PATH_M + '"/><path class="mm-piece mm-j" d="' + PATH_J + '"/><path class="mm-piece mm-b" d="' + PATH_B + '"/>' +
            '</svg><p class="mm-text"><span class="mm-label"></span> <span class="mm-pct">0%</span></p></div>';
        return d;
    }

    function attach(viewer) {
        var host = viewer.parentNode;
        if (!host || viewer.__mjvLoader) return;
        viewer.__mjvLoader = true;
        var oldStatus = host.querySelector('.loading-status');
        if (oldStatus) oldStatus.style.display = 'none';
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

        var root = build();
        host.appendChild(root);
        host.setAttribute('aria-busy', 'true');                  // cursors.js: sobre el visor, el cursor pasa a ser el ícono girando
        var labelEl = root.querySelector('.mm-label'), pctEl = root.querySelector('.mm-pct');
        function setLabel() { labelEl.textContent = TEXT[lang()].load; root.setAttribute('aria-label', TEXT[lang()].load.replace('…', '')); }
        setLabel();
        document.addEventListener('mjvlangchange', function () { if (!root.classList.contains('is-error')) setLabel(); else labelEl.textContent = TEXT[lang()].err; });

        var started = Date.now(), real = 0, loaded = false, failed = false, shown = 0, leaving = false, last = performance.now();
        viewer.addEventListener('progress', function (e) { real = Math.max(real, (e.detail && e.detail.totalProgress) || 0); });
        viewer.addEventListener('load', function () { loaded = true; real = 1; });
        viewer.addEventListener('error', function () { failed = true; });
        if (viewer.loaded) { loaded = true; real = 1; }
        // por si el aviso "load" se perdió (modelo en caché que llegó antes de armar el cargador)
        var poll = setInterval(function () {
            if (viewer.loaded) { loaded = true; real = 1; }
            if (leaving || loaded || failed) clearInterval(poll);
        }, 400);

        function paint(n) { pctEl.textContent = fmt(n); root.setAttribute('aria-valuenow', String(n)); }
        function leave() {
            root.classList.add('is-leaving');
            host.removeAttribute('aria-busy');
            setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, EXIT_MS + 60);
        }
        function tick(now) {
            if (leaving) return;
            if (failed) {
                leaving = true;
                root.classList.add('is-error');
                host.removeAttribute('aria-busy');
                labelEl.textContent = TEXT[lang()].err; pctEl.textContent = '';
                return;
            }
            var dt = Math.min(100, now - last); last = now;
            var byTime = Math.min(1, (Date.now() - started) / MIN_MS);
            var t = Math.min(real, byTime) * 100;
            // hasta que el visor avise su primer avance, el número avanza un poco solo (hasta 10 %): así no parece trabado
            if (!loaded && t < 10) t = Math.max(t, Math.min(10, (Date.now() - started) / 1000 * 2.5));
            if (t > shown) shown += Math.max((t - shown) * (1 - Math.exp(-dt / 140)), dt * 0.012);
            if (shown > t) shown = t;
            var n = Math.min(100, Math.floor(shown + 0.0001));
            if (loaded && t >= 100 && shown >= 99.4) { shown = 100; n = 100; }
            paint(n);
            if (n >= 100) { leaving = true; setTimeout(leave, 160); return; }
            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        // red de seguridad: si la pestaña está en segundo plano el navegador pausa requestAnimationFrame
        setTimeout(function () { if (!leaving && (loaded || failed)) { leaving = true; if (failed) { root.classList.add('is-error'); labelEl.textContent = TEXT[lang()].err; pctEl.textContent = ''; } else { paint(100); leave(); } } }, 20000);
    }

    // El cursor "cargando" lo dibuja cursors.js (está en la carpeta principal): si la página no lo cargó, se lo pide
    function ensureCursors() {
        if (window.mjvCursors) return;
        try {
            var me = SELF;
            if (!me) return;
            var s = document.createElement('script');
            s.src = me.replace('model-loader.js', 'cursors.js');
            document.head.appendChild(s);
        } catch (e) {}
    }
    function init() {
        ensureCursors();
        Array.prototype.forEach.call(document.querySelectorAll('model-viewer'), attach);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

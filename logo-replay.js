/* =====================================================================
   LOGO ANIMADO: UNO POR IDIOMA + REPETIR LA ANIMACIÓN AL VOLVER

   Este archivo se carga en la portada JUSTO DESPUÉS de la etiqueta <picture>
   del logo (index.html), sin "defer": así la imagen correcta se elige antes
   de que el navegador la pida (no se descarga el logo en español para
   cambiarlo enseguida por el de otro idioma).

   1) UN LOGO POR IDIOMA
      assets/mjv-logo-es.svg / -en / -fr / -pt     (animados, 4,65 s)
      assets/mjv-logo-es-fijo.svg / ...            (versión fija, para quien
                                                    tiene "reducir movimiento")
      El idioma se lee de donde lo guarda lang.js ("mjv-lang") y se actualiza
      solo cuando se cambia de idioma (evento 'mjvlangchange'). Si se cambia
      de idioma estando en el logo, se reproduce de nuevo, ya en el idioma nuevo.
      El tamaño y el centrado de cada idioma están en styles.css
      (.logo-main[data-logo-lang="..."]).
      Para sumar un idioma: agregarlo en LOGOS (abajo) y en styles.css.

   2) REPETIR LA ANIMACIÓN AL VOLVER A LA SECCIÓN DEL LOGO
      Cada vez que se vuelve a la sección del Logo (viniendo de Architecture
      o de Studio, por deslizamiento, rueda, teclado o los puntitos), la
      animación arranca de nuevo desde el primer cuadro.
      - El logo es una imagen SVG: el navegador la reproduce una sola vez al
        cargarla y no permite reiniciarla desde afuera. Volver a poner el
        mismo "src", vaciarlo o clonar la etiqueta NO funciona (probado en
        Chrome: reutiliza la imagen ya cargada). Lo que sí funciona es darle
        una imagen "nueva": se guarda una copia del texto del SVG en memoria
        y, cada vez, se crea una dirección temporal (blob:) con ese texto. No
        vuelve a descargar nada de internet.
      - Mientras la sección se desliza hacia adentro, el logo ya terminado se
        oculta (si no, se vería completo y de golpe empezaría de cero). Cuando
        la sección queda quieta, arranca la animación.
      - La "respiración" lenta del logo (styles.css) también arranca de cero:
        queda apagada mientras se espera (clase "is-waiting").
      - Con "reducir movimiento" no se repite nada: se muestra el logo fijo.

   3) CASITA DE RELLENO Y CARGADOR
      Dentro del wrap hay una casita dibujada en el propio HTML (.logo-casita): es el primer
      cuadro de la animación. Se ve siempre que el logo animado NO está en pantalla (clase
      "is-waiting" en el wrap): al cargar la página, durante el cargador (loader.js), mientras la
      sección del logo se desliza hacia adentro y mientras se prepara un cambio de idioma. Así
      nunca se ve vacío. Cuando la animación arranca (la imagen ya cargó y se pintó), se oculta.
      Con el cargador a la vista, la animación NO arranca: espera el aviso "mjvloaderdone".

   Usa dos avisos que manda scripts.js:
     mjvsectionchange   la sección empezó a cambiar  (detail.index: 0 = Logo)
     mjvsectionsettled  la sección quedó quieta
   y uno que manda lang.js:
     mjvlangchange      se cambió de idioma          (detail.lang)
   y uno que manda loader.js:
     mjvloaderdone      el cargador ya se está yendo
   ===================================================================== */
(function () {
    'use strict';

    var wrap = document.querySelector('.logo-svg-wrap');
    var pic = wrap && wrap.querySelector('picture');
    var img = pic && pic.querySelector('img');
    var fixedSource = pic && pic.querySelector('source');
    if (!img) return;

    /* ---------- Los logos de cada idioma ---------- */
    var LOGOS = {
        es: { file: 'assets/mjv-logo-es.svg', fixed: 'assets/mjv-logo-es-fijo.svg', alt: 'MJV arquitectura y diseño' },
        en: { file: 'assets/mjv-logo-en.svg', fixed: 'assets/mjv-logo-en-fijo.svg', alt: 'MJV architecture and design' },
        fr: { file: 'assets/mjv-logo-fr.svg', fixed: 'assets/mjv-logo-fr-fijo.svg', alt: 'MJV architecture et design' },
        pt: { file: 'assets/mjv-logo-pt.svg', fixed: 'assets/mjv-logo-pt-fijo.svg', alt: 'MJV arquitetura e design' }
    };

    // Mismo criterio que lang.js: el idioma guardado, y si no hay, español
    function savedLang() {
        try {
            var s = localStorage.getItem('mjv-lang');
            if (LOGOS[s]) return s;
        } catch (e) {}
        return 'es';
    }
    var lang = savedLang();

    // Idioma → atributos de la imagen (los usa el CSS para el tamaño y el centrado)
    function applyLang(l) {
        var d = LOGOS[l];
        wrap.setAttribute('data-logo-lang', l);
        img.alt = d.alt;
        if (fixedSource) fixedSource.setAttribute('srcset', d.fixed);
    }
    applyLang(lang);

    // Con "reducir movimiento" se muestra el logo fijo: no hay animación que repetir
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var reduced = !!(reduce && reduce.matches);

    // ¿Hay un cargador a la vista? Entonces la animación espera a que se vaya (más abajo).
    var loaderActive = !!(window.mjvLoader && window.mjvLoader.active);

    if (reduced || !loaderActive) {
        // Primera carga normal, a la primera vista. La casita de relleno (is-waiting) queda hasta
        // que la imagen está pintada.
        img.onload = img.onerror = function () {
            img.onload = img.onerror = null;
            revealSoon();
        };
        img.src = LOGOS[lang].file;
    } else {
        img.style.visibility = 'hidden';         // sin pedir la imagen todavía: la casita de relleno ocupa su lugar
    }

    // Quita la casita de relleno recién cuando la imagen ya se pintó (dos cuadros después de cargar),
    // así no hay un parpadeo vacío en el cambio.
    function revealSoon() {
        var go = function () { img.style.visibility = ''; wrap.classList.remove('is-waiting'); };
        if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(go); });
        else go();
    }

    var SETTLE_FALLBACK_MS = 1300;               // red de seguridad: la transición dura 800 ms
    var onLogo = true;                           // ¿se está viendo la sección del logo?
    var waiting = false;                         // llegó al logo y espera a que la sección quede quieta
    var timer = null;                            // red de seguridad (se cancela si se sale o ya arrancó)

    // Idioma elegido → cambia el logo (y, si es el fijo, su versión)
    document.addEventListener('mjvlangchange', function (e) {
        var l = e.detail && e.detail.lang;
        if (!LOGOS[l] || l === lang) return;
        lang = l;
        applyLang(l);
        if (reduced) return;                     // logo fijo: el <source> ya cambió
        if (loaderActive) return;                // con el cargador a la vista la animación todavía no arrancó: arrancará en el idioma nuevo
        if (onLogo) {                            // se está mirando: se reproduce de nuevo, en el idioma nuevo
            waiting = false;
            clearTimeout(timer);
            img.style.visibility = 'hidden';
            wrap.classList.add('is-waiting');
            playFromStart();
        }
        // Si está en otra sección, la imagen vieja queda fuera de vista y al volver
        // se reproduce directamente la del idioma nuevo.
    });

    if (reduced) return;

    /* ---------- Repetir la animación ---------- */

    // ¿La página arrancó en el logo? (si se entró por #architecture, no). Se
    // consulta cuando el carrusel ya existe.
    document.addEventListener('DOMContentLoaded', function () {
        var el = document.querySelector('.swiper-container');
        if (el && el.swiper && el.swiper.realIndex !== 0) onLogo = false;
    });

    /* Copia del SVG de cada idioma en memoria (una sola descarga por idioma) */
    var texts = {}, pending = {};
    function getText(l) {
        if (texts[l] == null && window.mjvLoader && window.mjvLoader.texts && window.mjvLoader.texts[LOGOS[l].file]) {
            texts[l] = window.mjvLoader.texts[LOGOS[l].file];   // ya la bajó el cargador
        }
        if (texts[l] != null) return Promise.resolve(texts[l]);
        if (!pending[l]) {
            try {
                pending[l] = fetch(LOGOS[l].file)
                    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
                    .then(function (t) { texts[l] = t; return t; })
                    .catch(function () { pending[l] = null; return null; });
            } catch (e) { pending[l] = Promise.resolve(null); }
        }
        return pending[l];
    }
    // Se prepara la copia del idioma actual apenas la página terminó de cargar
    // (el archivo ya está en la memoria del navegador, no se vuelve a bajar),
    // así el primer reinicio es instantáneo.
    window.addEventListener('load', function () { setTimeout(function () { getText(lang); }, 1500); });

    var current = null;           // dirección temporal que se está mostrando
    var stale = [];               // direcciones temporales viejas, para liberarlas

    function reveal() {
        revealSoon();                            // quita la casita de relleno y la "respiración" vuelve a contar desde cero
    }

    function playFromStart() {
        var l = lang;
        getText(l).then(function (text) {
            if (!onLogo || l !== lang) return;   // se fue, o cambió de idioma, antes de que estuviera lista
            var next;
            if (text) {
                next = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
            } else {                             // respaldo (ej. abriendo el archivo sin servidor)
                var f = LOGOS[l].file;
                next = f + (f.indexOf('?') < 0 ? '?' : '&') + 'r=' + Date.now();
            }
            if (current) stale.push(current);
            current = text ? next : null;
            img.onload = img.onerror = function () {
                img.onload = img.onerror = null;
                while (stale.length) URL.revokeObjectURL(stale.pop());
                reveal();
            };
            img.src = next;
        });
    }

    // Cuando el cargador se va, arranca la animación (si se sigue en la sección del logo).
    // Si ya no se está en el logo, queda lista para cuando se vuelva (flujo normal de abajo).
    function onLoaderDone() {
        if (!loaderActive) return;
        loaderActive = false;
        if (onLogo) {
            img.style.visibility = 'hidden';
            wrap.classList.add('is-waiting');
            playFromStart();
        }
    }
    document.addEventListener('mjvloaderdone', onLoaderDone);
    // Red de seguridad: si el aviso no llegara nunca (cargador roto), arranca igual
    if (loaderActive) setTimeout(onLoaderDone, 16000);

    function settle() {
        clearTimeout(timer);
        if (!waiting) return;
        waiting = false;
        playFromStart();
    }

    document.addEventListener('mjvsectionchange', function (e) {
        var index = e.detail && e.detail.index;
        if (index === 0) {
            if (onLogo) return;                  // ya estaba en el logo
            onLogo = true;
            waiting = true;
            img.style.visibility = 'hidden';     // no se ve el logo terminado mientras se desliza
            wrap.classList.add('is-waiting');    // y sin "respiración"
            clearTimeout(timer);
            timer = setTimeout(settle, SETTLE_FALLBACK_MS);  // por si el aviso de "quedó quieta" no llegara
        } else {
            onLogo = false;
            waiting = false;
            clearTimeout(timer);
        }
    });

    document.addEventListener('mjvsectionsettled', function (e) {
        if (e.detail && e.detail.index === 0) settle();
    });
})();

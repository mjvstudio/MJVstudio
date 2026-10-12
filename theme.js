/* ==========================================================================
   TEMA CLARO / OSCURO — MJV Studio
   Un solo archivo compartido por TODO el sitio (portada + páginas de
   proyecto), así la elección del visitante es la misma en todas partes.
   ========================================================================== */

// 1) Aplicar el tema guardado ANTES de que se pinte la página, para que
//    no se vea un "flash" del tema equivocado por una fracción de segundo.
//    Por eso este bloque corre suelto (no espera a DOMContentLoaded) y por
//    eso <script src="theme.js"> va en el <head>, no al final del body.
(function () {
    try {
        var saved = localStorage.getItem('mjv-theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
        // Lo mismo con el sonido: si estaba silenciado, el ícono correcto
        // (parlante tachado) se ve desde el primer instante, sin parpadeo.
        if (localStorage.getItem('mjv-sound-muted') === 'true') {
            document.documentElement.setAttribute('data-sound', 'off');
        }
    } catch (e) {
        // Si el navegador bloquea localStorage, seguimos en modo claro.
    }
})();

// Cursores (cursors.js): las páginas de proyecto cargan este archivo, así que desde acá se carga también cursors.js
// (si la página ya lo trae, no se duplica).
(function () {
    var me = document.currentScript && document.currentScript.src;
    if (!me) return;
    document.addEventListener('DOMContentLoaded', function () {
        if (window.mjvCursors || document.querySelector('script[src$="cursors.js"]')) return;
        var s = document.createElement('script');
        s.src = me.replace(/theme\.js(\?.*)?$/, 'cursors.js');
        document.head.appendChild(s);
    });
})();

// Fundido gradual: durante el cambio, <html> lleva la clase "theme-fading" (ver
// dark-mode.css, sección "CAMBIO DE TEMA GRADUAL"). Dura lo que diga --theme-fade.
var mjvThemeFadeTimer = 0;
function fadeMjvTheme() {
    var root = document.documentElement;
    try {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // sin animación
        var v = getComputedStyle(root).getPropertyValue('--theme-fade').trim();       // "0.6s" o "600ms"
        var ms = /ms$/.test(v) ? parseFloat(v) : parseFloat(v) * 1000;
        if (!(ms > 0)) ms = 600;
        root.classList.add('theme-fading');
        clearTimeout(mjvThemeFadeTimer);
        mjvThemeFadeTimer = setTimeout(function () { root.classList.remove('theme-fading'); }, ms + 120);
    } catch (e) {}
}

// 2) Cambiar de tema (la usan los botones, donde existan)
function toggleMjvTheme() {
    fadeMjvTheme();                  // antes de cambiar: así el cambio se anima
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.documentElement.removeAttribute('data-theme');
        try { localStorage.setItem('mjv-theme', 'light'); } catch (e) {}
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        try { localStorage.setItem('mjv-theme', 'dark'); } catch (e) {}
    }
    if (window.mjvSound) window.mjvSound.click();
    updateMjvThemeButtons();
}

function updateMjvThemeButtons() {
    var btns = document.querySelectorAll('.js-theme-toggle');
    if (!btns.length) return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var pick = function (d) { return window.mjvLang ? window.mjvLang.pick(d) : d.es; };
    var label = isDark
        ? pick({ es: 'Cambiar a modo claro', en: 'Switch to light mode', fr: 'Passer en mode clair', pt: 'Mudar para o modo claro' })
        : pick({ es: 'Cambiar a modo oscuro', en: 'Switch to dark mode', fr: 'Passer en mode sombre', pt: 'Mudar para o modo escuro' });
    // El ícono (luna/sol) lo decide el CSS según data-theme; acá solo se
    // actualiza el texto de ayuda. No se toca el contenido del botón.
    btns.forEach(function (btn) {
        btn.title = label;
        btn.setAttribute('aria-label', label);
        btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    });
}

// 3) Conectar todos los botones de esta página (puede haber más de uno,
//    uno por sección) una vez cargado el DOM
document.addEventListener('DOMContentLoaded', function () {
    var btns = document.querySelectorAll('.js-theme-toggle');
    btns.forEach(function (btn) {
        btn.addEventListener('click', toggleMjvTheme);
    });
    updateMjvThemeButtons();
    // Si cambia el idioma, se actualizan también los textos de ayuda
    document.addEventListener('mjvlangchange', updateMjvThemeButtons);
});

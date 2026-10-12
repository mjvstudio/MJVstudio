/* ==========================================================================
   IDIOMAS (ES / EN / FR / PT) — MJV Studio
   Mismo patrón que theme.js y sound.js: la barra de preferencias está en
   todas las páginas y lo elegido se guarda (localStorage) para todo el sitio.
   El selector es un despliegue con el nombre de cada idioma en su propia
   lengua: Español, English, Français, Português.

   El idioma ORIGINAL del sitio es el español: está escrito directo en el
   HTML y en los .txt sin sufijo. Las demás lenguas se agregan así:

   1) Texto fijo en el HTML → atributos data-en, data-fr, data-pt en el
      mismo elemento que tiene el texto en español:
        <h2 data-en="Project" data-fr="Projet" data-pt="Projeto">Proyecto</h2>
      Si falta una lengua, se muestra la inglesa; y si tampoco, la española.
      Para los textos de ayuda de un campo: data-en-placeholder,
      data-fr-placeholder, data-pt-placeholder.

   2) Texto que se carga desde un .txt → un archivo por idioma con sufijo:
      memoria20.txt (es), memoria20_en.txt, memoria20_fr.txt, memoria20_pt.txt.
      Cada página pide el archivo con mjvLang.suffix() y vuelve a pedirlo
      cuando llega el evento 'mjvlangchange'.

   3) Textos armados por JavaScript → window.mjvLang.pick({ es:…, en:…,
      fr:…, pt:… }) devuelve el del idioma actual.

   Para sumar un idioma nuevo: agregarlo en LANGS y NAMES, sumarle su
   opción <a data-lang-option="xx"> al menú, y traducir los textos.
   ========================================================================== */

(function () {
    var LANGS = ['es', 'en', 'fr', 'pt'];

    var current = 'es';
    try {
        var saved = localStorage.getItem('mjv-lang');
        if (LANGS.indexOf(saved) !== -1) current = saved;
    } catch (e) {}
    document.documentElement.setAttribute('lang', current);

    // Devuelve el texto del idioma actual. Si falta: inglés, y si no, español.
    function pick(dict) {
        if (!dict) return '';
        return dict[current] || dict.en || dict.es || '';
    }

    function applyStaticTranslations() {
        document.querySelectorAll('[data-en],[data-fr],[data-pt]').forEach(function (el) {
            // El original (español) se guarda una sola vez, antes de cambiarlo
            if (el.dataset.es === undefined) el.dataset.es = el.textContent;
            el.textContent = current === 'es'
                ? el.dataset.es
                : (el.dataset[current] || el.dataset.en || el.dataset.es);
        });

        // Textos de ayuda dentro de los campos de formulario (placeholder)
        document.querySelectorAll('[data-en-placeholder],[data-fr-placeholder],[data-pt-placeholder]').forEach(function (el) {
            if (el.dataset.esPlaceholder === undefined) {
                el.dataset.esPlaceholder = el.getAttribute('placeholder') || '';
            }
            el.setAttribute('placeholder', current === 'es'
                ? el.dataset.esPlaceholder
                : (el.dataset[current + 'Placeholder'] || el.dataset.enPlaceholder || el.dataset.esPlaceholder));
        });
    }

    function updateLangUI() {
        // Botón del globo: el ícono es fijo; cambia el texto de ayuda
        var label = pick({ es: 'Idioma', en: 'Language', fr: 'Langue', pt: 'Idioma' });
        document.querySelectorAll('.js-lang-toggle').forEach(function (btn) {
            btn.title = label;
            btn.setAttribute('aria-label', label);
        });
        // Opciones del menú: se marca la que está en uso
        document.querySelectorAll('[data-lang-option]').forEach(function (a) {
            var active = a.getAttribute('data-lang-option') === current;
            a.classList.toggle('is-active', active);
            if (active) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
        });
    }

    function setLang(code) {
        if (LANGS.indexOf(code) === -1 || code === current) return;
        current = code;
        try { localStorage.setItem('mjv-lang', current); } catch (e) {}
        document.documentElement.setAttribute('lang', current);
        if (window.mjvSound) window.mjvSound.click();
        applyStaticTranslations();
        updateLangUI();
        // Avisa a las páginas para que vuelvan a pedir sus .txt en el idioma nuevo
        document.dispatchEvent(new CustomEvent('mjvlangchange', { detail: { lang: current } }));
    }

    window.mjvLang = {
        current: function () { return current; },
        // Sufijo de los archivos .txt: '' (español), '_en', '_fr', '_pt'
        suffix: function () { return current === 'es' ? '' : '_' + current; },
        pick: pick,
        set: setLang,
        languages: LANGS.slice()
    };

    document.addEventListener('DOMContentLoaded', function () {
        applyStaticTranslations();
        updateLangUI();

        document.querySelectorAll('[data-lang-option]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                setLang(a.getAttribute('data-lang-option'));
            });
        });

        // Despliegue: el mismo mecanismo animado de Categorías y Contacto
        // (dropdown.js). Si por algún motivo no estuviera cargado, el botón
        // abre y cierra el menú de forma simple para que no quede inaccesible.
        var btn = document.querySelector('.js-lang-toggle');
        var menu = document.getElementById('lang-dropdown');
        if (btn && menu) {
            if (typeof window.setupAnimatedDropdown === 'function') {
                window.setupAnimatedDropdown(btn, menu);
            } else {
                btn.addEventListener('click', function () {
                    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
                });
            }
        }
    });
})();

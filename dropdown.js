/* ==========================================================================
   DESPLIEGUE ANIMADO — MJV Studio
   Es el mismo mecanismo que usan Categorías, Contacto e Idioma. Estaba
   dentro de scripts.js; se sacó a este archivo para que también lo puedan
   usar las páginas de proyecto (que no cargan scripts.js).

   Uso:  setupAnimatedDropdown(botón, contenedorDeOpciones)
   - El contenedor tiene <a style="--i: N"> por cada opción (el número más
     alto aparece último; ver los CSS de ".dropdown-content" o
     ".lang-dropdown-content").
   - Se abre con el mouse encima o con un click/toque; se cierra al sacar el
     mouse, al hacer click afuera o con Escape. Al cerrar, las opciones se
     esconden en orden inverso al que aparecieron.
   ========================================================================== */

// Cuántas listas hay abiertas ahora (para difuminar el contenido de fondo: clase "dd-open" en <html>)
const mjvOpenDropdowns = new Set();
function mjvSyncDropdownBlur(el, open) {
    if (open) mjvOpenDropdowns.add(el); else mjvOpenDropdowns.delete(el);
    document.documentElement.classList.toggle('dd-open', mjvOpenDropdowns.size > 0);
}

function setupAnimatedDropdown(buttonEl, dropdownEl) {
    if (!buttonEl || !dropdownEl) return;

    const items = dropdownEl.querySelectorAll('a');
    const maxIndex = items.length
        ? Math.max(...Array.from(items).map(a => parseFloat(getComputedStyle(a).getPropertyValue('--i')) || 0))
        : 0;
    dropdownEl.style.setProperty('--max-i', maxIndex);

    const STEP_MS = 100;   // debe coincidir con el "0.1s" de los keyframes en CSS
    const ITEM_ANIM_MS = 300;
    const CLOSE_TOTAL_MS = (maxIndex * STEP_MS) + ITEM_ANIM_MS + 50;

    let hideTimer, closeAnimTimer;
    let lastTouch = 0;

    const isOpen = () => dropdownEl.style.display === 'block';

    // Si el botón avisa si está desplegado (aria-expanded), se mantiene al día
    const syncAria = (expanded) => {
        if (buttonEl.hasAttribute('aria-expanded')) {
            buttonEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    };

    const open = () => {
        clearTimeout(hideTimer);
        clearTimeout(closeAnimTimer);
        dropdownEl.classList.remove('closing');
        dropdownEl.style.display = 'block';
        syncAria(true);
        mjvSyncDropdownBlur(dropdownEl, true);
    };

    const closeNow = () => {
        dropdownEl.style.display = 'none';
        dropdownEl.classList.remove('closing');
        syncAria(false);
        mjvSyncDropdownBlur(dropdownEl, false);
    };

    const closeAnimated = () => {
        if (!isOpen() || dropdownEl.classList.contains('closing')) return;
        dropdownEl.classList.add('closing');
        mjvSyncDropdownBlur(dropdownEl, false);   // el fondo recupera la nitidez mientras las opciones se esconden
        clearTimeout(closeAnimTimer);
        closeAnimTimer = setTimeout(closeNow, CLOSE_TOTAL_MS);
    };

    const scheduleClose = () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(closeAnimated, 200);
    };

    // En pantallas táctiles, un toque dispara primero un "mouseenter" falso y
    // enseguida el click. Sin esta guarda, el toque abriría el menú y el click
    // lo cerraría de inmediato. Si hace poco hubo un toque, se ignora el
    // "mouseenter" y queda solo el click, que abre y cierra con normalidad.
    const markTouch = () => { lastTouch = Date.now(); };
    const hoverOpen = () => { if (Date.now() - lastTouch > 800) open(); };
    const hoverClose = () => { if (Date.now() - lastTouch > 800) scheduleClose(); };

    buttonEl.addEventListener('touchstart', markTouch, { passive: true });
    dropdownEl.addEventListener('touchstart', markTouch, { passive: true });

    buttonEl.addEventListener('mouseenter', hoverOpen);
    buttonEl.addEventListener('mouseleave', hoverClose);
    buttonEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.mjvSound) window.mjvSound.click();
        (isOpen() && !dropdownEl.classList.contains('closing')) ? closeAnimated() : open();
    });

    dropdownEl.addEventListener('mouseenter', hoverOpen);
    dropdownEl.addEventListener('mouseleave', hoverClose);

    document.addEventListener('click', (e) => {
        if (!buttonEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            closeAnimated();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAnimated();
    });
}

/* =====================================================================
   CURSOR "CARGANDO" — MJV Studio

   Qué hace
   - Cuando el mouse está sobre algo que se está cargando, el cursor desaparece y en su lugar GIRA el ícono
     assets/cursors/…/progress_activity.svg (un cursor .svg no puede animarse; por eso se dibuja un elemento
     que sigue al mouse). Cuando termina de cargar, vuelve el cursor normal.
   - Qué cuenta como "cargando":
       · mientras se abre un proyecto sobre la portada (<html class="project-loading">, project-layer.js);
       · cualquier elemento (o algo dentro de él) con aria-busy="true" o la clase "is-loading";
       · el visor 3D mientras carga el modelo (model-loader.js le pone aria-busy="true" a su caja).
     Para sumarlo a otra cosa: ponerle aria-busy="true" mientras carga y sacárselo al terminar.
   - Solo con mouse (en pantallas táctiles no hay cursor).
   El estilo y los colores están en dark-mode.css (".cur-spinner", sección CURSORES).
   ===================================================================== */
(function () {
    'use strict';
    if (window.mjvCursors) return;
    var root = document.documentElement;
    var SELF = (document.currentScript && document.currentScript.src) || document.baseURI;
    // un url() leído de una variable CSS es relativo a la hoja de estilos, no a la página: se vuelve absoluto
    function absUrl(v) { return v.replace(/url\((['"]?)([^'")]+)\1\)/g, function (m, q, u) { try { return 'url("' + new URL(u, SELF).href + '")'; } catch (e) { return m; } }); }
    root.classList.add('cur-on');

    var el = document.createElement('div');
    el.className = 'cur-spinner';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<svg viewBox="0 -960 960 960"><path class="halo" d="M339.65-147.8q-65.59-27.8-114.82-77.03-49.23-49.23-77.03-114.82Q120-405.23 120-480.09q0-74.87 27.92-140.46 27.93-65.6 76.93-114.6 49-49 114.85-76.93Q405.56-840 480-840q6.58 0 10.98 4.41t4.4 11q0 6.59-4.4 10.97-4.4 4.39-10.98 4.39-136.38 0-232.81 96.42-96.42 96.43-96.42 232.81t96.42 232.81q96.43 96.42 232.81 96.42t232.81-96.42q96.42-96.43 96.42-232.81 0-6.62 4.41-11t11-4.38q6.59 0 10.98 4.4Q840-486.58 840-480q0 74.44-27.92 140.3-27.93 65.85-76.93 114.85-49 49-114.6 76.93Q554.96-120 480.09-120q-74.86 0-140.44-27.8Z"/><path class="ink" d="M339.65-147.8q-65.59-27.8-114.82-77.03-49.23-49.23-77.03-114.82Q120-405.23 120-480.09q0-74.87 27.92-140.46 27.93-65.6 76.93-114.6 49-49 114.85-76.93Q405.56-840 480-840q6.58 0 10.98 4.41t4.4 11q0 6.59-4.4 10.97-4.4 4.39-10.98 4.39-136.38 0-232.81 96.42-96.42 96.43-96.42 232.81t96.42 232.81q96.43 96.42 232.81 96.42t232.81-96.42q96.42-96.43 96.42-232.81 0-6.62 4.41-11t11-4.38q6.59 0 10.98 4.4Q840-486.58 840-480q0 74.44-27.92 140.3-27.93 65.85-76.93 114.85-49 49-114.6 76.93Q554.96-120 480.09-120q-74.86 0-140.44-27.8Z"/></svg>';

    var x = -100, y = -100, over = null, seen = false, busyNow = false;

    function busyAt(target) {
        if (root.classList.contains('project-loading')) return true;
        return !!(target && target.closest && target.closest('[aria-busy="true"], .is-loading'));
    }
    function update() {
        var b = seen && busyAt(over);
        if (b !== busyNow) {
            busyNow = b;
            root.classList.toggle('cur-busy', b);
            el.classList.toggle('is-on', b);
        }
        el.style.translate = x + 'px ' + y + 'px';
    }
    function mount() { if (!el.parentNode) document.body.appendChild(el); }

    document.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        mount();
        seen = true; x = e.clientX; y = e.clientY; over = e.target;
        update();
    }, { passive: true });
    document.addEventListener('pointerover', function (e) { over = e.target; update(); }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { seen = false; update(); });
    document.documentElement.addEventListener('mouseenter', function () { seen = true; });
    // los cambios de estado (empieza / termina de cargar) aunque el mouse esté quieto
    var mo = new MutationObserver(update);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    function watchBody() { mo.observe(document.body, { attributes: true, attributeFilter: ['aria-busy', 'class'], subtree: true }); }
    if (document.body) watchBody(); else document.addEventListener('DOMContentLoaded', watchBody);

    /* Arrastrar para pasar de sección: mientras se arrastra con el mouse, el cursor es la mano (pan_tool).
       No depende de Swiper: se detecta el gesto (botón izquierdo apretado + movimiento) en cualquier parte de la
       página, salvo donde el arrastre es otra cosa (el visor 3D, los proyectos de la grilla, el control de volumen,
       campos de texto). */
    var press = null;
    var NOT_PAN = 'a[href], button, [role="button"], [data-cur-touch], model-viewer, .modelo-3d-wrapper, .vol-pop, input, textarea, select, .project, .team-card, .info-modal-box';
    function stopPan() { press = null; root.classList.remove('is-swiping'); }
    document.addEventListener('pointerdown', function (e) {
        if (e.pointerType !== 'mouse' || e.button !== 0) return;
        press = (e.target.closest && e.target.closest(NOT_PAN)) ? null : { x: e.clientX, y: e.clientY };
        if (press && e.target.closest && e.target.closest('.swiper-container')) root.classList.add('is-swiping'); // mano cerrada al apretar
    }, true);
    document.addEventListener('pointermove', function (e) {
        if (!press || e.pointerType !== 'mouse') return;
        if (Math.abs(e.clientX - press.x) + Math.abs(e.clientY - press.y) > 8) root.classList.add('is-swiping');
    }, true);
    ['mouseup', 'pointerup', 'pointercancel', 'dragend', 'blur', 'contextmenu'].forEach(function (t) { window.addEventListener(t, stopPan, true); });

    /* Visor 3D: el <model-viewer> cambia su cursor por su cuenta (y en su interior, según la versión). Se fuerza el
       ícono 3d_rotation en el visor y en todo lo que tiene adentro, y se vuelve a forzar si el visor lo cambia. */
    function cursor3d(mv) {
        if (mv.__mjv3d) return;
        mv.__mjv3d = true;
        var val = absUrl(getComputedStyle(root).getPropertyValue('--cur-3d').trim()) || 'grab';
        function apply() {
            val = absUrl(getComputedStyle(root).getPropertyValue('--cur-3d').trim()) || val;
            var list = [mv];
            if (mv.shadowRoot) Array.prototype.push.apply(list, mv.shadowRoot.querySelectorAll('*'));
            list.forEach(function (n) {
                if (n.style && n.style.getPropertyValue('cursor') !== val || (n.style && n.style.getPropertyPriority('cursor') !== 'important')) {
                    if (n.style) n.style.setProperty('cursor', val, 'important');
                }
            });
        }
        apply();
        new MutationObserver(apply).observe(mv, { attributes: true, attributeFilter: ['style'] });
        if (mv.shadowRoot) new MutationObserver(apply).observe(mv.shadowRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        window.addEventListener('pointerup', function () { apply(); setTimeout(apply, 0); }, true);
        window.addEventListener('pointercancel', apply, true);
        mv.addEventListener('load', apply);
        mv.addEventListener('pointerdown', apply);
        mv.addEventListener('pointerenter', apply);
        new MutationObserver(apply).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    }
    function hook3d() { Array.prototype.forEach.call(document.querySelectorAll('model-viewer'), cursor3d); }
    document.addEventListener('DOMContentLoaded', function () { hook3d(); setTimeout(hook3d, 800); });
    window.addEventListener('load', function () { hook3d(); setTimeout(hook3d, 1500); });
    if (window.customElements && customElements.whenDefined) customElements.whenDefined('model-viewer').then(function () { setTimeout(hook3d, 50); });

    /* Elementos que la propia página marca con cursor:pointer (botones de flechas, cerrar, fotos...): se les pone el
       dedo igual que al resto. Se detecta al pasar el mouse. */
    var checked = window.WeakSet ? new WeakSet() : { has: function () { return false; }, add: function () {} };
    document.addEventListener('pointerover', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var t = e.target;
        if (!t || t.nodeType !== 1 || checked.has(t)) return;
        checked.add(t);
        if (getComputedStyle(t).cursor === 'pointer') t.setAttribute('data-cur-touch', '');
    }, true);

    window.mjvCursors = { update: update };
})();

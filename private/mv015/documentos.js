/* =====================================================================
   MV015 · DOCUMENTOS — carpetas de planos
   - Las carpetas son los botones de .pg-tabs (Arquitectura, Estructural...).
   - Cada carpeta tiene su grupo .pg-doc-files[data-folder] con un botón por lámina:
       <button data-img="documentos/x/img/lamina-1.webp" data-pdf="documentos/x/archivo.pdf">Lámina 1</button>
   - La lámina se muestra en el visor con zoom de la página (.pg-zoom de secciones.js):
     doble toque / doble clic, pellizco, Ctrl + ruedita y botones + y −. Funciona igual en el celular.
   - Los botones de la derecha abren o descargan el PDF original de esa lámina.
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const sec = document.getElementById('pg-docs');
    if (!sec) return;
    const T = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);
    const tabs = Array.from(sec.querySelectorAll('.pg-tabs [role="tab"]'));
    const groups = Array.from(sec.querySelectorAll('.pg-doc-files'));
    const view = document.getElementById('pg-doc-view');
    const emptyEl = document.getElementById('pg-doc-empty');
    const openA = Array.from(sec.querySelectorAll('[data-doc-open]'));
    const dlA = Array.from(sec.querySelectorAll('[data-doc-download]'));
    const fileName = (p) => decodeURIComponent(p.split('/').pop());
    let current = null;

    const show = (src, alt) => {
        if (view.pgZoom) view.pgZoom.show(src, alt);
        else { view.dataset.pendingSrc = src; }
    };

    const showFile = (btn, sound) => {
        if (btn === current) return;
        groups.forEach((g) => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false')));
        current = btn;
        const pdf = encodeURI(btn.dataset.pdf);
        openA.forEach((a) => { a.href = pdf; });
        dlA.forEach((a) => { a.href = pdf; a.setAttribute('download', fileName(btn.dataset.pdf)); });
        show(encodeURI(btn.dataset.img), btn.textContent.trim());
        if (sound && window.mjvSound && window.mjvSound.click) window.mjvSound.click();
    };

    const showFolder = (tab, sound) => {
        tabs.forEach((t) => { const on = t === tab; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
        let first = null;
        groups.forEach((g) => {
            const on = g.dataset.folder === tab.dataset.folder;
            g.hidden = !on;
            if (on) first = g.querySelector('button');
        });
        view.hidden = !first; emptyEl.hidden = !!first;
        current = null;
        if (first) showFile(first, false);
        if (sound && window.mjvSound && window.mjvSound.click) window.mjvSound.click();
    };

    tabs.forEach((t) => t.addEventListener('click', (e) => { e.stopPropagation(); if (t.getAttribute('aria-selected') !== 'true') showFolder(t, true); }));
    groups.forEach((g) => g.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); showFile(b, true); })));

    const labels = () => {
        const o = T({ es: 'Abrir PDF', en: 'Open PDF', fr: 'Ouvrir le PDF', pt: 'Abrir PDF' });
        const d = T({ es: 'Descargar PDF', en: 'Download PDF', fr: 'Télécharger le PDF', pt: 'Baixar PDF' });
        openA.forEach((a) => { a.title = o; a.setAttribute('aria-label', o); });
        dlA.forEach((a) => { a.title = d; a.setAttribute('aria-label', d); });
    };
    labels(); document.addEventListener('mjvlangchange', labels);

    // secciones.js arma el visor con zoom en su DOMContentLoaded (va antes que este archivo)
    if (tabs.length) showFolder(tabs[0], false);

    // Las otras láminas de la carpeta se piden de antemano cuando la página ya cargó (el modelo 3D va primero)
    const preload = () => {
        sec.querySelectorAll('.pg-doc-files button').forEach((b, i) => setTimeout(() => { const im = new Image(); im.decoding = 'async'; im.src = encodeURI(b.dataset.img); }, 1500 + i * 250));
    };
    if (document.readyState === 'complete') preload(); else window.addEventListener('load', preload);
});

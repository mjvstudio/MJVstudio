/* =====================================================================
   MV015 · DOCUMENTOS — carpetas de planos con vista previa y descarga
   - Las carpetas son los botones de .pg-tabs (Arquitectura, Estructural...).
   - Cada carpeta tiene su grupo .pg-doc-files[data-folder] con un botón por lámina:
       <button data-pdf="documentos/arquitectura/archivo.pdf">Nombre</button>
     Para sumar un plano: copiar el PDF a su carpeta y agregar un botón igual.
   - En computadoras el PDF se ve dentro de la página; en celulares (que no muestran
     PDF dentro de una página) aparece una tarjeta para abrirlo o descargarlo.
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const sec = document.getElementById('pg-docs');
    if (!sec) return;
    const T = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);
    const tabs = Array.from(sec.querySelectorAll('.pg-tabs [role="tab"]'));
    const groups = Array.from(sec.querySelectorAll('.pg-doc-files'));
    const frame = document.getElementById('pg-doc-frame');
    const card = document.getElementById('pg-doc-card');
    const cardName = document.getElementById('pg-doc-card-name');
    const openA = Array.from(sec.querySelectorAll('[data-doc-open]'));
    const dlA = Array.from(sec.querySelectorAll('[data-doc-download]'));
    const emptyEl = document.getElementById('pg-doc-empty');
    const view = document.getElementById('pg-doc-view');

    // ¿El navegador muestra PDF dentro de la página? (Android y la mayoría de los celulares no)
    const touch = matchMedia('(pointer: coarse)').matches;
    const inlinePdf = navigator.pdfViewerEnabled === true && !(touch && /Android|iPhone|iPad/i.test(navigator.userAgent));

    const fileName = (p) => decodeURIComponent(p.split('/').pop());
    let current = null, loaded = false;

    const showFile = (btn) => {
        groups.forEach((g) => g.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false')));
        current = btn;
        const url = encodeURI(btn.dataset.pdf);
        openA.forEach((a) => { a.href = url; });
        dlA.forEach((a) => { a.href = url; a.setAttribute('download', fileName(btn.dataset.pdf)); });
        cardName.textContent = btn.textContent.trim();
        if (inlinePdf && loaded) frame.src = url + '#view=FitH&toolbar=1&navpanes=0';
    };

    const showFolder = (tab) => {
        tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'));
        let first = null;
        groups.forEach((g) => {
            const on = g.dataset.folder === tab.dataset.folder;
            g.hidden = !on;
            if (on) first = g.querySelector('button');
        });
        view.hidden = !first; emptyEl.hidden = !!first;
        if (first) showFile(first);
        if (window.mjvSound && window.mjvSound.click && loaded) window.mjvSound.click();
    };

    tabs.forEach((t) => t.addEventListener('click', () => showFolder(t)));
    groups.forEach((g) => g.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => showFile(b))));

    frame.hidden = !inlinePdf;
    card.hidden = inlinePdf;

    // La ruedita sobre el PDF lo desplaza; no cambia de sección
    view.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

    if (tabs.length) showFolder(tabs[0]);
    // Los PDF se piden recién cuando la página terminó de cargar (el modelo 3D va primero)
    const start = () => { loaded = true; if (current) showFile(current); };
    if (document.readyState === 'complete') setTimeout(start, 600); else window.addEventListener('load', () => setTimeout(start, 600));

    const labels = () => {
        cardName.title = T({ es: 'Plano', en: 'Drawing', fr: 'Plan', pt: 'Planta' });
    };
    labels(); document.addEventListener('mjvlangchange', labels);
});

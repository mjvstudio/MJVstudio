/* Páginas privadas (private/<proyecto>/): carrusel de 3 secciones, galería con visor y recorrido 360. */
document.addEventListener('DOMContentLoaded', () => {
    const T = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);
    const html = document.documentElement;

    /*-------- CARRUSEL: 1) galería  2) recorrido 360  3) antes y después --------*/
    const swiper = new Swiper('.swiper-container', {
        direction: 'horizontal', loop: false, slidesPerView: 1, speed: 800, simulateTouch: true, effect: 'slide',
        keyboard: { enabled: true, onlyInViewport: false },
        pagination: { el: '.swiper-pagination', clickable: true }
    });
    // Deslizar con el mouse desde fuera del recuadro 360: mientras se arrastra, el recorrido deja de "tragarse" el mouse
    swiper.on('touchStart', () => html.classList.add('pg-swiping'));
    swiper.on('touchEnd', () => html.classList.remove('pg-swiping'));
    document.addEventListener('mouseup', () => html.classList.remove('pg-swiping'));
    let lastSound = swiper.realIndex;
    swiper.on('slideChange', () => { if (swiper.realIndex === lastSound) return; lastSound = swiper.realIndex; if (window.mjvSound) window.mjvSound.swipe(); });

    // Ruedita del mouse: pasa de una sección a la otra (sobre el recorrido 360 la ruedita es del recorrido)
    let wheelTimer;
    window.addEventListener('wheel', (e) => {
        if (html.classList.contains('gv-open')) return;
        clearTimeout(wheelTimer);
        wheelTimer = setTimeout(() => { if (Math.abs(e.deltaY) > 15 || Math.abs(e.deltaX) > 15) ((e.deltaY || e.deltaX) > 0 ? swiper.slideNext() : swiper.slidePrev()); }, 50);
    }, { passive: true });

    /*-------- RECORRIDO 360: se carga cuando la página terminó (la galería va primero) --------*/
    const frame = document.getElementById('pg-tour-frame');
    const loadTour = () => { if (frame && !frame.getAttribute('src')) frame.setAttribute('src', frame.dataset.src); };
    if (document.readyState === 'complete') setTimeout(loadTour, 400); else window.addEventListener('load', () => setTimeout(loadTour, 400));
    swiper.on('slideChange', loadTour);

    /*-------- GALERÍA --------*/
    // Las fotos se piden como images/01.webp, 02.webp, 03.webp... hasta que una no exista (no hace falta avisar cuántas son).
    const grid = document.getElementById('pg-gallery');
    const empty = document.getElementById('pg-empty');
    const GAP = 8;
    const imgs = [];
    const pad = (n) => (n < 10 ? '0' + n : String(n));

    // Reparte las fotos (en su orden) en filas que llenan el espacio: prueba todas las formas de cortar el orden en filas
    // y elige la que menos obliga a recortar. Cada foto se recorta apenas, nunca se deforma.
    let raf = 0;
    const queueLayout = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
    function layout() {
        const list = imgs.filter((im) => im.naturalWidth);
        const n = list.length, W = grid.clientWidth, H = grid.clientHeight;
        if (!n || W <= 0 || H <= 0) return;
        const asp = list.map((im) => im.naturalWidth / im.naturalHeight);
        let best = null;
        // con muchas fotos se limita la búsqueda (cantidad de maneras de cortar = 2^(n-1))
        const limit = n > 16 ? 1 << 15 : 1 << (n - 1);
        for (let mask = 0; mask < limit; mask++) {
            const rows = []; let cur = [0];
            for (let i = 1; i < n; i++) { if ((mask >> (i - 1)) & 1) { rows.push(cur); cur = [i]; } else cur.push(i); }
            rows.push(cur);
            let sumH = 0;
            const hs = rows.map((r) => { const A = r.reduce((t, i) => t + asp[i], 0); const h = (W - (r.length - 1) * GAP) / A; sumH += h; return h; });
            const f = (H - (rows.length - 1) * GAP) / sumH;
            const score = Math.abs(Math.log(f));
            if (!best || score < best.score) best = { score, rows, hs, f };
        }
        let y = 0;
        best.rows.forEach((r, ri) => {
            const h = best.hs[ri] * best.f, A = r.reduce((t, i) => t + asp[i], 0), availW = W - (r.length - 1) * GAP;
            let x = 0;
            r.forEach((i) => {
                const w = asp[i] / A * availW, st = list[i].style;
                st.left = x.toFixed(1) + 'px'; st.top = y.toFixed(1) + 'px'; st.width = w.toFixed(1) + 'px'; st.height = h.toFixed(1) + 'px';
                x += w + GAP;
            });
            y += h + GAP;
        });
    }
    if (window.ResizeObserver) new ResizeObserver(queueLayout).observe(grid);
    window.addEventListener('resize', queueLayout);

    const addImage = (i) => new Promise((resolve) => {
        const im = new Image();
        im.alt = (document.title.split(' — ')[0] || '') + ' ' + i;
        im.decoding = 'async'; im.draggable = false;
        im.tabIndex = 0; im.setAttribute('role', 'button');
        im.onload = () => { im.classList.add('is-loaded'); grid.appendChild(im); imgs.push(im); empty.hidden = true; buildDots(); queueLayout(); resolve(true); };
        im.onerror = () => resolve(false);
        im.src = 'images/' + pad(i) + '.webp';
    });
    (async () => { for (let i = 1; i <= 80; i++) { if (!(await addImage(i))) break; } if (!imgs.length) empty.hidden = false; })();

    /*-------- VISOR DE FOTO (se abre en el mismo espacio; flechas, teclas, ruedita y puntos de abajo) --------*/
    const viewer = document.getElementById('pg-viewer');
    const layers = Array.from(viewer.querySelectorAll('.gv-img'));
    const stage = viewer.querySelector('.gv-stage');
    const btnPrev = viewer.querySelector('.gv-prev'), btnNext = viewer.querySelector('.gv-next');
    const closeBtn = document.getElementById('pg-close');
    const setLabels = () => {
        viewer.setAttribute('aria-label', T({ es: 'Galería de imágenes', en: 'Image gallery', fr: "Galerie d'images", pt: 'Galeria de imagens' }));
        btnPrev.setAttribute('aria-label', T({ es: 'Imagen anterior', en: 'Previous image', fr: 'Image précédente', pt: 'Imagem anterior' }));
        btnNext.setAttribute('aria-label', T({ es: 'Imagen siguiente', en: 'Next image', fr: 'Image suivante', pt: 'Imagem seguinte' }));
        closeBtn.setAttribute('aria-label', T({ es: 'Cerrar foto', en: 'Close photo', fr: 'Fermer la photo', pt: 'Fechar foto' }));
        const home = document.getElementById('pg-home');
        if (home) { home.setAttribute('aria-label', T({ es: 'Volver a la página principal', en: 'Back to the main page', fr: "Retour à la page d'accueil", pt: 'Voltar à página principal' })); home.title = home.getAttribute('aria-label'); }
        closeBtn.title = closeBtn.getAttribute('aria-label');
    };
    setLabels();
    document.addEventListener('mjvlangchange', setLabels);

    const dotsBar = document.createElement('div');
    dotsBar.className = 'swiper-pagination gv-pagination swiper-pagination-clickable swiper-pagination-bullets';
    dotsBar.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.swiper-pagination-bullet');
        if (!b) return;
        e.stopPropagation();
        if (Number(b.dataset.i) !== current) showImage(Number(b.dataset.i));
    });
    function buildDots() {
        const n = imgs.length;
        dotsBar.textContent = '';
        for (let i = 0; i < n; i++) { const b = document.createElement('span'); b.className = 'swiper-pagination-bullet'; b.dataset.i = i; dotsBar.appendChild(b); }
        const host = document.querySelector('.swiper-container');
        if (host && dotsBar.parentNode !== host) host.appendChild(dotsBar);
        markDot(current);
    }
    const markDot = (index) => Array.prototype.forEach.call(dotsBar.children, (b, i) => b.classList.toggle('swiper-pagination-bullet-active', i === index));

    let current = -1, front = 0, token = 0, lastNavAt = 0, opener = null;
    const isOpen = () => viewer.classList.contains('is-open');

    const showImage = (index) => {
        const img = imgs[index];
        const incoming = layers[front ^ 1], outgoing = layers[front], my = ++token;
        resetZoom();
        incoming.alt = img.alt; incoming.src = img.src;
        requestAnimationFrame(() => { if (my !== token) return; incoming.classList.add('on'); outgoing.classList.remove('on'); });
        front ^= 1; current = index; markDot(index);
        [index - 1, index + 1].forEach((k) => { new Image().src = imgs[(k + imgs.length) % imgs.length].src; });
    };
    const openViewer = (img, fromKeyboard) => {
        opener = fromKeyboard ? img : null;
        current = -1;
        layers.forEach((l) => { l.classList.remove('on'); l.removeAttribute('src'); });
        viewer.classList.add('is-open'); viewer.setAttribute('aria-hidden', 'false');
        html.classList.add('gv-open'); setLabels();
        grid.classList.add('is-covered');
        if (swiper.keyboard) swiper.keyboard.disable();
        showImage(imgs.indexOf(img));
        viewer.focus({ preventScroll: true });
    };
    const closeViewer = () => {
        if (!isOpen()) return;
        viewer.classList.remove('is-open'); viewer.setAttribute('aria-hidden', 'true');
        html.classList.remove('gv-open'); setLabels(); resetZoom();
        grid.classList.remove('is-covered');
        if (swiper.keyboard) swiper.keyboard.enable();
        if (opener) { opener.focus({ preventScroll: true }); opener = null; }
        token++;
        setTimeout(() => { if (!isOpen()) layers.forEach((l) => { l.classList.remove('on'); l.removeAttribute('src'); }); }, 650);
    };
    const go = (dir) => {
        if (!isOpen()) return;
        const now = Date.now();
        if (now - lastNavAt < 350) return;
        lastNavAt = now;
        showImage((current + dir + imgs.length) % imgs.length);
    };

    grid.addEventListener('click', (e) => { const im = e.target.closest && e.target.closest('img'); if (im) openViewer(im); });
    document.addEventListener('keydown', (e) => {
        const a = document.activeElement;
        if (a && a.parentNode === grid && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openViewer(a, true); return; }
        if (!isOpen()) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        else if (e.key === 'Escape') closeViewer();
    });
    let wheelAcc = 0, wheelAt = 0;
    document.addEventListener('wheel', (e) => {
        if (!isOpen()) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        if (e.ctrlKey || e.metaKey) return;
        if (zs > 1) { zx -= e.deltaX; zy -= e.deltaY; clampPan(); applyZoom(); return; }
        const now = Date.now();
        if (now - wheelAt > 250) wheelAcc = 0;
        wheelAt = now;
        wheelAcc += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (Math.abs(wheelAcc) >= 30) { go(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
    }, { passive: false, capture: true });
    btnPrev.addEventListener('click', () => go(-1));
    btnNext.addEventListener('click', () => go(1));
    closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeViewer(); });
    /*-------- ZOOM DE LA FOTO: pellizco, doble toque/clic, Ctrl+ruedita, botones + / − y teclas + − 0 --------*/
    const MAXZ = 5;
    let zs = 1, zx = 0, zy = 0;
    const applyZoom = () => {
        stage.style.transform = zs === 1 ? '' : 'translate(' + zx + 'px,' + zy + 'px) scale(' + zs + ')';
        viewer.classList.toggle('is-zoomed', zs > 1);
        if (zoomOutBtn) zoomOutBtn.disabled = zs <= 1;
        if (zoomInBtn) zoomInBtn.disabled = zs >= MAXZ;
    };
    const clampPan = () => {
        const r = viewer.getBoundingClientRect(), mx = (zs - 1) * r.width / 2, my = (zs - 1) * r.height / 2;
        zx = Math.max(-mx, Math.min(mx, zx)); zy = Math.max(-my, Math.min(my, zy));
    };
    // Zoom manteniendo fijo el punto (cx, cy) de la pantalla
    const zoomAt = (ns, cx, cy) => {
        ns = Math.max(1, Math.min(MAXZ, ns));
        const r = viewer.getBoundingClientRect(), px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2), k = ns / zs;
        zx = px - (px - zx) * k; zy = py - (py - zy) * k; zs = ns;
        if (zs <= 1.001) { zs = 1; zx = zy = 0; } else clampPan();
        applyZoom();
    };
    const zoomCenter = (ns) => { const r = viewer.getBoundingClientRect(); zoomAt(ns, r.left + r.width / 2, r.top + r.height / 2); };
    const resetZoom = () => { zs = 1; zx = zy = 0; applyZoom(); };
    const mkZoomBtn = (cls, txt, fn) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'gv-zbtn ' + cls; b.textContent = txt;
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
        return b;
    };
    const zoomBox = document.createElement('div'); zoomBox.className = 'gv-zoom';
    const zoomInBtn = mkZoomBtn('gv-zin', '+', () => zoomCenter(zs * 1.6));
    const zoomOutBtn = mkZoomBtn('gv-zout', '−', () => zoomCenter(zs / 1.6));
    zoomBox.append(zoomInBtn, zoomOutBtn); viewer.appendChild(zoomBox);
    const setZoomLabels = () => {
        zoomInBtn.setAttribute('aria-label', T({ es: 'Acercar', en: 'Zoom in', fr: 'Agrandir', pt: 'Aproximar' }));
        zoomOutBtn.setAttribute('aria-label', T({ es: 'Alejar', en: 'Zoom out', fr: 'Réduire', pt: 'Afastar' }));
    };
    setZoomLabels(); document.addEventListener('mjvlangchange', setZoomLabels); applyZoom();

    // Punteros: 1 dedo/mouse = pasar de foto (sin zoom) o mover la foto (con zoom); 2 dedos = pellizco
    const ptrs = new Map();
    let swipeX = null, swipeY = null, pinch = null, moved = false, lastTap = { t: 0, x: 0, y: 0 }, downAt = 0;
    const pinchState = () => { const [a, b] = Array.from(ptrs.values()); return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; };
    stage.addEventListener('pointerdown', (e) => {
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
        if (ptrs.size === 1) { swipeX = e.clientX; swipeY = e.clientY; moved = false; downAt = Date.now(); }
        else if (ptrs.size === 2) { swipeX = swipeY = null; pinch = Object.assign(pinchState(), { s: zs }); moved = true; }
    });
    stage.addEventListener('pointermove', (e) => {
        const p = ptrs.get(e.pointerId); if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
        if (ptrs.size >= 2 && pinch) {
            const st = pinchState();
            const r = viewer.getBoundingClientRect();
            const ns = Math.max(1, Math.min(MAXZ, pinch.s * st.d / pinch.d));
            const k = ns / zs, px = st.cx - (r.left + r.width / 2), py = st.cy - (r.top + r.height / 2);
            zx = px - (px - zx) * k + (st.cx - pinch.cx); zy = py - (py - zy) * k + (st.cy - pinch.cy); zs = ns;
            pinch.cx = st.cx; pinch.cy = st.cy;
            if (zs <= 1.001) { zs = 1; zx = zy = 0; } else clampPan();
            applyZoom(); return;
        }
        if (swipeX !== null && (Math.abs(e.clientX - swipeX) > 8 || Math.abs(e.clientY - swipeY) > 8)) moved = true;
        if (zs > 1 && ptrs.size === 1) { zx += dx; zy += dy; clampPan(); applyZoom(); stage.classList.add('is-panning'); }
    });
    const endPtr = (e, cancelled) => {
        if (!ptrs.has(e.pointerId)) return;
        ptrs.delete(e.pointerId);
        stage.classList.remove('is-panning');
        if (ptrs.size < 2) pinch = null;
        if (ptrs.size === 1) { const q = Array.from(ptrs.values())[0]; swipeX = swipeY = null; moved = true; return; }
        if (ptrs.size > 0 || swipeX === null) return;
        const dx = e.clientX - swipeX, dy = e.clientY - swipeY;
        swipeX = swipeY = null;
        if (cancelled) return;
        if (zs === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { go(dx < 0 ? 1 : -1); return; }
        if (!moved && Date.now() - downAt < 350) {   // toque corto: dos seguidos = acercar / volver
            const now = Date.now();
            if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap.t = 0; zs > 1 ? zoomAt(1, e.clientX, e.clientY) : zoomAt(2.5, e.clientX, e.clientY); }
            else lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
    };
    stage.addEventListener('pointerup', (e) => endPtr(e, false));
    stage.addEventListener('pointercancel', (e) => endPtr(e, true));
    // Ctrl + ruedita (y el pellizco del trackpad) hace zoom; con zoom, la ruedita mueve la foto
    document.addEventListener('wheel', (e) => {
        if (!isOpen() || !(e.ctrlKey || e.metaKey)) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        zoomAt(zs * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0105)), e.clientX, e.clientY);
    }, { passive: false, capture: true });
    document.addEventListener('keydown', (e) => {
        if (!isOpen()) return;
        if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomCenter(zs * 1.6); }
        else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomCenter(zs / 1.6); }
        else if (e.key === '0') { e.preventDefault(); resetZoom(); }
    });
    swiper.on('slideChange', closeViewer);

    /*-------- BOTÓN DE CONTACTO --------*/
    if (typeof setupAnimatedDropdown === 'function') {
        setupAnimatedDropdown(document.getElementById('contact-button'), document.getElementById('contact-dropdown'));
    }
});


/*-------- ANTES Y DESPUÉS: la imagen de "después" se superpone a la de "antes"; se arrastra la línea para descubrirla --------*/
document.addEventListener('DOMContentLoaded', () => {
    const T = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);
    const box = document.getElementById('pg-compare');
    if (!box) return;
    const handle = box.querySelector('.cmp-handle');
    let pos = 50, dragging = false;
    const set = (p) => {
        pos = Math.max(0, Math.min(100, p));
        box.style.setProperty('--pos', pos + '%');
        handle.setAttribute('aria-valuenow', Math.round(pos));
    };
    const fromEvent = (e) => { const r = box.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
    box.addEventListener('pointerdown', (e) => { dragging = true; box.classList.add('is-drag'); try { box.setPointerCapture(e.pointerId); } catch (_) {} fromEvent(e); e.preventDefault(); });
    box.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    const end = () => { dragging = false; box.classList.remove('is-drag'); };
    box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
    handle.addEventListener('keydown', (e) => {
        const k = e.key;
        if (k === 'ArrowLeft' || k === 'ArrowDown') { set(pos - 4); e.preventDefault(); e.stopPropagation(); }
        else if (k === 'ArrowRight' || k === 'ArrowUp') { set(pos + 4); e.preventDefault(); e.stopPropagation(); }
        else if (k === 'Home') { set(0); e.preventDefault(); } else if (k === 'End') { set(100); e.preventDefault(); }
    });
    const labels = () => {
        handle.setAttribute('aria-label', T({ es: 'Comparar antes y después', en: 'Compare before and after', fr: 'Comparer avant et après', pt: 'Comparar antes e depois' }));
        box.querySelector('.cmp-before').alt = T({ es: 'Antes: obra en construcción', en: 'Before: construction site', fr: 'Avant : chantier', pt: 'Antes: obra em construção' });
        box.querySelector('.cmp-after').alt = T({ es: 'Después: proyecto terminado', en: 'After: finished project', fr: 'Après : projet terminé', pt: 'Depois: projeto concluído' });
    };
    labels(); document.addEventListener('mjvlangchange', labels);
    set(50);
});

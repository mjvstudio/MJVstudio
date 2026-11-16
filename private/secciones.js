/* =====================================================================
   SECCIONES EXTRA de las páginas privadas — MJV Studio (se carga después de private.js)
   1) .pg-zoom: imagen que se puede ampliar sin salir de la sección
      - doble clic / doble toque: acerca (y vuelve)       - pellizco o Ctrl + ruedita: zoom
      - con zoom: arrastrar o la ruedita mueven la imagen  - botones + y − (abajo a la derecha)
      - sin zoom, la ruedita y el deslizar siguen pasando de sección como en el resto de la página
   2) .pg-switch con .pg-tabs: cada botón (data-src) cambia la imagen; data-note="x" muestra la nota .pg-note[data-note="x"]
   3) #pg-subtitle: debajo del título muestra el nombre de la sección que se está viendo (data-title de cada .swiper-slide,
      con data-title-en / -fr / -pt para los otros idiomas)
   ===================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    const T = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);
    const swiperEl = document.querySelector('.swiper-container');
    const sw = () => swiperEl && swiperEl.swiper;
    const MAXZ = 6;

    function makeZoom(box) {
        const stage = document.createElement('div');
        stage.className = 'pg-zoom-stage';
        const layers = [document.createElement('img'), document.createElement('img')];
        layers.forEach((l) => { l.alt = ''; l.draggable = false; l.decoding = 'async'; stage.appendChild(l); });
        box.appendChild(stage);
        const btns = document.createElement('div');
        btns.className = 'pg-zoom-btns';
        btns.innerHTML = '<button type="button" class="pz-in">+</button><button type="button" class="pz-out">−</button>';
        box.appendChild(btns);
        const bIn = btns.querySelector('.pz-in'), bOut = btns.querySelector('.pz-out');
        const labels = () => {
            bIn.setAttribute('aria-label', T({ es: 'Acercar', en: 'Zoom in', fr: 'Zoom avant', pt: 'Aproximar' })); bIn.title = bIn.getAttribute('aria-label');
            bOut.setAttribute('aria-label', T({ es: 'Alejar', en: 'Zoom out', fr: 'Zoom arrière', pt: 'Afastar' })); bOut.title = bOut.getAttribute('aria-label');
        };
        labels(); document.addEventListener('mjvlangchange', labels);

        let zs = 1, zx = 0, zy = 0, front = 0, token = 0;
        const apply = () => {
            stage.style.transform = zs === 1 ? '' : 'translate(' + zx + 'px,' + zy + 'px) scale(' + zs + ')';
            box.classList.toggle('is-zoomed', zs > 1);
            box.classList.toggle('swiper-no-swiping', zs > 1);
            bOut.disabled = zs <= 1; bIn.disabled = zs >= MAXZ;
        };
        const clamp = () => {
            const r = box.getBoundingClientRect(), mx = (zs - 1) * r.width / 2, my = (zs - 1) * r.height / 2;
            zx = Math.max(-mx, Math.min(mx, zx)); zy = Math.max(-my, Math.min(my, zy));
        };
        const zoomAt = (ns, cx, cy) => {
            ns = Math.max(1, Math.min(MAXZ, ns));
            const r = box.getBoundingClientRect(), px = cx - (r.left + r.width / 2), py = cy - (r.top + r.height / 2), k = ns / zs;
            zx = px - (px - zx) * k; zy = py - (py - zy) * k; zs = ns;
            if (zs <= 1.001) { zs = 1; zx = zy = 0; } else clamp();
            apply();
        };
        const center = (ns) => { const r = box.getBoundingClientRect(); zoomAt(ns, r.left + r.width / 2, r.top + r.height / 2); };
        const reset = () => { zs = 1; zx = zy = 0; apply(); };
        bIn.addEventListener('click', (e) => { e.stopPropagation(); center(zs * 1.6); });
        bOut.addEventListener('click', (e) => { e.stopPropagation(); center(zs / 1.6); });
        btns.addEventListener('pointerdown', (e) => e.stopPropagation());

        const show = (src, alt) => {
            const incoming = layers[front ^ 1], outgoing = layers[front], my = ++token;
            reset();
            const pre = new Image();
            pre.onload = () => {
                if (my !== token) return;
                incoming.src = src; incoming.alt = alt || '';
                requestAnimationFrame(() => { incoming.classList.add('on'); outgoing.classList.remove('on'); });
                front ^= 1;
            };
            pre.src = src;
        };

        // Ruedita: sin zoom pasa de sección (lo hace private.js); con zoom mueve la imagen; con Ctrl (o el pellizco del trackpad) hace zoom
        box.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault(); e.stopPropagation();
                zoomAt(zs * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0105)), e.clientX, e.clientY);
            } else if (zs > 1) {
                e.preventDefault(); e.stopPropagation();
                zx -= e.deltaX; zy -= e.deltaY; clamp(); apply();
            }
        }, { passive: false });

        // Punteros: 1 = mover (con zoom) o doble toque; 2 = pellizco (mientras tanto el carrusel no se mueve)
        const ptrs = new Map();
        let pinch = null, lastTap = { t: 0, x: 0, y: 0 }, downAt = 0, moved = false, sx = 0, sy = 0, locked = false;
        const pinchState = () => { const [a, b] = Array.from(ptrs.values()); return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; };
        const lock = (on) => { const s = sw(); if (!s || locked === on) return; locked = on; s.allowTouchMove = !on; if (!on) s.slideTo(s.activeIndex, 250); };
        box.addEventListener('pointerdown', (e) => {
            if (e.button > 0) return;
            ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (ptrs.size === 1) { moved = false; downAt = Date.now(); sx = e.clientX; sy = e.clientY; if (zs > 1) { try { box.setPointerCapture(e.pointerId); } catch (_) {} } }
            else if (ptrs.size === 2) { pinch = Object.assign(pinchState(), { s: zs }); moved = true; lock(true); }
        });
        box.addEventListener('pointermove', (e) => {
            const p = ptrs.get(e.pointerId); if (!p) return;
            const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
            if (ptrs.size >= 2 && pinch) {
                const st = pinchState(), r = box.getBoundingClientRect();
                const ns = Math.max(1, Math.min(MAXZ, pinch.s * st.d / pinch.d)), k = ns / zs;
                const px = st.cx - (r.left + r.width / 2), py = st.cy - (r.top + r.height / 2);
                zx = px - (px - zx) * k + (st.cx - pinch.cx); zy = py - (py - zy) * k + (st.cy - pinch.cy); zs = ns;
                pinch.cx = st.cx; pinch.cy = st.cy;
                if (zs <= 1.001) { zs = 1; zx = zy = 0; } else clamp();
                apply(); return;
            }
            if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) moved = true;
            if (zs > 1 && ptrs.size === 1) { zx += dx; zy += dy; clamp(); apply(); box.classList.add('is-panning'); }
        });
        const end = (e) => {
            if (!ptrs.has(e.pointerId)) return;
            ptrs.delete(e.pointerId);
            box.classList.remove('is-panning');
            if (ptrs.size < 2) pinch = null;
            if (ptrs.size) return;
            if (locked) { lock(false); return; }
            if (!moved && Date.now() - downAt < 350 && e.type === 'pointerup') {
                const now = Date.now();
                if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap.t = 0; zs > 1 ? zoomAt(1, e.clientX, e.clientY) : zoomAt(2.5, e.clientX, e.clientY); }
                else lastTap = { t: now, x: e.clientX, y: e.clientY };
            }
        };
        box.addEventListener('pointerup', end);
        box.addEventListener('pointercancel', end);
        window.addEventListener('resize', () => { if (zs > 1) { clamp(); apply(); } });
        apply();
        return { show, reset };
    }

    const zooms = new Map();
    document.querySelectorAll('.pg-zoom').forEach((box) => {
        const z = makeZoom(box);
        zooms.set(box, z);
        if (box.dataset.src) z.show(box.dataset.src, box.getAttribute('aria-label') || '');
    });

    document.querySelectorAll('.pg-switch').forEach((sec) => {
        const tabs = Array.from(sec.querySelectorAll('.pg-tabs [role="tab"]'));
        const box = sec.querySelector('.pg-zoom');
        const z = zooms.get(box);
        if (!tabs.length || !z) return;
        const notes = Array.from(sec.querySelectorAll('.pg-note'));
        let cur = -1;
        const select = (i, focus) => {
            if (i === cur) return;
            cur = i;
            tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; });
            const t = tabs[i];
            z.show(t.dataset.src, t.textContent.trim());
            notes.forEach((n) => { n.hidden = n.dataset.note !== t.dataset.note; });
            if (focus) t.focus();
        };
        tabs.forEach((t, i) => {
            t.addEventListener('click', (e) => { e.stopPropagation(); if (i !== cur && window.mjvSound && window.mjvSound.click) window.mjvSound.click(); select(i); });
            t.addEventListener('keydown', (e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault(); e.stopPropagation();
                select((cur + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length, true);
            });
        });
        select(0);
        // las imágenes de los otros botones se piden de antemano, cuando la página ya cargó
        window.addEventListener('load', () => setTimeout(() => tabs.forEach((t) => { new Image().src = t.dataset.src; }), 1500));
    });

    /*-------- SUBTÍTULO: nombre de la sección actual --------*/
    const sub = document.getElementById('pg-subtitle');
    const s = sw();
    if (sub && s) {
        const text = () => {
            const el = s.slides[s.activeIndex];
            if (!el) return '';
            const l = window.mjvLang && window.mjvLang.current ? window.mjvLang.current() : 'es';
            return (l !== 'es' && el.dataset['title' + l.charAt(0).toUpperCase() + l.slice(1)]) || el.dataset.title || '';
        };
        let shown = null, tm = 0;
        const paint = (instant) => {
            const t = text();
            if (t === shown) return;
            shown = t;
            clearTimeout(tm);
            if (instant) { sub.textContent = t; sub.classList.remove('is-out'); return; }
            sub.classList.add('is-out');
            tm = setTimeout(() => { sub.textContent = t; sub.classList.remove('is-out'); }, 220);
        };
        paint(true);
        s.on('slideChange', () => paint(false));
        document.addEventListener('mjvlangchange', () => { shown = null; paint(true); });
    }
});

/* --------------- SWIPER INITIALIZATION --------------- */
const swiper = new Swiper('.swiper-container', {
    direction: 'horizontal',
    loop: true,
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    mousewheel: true,
    keyboard: {
        enabled: true,
        onlyInViewport: true,
    },
    speed: 800,
    grabCursor: true,
    autoHeight: true,
    watchSlidesProgress: true, // necesario para saber cuánto se corrió cada sección (ver más abajo)
});

// Al dar la vuelta (de Studio al Logo y viceversa) el carrusel reordena las secciones
// y avisa "slideChange" varias veces por un mismo cambio, algunas con el número de
// sección viejo. El sonido de transición dura 2 s: debe sonar UNA vez por cambio real.
let lastSoundIndex = swiper.realIndex;
swiper.on('slideChange', () => {
    if (swiper.realIndex !== lastSoundIndex) {
        lastSoundIndex = swiper.realIndex;
        if (window.mjvSound) window.mjvSound.swipe();
    }
    // Aviso para las estadísticas (analytics.js): 0 = Logo, 1 = Architecture, 2 = Studio
    document.dispatchEvent(new CustomEvent('mjvsectionchange', { detail: { index: swiper.realIndex } }));
});
// Aviso para logo-replay.js: la sección terminó de deslizarse y quedó quieta
swiper.on('slideChangeTransitionEnd', () => {
    document.dispatchEvent(new CustomEvent('mjvsectionsettled', { detail: { index: swiper.realIndex } }));
});

/* --------------- BOTONES DE SECCIÓN vs. BARRA DE PREFERENCIAS ---------------
   Categorías (Architecture) y Contacto (Studio) viven en el rincón inferior
   derecho de SU sección, así que al deslizar viajan por toda la pantalla y
   cruzan por encima de la barra de preferencias (fija, abajo a la izquierda).
   Para que no se superpongan, cada botón se desvanece apenas su sección
   empieza a moverse: queda invisible mucho antes de llegar a la barra, y
   reaparece recién cuando la sección ya casi se asentó. */
const SECTION_BUTTONS = '.dropdown, .contact-dropdown';
const FADE_OUT_MS = 220;            // qué tan rápido se esfuma al salir
const FADE_IN_MS = 260;             // y qué tan rápido reaparece al entrar...
const FADE_IN_DELAY_MS = 280;       // ...después de esta espera, para no cruzar la barra
let lastTransitionMs = 0;           // 0 = arrastre con el dedo/mouse; >0 = deslizamiento animado

function updateSectionButtons() {
    swiper.slides.forEach((slide) => {
        // Visible solo cerca de su posición final: invisible desde el 40 % del recorrido
        const target = Math.max(0, 1 - Math.abs(slide.progress || 0) * 2.5);
        slide.querySelectorAll(SECTION_BUTTONS).forEach((el) => {
            const current = el.style.opacity === '' ? 1 : parseFloat(el.style.opacity);
            if (lastTransitionMs === 0) {
                el.style.transition = 'none'; // al arrastrar, acompaña al dedo sin demora
            } else {
                el.style.transition = target > current
                    ? `opacity ${FADE_IN_MS}ms ease ${FADE_IN_DELAY_MS}ms`
                    : `opacity ${FADE_OUT_MS}ms ease`;
            }
            el.style.opacity = target >= 0.999 ? '' : String(target);
            // Mientras está esfumado no debe poder tocarse
            el.style.pointerEvents = target < 0.5 ? 'none' : '';
        });
    });
}

swiper.on('setTransition', (sw, duration) => { lastTransitionMs = duration; }); // Swiper 11: 1.º argumento = la instancia
swiper.on('setTranslate', updateSectionButtons);

// Si se llega desde el botón "Volver" de una página de proyecto
// (index.html#architecture), saltar directo ahí sin pasar por el Logo.
if (window.location.hash === '#architecture') {
    swiper.slideToLoop(1, 0); // 0 = sin animación, aparece ya ahí
}
updateSectionButtons();

/* El mecanismo de despliegue animado (setupAnimatedDropdown) vive ahora en
   dropdown.js, compartido con las páginas de proyecto. */

/* --------------- FILTRO DE ARQUITECTURA --------------- */
document.addEventListener('DOMContentLoaded', function () {
    // Elementos del filtro
    const filterButtons = document.querySelectorAll('.filter');
    const galleryItems = document.querySelectorAll('.project');
    const categoriesButton = document.getElementById('categories-button');
    const dropdown = document.getElementById('categories-dropdown');

    setupAnimatedDropdown(categoriesButton, dropdown);

    // Filtrado de proyectos
    const handleFilterClick = (e) => {
        e.preventDefault();
        if (window.mjvSound) window.mjvSound.click();
        const filter = e.currentTarget.dataset.filter;

        if (window.mjvGrid) {
            window.mjvGrid.setFilter(filter);
        } else {
            galleryItems.forEach(item => {
                const shouldShow = filter === 'all' || item.classList.contains(filter);
                item.style.display = shouldShow ? 'grid' : 'none';
            });
        }

        filterButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
    };

    filterButtons.forEach(button => {
        button.addEventListener('click', handleFilterClick);
    });

    // Al volver a esta sección (swipe hacia adentro o hacia afuera y de vuelta),
    // la galería siempre vuelve a mostrar todos los proyectos.
    const resetGalleryFilters = () => {
        if (window.mjvGrid) window.mjvGrid.setFilter('all', { animate: false });
        else galleryItems.forEach(item => { item.style.display = ''; });
        filterButtons.forEach(btn => btn.classList.remove('active'));
        const allButton = document.querySelector('.filter[data-filter="all"]');
        if (allButton) allButton.classList.add('active');
    };

    const ARCHITECTURE_SLIDE_INDEX = 1; // 0=Logo, 1=Architecture, 2=Studio
    if (typeof swiper !== 'undefined' && swiper) {
        swiper.on('slideChange', () => {
            if (swiper.realIndex === ARCHITECTURE_SLIDE_INDEX) {
                resetGalleryFilters();
            }
        });
    }
});

/* --------------- MOSAICO DE STUDIO (fotos que rotan + panel de texto + pop-up) --------------- */
document.addEventListener('DOMContentLoaded', function () {

    // Cuántas fotos tiene cada tarjeta: team/<miembro>_1.png ... team/<miembro>_N.png
    // (si una persona tiene distinta cantidad, anotarla en PHOTOS_OF; ej. { martin: 4 })
    const PHOTOS_PER_MEMBER = 5;
    const PHOTOS_OF = {};
    const photosOf = (member) => PHOTOS_OF[member] || PHOTOS_PER_MEMBER;
    const CYCLE_MS = 1500;                  // cada cuánto cambia la foto mientras el cursor está encima
    // Celular/tablet (sin cursor): no hay "hover" ni botón "more"; se toca la foto y se abre el pop-up
    const touchMQ = window.matchMedia ? window.matchMedia('(hover: none)') : { matches: false };
    const isTouch = () => touchMQ.matches;
    const DEFAULT_MEMBER = 'estudio';
    const STUDIO_LABEL = {
        es: 'MJV arquitectura y diseño', en: 'MJV architecture and design',
        fr: 'MJV architecture et design', pt: 'MJV arquitetura e design'
    };
    const NOT_AVAILABLE = {
        es: 'Texto no disponible por el momento.',
        en: 'Text not available at the moment.',
        fr: 'Texte momentanément indisponible.',
        pt: 'Texto indisponível no momento.'
    };
    // window.mjvLang.pick({...}) devuelve el texto del idioma actual
    const STUDIO_SHORT = { es: 'Estudio', en: 'Studio', fr: 'Studio', pt: 'Estúdio' };
    const pickLang = (dict) => (window.mjvLang ? window.mjvLang.pick(dict) : dict.es);
    const PERSON_NAMES = { majo: 'Majo', martin: 'Martín', gonza: 'Gonza', maria: 'María' };
    const memberLabel = (member) => (member === 'estudio' ? pickLang(STUDIO_LABEL) : (PERSON_NAMES[member] || member));

    const cards = document.querySelectorAll('.team-card');
    const infoPanelText = document.getElementById('info-panel-text');
    // Si el carrusel duplicó las secciones (versiones de Swiper con "loop"), el texto tiene copias: se actualizan todas
    const setPanelText = (t) => { document.querySelectorAll('#info-panel-text').forEach(el => { el.textContent = t; }); };
    const moreLink = document.getElementById('more-link');
    const modalOverlay = document.getElementById('info-modal-overlay');
    const modalTitle = document.getElementById('info-modal-title');
    const modalText = document.getElementById('info-modal-text');
    const modalCloseBtn = document.getElementById('info-modal-close');

    if (!cards.length || !infoPanelText) return;

    // Textos cargados desde team/<miembro>.txt (o team/<miembro>_en.txt en inglés)
    const memberTexts = {};
    // Texto del panel: el de la persona que se está mirando (cursor encima) y, si no hay ninguna, el de la que se eligió
    // con un clic (al principio, el del estudio). El clic en una foto lo deja fijo hasta elegir otra.
    let selectedMember = DEFAULT_MEMBER;
    let hoveredMember = null;
    const refreshPanel = () => {
        const m = hoveredMember || selectedMember;
        if (memberTexts[m] !== undefined) setPanelText(memberTexts[m]);
        cards.forEach(c => c.classList.toggle('is-selected', c.dataset.member === selectedMember && selectedMember !== DEFAULT_MEMBER));
    };

    const langSuffix = () => (window.mjvLang ? window.mjvLang.suffix() : '');

    const fetchMember = (member, suffix) => fetch(`team/${member}${suffix}.txt`).then(res => {
        if (!res.ok) throw new Error(`No se pudo cargar team/${member}${suffix}.txt`);
        return res.text();
    });
    const loadMemberText = (member) => {
        const sfx = langSuffix();
        // 1) idioma actual; 2) un reintento (red lenta); 3) el texto sin sufijo (español)
        return fetchMember(member, sfx)
            .catch(() => new Promise(r => setTimeout(r, 1200)).then(() => fetchMember(member, sfx)))
            .catch(() => (sfx ? fetchMember(member, '') : Promise.reject()))
            .then(text => { if (sfx === langSuffix()) memberTexts[member] = text; })
            .catch(() => { memberTexts[member] = pickLang(NOT_AVAILABLE); })
            .then(refreshPanel);
    };

    const allMembers = Array.from(cards).map(c => c.dataset.member);
    const loadAllMemberTexts = () => Promise.all(allMembers.map(loadMemberText)).then(refreshPanel);
    loadAllMemberTexts();

    // Si cambia el idioma (botón EN/ES), volvemos a pedir los textos (y se actualizan los rótulos de las tarjetas)
    const labelCards = () => cards.forEach(c => {
        const l = c.querySelector('.team-card-label');
        if (l && c.dataset.member === DEFAULT_MEMBER) l.textContent = memberLabel(DEFAULT_MEMBER);
    });
    document.addEventListener('mjvlangchange', () => { labelCards(); loadAllMemberTexts(); });
    labelCards();

    // --- Fotos: se precargan para que el cambio sea continuo (sin parpadeo ni demora la primera vez) ---
    const preloaded = new Set();
    const preloadMember = (member) => {
        if (preloaded.has(member)) return;
        preloaded.add(member);
        for (let i = 1; i <= photosOf(member); i++) { const im = new Image(); im.decoding = 'async'; im.src = `team/${member}_${i}.png`; }
    };
    if (!isTouch()) {
        // en computadora: apenas la portada terminó de cargar, en un rato libre
        const idle = () => allMembers.forEach(preloadMember);
        const later = () => { if (window.requestIdleCallback) requestIdleCallback(idle, { timeout: 4000 }); else setTimeout(idle, 1500); };
        if (document.readyState === 'complete') setTimeout(later, 2500); else window.addEventListener('load', () => setTimeout(later, 2500));
    }

    // Estado de ciclado de imágenes por tarjeta. Cada tarjeta tiene DOS capas de foto (la de siempre y una copia encima):
    // la nueva se carga en la oculta y se funden una con otra, así el cambio es suave y continuo.
    const cardState = new Map();

    cards.forEach(card => {
        const member = card.dataset.member;
        const imgA = card.querySelector('.team-card-img');
        if (!imgA) return;
        const imgB = imgA.cloneNode(false);
        imgB.className = 'team-card-img team-card-img-b layer-hidden';
        imgB.alt = ''; imgB.setAttribute('aria-hidden', 'true'); imgB.removeAttribute('src');
        imgA.parentNode.insertBefore(imgB, imgA.nextSibling);

        const st = { timer: null, cur: 1, front: 0, token: 0, bad: new Set() };
        cardState.set(card, st);
        const layers = [imgA, imgB];

        // muestra la foto número idx fundiéndola sobre la actual
        const swapTo = (idx) => {
            if (idx === st.cur) return Promise.resolve(true);
            const token = ++st.token;
            const back = layers[1 - st.front], front = layers[st.front];
            back.src = `team/${member}_${idx}.png`;
            const ready = back.decode ? back.decode() : new Promise((res, rej) => { back.onload = res; back.onerror = rej; });
            return ready.then(() => {
                if (token !== st.token) return false;
                back.classList.remove('layer-hidden');
                front.classList.add('layer-hidden');
                st.front = 1 - st.front; st.cur = idx;
                return true;
            }).catch(() => { st.bad.add(idx); return false; });
        };
        const nextIndex = () => {
            const n = photosOf(member);
            for (let k = 1; k <= n; k++) {
                const i = ((st.cur - 1 + k) % n) + 1;
                if (!st.bad.has(i) && i !== st.cur) return i;
            }
            return st.cur;
        };
        const tick = () => { const i = nextIndex(); if (i !== st.cur) swapTo(i); };

        const startCycle = () => {
            if (isTouch()) return;                // en celular no hay vista previa: se toca y se abre el pop-up
            card.classList.add('previewing');
            hoveredMember = member;
            refreshPanel();
            preloadMember(member);
            clearInterval(st.timer);
            st.timer = setInterval(tick, CYCLE_MS);   // desde que se arrima, cambia cada CYCLE_MS
        };

        const stopCycle = () => {
            clearInterval(st.timer);
            st.timer = null;
            card.classList.remove('previewing');
            if (hoveredMember === member) hoveredMember = null;
            refreshPanel();
            swapTo(1);                            // vuelve a la primera foto (fundida)
        };

        // --- Escritorio: hover ---
        card.addEventListener('mouseenter', startCycle);
        card.addEventListener('mouseleave', stopCycle);
        card.addEventListener('focus', startCycle);  // navegación por teclado
        card.addEventListener('blur', stopCycle);

        // Clic / toque en una foto. Celular: abre el pop-up de esa persona. Computadora: el texto de esa persona queda fijo en el panel.
        const choose = () => {
            if (isTouch()) { openModal(member); return; }
            selectedMember = member;           // computadora: tocar una foto es lo mismo que "more" para esa persona
            refreshPanel();
            openModal(member, true);
        };
        card.addEventListener('click', choose);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
        });
    });

    // Botón "more" (solo computadora): abre el pop-up con las fotos y el texto de la persona elegida (al principio, el estudio)
    if (moreLink) {
        moreLink.addEventListener('click', () => openModal(selectedMember, true));
    }

    // --- Pop-up: galería de fotos a color + texto ---
    const modalGallery = document.getElementById('info-modal-gallery');
    const modalTabs = document.getElementById('info-modal-tabs');
    let modalMember = null;
    let modalOpener = null;

    // Animación del pop-up: la foto elegida del mosaico se agranda y se esfuma; las fotos del collage entran desde afuera
    // de la pantalla. Al cerrar, las fotos salen de la pantalla y la foto elegida vuelve a su lugar.
    let heldCard = null, heldAnim = null, modalReady = Promise.resolve();
    const whenReady = (fn) => Promise.race([modalReady, new Promise(r => setTimeout(r, 900))]).then(() => requestAnimationFrame(() => requestAnimationFrame(fn)));
    const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function collageImgs() { return Array.prototype.slice.call(modalGallery ? modalGallery.querySelectorAll('.tp-gallery-cols img') : []); }
    function awayVector(im, gr) {
        const l = parseFloat(im.style.left), t = parseFloat(im.style.top);
        const cx = (isNaN(l) ? 0 : l) + (parseFloat(im.style.width) || 0) / 2 - gr.width / 2;
        const cy = (isNaN(t) ? 0 : t) + (parseFloat(im.style.height) || 0) / 2 - gr.height / 2;
        const d = Math.sqrt(cx * cx + cy * cy) || 1;
        const far = Math.max(window.innerWidth, window.innerHeight) * 0.7;
        return { x: cx / d * far, y: cy / d * far };
    }
    function enterFx(member) {
        if (reduceMotion() || !Element.prototype.animate) return;
        if (heldAnim) { try { heldAnim.cancel(); } catch (e) {} }
        heldCard = Array.prototype.find.call(cards, c => c.dataset.member === member) || null;
        heldAnim = heldCard ? heldCard.animate([{ scale: 1, opacity: 1 }, { scale: 1.5, opacity: 0 }],
            { duration: 800, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' }) : null;
        whenReady(enterImgs);
    }
    function enterImgs() {
        if (!modalGallery || reduceMotion() || !Element.prototype.animate) return;
        const gr = modalGallery.getBoundingClientRect();
        collageImgs().forEach((im, i) => {
            const v = awayVector(im, gr);
            im.animate([{ translate: v.x + 'px ' + v.y + 'px', scale: 0.7, opacity: 0 }, { translate: '0px 0px', scale: 1, opacity: 1 }],
                { duration: 1000, delay: 120 + i * 110, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
        });
    }
    function exitImgs(ms) {
        const gr = modalGallery.getBoundingClientRect();
        collageImgs().forEach((im, i) => {
            const v = awayVector(im, gr);
            im.animate([{ translate: '0px 0px', scale: 1, opacity: 1 }, { translate: v.x + 'px ' + v.y + 'px', scale: 0.7, opacity: 0 }],
                { duration: ms, delay: i * 50, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
        });
    }
    // Cambio de persona con las pestañas de abajo: las fotos salen, la foto del mosaico de la persona anterior vuelve a su lugar,
    // la de la nueva se agranda y las fotos de la nueva persona entran.
    let switching = 0;
    function switchMember(m) {
        if (m === modalMember) return;
        if (reduceMotion() || !Element.prototype.animate || !modalOverlay.classList.contains('open')) { showMember(m); return; }
        const my = ++switching;
        exitImgs(560);
        if (heldAnim && heldCard) {
            try { heldAnim.cancel(); } catch (e) {}
            heldCard.animate([{ scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 800, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
        }
        heldCard = Array.prototype.find.call(cards, c => c.dataset.member === m) || null;
        heldAnim = heldCard ? heldCard.animate([{ scale: 1, opacity: 1 }, { scale: 1.5, opacity: 0 }],
            { duration: 800, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' }) : null;
        modalTabs && Array.prototype.forEach.call(modalTabs.children, b => b.classList.toggle('is-active', b.dataset.member === m));
        setTimeout(() => {
            if (my !== switching) return;
            showMember(m);
            whenReady(enterImgs);
        }, 700);
    }
    function exitFx() {
        if (reduceMotion() || !Element.prototype.animate) { if (heldAnim) { try { heldAnim.cancel(); } catch (e) {} heldAnim = null; } return; }
        switching++;
        exitImgs(640);
        if (heldAnim && heldCard) {
            try { heldAnim.cancel(); } catch (e) {}
            heldCard.animate([{ scale: 1.5, opacity: 0 }, { scale: 1, opacity: 1 }],
                { duration: 900, delay: 260, easing: 'cubic-bezier(.33,1,.68,1)', fill: 'backwards' });
        }
        heldAnim = null;
    }

    function buildTabs() {
        if (!modalTabs) return;
        modalTabs.textContent = '';
        allMembers.forEach(m => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'tp-tab';
            b.dataset.member = m;
            b.textContent = (m === 'estudio' && matchMedia('(max-width: 700px)').matches) ? pickLang(STUDIO_SHORT) : memberLabel(m);
            b.addEventListener('click', () => { if (window.mjvSound) window.mjvSound.click(); switchMember(m); });
            modalTabs.appendChild(b);
        });
    }

    function showMember(member) {
        modalMember = member;
        modalTitle.textContent = memberLabel(member);
        modalText.textContent = memberTexts[member] || pickLang(NOT_AVAILABLE);
        modalText.scrollTop = 0;
        if (modalTabs) Array.prototype.forEach.call(modalTabs.children, b => {
            const on = b.dataset.member === member;
            b.classList.toggle('is-active', on);
            if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
        });
        if (modalGallery) {
            modalGallery.textContent = '';
            const cols = document.createElement('div');        // las fotos se acomodan juntas dentro del cuadrado, sin desplazamiento
            cols.className = 'tp-gallery-cols';
            modalGallery.appendChild(cols);
            for (let i = 1; i <= photosOf(member); i++) {
                const im = document.createElement('img');
                im.alt = memberLabel(member) + ' ' + i;
                im.decoding = 'async';
                im.draggable = false;
                im.addEventListener('load', () => { im.classList.add('is-loaded'); queueLayout(); });
                im.addEventListener('error', () => { if (im.parentNode) im.parentNode.removeChild(im); queueLayout(); });   // foto que todavía no existe: se omite
                im.src = `team/${member}_${i}.png`;
                cols.appendChild(im);
            }
            queueLayout();
            const imgsNow = Array.prototype.slice.call(cols.children);
            modalReady = Promise.all(imgsNow.map(im => (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
        }
    }

    // Collage: reparte las fotos (en su orden) en filas que llenan el cuadrado. Prueba todas las formas de cortar el orden en
    // filas y se queda con la que menos hay que estirar/recortar para llenar el cuadro (cada foto se recorta apenas, nunca se deforma).
    const COLLAGE_GAP = 8;
    let layoutRaf = 0;
    function queueLayout() { cancelAnimationFrame(layoutRaf); layoutRaf = requestAnimationFrame(layoutCollage); }
    function layoutCollage() {
        const cols = modalGallery && modalGallery.querySelector('.tp-gallery-cols');
        if (!cols) return;
        const imgs = Array.prototype.slice.call(cols.children);
        const n = imgs.length, W = cols.clientWidth, H = cols.clientHeight;
        if (!n || W <= 0 || H <= 0) return;
        const g = COLLAGE_GAP;
        const asp = imgs.map(im => (im.naturalWidth && im.naturalHeight) ? im.naturalWidth / im.naturalHeight : 1);
        let best = null;
        for (let mask = 0; mask < (1 << (n - 1)); mask++) {
            const rows = []; let cur = [0];
            for (let i = 1; i < n; i++) { if ((mask >> (i - 1)) & 1) { rows.push(cur); cur = [i]; } else cur.push(i); }
            rows.push(cur);
            let sumH = 0;
            const hs = rows.map(r => { const A = r.reduce((t, i) => t + asp[i], 0); const h = (W - (r.length - 1) * g) / A; sumH += h; return h; });
            const f = (H - (rows.length - 1) * g) / sumH;
            const score = Math.abs(Math.log(f));
            if (!best || score < best.score) best = { score, rows, hs, f };
        }
        let y = 0;
        best.rows.forEach((r, ri) => {
            const h = best.hs[ri] * best.f;
            const A = r.reduce((t, i) => t + asp[i], 0);
            const availW = W - (r.length - 1) * g;
            let x = 0;
            r.forEach(i => {
                const w = asp[i] / A * availW, st = imgs[i].style;
                st.left = x.toFixed(1) + 'px'; st.top = y.toFixed(1) + 'px';
                st.width = w.toFixed(1) + 'px'; st.height = h.toFixed(1) + 'px';
                x += w + g;
            });
            y += h + g;
        });
    }
    if (window.ResizeObserver && modalGallery) new ResizeObserver(queueLayout).observe(modalGallery);
    window.addEventListener('resize', queueLayout);

    function openModal(member, withTabs) {
        if (!modalOverlay) return;
        if (window.mjvSound) window.mjvSound.pop();
        modalOpener = document.activeElement;
        enterFx(member);
        modalOverlay.classList.add('has-tabs');
        buildTabs();
        showMember(member);
        modalOverlay.classList.add('open');
        if (modalCloseBtn) { try { modalCloseBtn.focus({ preventScroll: true }); } catch (e) {} }
    }

    function closeModal() {
        if (!modalOverlay || !modalOverlay.classList.contains('open')) return;
        modalOverlay.classList.remove('open');
        exitFx();
        if (modalOpener && modalOpener.focus) { try { modalOpener.focus({ preventScroll: true }); } catch (e) {} }
        modalOpener = null;
    }

    // Si se cambia de idioma con el pop-up abierto, se actualizan sus textos
    document.addEventListener('mjvlangchange', () => {
        if (!modalOverlay || !modalOverlay.classList.contains('open') || !modalMember) return;
        const m = modalMember;
        Promise.all(allMembers.map(loadMemberText)).then(() => {
            buildTabs();
            modalTitle.textContent = memberLabel(m);
            modalText.textContent = memberTexts[m] || pickLang(NOT_AVAILABLE);
            if (modalTabs) Array.prototype.forEach.call(modalTabs.children, b => b.classList.toggle('is-active', b.dataset.member === m));
        });
    });

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

    if (modalOverlay) {
        // Cerrar al hacer click fuera de la caja (pero no adentro de ella)
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
});

/* --------------- MENÚ DE CONTACTO (STUDIO) --------------- */
document.addEventListener('DOMContentLoaded', function () {
    const contactButton = document.getElementById('studio-contact-button');
    const contactDropdown = document.getElementById('studio-contact-dropdown');
    setupAnimatedDropdown(contactButton, contactDropdown);
});
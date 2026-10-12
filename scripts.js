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

    // Config: cuántas fotos secundarias tiene cada tarjeta y cada cuánto rotan
    const IMAGES_PER_MEMBER = 3;
    const CYCLE_MS = 1000; // ritmo más rápido
    const DEFAULT_MEMBER = 'estudio';
    const OPEN_POPUP_ON_CARD_CLICK = false;
    const STUDIO_LABEL = { es: 'Foto del Estudio', en: 'Studio Photo', fr: 'Photo du studio', pt: 'Foto do estúdio' };
    const NOT_AVAILABLE = {
        es: 'Texto no disponible por el momento.',
        en: 'Text not available at the moment.',
        fr: 'Texte momentanément indisponible.',
        pt: 'Texto indisponível no momento.'
    };
    // window.mjvLang.pick({...}) devuelve el texto del idioma actual
    const pickLang = (dict) => (window.mjvLang ? window.mjvLang.pick(dict) : dict.es);
    const PERSON_NAMES = { majo: 'Majo', martin: 'Martín', gonza: 'Gonza', maria: 'María' };
    const memberLabel = (member) => (member === 'estudio' ? pickLang(STUDIO_LABEL) : (PERSON_NAMES[member] || member));

    const cards = document.querySelectorAll('.team-card');
    const infoPanelText = document.getElementById('info-panel-text');
    const moreLink = document.getElementById('more-link');
    const modalOverlay = document.getElementById('info-modal-overlay');
    const modalTitle = document.getElementById('info-modal-title');
    const modalText = document.getElementById('info-modal-text');
    const modalCloseBtn = document.getElementById('info-modal-close');

    if (!cards.length || !infoPanelText) return;

    // Textos cargados desde team/<miembro>.txt (o team/<miembro>_en.txt en inglés)
    const memberTexts = {};
    let lastFocusedMember = DEFAULT_MEMBER;

    const langSuffix = () => (window.mjvLang ? window.mjvLang.suffix() : '');

    const loadMemberText = (member) => {
        return fetch(`team/${member}${langSuffix()}.txt`)
            .then(res => {
                if (!res.ok) throw new Error(`No se pudo cargar team/${member}${langSuffix()}.txt`);
                return res.text();
            })
            .then(text => { memberTexts[member] = text; })
            .catch(() => { memberTexts[member] = pickLang(NOT_AVAILABLE); });
    };

    const allMembers = Array.from(cards).map(c => c.dataset.member);
    const loadAllMemberTexts = () => Promise.all(allMembers.map(loadMemberText)).then(() => {
        infoPanelText.textContent = memberTexts[DEFAULT_MEMBER] || '';
    });
    loadAllMemberTexts();

    // Si cambia el idioma (botón EN/ES), volvemos a pedir los textos
    document.addEventListener('mjvlangchange', loadAllMemberTexts);

    // Estado de ciclado de imágenes por tarjeta
    const cardState = new Map();

    cards.forEach(card => {
        const member = card.dataset.member;
        const img = card.querySelector('.team-card-img');
        if (!img) return;

        cardState.set(card, { timer: null, index: 0 });

        const startCycle = () => {
            const state = cardState.get(card);
            card.classList.add('previewing');

            // Texto del panel = el de esta tarjeta mientras se está mirando
            if (memberTexts[member] !== undefined) {
                infoPanelText.textContent = memberTexts[member];
            }
            lastFocusedMember = member;

            clearInterval(state.timer);
            state.timer = setInterval(() => {
                state.index = (state.index % IMAGES_PER_MEMBER) + 1;
                img.src = `team/${member}_${state.index}.png`;
            }, CYCLE_MS);
        };

        const stopCycle = () => {
            const state = cardState.get(card);
            clearInterval(state.timer);
            state.timer = null;
            state.index = 0;
            img.src = `team/${member}_1.png`;
            card.classList.remove('previewing');

            // Al sacar el cursor/dedo, el panel vuelve al texto por defecto
            lastFocusedMember = DEFAULT_MEMBER;
            if (memberTexts[DEFAULT_MEMBER] !== undefined) {
                infoPanelText.textContent = memberTexts[DEFAULT_MEMBER];
            }
        };

        // --- Escritorio: hover ---
        card.addEventListener('mouseenter', startCycle);
        card.addEventListener('mouseleave', stopCycle);
        card.addEventListener('focus', startCycle);  // navegación por teclado
        card.addEventListener('blur', stopCycle);

        // --- Celular/tablet: mantener presionado ---
        card.addEventListener('touchstart', startCycle, { passive: true });
        card.addEventListener('touchend', stopCycle);
        card.addEventListener('touchcancel', stopCycle);

        // Click en una tarjeta: por ahora NO abre el pop-up (todavía no hay esa información).
        // Para volver a activarlo: poner OPEN_POPUP_ON_CARD_CLICK en true.
        if (OPEN_POPUP_ON_CARD_CLICK) {
            card.addEventListener('click', () => openModal(member));
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal(member);
                }
            });
        }
    });

    // Botón "more": abre el pop-up del último miembro enfocado (o Estudio por defecto)
    if (moreLink) {
        moreLink.addEventListener('click', () => openModal(lastFocusedMember));
    }

    // --- Pop-up ---
    function openModal(member) {
        if (!modalOverlay) return;
        if (window.mjvSound) window.mjvSound.pop();
        modalTitle.textContent = memberLabel(member);
        modalText.textContent = memberTexts[member] || pickLang(NOT_AVAILABLE);
        modalOverlay.classList.add('open');
    }

    function closeModal() {
        if (!modalOverlay) return;
        modalOverlay.classList.remove('open');
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

    if (modalOverlay) {
        // Cerrar al hacer click fuera de la caja de texto (pero no adentro de ella)
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
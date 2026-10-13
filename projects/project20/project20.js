/*-------- INICIALIZACIÓN PRINCIPAL DEL SWIPER --------*/
document.addEventListener('DOMContentLoaded', () => {
    // Configuración del Swiper principal
    const mainSwiper = new Swiper('.swiper-container', {
        direction: 'horizontal',   // siempre en horizontal (PC y celular)
        loop: true,
        slidesPerView: 1,
        mousewheel: {
            forceToAxis: true,
            sensitivity: 0.7,
            thresholdDelta: 25,
            releaseOnEdges: true
        },
        keyboard: {
            enabled: true,
            onlyInViewport: false,
            pageUpDown: true
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        speed: 800,
        simulateTouch: true,
        effect: 'slide',
        breakpoints: {
            768: {
                mousewheel: {
                    forceToAxis: false,
                    sensitivity: 0.5
                }
            }
        }
    });

    /*-------- SONIDO AL CAMBIAR DE SECCIÓN --------*/
    // Mismo sonido de transición que usa la portada entre Logo, Architecture y Studio
    // (el carrusel con vuelta avisa "slideChange" varias veces por un mismo cambio:
    // solo suena cuando cambia de verdad la sección)
    let lastSoundIndex = mainSwiper.realIndex;
    mainSwiper.on('slideChange', () => {
        if (mainSwiper.realIndex === lastSoundIndex) return;
        lastSoundIndex = mainSwiper.realIndex;
        if (window.mjvSound) window.mjvSound.swipe();
    });

    /*-------- EL VISOR 3D MANEJA SU PROPIO ZOOM --------*/
    // Mientras el cursor esté sobre el modelo 3D, el scroll del mouse es
    // exclusivamente para el zoom del visor: se apaga la navegación por
    // rueda del mouse de Swiper para que no compitan entre sí.
    const modelo3dWrapper = document.querySelector('.modelo-3d-wrapper');
    if (modelo3dWrapper && mainSwiper.mousewheel) {
        modelo3dWrapper.addEventListener('mouseenter', () => mainSwiper.mousewheel.disable());
        modelo3dWrapper.addEventListener('mouseleave', () => mainSwiper.mousewheel.enable());
    }

    /*-------- NAVEGACIÓN CON TECLADO --------*/
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case 'ArrowDown':
                mainSwiper.slideNext();
                break;
            case 'ArrowUp':
                mainSwiper.slidePrev();
                break;
        }
    });

    /*-------- NAVEGACIÓN CON RUEDA DEL MOUSE --------*/
    let scrollTimeout;
    window.addEventListener('wheel', (e) => {
        // Si el cursor está sobre el visor 3D, el scroll es para hacer zoom
        // al modelo, no para cambiar de sección.
        if (e.target.closest('.modelo-3d-wrapper')) return;

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if(Math.abs(e.deltaY) > 15) {
                e.deltaY > 0 ? mainSwiper.slideNext() : mainSwiper.slidePrev();
            }
        }, 50);
    }, { passive: true });

    /*-------- GALERÍA: LA FOTO SE ABRE EN EL MISMO ESPACIO --------*/
    // Al tocar una foto de la grilla se abre en el espacio central de la sección (donde
    // estaba la grilla), ocupando todo el alto disponible. Con las flechitas, las
    // teclas ← → o deslizando se pasa a otra, con un fundido suave entre fotos.
    // Se cierra con la X, con Esc, o al cambiar de sección.
    const T = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);

    const viewer = document.createElement('div');
    viewer.className = 'gallery-viewer swiper-no-swiping';   // swiper-no-swiping: deslizar acá no cambia de sección
    viewer.setAttribute('role', 'dialog');
    viewer.setAttribute('aria-hidden', 'true');
    viewer.setAttribute('tabindex', '-1');                   // puede recibir el foco (para el teclado) sin mostrar recuadro
    viewer.innerHTML = `
        <div class="gv-stage">
            <img class="gv-img" alt="" draggable="false">
            <img class="gv-img" alt="" draggable="false">
        </div>
        <button type="button" class="gv-btn gv-prev"><span class="gv-icon" aria-hidden="true"></span></button>
        <button type="button" class="gv-btn gv-next"><span class="gv-icon" aria-hidden="true"></span></button>
`;
    const layers = Array.from(viewer.querySelectorAll('.gv-img'));
    const stage = viewer.querySelector('.gv-stage');
    const btnPrev = viewer.querySelector('.gv-prev');
    const btnNext = viewer.querySelector('.gv-next');

    const setLabels = () => {
        viewer.setAttribute('aria-label', T({ es: 'Galería de imágenes', en: 'Image gallery', fr: 'Galerie d\'images', pt: 'Galeria de imagens' }));
        btnPrev.setAttribute('aria-label', T({ es: 'Imagen anterior', en: 'Previous image', fr: 'Image précédente', pt: 'Imagem anterior' }));
        btnNext.setAttribute('aria-label', T({ es: 'Imagen siguiente', en: 'Next image', fr: 'Image suivante', pt: 'Imagem seguinte' }));
    };
    setLabels();
    document.addEventListener('mjvlangchange', setLabels);

    // Barra de puntos (la misma de abajo de la página): marca en qué foto se está
    const dotsBar = document.createElement('div');
    dotsBar.className = 'swiper-pagination gv-pagination swiper-pagination-clickable swiper-pagination-bullets';
    dotsBar.addEventListener('click', (e) => {
        const b = e.target.closest && e.target.closest('.swiper-pagination-bullet');
        if (!b) return;
        e.stopPropagation();
        const i = Number(b.dataset.i);
        if (i !== current) showImage(i);
    });
    const buildDots = (n) => {
        dotsBar.textContent = '';
        for (let i = 0; i < n; i++) {
            const b = document.createElement('span');
            b.className = 'swiper-pagination-bullet';
            b.dataset.i = i;
            dotsBar.appendChild(b);
        }
        const host = document.querySelector('.swiper-container');
        if (host && dotsBar.parentNode !== host) host.appendChild(dotsBar);
    };
    const markDot = (index) => {
        Array.prototype.forEach.call(dotsBar.children, (b, i) => b.classList.toggle('swiper-pagination-bullet-active', i === index));
    };

    let items = [];          // las fotos de la grilla de la sección que está abierta
    let grid = null;
    let current = -1;        // número de la foto que se ve
    let front = 0;           // cuál de las dos capas está al frente
    let token = 0;           // para ignorar cargas que llegan tarde si ya se cambió de foto
    let lastNavAt = 0;
    let opener = null;       // la foto de la grilla que se tocó (para devolverle el foco al cerrar)

    const isOpen = () => viewer.classList.contains('is-open');
    // La grilla muestra miniaturas livianas; la foto grande está en data-full
    const fullSrcOf = (img) => img.dataset.full || img.getAttribute('src');
    const thumbSrcOf = (img) => img.currentSrc || img.getAttribute('src');

    // Muestra la foto "index": entra con un fundido mientras la anterior sale.
    // Se ve primero la miniatura (ya cargada en la grilla, aparece al instante) y, apenas la
    // foto grande está lista, la reemplaza: tienen la misma proporción, así que no se nota.
    const showImage = (index) => {
        const img = items[index].querySelector('img');
        const incoming = layers[front ^ 1];
        const outgoing = layers[front];
        const my = ++token;

        incoming.alt = img.alt;
        incoming.dataset.index = index;
        incoming.src = thumbSrcOf(img);
        requestAnimationFrame(() => {
            if (my !== token) return;
            incoming.classList.add('on');
            outgoing.classList.remove('on');
        });
        front ^= 1;
        current = index;
        markDot(index);

        const big = new Image();
        big.src = fullSrcOf(img);
        const ready = big.decode ? big.decode() : new Promise((ok) => { big.onload = ok; big.onerror = ok; });
        ready.catch(() => {}).then(() => {
            if (my === token && incoming.dataset.index === String(index)) incoming.src = big.src;
        });

        // Las vecinas se piden por adelantado: pasar a la siguiente es instantáneo
        [index - 1, index + 1].forEach((n) => {
            const nb = items[(n + items.length) % items.length].querySelector('img');
            new Image().src = fullSrcOf(nb);
        });
    };

    // fromKeyboard: se abrió con Enter/Espacio. Solo en ese caso el foco va a la X y, al cerrar,
    // vuelve a la foto (con el mouse no se muestra ningún recuadro de foco).
    const openViewer = (item, fromKeyboard) => {
        grid = item.parentNode;
        items = Array.from(grid.querySelectorAll('.gallery-item'));
        // el visor se coloca en la misma sección (slide) de la foto tocada
        item.closest('.swiper-slide').appendChild(viewer);
        opener = fromKeyboard ? item : null;
        current = -1;
        layers.forEach((l) => { l.classList.remove('on'); l.removeAttribute('src'); });
        viewer.classList.add('is-open');
        viewer.setAttribute('aria-hidden', 'false');
        buildDots(items.length);
        document.documentElement.classList.add('gv-open');
        if (mainSwiper.mousewheel) mainSwiper.mousewheel.disable();      // la ruedita pasa de foto, no de sección
        grid.classList.add('is-covered');
        if (mainSwiper.keyboard) mainSwiper.keyboard.disable();     // ← → son para las fotos, no para cambiar de sección
        showImage(items.indexOf(item));
        viewer.focus({ preventScroll: true });
    };

    const closeViewer = () => {
        if (!isOpen()) return;
        viewer.classList.remove('is-open');
        viewer.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('gv-open');
        if (mainSwiper.mousewheel) mainSwiper.mousewheel.enable();
        if (grid) grid.classList.remove('is-covered');
        if (mainSwiper.keyboard) mainSwiper.keyboard.enable();
        if (opener) { opener.focus({ preventScroll: true }); opener = null; }
        token++;
        // cuando terminó el fundido de salida se vacían las capas (se libera memoria)
        setTimeout(() => {
            if (isOpen()) return;
            layers.forEach((l) => { l.classList.remove('on'); l.removeAttribute('src'); });
        }, 650);
    };

    const go = (dir) => {
        if (!isOpen()) return;
        const now = Date.now();
        if (now - lastNavAt < 350) return;      // deja terminar el fundido anterior antes de otro cambio
        lastNavAt = now;
        showImage((current + dir + items.length) % items.length);
    };

    // Las fotos de la grilla se pueden tocar o activar con el teclado (Enter / Espacio).
    // (El carrusel con "vuelta" de Swiper duplica las secciones: por eso se escucha en el
    // documento y no en cada foto.)
    document.querySelectorAll('.gallery-item').forEach((it) => {
        it.setAttribute('tabindex', '0');
        it.setAttribute('role', 'button');
    });
    document.addEventListener('click', (e) => {
        const item = e.target.closest && e.target.closest('.gallery-item');
        if (item) openViewer(item);
    });
    document.addEventListener('keydown', (e) => {
        const item = document.activeElement && document.activeElement.classList &&
                     document.activeElement.classList.contains('gallery-item') ? document.activeElement : null;
        if (item && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openViewer(item, true); return; }
        if (!isOpen()) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        else if (e.key === 'Escape') closeViewer();
    });

    // Ruedita del mouse / trackpad: cambia de foto (hacia abajo = siguiente). Se junta un poco de movimiento para que un
    // solo giro no salte varias fotos.
    let wheelAcc = 0, wheelAt = 0;
    const onWheel = (e) => {
        if (!isOpen()) return;
        e.preventDefault();
        e.stopPropagation();          // que no llegue a Swiper (no cambia de sección)
        e.stopImmediatePropagation();
        const now = Date.now();
        if (now - wheelAt > 250) wheelAcc = 0;
        wheelAt = now;
        wheelAcc += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (Math.abs(wheelAcc) >= 30) { go(wheelAcc > 0 ? 1 : -1); wheelAcc = 0; }
    };
    viewer.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    btnPrev.addEventListener('click', () => go(-1));
    btnNext.addEventListener('click', () => go(1));
    // El único botón de volver es el de arriba (el de la página): con una foto abierta cierra la foto; si no, vuelve a proyectos.
    // (Se escucha en la fase de captura y antes que el de la portada, así que lo frena si hay una foto abierta.)
    document.addEventListener('click', (e) => {
        const back = e.target.closest && e.target.closest('.back-to-projects-btn');
        if (!back || !isOpen()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        closeViewer();
    }, true);

    // Deslizar con el dedo (o arrastrar con el mouse) hacia los costados
    let dragX = null, dragY = null;
    stage.addEventListener('pointerdown', (e) => { dragX = e.clientX; dragY = e.clientY; });
    stage.addEventListener('pointerup', (e) => {
        if (dragX === null) return;
        const dx = e.clientX - dragX, dy = e.clientY - dragY;
        dragX = dragY = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    });
    stage.addEventListener('pointercancel', () => { dragX = dragY = null; });

    // Si se cambia de sección (rueda, teclas, puntitos...), el visor se cierra
    mainSwiper.on('slideChange', closeViewer);

    /*-------- CARGA DE TEXTOS DINÁMICOS --------*/
    const langSuffix = () => (window.mjvLang ? window.mjvLang.suffix() : '');

    // Pide un texto; si no existe la versión del idioma (404), usa la versión sin sufijo.
    // 'seq' descarta respuestas viejas si el idioma cambió mientras se descargaba.
    const fetchText = async (base, ext) => {
        const suf = langSuffix();
        let res = await fetch(base + suf + ext);
        if (!res.ok && suf) res = await fetch(base + ext);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
    };
    let memoriaSeq = 0;
    const loadText = async (base, ext, elementId) => {
        const mine = ++memoriaSeq;
        try {
            const text = await fetchText(base, ext);
            if (mine !== memoriaSeq) return;
            document.querySelectorAll('#' + elementId).forEach(el => { el.innerHTML = text; });
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const loadMemoria = () => loadText('memoria20', '.txt', 'memoria-text');
    loadMemoria();

    /*-------- CARRUSEL TÉCNICO (DETALLES) --------*/
    let currentTechIndex = 0;
    const techSlides = document.querySelectorAll('.team-slide');
    const infoSlides = document.querySelectorAll('.info-slide');

    function updateTechSlide() {
        techSlides.forEach(slide => slide.classList.remove('active'));
        infoSlides.forEach(slide => slide.classList.remove('active'));
        
        if (techSlides[currentTechIndex]) techSlides[currentTechIndex].classList.add('active');
        if (infoSlides[currentTechIndex]) infoSlides[currentTechIndex].classList.add('active');
    }

    // Control de navegación
    const techPrev = document.getElementById('tech-prev-btn');
    const techNext = document.getElementById('tech-next-btn');
    if (techPrev) techPrev.addEventListener('click', () => {
        if (!techSlides.length) return;
        currentTechIndex = (currentTechIndex - 1 + techSlides.length) % techSlides.length;
        updateTechSlide();
    });
    if (techNext) techNext.addEventListener('click', () => {
        if (!techSlides.length) return;
        currentTechIndex = (currentTechIndex + 1) % techSlides.length;
        updateTechSlide();
    });

    /*-------- CARGA DE DESCRIPCIONES TÉCNICAS --------*/
    let techSeq = 0;
    const loadTechDescriptions = () => {
        const mine = ++techSeq;
        document.querySelectorAll('.team-slide').forEach((slide, index) => {
            const memberNumber = index + 1;
            const contentContainer = document.querySelector(
                `.info-slide[data-member="${memberNumber}"] .team-info-content`
            );
            
            if (!contentContainer) return;
            fetchText(`tech_info_${memberNumber}`, '.txt')
                .then(data => {
                    if (mine !== techSeq) return;
                    // Sanitización básica de contenido
                    const sanitized = data
                        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                        .replace(/onerror\s*=\s*["'][^"']*["']/gi, '');
                    
                    contentContainer.innerHTML = sanitized;
                    
                    // Aplicar estilos dinámicos
                    contentContainer.querySelectorAll('ul').forEach(ul => {
                        ul.style.listStyleType = 'square';
                        ul.style.paddingLeft = '20px';
                        ul.style.margin = '10px 0';
                    });
                })
                .catch(error => console.error(`Error cargando tech_info_${memberNumber}:`, error));
        });
    };

    // Iniciar carga de contenidos
    loadTechDescriptions();

    // Si cambia el idioma (botón EN/ES, elegido en la portada), volvemos a
    // pedir estos mismos textos pero en el idioma nuevo.
    document.addEventListener('mjvlangchange', () => {
        loadMemoria();
        loadTechDescriptions();
    });

    /*-------- CONTROL DE SCROLL EN SUBSECCIONES --------*/
    document.querySelectorAll('.sub-section.right').forEach(section => {
        section.addEventListener('wheel', (e) => {
            if(section.scrollHeight > section.clientHeight) {
                e.stopPropagation();
            }
        });
    });
});

/*-------- VISOR 3D: PORCENTAJE DE CARGA --------*/
document.addEventListener('DOMContentLoaded', () => {
    const viewer = document.getElementById('viewer-memoria');
    const status = document.getElementById('loading-status-memoria');
    if (!viewer || !status) return;

    const pick = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);

    viewer.addEventListener('progress', (event) => {
        const pct = Math.round(event.detail.totalProgress * 100);
        status.textContent = pick({
            es: `Cargando modelo… ${pct}%`,
            en: `Loading model… ${pct}%`,
            fr: `Chargement du modèle… ${pct} %`,
            pt: `Carregando modelo… ${pct}%`
        });
    });

    viewer.addEventListener('load', () => {
        status.style.display = 'none';
    });

    viewer.addEventListener('error', () => {
        status.textContent = pick({
            es: 'No se pudo cargar el modelo.',
            en: 'Could not load the model.',
            fr: 'Impossible de charger le modèle.',
            pt: 'Não foi possível carregar o modelo.'
        });
    });
});
/*-------- INICIALIZACIÓN PRINCIPAL DEL SWIPER --------*/
document.addEventListener('DOMContentLoaded', () => {
    // Configuración del Swiper principal
    const mainSwiper = new Swiper('.swiper-container', {
        direction: 'vertical',
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
                direction: 'horizontal',
                mousewheel: {
                    forceToAxis: false,
                    sensitivity: 0.5
                }
            }
        }
    });

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
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            if(Math.abs(e.deltaY) > 15) {
                e.deltaY > 0 ? mainSwiper.slideNext() : mainSwiper.slidePrev();
            }
        }, 50);
    }, { passive: true });

    /*-------- LIGHTBOX PARA LA GALERÍA --------*/
    const lightbox = document.getElementById('lightbox');
    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightboxSwiper = new Swiper('.lightbox-swiper', {
        loop: true,
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        keyboard: true,
        speed: 500
    });

    // Preparar slides del lightbox
    galleryItems.forEach(item => {
        const slide = document.createElement('div');
        slide.className = 'swiper-slide';
        slide.innerHTML = `
            <img src="${item.querySelector('img').src}" 
                 alt="${item.querySelector('img').alt}" 
                 style="max-height: 80vh; width: auto;">`;
        lightboxSwiper.appendSlide(slide);
    });

    // Eventos del lightbox
    galleryItems.forEach((item, index) => {
        item.addEventListener('click', () => {
            lightbox.classList.add('active');
            lightboxSwiper.slideTo(index);
        });
    });

    const closeLightbox = () => {
        lightbox.classList.remove('active');
        lightboxSwiper.slideTo(0);
    };
    
    document.querySelector('.close-btn').addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && closeLightbox());
    lightbox.addEventListener('click', (e) => e.target === lightbox && closeLightbox());

    /*-------- CARGA DE TEXTOS DINÁMICOS --------*/
    const loadText = async (url, elementId) => {
        try {
            const response = await fetch(url);
            const text = await response.text();
            document.getElementById(elementId).innerHTML = text;
        } catch (error) {
            console.error('Error:', error);
        }
    };
    
    loadText('memoria20.txt', 'memoria-text');
    loadText('informacion20.txt', 'informacion-text');

    /*-------- CARRUSEL TÉCNICO (DETALLES) --------*/
    let currentTechIndex = 0;
    const techSlides = document.querySelectorAll('.team-slide');
    const infoSlides = document.querySelectorAll('.info-slide');

    function updateTechSlide() {
        techSlides.forEach(slide => slide.classList.remove('active'));
        infoSlides.forEach(slide => slide.classList.remove('active'));
        
        techSlides[currentTechIndex].classList.add('active');
        infoSlides[currentTechIndex].classList.add('active');
    }

    // Control de navegación
    document.getElementById('tech-prev-btn').addEventListener('click', () => {
        currentTechIndex = (currentTechIndex - 1 + techSlides.length) % techSlides.length;
        updateTechSlide();
    });

    document.getElementById('tech-next-btn').addEventListener('click', () => {
        currentTechIndex = (currentTechIndex + 1) % techSlides.length;
        updateTechSlide();
    });

    /*-------- CARGA DE DESCRIPCIONES TÉCNICAS --------*/
    const loadTechDescriptions = () => {
        document.querySelectorAll('.team-slide').forEach((slide, index) => {
            const memberNumber = index + 1;
            const contentContainer = document.querySelector(
                `.info-slide[data-member="${memberNumber}"] .team-info-content`
            );
            
            fetch(`tech_info_${memberNumber}.txt`)
                .then(response => response.text())
                .then(data => {
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
                .catch(error => console.error(`Error cargando tech_info_${memberNumber}.txt:`, error));
        });
    };

    // Iniciar carga de contenidos
    loadTechDescriptions();

    /*-------- CONTROL DE SCROLL EN SUBSECCIONES --------*/
    document.querySelectorAll('.sub-section.right').forEach(section => {
        section.addEventListener('wheel', (e) => {
            if(section.scrollHeight > section.clientHeight) {
                e.stopPropagation();
            }
        });
    });
});
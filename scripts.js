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
});

/* --------------- FILTRO DE ARQUITECTURA --------------- */
document.addEventListener('DOMContentLoaded', function () {
    // Elementos del filtro
    const filterButtons = document.querySelectorAll('.filter');
    const galleryItems = document.querySelectorAll('.project');
    const categoriesButton = document.getElementById('categories-button');
    const dropdown = document.getElementById('categories-dropdown');
    let dropdownTimeout;

    // Control del dropdown
    const dropdownController = {
        show: () => {
            clearTimeout(dropdownTimeout);
            dropdown.style.display = 'block';
        },
        hide: () => {
            dropdownTimeout = setTimeout(() => {
                dropdown.style.display = 'none';
            }, 200);
        },
        toggle: (e) => {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
        }
    };

    // Event handlers del dropdown
    if (categoriesButton && dropdown) {
        categoriesButton.addEventListener('mouseenter', dropdownController.show);
        categoriesButton.addEventListener('mouseleave', dropdownController.hide);
        categoriesButton.addEventListener('click', dropdownController.toggle);
        
        dropdown.addEventListener('mouseenter', dropdownController.show);
        dropdown.addEventListener('mouseleave', dropdownController.hide);

        // Cierre externo
        document.addEventListener('click', (e) => {
            if (!categoriesButton.contains(e.target) && !dropdown.contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    // Filtrado de proyectos
    const handleFilterClick = (e) => {
        e.preventDefault();
        const filter = e.currentTarget.dataset.filter;

        galleryItems.forEach(item => {
            const shouldShow = filter === 'all' || item.classList.contains(filter);
            item.style.display = shouldShow ? 'grid' : 'none';
        });

        filterButtons.forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        dropdown.style.display = 'none';
    };

    filterButtons.forEach(button => {
        button.addEventListener('click', handleFilterClick);
    });
});

/* --------------- CARRUSEL DE STUDIO --------------- */
document.addEventListener('DOMContentLoaded', function () {
    // Elementos del carrusel Studio
    const prevBtn = document.getElementById('studio-prev-btn');
    const nextBtn = document.getElementById('studio-next-btn');
    const teamSlides = document.querySelectorAll('.team-slide');
    const infoSlides = document.querySelectorAll('.info-slide');
    let currentSlide = 0;

    const updateSlides = () => {
        teamSlides.forEach(slide => slide.classList.remove('active'));
        infoSlides.forEach(slide => slide.classList.remove('active'));
        
        if (teamSlides[currentSlide]) teamSlides[currentSlide].classList.add('active');
        if (infoSlides[currentSlide]) infoSlides[currentSlide].classList.add('active');
    };

    const nextSlide = () => {
        currentSlide = (currentSlide + 1) % teamSlides.length;
        updateSlides();
    };

    const prevSlide = () => {
        currentSlide = (currentSlide - 1 + teamSlides.length) % teamSlides.length;
        updateSlides();
    };

    if (prevBtn && nextBtn) {
        prevBtn.addEventListener('click', prevSlide);
        nextBtn.addEventListener('click', nextSlide);
    }
});

/* --------------- CARGA DE CONTENIDO PARA STUDIO --------------- */
document.addEventListener('DOMContentLoaded', function () {
    // Cargar contenido de los miembros del Studio
    const members = ['studio-1', 'studio-2'];
    
    members.forEach(member => {
        fetch(`studio/${member}.txt`)
            .then(response => {
                if (!response.ok) throw new Error(`No se pudo cargar ${member}.txt`);
                return response.text();
            })
            .then(data => {
                const container = document.querySelector(`.info-slide[data-member="${member}"] .team-info-content`);
                if (container) {
                    container.innerHTML = data;
                }
            })
            .catch(error => console.error(`Error cargando ${member}.txt:`, error));
    });
});

/* --------------- MENÚ DE CONTACTO (STUDIO) --------------- */
document.addEventListener('DOMContentLoaded', function () {
    const contactButton = document.getElementById('studio-contact-button');
    const contactDropdown = document.getElementById('studio-contact-dropdown');
    let contactTimeout;

    if (contactButton && contactDropdown) {
        const showDropdown = () => {
            clearTimeout(contactTimeout);
            contactDropdown.style.display = 'block';
        };

        const hideDropdown = () => {
            contactTimeout = setTimeout(() => {
                contactDropdown.style.display = 'none';
            }, 200);
        };

        contactButton.addEventListener('mouseenter', showDropdown);
        contactButton.addEventListener('mouseleave', hideDropdown);
        contactButton.addEventListener('click', (e) => {
            e.stopPropagation();
            contactDropdown.style.display = contactDropdown.style.display === 'block' ? 'none' : 'block';
        });

        contactDropdown.addEventListener('mouseenter', showDropdown);
        contactDropdown.addEventListener('mouseleave', hideDropdown);

        document.addEventListener('click', (e) => {
            if (!contactButton.contains(e.target) && !contactDropdown.contains(e.target)) {
                contactDropdown.style.display = 'none';
            }
        });
    }
});
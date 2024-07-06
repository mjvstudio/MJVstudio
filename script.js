document.addEventListener('DOMContentLoaded', () => {
    const mainSwiper = new Swiper('.swiper-container', {
        loop: true,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        keyboard: {
            enabled: true,
        },
        mousewheel: {
            invert: false,
            sensitivity: 0.5,
        },
        autoHeight: false, // Desactivar autoHeight para mantener el tamaño fijo
    });

    // Video control for MJV section
    const mjvVideo = document.getElementById('mjv-video');
    mjvVideo.addEventListener('ended', () => {
        mjvVideo.currentTime = mjvVideo.duration - 0.1; // Set video to last frame
    });

    // Event listeners para abrir la página del proyecto al hacer clic en un proyecto
    document.querySelectorAll('.gallery-item').forEach(item => {
        item.addEventListener('click', () => {
            const projectId = item.dataset.project;
            window.location.href = `projects/project.html?project=${projectId}`;
        });
    });

    // Event listeners para abrir la página del proyecto al hacer clic en el nombre del proyecto
    document.querySelectorAll('.project-title').forEach(item => {
        item.addEventListener('click', (event) => {
            event.stopPropagation(); // Evita que se dispare el evento del padre
            const projectId = item.closest('.gallery-item').dataset.project;
            window.location.href = `projects/project.html?project=${projectId}`;
        });
    });

    // Filtrado de categorías
    const filterLinks = document.querySelectorAll('.filter');
    const galleryItems = document.querySelectorAll('.gallery-item');

    filterLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const filter = this.getAttribute('data-filter');

            galleryItems.forEach(item => {
                if (filter === 'all') {
                    item.style.display = 'block';
                } else if (item.classList.contains(filter)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });

    // Lightbox functionality
    const lightbox = document.getElementById('contact-lightbox');
    const closeBtn = document.querySelector('.close');
    const emailBtn = document.getElementById('email-button');

    emailBtn.addEventListener('click', (event) => {
        event.preventDefault();
        lightbox.classList.add('show');
    });

    closeBtn.addEventListener('click', () => {
        lightbox.classList.remove('show');
    });

    window.addEventListener('click', (event) => {
        if (event.target === lightbox) {
            lightbox.classList.remove('show');
        }
    });

    // Agregar sonido al pasar el cursor sobre los menús desplegables, opciones y galería de proyectos
    const hoverSound = new Audio('site/sounds/menu.mp3');
    hoverSound.volume = 0.01; // Ajustar el volumen si es necesario

    document.querySelectorAll('a, button, img').forEach(item => {
        item.addEventListener('mouseover', () => {
            hoverSound.currentTime = 0;
            hoverSound.play();
        });
    });

    // Crear y mover el cursor personalizado
    const customCursor = document.createElement('div');
    customCursor.classList.add('custom-cursor');
    document.body.appendChild(customCursor);

    document.addEventListener('mousemove', (e) => {
        customCursor.style.left = `${e.clientX}px`;
        customCursor.style.top = `${e.clientY}px`;
    });

    // Cerrar el formulario con la tecla Escape
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            lightbox.classList.remove('show');
        }
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const loaderContainer = document.getElementById('loader-container');
    const contentContainer = document.querySelector('.swiper-container');

    window.addEventListener('load', () => {
        loaderContainer.style.display = 'none';
        contentContainer.style.display = 'block';
    });
});

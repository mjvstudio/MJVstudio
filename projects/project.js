document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');

    const projectTitles = {
        project1: "Edificio LL",
        project2: "Casa Mburucujá",
        project3: "Casa Mbarete Porã",
        project4: "Casa Gini Vera",
        project5: "Camp Fire",
        project6: "Casa Vikinga",
        project7: "Padel Center Rimini",
        project8: "Casa Asunción",
        project9: "Oficina Ejecutiva KP",
        project10: "Casa 6:40",
        project11: "Reforma Vikinga",
        project12: "Casa RA",
        project13: "Reforma LM1",
        project14: "Ovy",
        project15: "Fachada Andes",
        project16: "Fachada Aldito"
    };

    const projectTitle = projectTitles[projectId] || "Proyecto";

    document.title = projectTitle;
    document.getElementById('project-title').textContent = projectTitle;

    // Cargar el carrusel de imágenes del proyecto
    let imageIndex = 1;
    const carouselContainer = document.getElementById('project-carousel');

    const loadImages = async () => {
        while (true) {
            const image = `${projectId}/${projectId}_${imageIndex}.jpg`;
            try {
                const response = await fetch(image);
                if (response.ok) {
                    const slide = document.createElement('div');
                    slide.classList.add('swiper-slide');

                    const imageContainer = document.createElement('div');
                    imageContainer.classList.add('image-container');

                    const img = document.createElement('img');
                    img.src = image;
                    img.alt = `Imagen del proyecto ${projectId}`;

                    const loader = document.createElement('img');
                    loader.src = '../site/loader.gif';
                    loader.classList.add('image-loader');

                    imageContainer.appendChild(loader);
                    imageContainer.appendChild(img);
                    slide.appendChild(imageContainer);

                    img.onload = () => {
                        loader.style.display = 'none';
                        img.style.display = 'block';
                    };

                    carouselContainer.appendChild(slide);
                    imageIndex++;
                } else {
                    break; // Sale del bucle si no encuentra más imágenes
                }
            } catch (error) {
                console.error('Error al cargar la imagen:', error);
                break;
            }
        }

        // Inicializar Swiper después de cargar las imágenes
        const projectSwiper = new Swiper('.project-swiper-container', {
            loop: true,
            pagination: { el: '.swiper-pagination', clickable: true },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            keyboard: { enabled: true },
            mousewheel: { invert: false, sensitivity: 0.5 },
        });
    };

    loadImages();

    const infoModal = document.getElementById('info-modal');
    const infoContent = document.getElementById('info-content');
    const closeModal = document.querySelector('.close');

    const goBack = () => {
        window.location.href = '../index.html#projects'; // Redirigir a la sección de Projects
    };
    document.querySelector('.back-button').addEventListener('click', goBack);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (infoModal.style.display === 'block') {
                infoModal.style.display = 'none';
            } else {
                goBack();
            }
        }
    });

    document.querySelectorAll('.more-info-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const project = e.currentTarget.dataset.project;
            fetch(`${project}/${project}_info.txt`)
                .then(response => response.text())
                .then(data => {
                    infoContent.innerHTML = data;
                    infoModal.style.display = 'block';
                })
                .catch(error => {
                    console.error('Error al cargar el archivo de información:', error);
                    alert('No se pudo cargar la información del proyecto.');
                });
        });
    });

    closeModal.addEventListener('click', () => {
        infoModal.style.display = 'none';
    });

    const customCursor = document.createElement('div');
    customCursor.classList.add('custom-cursor');
    document.body.appendChild(customCursor);

    document.addEventListener('mousemove', (e) => {
        customCursor.style.left = `${e.clientX}px`;
        customCursor.style.top = `${e.clientY}px`;
    });

    const hoverSound = new Audio('../site/Sounds/Menu.mp3');
    hoverSound.volume = 0.075;
    const interactiveElements = document.querySelectorAll('.back-button, .more-info-button');

    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', () => {
            hoverSound.currentTime = 0;
            hoverSound.play();
        });
    });
});

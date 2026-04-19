// Inicialización de Swiper
const projectSwiper = new Swiper('.project-swiper', {
    direction: 'horizontal',
    loop: false,
    speed: 800,
    mousewheel: {
        forceToAxis: true
    },
    keyboard: {
        enabled: true,
        onlyInViewport: true
    },
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
        renderBullet: function (index, className) {
            const labels = ['MEMORIA', 'INFO', 'GALERÍA'];
            return `<span class="${className}">${labels[index]}</span>`;
        }
    },
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    },
    breakpoints: {
        768: {
            pagination: {
                dynamicBullets: true
            }
        }
    }
});

// Efecto hover para imágenes
document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
        item.style.transform = 'scale(1.02)';
        item.style.zIndex = '10';
    });
    
    item.addEventListener('mouseleave', () => {
        item.style.transform = 'scale(1)';
        item.style.zIndex = '1';
    });
});

// Ajuste responsive de altura
function adjustSwiperHeight() {
    const swiper = document.querySelector('.project-swiper');
    swiper.style.height = `${window.innerHeight}px`;
}

window.addEventListener('resize', adjustSwiperHeight);
adjustSwiperHeight();
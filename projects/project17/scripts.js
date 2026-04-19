document.addEventListener("DOMContentLoaded", () => {
    console.log("Proyecto cargado correctamente");

    // Cargar el contenido de la memoria
    const loadMemoria = () => {
        fetch("memoria.txt")
            .then(response => {
                if (!response.ok) {
                    throw new Error("Error al cargar el archivo de memoria");
                }
                return response.text();
            })
            .then(data => {
                const memoriaContent = document.getElementById("memoria-content");
                if (memoriaContent) {
                    memoriaContent.textContent = data;
                }
            })
            .catch(error => {
                const memoriaContent = document.getElementById("memoria-content");
                if (memoriaContent) {
                    memoriaContent.textContent = "No se pudo cargar la memoria.";
                }
                console.error(error);
            });
    };

    // Inicializar Swiper
    const swiper = new Swiper('.swiper-container', {
        direction: 'horizontal',
        loop: true, // Modo infinito
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        mousewheel: true, // Desplazamiento con rueda del ratón
        keyboard: {
            enabled: true, // Navegación con teclado
        },
        on: {
            init: function () {
                // Cargar la memoria cuando Swiper se inicializa
                loadMemoria();
            },
            slideChange: function () {
                // Recargar la memoria si es necesario al cambiar de slide
                if (this.activeIndex === 0) {
                    loadMemoria();
                }
            },
        },
    });
});
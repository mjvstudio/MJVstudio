/* Sección Documentos: carpetas, lista de planos y vista previa */
(function () {
  const cfg = window.MV015;
  const $ = (id) => document.getElementById(id);

  document.getElementById('codigo').textContent = cfg.codigo;
  document.getElementById('titulo').textContent = cfg.titulo;
  document.title = cfg.codigo + ' · ' + cfg.titulo;

  // ----- Pestañas -----
  document.querySelectorAll('.pestana').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.pestana').forEach((x) => {
        x.classList.toggle('activa', x === b);
        x.setAttribute('aria-selected', x === b);
      });
      document.querySelectorAll('.vista').forEach((v) => v.classList.remove('activa'));
      $('vista-' + b.dataset.vista).classList.add('activa');
      window.dispatchEvent(new Event('resize'));
    });
  });

  const icono =
    '<svg viewBox="0 0 40 32" fill="none" stroke="currentColor" stroke-width="1.6">' +
    '<path d="M2 6a2 2 0 0 1 2-2h10l4 4h18a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/></svg>';

  const nombreArchivo = (ruta) => decodeURIComponent(ruta.split('/').pop());
  const url = (ruta) => encodeURI(ruta);

  // ----- Carpetas -----
  const cont = $('carpetas');
  cfg.carpetas.forEach((c) => {
    const n = c.archivos.length;
    const b = document.createElement('button');
    b.className = 'carpeta' + (n ? '' : ' vacia');
    b.innerHTML =
      icono +
      '<strong></strong><span></span><em>' +
      (n ? n + (n === 1 ? ' documento' : ' documentos') : 'Próximamente') +
      '</em>';
    b.querySelector('strong').textContent = c.nombre;
    b.querySelector('span').textContent = c.detalle || '';
    b.addEventListener('click', () => abrirCarpeta(c));
    cont.appendChild(b);
  });

  function abrirCarpeta(c) {
    cont.hidden = true;
    $('lista').hidden = false;
    $('listaTitulo').textContent = c.nombre;
    const ul = $('archivos');
    ul.innerHTML = '';
    if (!c.archivos.length) {
      ul.innerHTML = '<li class="sin-archivos">Todavía no hay planos cargados en esta carpeta.</li>';
      return;
    }
    c.archivos.forEach((a) => {
      const li = document.createElement('li');
      li.className = 'archivo';
      li.innerHTML =
        '<span class="pdf">PDF</span>' +
        '<div class="nombre"><strong></strong><small></small></div>' +
        '<button class="ver">Ver</button>' +
        '<a download>Descargar</a>';
      li.querySelector('strong').textContent = a.titulo;
      li.querySelector('small').textContent = nombreArchivo(a.archivo);
      li.querySelector('a').href = url(a.archivo);
      li.querySelector('a').setAttribute('download', nombreArchivo(a.archivo));
      li.querySelector('.ver').addEventListener('click', () => verPdf(a));
      ul.appendChild(li);
    });
  }

  $('volver').addEventListener('click', () => {
    $('lista').hidden = true;
    cont.hidden = false;
  });

  // ----- Vista previa -----
  function verPdf(a) {
    const u = url(a.archivo);
    $('previewTitulo').textContent = a.titulo;
    $('previewAbrir').href = u;
    $('previewBajar').href = u;
    $('previewBajar').setAttribute('download', nombreArchivo(a.archivo));
    $('previewFrame').src = u + '#view=FitH';
    $('preview').hidden = false;
  }
  $('previewCerrar').addEventListener('click', () => {
    $('preview').hidden = true;
    $('previewFrame').src = 'about:blank';
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('preview').hidden) $('previewCerrar').click();
  });
})();

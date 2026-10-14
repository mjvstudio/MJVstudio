/* Memoria descriptiva en las páginas de proyecto "simples": pide memoria<N>.txt (+ _en, _fr, _pt según el idioma)
   y arma un párrafo por cada bloque separado por una línea en blanco. N sale de <body data-project="N">. */
(function () {
    var box = document.getElementById('memoria-text');
    var n = document.body.getAttribute('data-project');
    if (!box || !n) return;
    var seq = 0;
    function suffix() { return window.mjvLang ? window.mjvLang.suffix() : ''; }
    function get(sfx) {
        return fetch('memoria' + n + sfx + '.txt').then(function (r) { if (!r.ok) throw new Error('404'); return r.text(); });
    }
    function render(text) {
        box.textContent = '';
        text.trim().split(/\n\s*\n/).forEach(function (par) {
            var p = document.createElement('p');
            p.textContent = par.trim();
            box.appendChild(p);
        });
    }
    function load() {
        var mine = ++seq, sfx = suffix();
        get(sfx).catch(function () { return sfx ? get('') : Promise.reject(); })
            .then(function (t) { if (mine === seq) render(t); })
            .catch(function () { if (mine === seq) box.textContent = ''; });
    }
    load();
    document.addEventListener('mjvlangchange', load);
})();

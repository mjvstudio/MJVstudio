/* =====================================================================
   ACCESO AL 360 STUDIO — pantalla de ingreso con usuario y contraseña

   - Las contraseñas se comparan por su hash (PBKDF2-SHA256), nunca en texto.
   - La sesión dura hasta cerrar la pestaña, o 7 días con "Recordarme".
   - Cada ingreso se envía a Umami como el evento  studio360-login  {user}.
   - El Studio recién se carga después de ingresar.
   ===================================================================== */
(function () {
    'use strict';
    var KEY = 'studio360_session';
    var ITER = 150000;
    var DAYS = 7;

    function store(kind) {
        try { return kind === 'local' ? window.localStorage : window.sessionStorage; } catch (e) { return null; }
    }
    function readSession() {
        var raw = null;
        try { raw = (store('session') && store('session').getItem(KEY)) || (store('local') && store('local').getItem(KEY)); } catch (e) {}
        if (!raw) return null;
        try {
            var s = JSON.parse(raw);
            if (s.exp && Date.now() > s.exp) { clearSession(); return null; }
            var u = findUser(s.user);
            if (!u || u.hash.slice(0, 12) !== s.k) return null;   // si cambia la contraseña o se borra el usuario, se cierra la sesión
            return u;
        } catch (e) { return null; }
    }
    function saveSession(u, remember) {
        var s = JSON.stringify({ user: u.user, k: u.hash.slice(0, 12), exp: remember ? Date.now() + DAYS * 864e5 : 0 });
        try { store('session').setItem(KEY, s); } catch (e) {}
        if (remember) { try { store('local').setItem(KEY, s); } catch (e) {} }
    }
    function clearSession() {
        try { store('session').removeItem(KEY); } catch (e) {}
        try { store('local').removeItem(KEY); } catch (e) {}
    }
    function findUser(name) {
        var n = String(name || '').trim().toLowerCase();
        return (window.STUDIO_USERS || []).filter(function (u) { return u.user.toLowerCase() === n; })[0] || null;
    }
    function hex(buf) {
        return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    function unhex(h) {
        var a = new Uint8Array(h.length / 2);
        for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
        return a;
    }
    function hashPassword(pw, saltHex) {
        var enc = new TextEncoder();
        return crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits'])
            .then(function (key) {
                return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: ITER }, key, 256);
            })
            .then(hex);
    }
    window.studioHashPassword = hashPassword;

    function track(name, data) {
        try { if (window.mjvAnalytics) window.mjvAnalytics.track(name, data); } catch (e) {}
    }

    function startStudio(u) {
        document.documentElement.classList.remove('gate-locked');
        var gate = document.getElementById('studioGate');
        if (gate) gate.remove();
        // Usuario visible y botón para salir
        var bar = document.createElement('div');
        bar.id = 'gateUser';
        var name = document.createElement('span');
        name.textContent = u.name || u.user;
        var out = document.createElement('button');
        out.type = 'button';
        out.textContent = 'Salir';
        out.addEventListener('click', function () {
            clearSession();
            track('studio360-logout', { user: u.user });
            location.reload();
        });
        bar.appendChild(name);
        bar.appendChild(out);
        document.body.appendChild(bar);
        window.STUDIO_USER = { user: u.user, name: u.name || u.user };
        // Cargar el Studio
        ['script.js', 'hotspot-editor.js', 'blueprint.js'].forEach(function (src) {
            var s = document.createElement('script');
            s.type = 'module';
            s.src = src;
            document.body.appendChild(s);
        });
    }

    function showGate() {
        document.documentElement.classList.add('gate-locked');
        var form = document.getElementById('gateForm');
        var err = document.getElementById('gateError');
        var btn = document.getElementById('gateSubmit');
        var userEl = document.getElementById('gateUserInput');
        var passEl = document.getElementById('gatePassInput');
        var remEl = document.getElementById('gateRemember');
        var fails = 0;
        setTimeout(function () { userEl.focus(); }, 50);
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            err.textContent = '';
            if (!window.crypto || !crypto.subtle) {
                err.textContent = 'Este navegador no permite ingresar. Abrí el Studio desde https://mjvstudio.com';
                return;
            }
            var u = findUser(userEl.value);
            btn.disabled = true;
            btn.textContent = 'Verificando…';
            var salt = u ? u.salt : '00000000000000000000000000000000';
            hashPassword(passEl.value, salt).then(function (h) {
                if (u && h === u.hash) {
                    saveSession(u, remEl.checked);
                    track('studio360-login', { user: u.user });
                    startStudio(u);
                } else {
                    fails++;
                    track('studio360-login-failed');
                    err.textContent = 'Usuario o contraseña incorrectos.';
                    passEl.value = '';
                    passEl.focus();
                    // frena los intentos repetidos
                    setTimeout(function () { btn.disabled = false; btn.textContent = 'Ingresar'; }, Math.min(8000, 600 * fails * fails));
                    return;
                }
            }).catch(function () {
                err.textContent = 'No se pudo verificar. Probá de nuevo.';
                btn.disabled = false;
                btn.textContent = 'Ingresar';
            });
        });
    }

    function boot() {
        if (window.STUDIO_GATE_OFF) return;   // usuarios.html solo usa la función de hash
        var u = readSession();
        if (u) {
            // sesión recordada: se registra una vez por pestaña
            try {
                if (!sessionStorage.getItem(KEY + '_logged')) { sessionStorage.setItem(KEY + '_logged', '1'); track('studio360-login', { user: u.user, recordada: 'si' }); }
            } catch (e) {}
            startStudio(u);
        } else {
            showGate();
        }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();

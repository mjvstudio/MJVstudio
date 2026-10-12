/* ==========================================================================
   SONIDOS DE INTERFAZ — MJV Studio

   Cinco sonidos (en assets/sounds/):
     general.mp3     → sonido ambiental: suena de fondo todo el tiempo, en bucle
     buttom.mp3      → botones (clic en cualquier botón, opción o tarjeta)
     hover.mp3       → "arrimar" el mouse a algo con interacción: proyectos,
                       perfiles, fotos, botones y los botones de los desplegables
     hover_2.mp3     → "arrimar" el mouse a las OPCIONES que se despliegan
                       (Categorías, Contacto, Idioma)
     transition.mp3  → cambio de sección (deslizar entre Logo, Architecture,
                       Studio y entre las secciones de un proyecto)

   Incluye control de silencio, con .js-sound-toggle como botón: silencia TODO,
   también el ambiente. Lo elegido se guarda (localStorage) para todo el sitio.

   Detalles pensados para que sea sutil y no canse:
   - Los archivos se bajan y se preparan en silencio apenas termina de cargar
     la página, así el primer sonido sale sin demora.
   - Cada uno tiene su volumen (VOLUME). Se saltea el silencio del comienzo
     de cada archivo (START_AT, o se detecta solo), sin modificar los originales.
   - Hover: solo con mouse (nunca en pantallas táctiles), con un intervalo
     mínimo entre sonidos para que no suene "a ametralladora" al cruzar la
     grilla de proyectos, y sin hover mientras se desliza una sección.
   - Si un sonido arranca mientras otro del mismo tipo todavía suena, el
     anterior se apaga con un fundido corto (no se acumulan las colas).
   - AMBIENTE: entra con un fundido; el bucle se empalma con un fundido
     cruzado (no se nota el corte aunque el archivo no esté preparado para
     repetirse); se apaga con fundido al silenciar o al cambiar de pestaña; y al
     pasar de una página a otra (portada ↔ proyecto) sigue desde el mismo punto
     en lugar de empezar de cero.
   - A la salida hay un limitador: si el ambiente y varios sonidos coinciden, no
     saturan.
   - hover_2 se iguala automáticamente al nivel de hover (MATCH_LEVEL): el mismo
     "50 %" suena igual de fuerte en los dos aunque los archivos tengan distinto nivel.
   - Los proyectos se abren ENCIMA de la portada (project-layer.js), que sigue viva y
     es quien maneja todo el audio: por eso el ambiente no se corta al entrar a un
     proyecto. Dentro del proyecto este archivo funciona como "control remoto" de la
     portada (ver embedded()). Si un proyecto se abre solo, en su propia pestaña, el
     ambiente se retoma con la menor demora posible.
   - Los navegadores no dejan sonar nada hasta que la persona hizo algún clic
     o tocó una tecla en la página: antes de eso, todo queda en silencio. (Al
     cambiar de página dentro del sitio, el ambiente sigue sin pedir otro clic
     en los navegadores que lo permiten.)
   - Si algún archivo faltara o no se pudiera leer: el botón y la transición
     usan los tonos generados que se usaban antes, hover_2 usa hover, y el
     ambiente y el hover quedan mudos.

   API: window.mjvSound.click() / .pop()  → sonido de botón
        window.mjvSound.swipe()           → sonido de transición
        window.mjvSound.hover(elemento)   → sonido de hover
        window.mjvSound.ambient.start() / .stop() / .isPlaying()
        window.mjvSound.isMuted()
   ========================================================================== */

(function () {
    'use strict';

    /* ---------- AJUSTES (lo único que conviene tocar) ---------- */

    // Volumen de cada sonido, de 0 a 1 (1 = el nivel original del archivo):
    // 0.50 = 50 %, 0.30 = 30 %.
    // Para bajar o subir TODO, multiplicá todos por el mismo número.
    var VOLUME = {
        general: 0.50,       // ambiente
        button: 0.30,
        transition: 0.50,
        hover: 0.50,
        hover2: 0.50         // opciones de los desplegables
    };

    // Igualar el nivel de un sonido al de otro ANTES de aplicar su porcentaje: así
    // "50 %" suena igual de fuerte en los dos aunque un archivo haya sido exportado
    // más fuerte que el otro. hover_2 se iguala al hover. Para desactivarlo: {}
    var MATCH_LEVEL = { hover2: 'hover' };

    // Segundos del comienzo de cada archivo que se saltean (son silencio).
    // Si un sonido no figura acá (como hover_2), se detecta solo al cargarlo.
    var START_AT = { button: 0.14, transition: 0.15, hover: 0.02 };

    var FILES = {
        general: 'general.mp3',
        button: 'buttom.mp3',
        transition: 'transition.mp3',
        hover: 'hover.mp3',
        hover2: 'hover_2.mp3'
    };

    // Ambiente (segundos)
    var AMBIENT_FADE_IN_S = 2.0;         // al empezar
    var AMBIENT_RESUME_FADE_IN_S = 0.4;  // al retomarlo recién llegado de otra página del sitio (que no se note el bache)
    var AMBIENT_FADE_OUT_S = 0.7;        // al silenciar
    var AMBIENT_CROSSFADE_S = 3.0;       // empalme del bucle (como mucho: 1/4 de la duración del archivo)
    var AMBIENT_LOOKAHEAD_S = 1.5;       // con cuánta anticipación se programa la vuelta siguiente

    var HOVER_MIN_GAP_MS = 110;          // tiempo mínimo entre dos sonidos de hover
    var HOVER_SAME_ELEMENT_MS = 350;     // y para volver a sonar sobre el mismo elemento
    var HOVER_QUIET_AFTER_TRANSITION_MS = 900;  // sin hover mientras se desliza una sección
    var BUTTON_DEDUPE_MS = 140;          // dos "clic" casi juntos suenan una sola vez
    var FADE_MS = 60;                    // fundido al cortar un sonido que sigue sonando

    // Qué cuenta como "botón" al hacer clic y qué cuenta como "algo con interacción" al arrimar.
    var CLICK_SELECTOR = [
        'button', '.project', '.team-card', '.gallery-item', '#categories-button', '#studio-contact-button',
        '.back-to-projects-btn', '.dropdown-content a', '.contact-dropdown-content a', '.lang-dropdown-content a'
    ].join(',');
    var HOVER_SELECTOR = CLICK_SELECTOR;
    // Las opciones que se despliegan tienen su propio sonido de hover (hover_2.mp3)
    var HOVER2_SELECTOR = '.dropdown-content a, .contact-dropdown-content a, .lang-dropdown-content a';

    /* ---------- ¿Esta página está abierta DENTRO de otra del sitio? ----------
       Los proyectos se abren encima de la portada (project-layer.js) sin recargarla,
       y la portada es la que maneja el audio: así el ambiente no se corta nunca al
       entrar a un proyecto. Cargado dentro del proyecto, este archivo no crea audio
       propio: manda todo a la portada (que reproduce, silencia, etc.). */
    var host = null;
    try {
        if (window.parent && window.parent !== window && window.parent.mjvSound && window.parent.mjvSound.isHost) host = window.parent.mjvSound;
    } catch (e) { /* otra procedencia: no se puede acceder, se trabaja por cuenta propia */ }
    if (host) { embedded(host); return; }

    /* ---------- Dónde están los archivos ---------- */
    // Se calcula a partir de la ubicación de ESTE archivo, así funciona igual
    // desde la portada y desde las páginas de proyecto.
    var BASE = 'assets/sounds/';
    try {
        if (document.currentScript && document.currentScript.src) {
            BASE = new URL('assets/sounds/', document.currentScript.src).href;
        }
    } catch (e) {}

    var ctx = null;
    var mix = null;                      // salida común (con limitador)
    var muted = false;
    try {
        muted = localStorage.getItem('mjv-sound-muted') === 'true';
    } catch (e) {}

    /* Volumen general (el control que aparece al arrimar el mouse al parlante): 0 a 1.
       Se guarda para todo el sitio. La ganancia real sube con el cuadrado, que se siente más parejo al oído. */
    var volume = 1;
    try {
        var sv = parseFloat(localStorage.getItem('mjv-sound-volume'));
        if (isFinite(sv)) volume = Math.min(1, Math.max(0, sv));
    } catch (e) {}
    function gainOfVolume(v) { return v * v; }
    function getVolume() { return volume; }
    function setVolume(v) {
        volume = Math.min(1, Math.max(0, v));
        try { localStorage.setItem('mjv-sound-volume', String(Math.round(volume * 1000) / 1000)); } catch (e) {}
        if (mix && ctx) {
            try { mix.gain.setTargetAtTime(gainOfVolume(volume), ctx.currentTime, 0.02); } catch (e) { mix.gain.value = gainOfVolume(volume); }
        }
    }

    var levelGain = {};  // ajuste automático de nivel de cada sonido (1 = sin ajuste), ver MATCH_LEVEL
    var raw = {};        // archivos bajados, a la espera de ser decodificados
    var buffers = {};    // sonidos listos para reproducir
    var startAt = {};    // silencio inicial de cada uno
    var voices = {};     // el sonido de cada tipo que está sonando ahora
    Object.keys(START_AT).forEach(function (k) { startAt[k] = START_AT[k]; });

    /* ---------- Audio ---------- */
    function hasActivation() {
        // Chrome, Firefox y Safari informan si la persona ya interactuó con la página
        var ua = navigator.userActivation;
        return !ua || ua.hasBeenActive;
    }

    // Salida común: todo pasa por un limitador (un compresor muy duro que solo
    // actúa cerca del tope), para que el ambiente más los sonidos no saturen.
    function buildOutput(ac) {
        mix = ac.createGain();
        mix.gain.value = gainOfVolume(volume);
        var lim = ac.createDynamicsCompressor();
        try {
            lim.threshold.value = -3;
            lim.knee.value = 0;
            lim.ratio.value = 20;
            lim.attack.value = 0.003;
            lim.release.value = 0.15;
        } catch (e) {}
        mix.connect(lim);
        lim.connect(ac.destination);
    }

    // "forzar" se usa solo para retomar el ambiente al pasar de una página a otra
    // del sitio: la persona ya había interactuado en la anterior.
    function getCtx(forzar) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        if (!ctx) {
            // No se crea hasta que haya habido una interacción: antes de eso el
            // navegador no deja sonar y solo mostraría advertencias en la consola.
            if (!forzar && !hasActivation()) return null;
            ctx = new AC();
            buildOutput(ctx);
            decodePending();
        }
        if (ctx.state === 'suspended') {
            try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
        }
        return ctx;
    }

    function decodeWith(ac, arrayBuffer) {
        return new Promise(function (ok, fail) {
            var p = ac.decodeAudioData(arrayBuffer, ok, fail);   // forma antigua (callbacks) y moderna (promesa)
            if (p && p.then) p.then(ok, fail);
        });
    }

    // Segundos de silencio al comienzo de un sonido (menos un margen de 10 ms)
    function leadingSilence(buf) {
        try {
            var thr = 0.00316;                                   // -50 dB
            var max = Math.min(buf.length, Math.floor(buf.sampleRate * 0.6));
            var best = max;
            for (var c = 0; c < buf.numberOfChannels; c++) {
                var d = buf.getChannelData(c);
                for (var i = 0; i < best; i++) {
                    if (Math.abs(d[i]) > thr) { best = i; break; }
                }
            }
            return best >= max ? 0 : Math.max(0, best / buf.sampleRate - 0.01);
        } catch (e) { return 0; }
    }

    // Nivel (RMS) de un sonido a partir de donde empieza a sonar de verdad
    function levelOf(buf, from) {
        try {
            var sum = 0, n = 0;
            for (var c = 0; c < buf.numberOfChannels; c++) {
                var d = buf.getChannelData(c);
                for (var i = Math.floor((from || 0) * buf.sampleRate); i < d.length; i++) { sum += d[i] * d[i]; n++; }
            }
            return n ? Math.sqrt(sum / n) : 0;
        } catch (e) { return 0; }
    }

    function updateLevels() {
        Object.keys(MATCH_LEVEL).forEach(function (name) {
            var ref = MATCH_LEVEL[name];
            if (!buffers[name] || !buffers[ref]) return;
            var a = levelOf(buffers[name], startAt[name]), b = levelOf(buffers[ref], startAt[ref]);
            if (a > 1e-5 && b > 1e-5) levelGain[name] = Math.max(0.2, Math.min(1.5, b / a));   // sin llegar a extremos
        });
    }

    // Un ambiente suele venir con un fundido al principio y otro al final (pensado para sonar
    // UNA vez). Repetido tal cual, esos fundidos harían un bache de varios segundos en cada
    // vuelta. Por eso se busca el tramo parejo del medio (el "cuerpo": donde el nivel no baja
    // más de 3 dB respecto del nivel típico) y solo ese se repite. Un archivo sin fundidos
    // se usa entero. Devuelve { start, len } en segundos.
    function findBody(buf) {
        var whole = { start: 0, len: buf.duration };
        try {
            var sr = buf.sampleRate, win = Math.max(1, Math.floor(sr * 0.1)), chans = [];
            for (var c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
            var n = Math.floor(chans[0].length / win);
            if (n < 20) return whole;                                       // demasiado corto para analizarlo
            var lv = [], i, k, s;
            for (i = 0; i < n; i++) {                                       // nivel (RMS) cada 0,1 s
                s = 0;
                for (c = 0; c < chans.length; c++) for (k = i * win; k < (i + 1) * win; k++) s += chans[c][k] * chans[c][k];
                lv.push(Math.sqrt(s / (win * chans.length)));
            }
            var mid = lv.slice(Math.floor(n * 0.2), Math.floor(n * 0.8)).sort(function (a, b) { return a - b; });
            var ref = mid[Math.floor(mid.length / 2)];                      // nivel típico = mediana del tramo central
            if (!(ref > 1e-4)) return whole;
            var thr = ref * 0.708, RUN = 5, first = -1, last = -1;          // -3 dB, durante al menos 0,5 s seguidos
            for (i = 0; i + RUN <= n && first < 0; i++) { for (k = 0; k < RUN && lv[i + k] >= thr; k++); if (k === RUN) first = i; }
            for (i = n - 1; i - RUN + 1 >= 0 && last < 0; i--) { for (k = 0; k < RUN && lv[i - k] >= thr; k++); if (k === RUN) last = i; }
            if (first < 0 || last < 0) return whole;
            var start = first * win / sr, end = (last + 1) * win / sr;
            var total = chans[0].length / sr;
            if (start < 0.15 && total - end < 0.15) return whole;          // sin fundidos: se usa entero
            if (end - start < 4 || end - start < total * 0.4) return whole; // el "cuerpo" sería demasiado corto: no es confiable
            return { start: start, len: end - start };
        } catch (e) { return whole; }
    }

    function ready(name, buffer) {
        buffers[name] = buffer;
        delete raw[name];
        if (name === 'general') ambBody = findBody(buffer);
        if (name !== 'general' && startAt[name] === undefined) startAt[name] = leadingSilence(buffer);
        if (name !== 'general') updateLevels();
        if (name === 'general') startAmbient();                  // si ya hubo interacción, entra el ambiente
    }

    // Se bajan los archivos y se decodifican SIN esperar un clic (con un contexto
    // "fuera de línea", que el navegador deja usar libremente).
    var preloaded = false;
    function preload() {
        if (preloaded || typeof fetch !== 'function') return;     // una sola vez, aunque el aviso llegue repetido
        preloaded = true;
        var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        var offline = null;
        try { offline = OAC ? new OAC(2, 1, 44100) : null; } catch (e) {}
        // Primero los sonidos cortos de la interfaz; el ambiente, que es el más pesado, al final y con prioridad baja
        // (si se llega desde otra página del sitio con el ambiente sonando, ese va primero y sin demora)
        var order = resumeEarly ? ['general', 'button', 'hover', 'hover2', 'transition'] : ['button', 'hover', 'hover2', 'transition', 'general'];
        order.forEach(function (name) {
            var opts = (name === 'general' && !resumeEarly) ? { priority: 'low' } : undefined;
            fetch(BASE + FILES[name], opts)
                .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
                .then(function (ab) {
                    raw[name] = ab.slice(0);                        // copia de respaldo
                    if (!offline) return;
                    return decodeWith(offline, ab).then(function (b) { ready(name, b); });
                })
                .catch(function () { /* sin archivo o sin poder leerlo: se usa el respaldo */ });
        });
    }

    // Si no se pudo decodificar por adelantado, se hace con el contexto real.
    function decodePending() {
        Object.keys(raw).forEach(function (name) {
            if (buffers[name]) return;
            decodeWith(ctx, raw[name].slice(0)).then(function (b) { ready(name, b); }).catch(function () {});
        });
    }

    function fadeOut(voice, ms) {
        try {
            var t = ctx.currentTime;
            voice.gain.gain.cancelScheduledValues(t);
            voice.gain.gain.setTargetAtTime(0, t, ms / 3000);
            voice.src.stop(t + ms / 1000 + 0.05);
        } catch (e) {}
    }

    // Reproduce el sonido "name". Devuelve false si no pudo (silenciado, sin
    // interacción previa todavía, o archivo no disponible).
    function play(name) {
        if (muted) return false;
        var ac = getCtx();
        if (!ac) return false;
        var buf = buffers[name];
        if (!buf) return false;
        var slot = name === 'hover2' ? 'hover' : name;             // los dos hover comparten "voz": no se pisan
        if (voices[slot]) fadeOut(voices[slot], FADE_MS);            // el anterior se apaga suave
        var src = ac.createBufferSource();
        var gain = ac.createGain();
        src.buffer = buf;
        gain.gain.value = VOLUME[name] * (levelGain[name] || 1);
        src.connect(gain);
        gain.connect(mix);
        var voice = { src: src, gain: gain };
        voices[slot] = voice;
        src.onended = function () {
            try { gain.disconnect(); } catch (e) {}
            if (voices[slot] === voice) voices[slot] = null;
        };
        src.start(0, startAt[name] || 0);
        return true;
    }

    // Tono generado: respaldo si un archivo no está disponible.
    function tone(freqStart, freqEnd, duration, volume, type) {
        if (muted) return;
        var audioCtx = getCtx();
        if (!audioCtx) return;
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
        if (freqEnd && freqEnd !== freqStart) {
            osc.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);
        }
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(mix);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    /* ---------- Ambiente ---------- */
    // El ambiente es un bucle: cada "vuelta" arranca X segundos antes de que
    // termine la anterior, y mientras tanto una sube y la otra baja (fundido
    // "de potencia constante": no se nota el empalme ni cae el volumen).
    // La posición del bucle sigue un reloj propio (clock): así, al apagarlo y
    // volver a encenderlo, o al pasar a otra página del sitio, retoma "por
    // donde iba" en lugar de empezar de cero.
    var AMB_KEY = 'mjv-ambient';
    // on = está sonando ahora; want = debería estar sonando (se apaga un rato si la
    // pestaña queda oculta, pero la intención sigue: es lo que se guarda para la página siguiente)
    var amb = { on: false, want: false, master: null, nodes: [], timer: 0 };
    var ambBody = null;                  // { start, len }: el tramo del archivo que se repite (ver findBody)
    var clock = null;                    // { t0: ms, p0: s } → posición = p0 + (ahora - t0)
    var resumeEarly = false;             // la página anterior del sitio tenía el ambiente sonando

    var CURVE_N = 64;
    var FADE_IN_CURVE = new Float32Array(CURVE_N);
    var FADE_OUT_CURVE = new Float32Array(CURVE_N);
    for (var ci = 0; ci < CURVE_N; ci++) {
        var u = ci / (CURVE_N - 1);
        FADE_IN_CURVE[ci] = Math.sin(u * Math.PI / 2);
        FADE_OUT_CURVE[ci] = Math.cos(u * Math.PI / 2);
    }

    try {
        var saved = JSON.parse(sessionStorage.getItem(AMB_KEY) || 'null');
        if (saved && typeof saved.t0 === 'number' && typeof saved.p0 === 'number') {
            clock = { t0: saved.t0, p0: saved.p0 };
            resumeEarly = !!saved.on && (Date.now() - saved.at) < 20000 && !muted;
        }
    } catch (e) {}

    function saveAmbient() {
        try {
            if (clock) sessionStorage.setItem(AMB_KEY, JSON.stringify({ t0: clock.t0, p0: clock.p0, on: amb.want, at: Date.now() }));
        } catch (e) {}
    }

    function scheduleAmbient(ac, buf, D, X, when, offset, first) {
        var src = ac.createBufferSource();
        var g = ac.createGain();
        src.buffer = buf;
        src.connect(g);
        g.connect(amb.master);
        try {
            if (first) g.gain.setValueAtTime(1, when);
            else g.gain.setValueCurveAtTime(FADE_IN_CURVE, when, X);                 // entra mientras la anterior sale
            g.gain.setValueCurveAtTime(FADE_OUT_CURVE, when + (D - X - offset), X);  // sale en sus últimos X segundos
        } catch (e) {}
        src.start(when, ambBody.start + offset);                // offset: posición dentro del "cuerpo"
        src.stop(when + (D - offset) + 0.05);
        var node = { src: src, gain: g };
        amb.nodes.push(node);
        src.onended = function () {
            var i = amb.nodes.indexOf(node);
            if (i >= 0) amb.nodes.splice(i, 1);
            try { g.disconnect(); } catch (e) {}
        };
        // La vuelta siguiente se programa poco antes de hacer falta
        var nextAt = when + (D - X - offset);
        var wait = Math.max(0, (nextAt - ac.currentTime - AMBIENT_LOOKAHEAD_S) * 1000);
        clearTimeout(amb.timer);
        amb.timer = setTimeout(function () {
            if (amb.on && amb.master) scheduleAmbient(ac, buf, D, X, Math.max(nextAt, ac.currentTime + 0.02), 0, false);
        }, wait);
    }

    function startAmbient() {
        if (amb.on || muted || document.hidden) return;
        var buf = buffers.general;
        if (!buf) return;
        var ac = getCtx(resumeEarly);
        if (!ac) return;
        var D = ambBody ? ambBody.len : buf.duration;                // largo del tramo que se repite
        var X = Math.min(AMBIENT_CROSSFADE_S, D / 4);
        var L = D - X;                                           // largo de cada vuelta
        if (!(L > 0.5)) return;
        if (!clock) clock = { t0: Date.now(), p0: 0 };
        var pos = (((clock.p0 + (Date.now() - clock.t0) / 1000) % L) + L) % L;
        var t = ac.currentTime + 0.05;
        var master = ac.createGain();
        master.gain.setValueAtTime(0, t);
        master.gain.linearRampToValueAtTime(VOLUME.general, t + (resumeEarly ? AMBIENT_RESUME_FADE_IN_S : AMBIENT_FADE_IN_S));
        master.connect(mix);
        amb.on = true;
        amb.want = true;
        amb.master = master;
        amb.nodes = [];
        resumeEarly = false;
        saveAmbient();
        scheduleAmbient(ac, buf, D, X, t, pos, true);
    }

    function stopAmbient(fadeS) {
        if (!amb.on) return;
        amb.on = false;
        clearTimeout(amb.timer);
        var master = amb.master, nodes = amb.nodes;
        amb.master = null;
        amb.nodes = [];
        try {
            var t = ctx.currentTime;
            master.gain.cancelScheduledValues(t);
            master.gain.setValueAtTime(master.gain.value, t);
            master.gain.linearRampToValueAtTime(0, t + fadeS);
        } catch (e) {}
        setTimeout(function () {                                 // cuando el fundido terminó, se corta del todo
            nodes.forEach(function (n) { try { n.src.stop(); } catch (e) {} });
            try { master.disconnect(); } catch (e) {}
        }, fadeS * 1000 + 80);
        saveAmbient();
    }

    /* ---------- Los sonidos puntuales ---------- */
    var lastButtonAt = 0;
    var lastTransitionAt = 0;
    var hoverQuietUntil = 0;
    var lastHoverAt = 0, lastHoverEl = null, lastHoverElAt = 0;

    function closestOf(el, selector) {
        return el && el.closest ? el.closest(selector) : null;
    }

    function button() {
        var now = Date.now();
        if (now - lastButtonAt < BUTTON_DEDUPE_MS) return;      // varios avisos del mismo clic: suena uno
        lastButtonAt = now;
        if (!play('button')) tone(700, 900, 0.07, 0.05, 'sine');
    }

    function transition() {
        var now = Date.now();
        hoverQuietUntil = now + HOVER_QUIET_AFTER_TRANSITION_MS;
        if (now - lastTransitionAt < 120) return;
        lastTransitionAt = now;
        if (!play('transition')) tone(280, 620, 0.22, 0.035, 'sine');
    }

    function hover(el) {
        var now = Date.now();
        if (muted || now < hoverQuietUntil) return;
        if (now - lastHoverAt < HOVER_MIN_GAP_MS) return;
        if (el && el === lastHoverEl && now - lastHoverElAt < HOVER_SAME_ELEMENT_MS) return;
        // Las opciones de los desplegables tienen su propio sonido; si ese archivo
        // no estuviera, suena el de hover de siempre.
        var name = (closestOf(el, HOVER2_SELECTOR) && buffers.hover2) ? 'hover2' : 'hover';
        if (play(name)) {
            lastHoverAt = now; lastHoverEl = el || null; lastHoverElAt = now;
        }
    }

    /* ---------- Silencio ---------- */
    function muteLabel(isMuted) {
        var pick = function (d) { return window.mjvLang ? window.mjvLang.pick(d) : d.es; };
        return isMuted
            ? pick({ es: 'Activar sonido', en: 'Turn sound on', fr: 'Activer le son', pt: 'Ativar o som' })
            : pick({ es: 'Silenciar sonido', en: 'Mute sound', fr: 'Couper le son', pt: 'Silenciar o som' });
    }

    function updateMuteButtons() {
        // El ícono (parlante / parlante tachado) lo decide el CSS según
        // <html data-sound="off">. Acá se mantiene ese atributo y el texto
        // de ayuda; no se toca el contenido del botón.
        var root = document.documentElement;
        if (muted) root.setAttribute('data-sound', 'off');
        else root.removeAttribute('data-sound');

        var label = muteLabel(muted);
        document.querySelectorAll('.js-sound-toggle').forEach(function (btn) {
            btn.title = label;
            btn.setAttribute('aria-label', label);
            btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
        });
    }

    function toggleMute() {
        muted = !muted;
        try { localStorage.setItem('mjv-sound-muted', muted ? 'true' : 'false'); } catch (e) {}
        updateMuteButtons();
        if (muted) {
            Object.keys(voices).forEach(function (k) { if (voices[k]) fadeOut(voices[k], 40); });   // se corta lo que esté sonando
            amb.want = false;                                           // silenciado a propósito: no se retoma solo
            stopAmbient(AMBIENT_FADE_OUT_S);
        } else {
            startAmbient();                                             // el ambiente vuelve con un fundido
            lastButtonAt = 0;
            button();                                                   // confirmación al reactivar
        }
    }


    /* ---------- Control de volumen ----------
       Al arrimar el mouse (o enfocar con el teclado) el botón de sonido, sobre él aparece una línea
       vertical con un punto: se arrastra el punto (o se hace clic en la línea) para subir o bajar el
       volumen. Flechas del teclado: +/- 5 %. Se arma por JavaScript alrededor de cada ".js-sound-toggle";
       el estilo está en dark-mode.css (".vol-wrap", ".vol-pop"). "api" = { get, set, done }. */
    function initVolumeUI(api) {
        document.querySelectorAll('.js-sound-toggle').forEach(function (btn) {
            if (btn.parentNode && btn.parentNode.classList.contains('vol-wrap')) return;
            var wrap = document.createElement('span');
            wrap.className = 'vol-wrap';
            btn.parentNode.insertBefore(wrap, btn);
            wrap.appendChild(btn);

            var pop = document.createElement('span');
            pop.className = 'vol-pop';
            pop.setAttribute('role', 'slider');
            pop.setAttribute('tabindex', '0');
            pop.setAttribute('aria-orientation', 'vertical');
            pop.setAttribute('aria-valuemin', '0');
            pop.setAttribute('aria-valuemax', '100');
            pop.innerHTML = '<span class="vol-track"><span class="vol-fill"></span><span class="vol-dot"></span></span>';
            wrap.appendChild(pop);
            var track = pop.firstChild;

            function label() {
                var pick = function (d) { return window.mjvLang ? window.mjvLang.pick(d) : d.es; };
                pop.setAttribute('aria-label', pick({ es: 'Volumen', en: 'Volume', fr: 'Volume', pt: 'Volume' }));
            }
            function paint() {
                var v = api.muted && api.muted() ? 0 : api.get();      // silenciado: el punto queda abajo
                pop.style.setProperty('--v', v);
                pop.setAttribute('aria-valuenow', String(Math.round(v * 100)));
            }
            function fromPointer(e) {
                var r = track.getBoundingClientRect();
                if (!(r.height > 0)) return;
                var v = 1 - (e.clientY - r.top) / r.height;
                v = Math.min(1, Math.max(0, v));
                if (v > 0 && api.muted && api.muted() && api.unmute) api.unmute();   // subir el punto = volver a prender el sonido
                api.set(v);
                paint();
            }
            var dragging = false;
            pop.addEventListener('pointerdown', function (e) {
                if (e.button !== undefined && e.button !== 0) return;
                dragging = true;
                pop.classList.add('is-dragging');
                try { pop.setPointerCapture(e.pointerId); } catch (err) {}
                fromPointer(e);
                e.preventDefault();
            });
            pop.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
            function end() {
                if (!dragging) return;
                dragging = false;
                pop.classList.remove('is-dragging');
                if (api.done) api.done();                                // un toque de sonido para oír el nivel
            }
            pop.addEventListener('pointerup', end);
            pop.addEventListener('pointercancel', end);
            pop.addEventListener('keydown', function (e) {
                var d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.05 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.05 : 0;
                if (!d) return;
                e.preventDefault();
                if (d > 0 && api.muted && api.muted() && api.unmute) api.unmute();
                api.set(api.get() + d); paint();
            });
            btn.addEventListener('click', function () { wrap.classList.add('is-closed'); try { btn.blur(); } catch (err) {} });
            wrap.addEventListener('pointerleave', function () { if (!dragging) wrap.classList.remove('is-closed'); });
            wrap.addEventListener('pointerenter', paint);
            wrap.addEventListener('focusin', paint);
            wrap.addEventListener('wheel', function (e) {                // la rueda sobre el control también lo mueve
                if (!pop.matches(':hover') && !pop.contains(document.activeElement)) return;
                e.preventDefault();
                if (e.deltaY < 0 && api.muted && api.muted() && api.unmute) api.unmute();
                api.set(api.get() + (e.deltaY < 0 ? 0.05 : -0.05)); paint();
            }, { passive: false });
            label(); paint();
            document.addEventListener('mjvlangchange', label);
            // prender / apagar el sonido mueve el punto (abajo = apagado, arriba = prendido)
            if (window.MutationObserver) new MutationObserver(paint).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sound'] });
        });
    }

    /* ---------- Modo "dentro de la portada" ---------- */
    function embedded(host) {
        function refresh() {
            var m = host.isMuted(), root = document.documentElement;
            if (m) root.setAttribute('data-sound', 'off'); else root.removeAttribute('data-sound');
            var label = muteLabel(m);
            document.querySelectorAll('.js-sound-toggle').forEach(function (btn) {
                btn.title = label; btn.setAttribute('aria-label', label); btn.setAttribute('aria-pressed', m ? 'true' : 'false');
            });
        }
        document.addEventListener('pointerover', function (e) {
            if (e.pointerType !== 'mouse') return;
            var target = closestOf(e.target, HOVER_SELECTOR);
            if (!target) return;
            if (closestOf(e.relatedTarget, HOVER_SELECTOR) === target) return;
            host.hover(target);
        });
        document.addEventListener('click', function (e) {
            var target = closestOf(e.target, CLICK_SELECTOR);
            if (!target || (target.classList && target.classList.contains('js-sound-toggle'))) return;
            host.button();
        });
        window.mjvSound = {
            click: host.click, pop: host.pop, button: host.button, swipe: host.swipe, transition: host.transition,
            hover: host.hover, ambient: host.ambient, isMuted: host.isMuted, embedded: true,
            getVolume: host.getVolume, setVolume: host.setVolume
        };
        document.addEventListener('DOMContentLoaded', function () {
            document.querySelectorAll('.js-sound-toggle').forEach(function (btn) {
                btn.addEventListener('click', function () { host.toggleMute(); refresh(); });
            });
            refresh();
            document.addEventListener('mjvlangchange', refresh);
            initVolumeUI({ get: host.getVolume, set: host.setVolume, done: host.click, muted: host.isMuted, unmute: function () { if (host.isMuted()) { host.toggleMute(); refresh(); } } });
        });
    }

    /* ---------- Conexión con la página ---------- */

    // Arrimar el mouse: solo mouse (en pantallas táctiles no existe "arrimar")
    document.addEventListener('pointerover', function (e) {
        if (e.pointerType !== 'mouse') return;
        var target = closestOf(e.target, HOVER_SELECTOR);
        if (!target) return;
        var from = closestOf(e.relatedTarget, HOVER_SELECTOR);
        if (from === target) return;                                    // se movió dentro del mismo elemento
        hover(target);
    });

    // Clic en un botón o algo parecido (los que ya llaman a click() / pop()
    // por su cuenta no suenan doble: BUTTON_DEDUPE_MS)
    document.addEventListener('click', function (e) {
        var target = closestOf(e.target, CLICK_SELECTOR);
        if (!target) return;
        if (target.classList && target.classList.contains('js-sound-toggle')) return;   // este lo maneja toggleMute
        button();
    });

    // Con la primera interacción de la persona (o la siguiente, si el navegador
    // había dejado dormido el audio) entra el ambiente.
    ['pointerup', 'keydown', 'touchend', 'click'].forEach(function (type) {
        document.addEventListener(type, function () {
            if (ctx && ctx.state === 'suspended') {
                try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
            }
            startAmbient();
        }, true);
    });

    // Al cambiar de pestaña, el ambiente se apaga con fundido; al volver, regresa.
    // (Ojo: al pasar a otra página del sitio el navegador también avisa que esta
    // quedó "oculta" justo antes de irse: por eso se guarda la INTENCIÓN de que
    // siga sonando, no solo si en ese instante estaba sonando.)
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopAmbient(0.4);
        else startAmbient();
    });
    // Al irse de la página se guarda en qué estado quedó el ambiente (para retomarlo en la siguiente)
    window.addEventListener('pagehide', saveAmbient);

    // API pública
    window.mjvSound = {
        isHost: true,                    // lo que usan los proyectos abiertos encima de la portada
        toggleMute: toggleMute,
        click: button,
        pop: button,
        button: button,
        swipe: transition,
        transition: transition,
        hover: hover,
        ambient: {
            start: startAmbient,
            stop: function () { stopAmbient(AMBIENT_FADE_OUT_S); },
            isPlaying: function () { return amb.on; }
        },
        isMuted: function () { return muted; },
        getVolume: getVolume,
        setVolume: setVolume
    };

    document.addEventListener('DOMContentLoaded', function () {
        document.querySelectorAll('.js-sound-toggle').forEach(function (btn) {
            btn.addEventListener('click', toggleMute);
        });
        updateMuteButtons();
        initVolumeUI({ get: getVolume, set: setVolume, done: button, muted: function () { return muted; }, unmute: function () { if (muted) toggleMute(); } });
        // Si cambia el idioma, se actualizan también los textos de ayuda
        document.addEventListener('mjvlangchange', updateMuteButtons);
    });

    // Los archivos se preparan apenas termina de cargar la página (sin competir con el logo).
    // Si se llega desde otra página del sitio con el ambiente sonando, se piden ya mismo.
    if (resumeEarly) preload();
    else window.addEventListener('load', function () { setTimeout(preload, 400); });
})();

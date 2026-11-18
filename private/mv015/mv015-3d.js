/* =====================================================================
   MV015 · VISOR 3D CON TRES CORTES — basado en ../secciones-3d.js (Casa DA)
   - Mismo visor del estudio: se gira arrastrando, se acerca con la ruedita o el
     pellizco, se mueve con clic derecho o dos dedos.
   - Tres cortes que se pueden combinar:
       Planta   → plano horizontal (data-cut = altura en metros sobre el terreno)
       Corte A  → plano vertical longitudinal
       Corte B  → plano vertical transversal
     Con un corte elegido aparece la barrita para moverlo y el botón "Espejar",
     que muestra el otro lado del corte.
   - data-exclude="Material1,Material2": materiales que no cuentan para encuadrar
     (el terreno), así la cámara se centra en la casa.
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const host = document.getElementById('pg-model');
if (host) start(host);

function start(host) {
    const wrap = document.getElementById('pg-model-wrap');
    const empty = document.getElementById('pg-model-empty');
    const chips = Array.from(wrap.querySelectorAll('[data-cut-id]'));
    const tools = document.getElementById('pg-cut-tools');
    const range = document.getElementById('pg-cut-h');
    const flipBtn = document.getElementById('pg-flip');
    const valueEl = document.getElementById('pg-cut-val');
    const resetBtn = document.getElementById('pg-reset');
    const T = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);
    const src = host.dataset.src;
    const CUT_OVER_GROUND = parseFloat(host.dataset.cut) || 1.2;
    const EXCLUDE = new Set((host.dataset.exclude || '').split(',').map((s) => s.trim()).filter(Boolean));
    const POCHE = new THREE.Color(0x2f3030);

    const notAvailable = () => {
        wrap.hidden = true; empty.hidden = false;
        host.dispatchEvent(new Event('error'));
    };
    const labels = () => {
        resetBtn.title = T({ es: 'Vista inicial', en: 'Initial view', fr: 'Vue initiale', pt: 'Vista inicial' });
        resetBtn.setAttribute('aria-label', resetBtn.title);
        flipBtn.title = T({ es: 'Ver el otro lado del corte', en: 'See the other side of the cut', fr: "Voir l'autre côté de la coupe", pt: 'Ver o outro lado do corte' });
        if (typeof refreshValue === 'function') refreshValue();
    };
    let refreshValue = null;
    labels(); document.addEventListener('mjvlangchange', labels);

    wrap.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    wrap.addEventListener('keydown', (e) => { if (e.target === range) e.stopPropagation(); });

    if (!src) return notAvailable();
    const whenReady = (fn) => { if (document.readyState === 'complete') setTimeout(fn, 300); else window.addEventListener('load', () => setTimeout(fn, 300)); };
    whenReady(() => fetch(src, { method: 'HEAD' }).then((r) => r.ok, () => false).then((ok) => {
        if (!ok) return notAvailable();
        let renderer;
        try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
        catch (e) { return notAvailable(); }
        build(renderer);
    }));

    function build(renderer) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.localClippingEnabled = true;
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.45;
        const sun = new THREE.DirectionalLight(0xffffff, 1.35);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
        scene.add(sun, sun.target, new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 0.3));

        const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 2000);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.08;
        controls.screenSpacePanning = true;
        controls.maxPolarAngle = Math.PI * 0.49;

        // ---- Cortes ----
        // eje: 'y' planta, 'x' corte A (longitudinal), 'z' corte B (transversal)
        const cuts = {
            h: { axis: 'y', on: false, flip: false, t: 0.4, plane: new THREE.Plane() },
            a: { axis: 'z', on: false, flip: false, t: 0.5, plane: new THREE.Plane() },
            b: { axis: 'x', on: false, flip: false, t: 0.5, plane: new THREE.Plane() }
        };
        let active = null;
        const cutUniform = { value: 0 };
        const materials = new Set();
        let box = null, ground = 0;

        const prepMaterial = (m) => {
            if (m.__mjv) return; m.__mjv = true;
            if ('metalness' in m && !m.metalnessMap && m.metalness > 0.5) m.metalness = 0;
            m.side = THREE.DoubleSide;
            m.clippingPlanes = [];
            m.onBeforeCompile = (sh) => {
                sh.uniforms.uCut = cutUniform;
                sh.uniforms.uPoche = { value: POCHE };
                sh.fragmentShader = 'uniform float uCut;\nuniform vec3 uPoche;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>',
                    '#include <clipping_planes_fragment>\n\tif ( uCut > 0.5 && !gl_FrontFacing ) { gl_FragColor = vec4( uPoche, 1.0 ); return; }');
            };
            m.customProgramCacheKey = () => 'mjv-cut';
            m.needsUpdate = true;
            materials.add(m);
        };

        const lo = (c) => (c.axis === 'y' ? ground : box.min[c.axis]);
        const coord = (c) => lo(c) + (box.max[c.axis] - lo(c)) * c.t;
        const applyCuts = () => {
            if (!box) return;
            const list = [];
            Object.values(cuts).forEach((c) => {
                const n = new THREE.Vector3(); n[c.axis] = c.flip ? 1 : -1;   // por defecto se quita lo que está "después" del plano
                c.plane.set(n, -n[c.axis] * coord(c));
                if (c.on) list.push(c.plane);
            });
            const changed = materials.size && [...materials][0].clippingPlanes.length !== list.length;
            materials.forEach((m) => { m.clippingPlanes = list; if (changed) m.needsUpdate = true; });
            cutUniform.value = list.length ? 1 : 0;
            need();
        };
        const fmt = (v) => v.toFixed(2).replace('.', T({ es: ',', en: '.', fr: ',', pt: ',' }));
        refreshValue = () => {
            if (!active || !box) { valueEl.textContent = ''; return; }
            const c = cuts[active];
            if (c.axis === 'y') valueEl.textContent = '+' + fmt(coord(c) - ground) + ' m';
            else valueEl.textContent = fmt(coord(c) - box.min[c.axis]) + ' m';
        };
        const syncUI = () => {
            chips.forEach((ch) => {
                const c = cuts[ch.dataset.cutId];
                ch.setAttribute('aria-pressed', c.on ? 'true' : 'false');
                ch.classList.toggle('is-current', ch.dataset.cutId === active && c.on);
            });
            tools.hidden = !(active && cuts[active].on);
            if (active) {
                range.value = String(cuts[active].t * 100);
                flipBtn.setAttribute('aria-pressed', cuts[active].flip ? 'true' : 'false');
            }
            refreshValue();
        };

        // Dibujo solo cuando algo cambia (ahorra batería)
        let dirty = true;
        const need = () => { dirty = true; };
        controls.addEventListener('change', need);
        const resize = () => {
            const w = host.clientWidth, h = host.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); need();
        };
        if (window.ResizeObserver) new ResizeObserver(resize).observe(host); else window.addEventListener('resize', resize);
        resize();

        let anim = null;
        const flyTo = (pos, target, ms = 900) => {
            anim = { t0: performance.now(), ms, p0: camera.position.clone(), q0: controls.target.clone(), p1: pos, q1: target };
        };
        const loop = (now) => {
            requestAnimationFrame(loop);
            if (anim) {
                let k = Math.min(1, (now - anim.t0) / anim.ms); k = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
                camera.position.lerpVectors(anim.p0, anim.p1, k); controls.target.lerpVectors(anim.q0, anim.q1, k);
                if (k >= 1) anim = null;
                dirty = true;
            }
            if (controls.update()) dirty = true;
            if (dirty && wrap.offsetParent !== null) { dirty = false; renderer.render(scene, camera); }
        };

        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        loader.load(src, (gltf) => {
            const model = gltf.scene;
            model.traverse((o) => {
                if (!o.isMesh) return;
                o.castShadow = true; o.receiveShadow = true;
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(prepMaterial);
            });
            scene.add(model);
            model.updateMatrixWorld(true);

            // Caja de la casa (sin el terreno) para encuadrar y para el recorrido de los cortes
            const all = new THREE.Box3().setFromObject(model);
            box = new THREE.Box3();
            model.traverse((o) => {
                if (!o.isMesh) return;
                const ms = Array.isArray(o.material) ? o.material : [o.material];
                if (EXCLUDE.size && ms.every((m) => EXCLUDE.has(m.name))) return;
                box.expandByObject(o);
            });
            if (box.isEmpty()) box.copy(all);
            // data-floor: nivel de piso de planta baja en metros sobre la base del modelo (si no está, se detecta solo)
            ground = host.dataset.floor ? all.min.y + parseFloat(host.dataset.floor) : findGround(model, all);
            box.min.y = Math.min(box.min.y, ground);
            cuts.h.t = Math.max(0.02, Math.min(0.98, CUT_OVER_GROUND / (box.max.y - ground)));

            const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
            const R = size.length() / 2, Rall = all.getSize(new THREE.Vector3()).length() / 2;

            sun.position.copy(center).add(new THREE.Vector3(-0.55, 1, 0.45).normalize().multiplyScalar(Rall * 2.5));
            sun.target.position.copy(center);
            const sc = sun.shadow.camera; sc.left = sc.bottom = -Rall; sc.right = sc.top = Rall; sc.near = Rall * 0.2; sc.far = Rall * 5; sc.updateProjectionMatrix();

            const corners = [];
            for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
            const probe = camera.clone();
            const fitDist = (dir, target, margin) => {
                let d = R * 3;
                for (let k = 0; k < 4; k++) {
                    probe.aspect = camera.aspect; probe.position.copy(target).addScaledVector(dir, d); probe.lookAt(target); probe.updateMatrixWorld(); probe.updateProjectionMatrix();
                    let m = 0; corners.forEach((c) => { const v = c.clone().project(probe); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); });
                    d *= m / margin;
                }
                return d;
            };
            const HOME_DIR = new THREE.Vector3(1, 0.95, 1.15).normalize();
            const home = () => ({ pos: center.clone().addScaledVector(HOME_DIR, fitDist(HOME_DIR, center, 0.86)), target: center.clone() });
            const h0 = home();
            camera.position.copy(h0.pos); controls.target.copy(h0.target);
            camera.near = R / 200; camera.far = Rall * 20; camera.updateProjectionMatrix();
            controls.minDistance = R * 0.15; controls.maxDistance = Math.max(R * 4, h0.pos.distanceTo(center) * 1.8);
            controls.update();
            applyCuts(); syncUI();
            requestAnimationFrame(loop);

            // Al prender un corte, la cámara se acomoda para leerlo
            const lookCut = (id) => {
                const c = cuts[id];
                const t = center.clone();
                let dir;
                if (c.axis === 'y') {
                    t.y = ground;
                    const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
                    const pol = THREE.MathUtils.degToRad(22);
                    dir = new THREE.Vector3(Math.sin(az) * Math.sin(pol), Math.cos(pol), Math.cos(az) * Math.sin(pol));
                } else {
                    t[c.axis] = coord(c);
                    dir = new THREE.Vector3(); dir[c.axis] = c.flip ? -1 : 1;   // se mira desde el lado que se quitó
                    const side = c.axis === 'x' ? 'z' : 'x';
                    dir[side] = 0.35; dir.y = 0.32; dir.normalize();
                }
                flyTo(t.clone().addScaledVector(dir, fitDist(dir, t, 0.9)), t);
            };

            resetBtn.addEventListener('click', () => {
                Object.values(cuts).forEach((c) => { c.on = false; c.flip = false; });
                cuts.a.t = cuts.b.t = 0.5;
                cuts.h.t = Math.max(0.02, Math.min(0.98, CUT_OVER_GROUND / (box.max.y - ground)));
                active = null; applyCuts(); syncUI();
                const h = home(); flyTo(h.pos, h.target);
            });
            chips.forEach((ch) => ch.addEventListener('click', () => {
                const id = ch.dataset.cutId, c = cuts[id];
                if (c.on && active !== id) { active = id; syncUI(); return; }   // ya estaba prendido: solo lo elige para moverlo
                c.on = !c.on;
                active = c.on ? id : (Object.keys(cuts).find((k) => cuts[k].on) || null);
                applyCuts(); syncUI();
                if (window.mjvSound && window.mjvSound.click) window.mjvSound.click();
                if (c.on) lookCut(id);
            }));
            range.addEventListener('input', () => {
                if (!active) return;
                cuts[active].t = parseFloat(range.value) / 100;
                applyCuts(); refreshValue();
            });
            flipBtn.addEventListener('click', () => {
                if (!active) return;
                cuts[active].flip = !cuts[active].flip;
                applyCuts(); syncUI();
                if (window.mjvSound && window.mjvSound.click) window.mjvSound.click();
                if (cuts[active].axis !== 'y') lookCut(active);
            });

            renderer.render(scene, camera);
            host.loaded = true;
            host.dispatchEvent(new CustomEvent('progress', { detail: { totalProgress: 1 } }));
            host.dispatchEvent(new Event('load'));
        }, (xhr) => {
            const p = xhr.lengthComputable && xhr.total ? xhr.loaded / xhr.total : 0;
            host.dispatchEvent(new CustomEvent('progress', { detail: { totalProgress: Math.min(0.98, p) } }));
        }, () => host.dispatchEvent(new Event('error')));
    }

    // Nivel del terreno: la altura donde hay más superficie horizontal mirando hacia arriba (igual que Casa DA)
    function findGround(model, box) {
        const bins = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
        let budget = 600000;
        model.traverse((o) => {
            if (!o.isMesh || budget <= 0) return;
            const g = o.geometry, pos = g.attributes.position, idx = g.index;
            const count = idx ? idx.count / 3 : pos.count / 3, step = Math.max(1, Math.ceil(count / Math.max(1, budget)));
            for (let i = 0; i < count; i += step) {
                const i0 = idx ? idx.getX(i * 3) : i * 3, i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1, i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
                a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
                n.subVectors(c, b).cross(a.clone().sub(b));
                const area = n.length() / 2;
                if (!area || n.y / (area * 2) < 0.97) continue;
                const y = Math.round((a.y + b.y + c.y) / 3 * 10) / 10;
                bins.set(y, (bins.get(y) || 0) + area * step);
            }
            budget -= count;
        });
        let best = box.min.y, bestA = -1;
        bins.forEach((ar, y) => { if (ar > bestA && y < box.min.y + (box.max.y - box.min.y) * 0.6) { bestA = ar; best = y; } });
        return best;
    }
}

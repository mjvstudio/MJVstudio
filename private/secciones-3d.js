/* =====================================================================
   VISOR 3D CON CORTE — páginas privadas de MJV Studio
   - Muestra el modelo de <model-viewer id="pg-model" data-src="modelo/xxx.glb"> con three.js
     (la etiqueta <model-viewer> solo sirve para que model-loader.js ponga el cargador del estudio).
   - Se gira arrastrando, se acerca con la ruedita o el pellizco, y se mueve con clic derecho o dos dedos.
   - Botón "Corte": corta el modelo con un plano horizontal (como una planta) y lo mira desde arriba.
     Los muros cortados se ven rellenos en gris oscuro. La barrita sube y baja la altura del corte.
   - data-cut="1.5": altura del corte, en metros, sobre el nivel del terreno (se detecta solo).
   - Si el archivo todavía no está, la sección muestra "El modelo 3D estará disponible muy pronto."
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
    const cutBtn = document.getElementById('pg-cut');
    const range = document.getElementById('pg-cut-h');
    const rangeBox = document.getElementById('pg-cut-range');
    const resetBtn = document.getElementById('pg-reset');
    const T = (d) => (window.mjvLang ? window.mjvLang.pick(d) : d.es);
    const src = host.dataset.src;
    const CUT_OVER_GROUND = parseFloat(host.dataset.cut) || 1.5;
    const POCHE = new THREE.Color(0x2f3030);

    const notAvailable = () => {
        wrap.hidden = true; empty.hidden = false;
        host.dispatchEvent(new Event('error'));   // detiene el cargador (está dentro de la caja escondida)
    };
    const labels = () => {
        resetBtn.title = T({ es: 'Vista inicial', en: 'Initial view', fr: 'Vue initiale', pt: 'Vista inicial' });
        resetBtn.setAttribute('aria-label', resetBtn.title);
    };
    labels(); document.addEventListener('mjvlangchange', labels);

    // La ruedita sobre el modelo es para acercar, no para cambiar de sección
    wrap.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
    wrap.addEventListener('keydown', (e) => { if (e.target === range) e.stopPropagation(); });

    if (!src) return notAvailable();
    fetch(src, { method: 'HEAD' }).then((r) => r.ok, () => false).then((ok) => {
        if (!ok) return notAvailable();
        let renderer;
        try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }); }
        catch (e) { return notAvailable(); }
        build(renderer);
    });

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

        // Corte: plano horizontal; lo que queda por encima desaparece. Las caras de atrás (el interior de los muros) se pintan de gris oscuro
        const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
        const cutUniform = { value: 0 };
        let cutOn = false, ground = 0, top = 1;
        const prepMaterial = (m) => {
            if (m.__mjv) return; m.__mjv = true;
            if ('metalness' in m && !m.metalnessMap && m.metalness > 0.5) m.metalness = 0;   // SketchUp no exporta metales reales
            m.side = THREE.DoubleSide;
            m.clippingPlanes = [plane];
            m.onBeforeCompile = (sh) => {
                sh.uniforms.uCut = cutUniform;
                sh.uniforms.uPoche = { value: POCHE };
                sh.fragmentShader = 'uniform float uCut;\nuniform vec3 uPoche;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>',
                    '#include <clipping_planes_fragment>\n\tif ( uCut > 0.5 && !gl_FrontFacing ) { gl_FragColor = vec4( uPoche, 1.0 ); return; }');
            };
            m.needsUpdate = true;
        };
        const setPlane = () => { plane.constant = cutOn ? ground + (top - ground) * (parseFloat(range.value) / 100) : 1e6; cutUniform.value = cutOn ? 1 : 0; need(); };

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
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
            ground = findGround(model, box); top = box.max.y;
            range.value = String(Math.max(2, Math.min(98, (ground + CUT_OVER_GROUND - ground) / (top - ground) * 100)));
            const R = size.length() / 2;

            // Sol (sombras) ajustado al tamaño del modelo
            sun.position.copy(center).add(new THREE.Vector3(-0.55, 1, 0.45).normalize().multiplyScalar(R * 2.5));
            sun.target.position.copy(center);
            const sc = sun.shadow.camera; sc.left = sc.bottom = -R; sc.right = sc.top = R; sc.near = R * 0.2; sc.far = R * 5; sc.updateProjectionMatrix();

            // Vista inicial: en diagonal desde adelante, como las axonometrías
            // Distancia para que el modelo entero entre en la pantalla mirando en la dirección "dir" (ajusta proyectando las 8 esquinas)
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
            camera.near = R / 200; camera.far = R * 20; camera.updateProjectionMatrix();
            controls.minDistance = R * 0.15; controls.maxDistance = Math.max(R * 4, h0.pos.distanceTo(center) * 1.8);
            controls.update();
            setPlane();
            requestAnimationFrame(loop);

            resetBtn.addEventListener('click', () => { const h = home(); flyTo(h.pos, h.target); });
            cutBtn.addEventListener('click', () => {
                cutOn = !cutOn;
                cutBtn.setAttribute('aria-pressed', cutOn ? 'true' : 'false');
                rangeBox.hidden = !cutOn;
                setPlane();
                if (window.mjvSound && window.mjvSound.click) window.mjvSound.click();
                if (cutOn) {   // se mira desde arriba, un poco inclinado, para leer la distribución
                    const t = center.clone(); t.y = ground;
                    const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
                    const pol = THREE.MathUtils.degToRad(22);
                    const dir = new THREE.Vector3(Math.sin(az) * Math.sin(pol), Math.cos(pol), Math.cos(az) * Math.sin(pol));
                    flyTo(t.clone().addScaledVector(dir, fitDist(dir, t, 0.92)), t);
                }
            });
            range.addEventListener('input', setPlane);

            renderer.render(scene, camera);
            host.loaded = true;
            host.dispatchEvent(new CustomEvent('progress', { detail: { totalProgress: 1 } }));
            host.dispatchEvent(new Event('load'));
        }, (xhr) => {
            const p = xhr.lengthComputable && xhr.total ? xhr.loaded / xhr.total : 0;
            host.dispatchEvent(new CustomEvent('progress', { detail: { totalProgress: Math.min(0.98, p) } }));
        }, () => host.dispatchEvent(new Event('error')));
    }

    // Nivel del terreno: la altura donde hay más superficie horizontal mirando hacia arriba (patio, pasto, piso)
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
                if (!area || Math.abs(n.y) / (area * 2) < 0.97) continue;
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

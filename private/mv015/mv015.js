/* Visor 3D con cortes horizontal y verticales (espejables) */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const cfg = window.MV015;
const $ = (id) => document.getElementById(id);
const visor = $('visor');
const oscuro = matchMedia('(prefers-color-scheme: dark)').matches;

// ---------- Escena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
visor.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(oscuro ? 0x1a1a19 : 0xe9e6e0);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8170, 1.6));
const sol = new THREE.DirectionalLight(0xffffff, 1.6);
sol.position.set(1, 1.6, 0.8);
scene.add(sol);

function ajustarTamano() {
  const w = visor.clientWidth, h = visor.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(ajustarTamano).observe(visor);
addEventListener('resize', ajustarTamano);

// ---------- Poché: cara interior pintada al cortar ----------
const poche = {
  uPocheOn: { value: 0 },
  uPocheColor: { value: new THREE.Color(oscuro ? 0x8c3a1f : 0x3a3530) }
};
function prepararMaterial(m) {
  m.side = THREE.DoubleSide;
  m.clippingPlanes = [];
  m.clipShadows = true;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPocheOn = poche.uPocheOn;
    sh.uniforms.uPocheColor = poche.uPocheColor;
    sh.fragmentShader = sh.fragmentShader
      .replace('void main() {', 'uniform float uPocheOn;\nuniform vec3 uPocheColor;\nvoid main() {')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nif (uPocheOn > 0.5 && !gl_FrontFacing) gl_FragColor = vec4(uPocheColor, 1.0);'
      );
  };
  m.customProgramCacheKey = () => 'mv015-poche';
  m.needsUpdate = true;
}

// ---------- Carga del modelo ----------
const modelo = new THREE.Group();
scene.add(modelo);
const materiales = new Set();

function progreso(e) {
  if (e && e.lengthComputable) $('progreso').style.width = Math.round((e.loaded / e.total) * 100) + '%';
}
function error(msg) {
  const c = $('cargando');
  c.classList.add('error');
  $('estado').textContent = msg;
}
async function existe(u) {
  try {
    const r = await fetch(encodeURI(u), { method: 'HEAD', cache: 'no-store' });
    return r.ok;
  } catch { return false; }
}
function separar(ruta) {
  const i = ruta.lastIndexOf('/');
  return [ruta.slice(0, i + 1), ruta.slice(i + 1)];
}

async function cargar() {
  const m = cfg.modelo;
  try {
    let obj;
    if (m.glb && (await existe(m.glb))) {
      $('estado').textContent = 'Cargando modelo…';
      const g = await new GLTFLoader().loadAsync(encodeURI(m.glb), progreso);
      obj = g.scene;
    } else if (m.obj && (await existe(m.obj))) {
      $('estado').textContent = 'Cargando modelo y texturas…';
      const [dir, archivoObj] = separar(m.obj);
      const objLoader = new OBJLoader();
      if (m.mtl && (await existe(m.mtl))) {
        const [dirM, archivoMtl] = separar(m.mtl);
        const mats = await new MTLLoader().setPath(dirM).loadAsync(archivoMtl);
        mats.preload();
        objLoader.setMaterials(mats);
      }
      obj = await objLoader.setPath(dir).loadAsync(archivoObj, progreso);
    } else {
      error('No se encontró el modelo. Copiá el GLB o el OBJ dentro de la carpeta "modelo".');
      return;
    }
    if (m.ejeArriba === 'z') obj.rotation.x = -Math.PI / 2;
    modelo.add(obj);
    modelo.updateMatrixWorld(true);

    modelo.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((mat) => {
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        if (mat.isMeshPhongMaterial) mat.shininess = Math.min(mat.shininess ?? 30, 20);
        prepararMaterial(mat);
        materiales.add(mat);
      });
    });

    // Apoyar en el piso y centrar
    const caja = new THREE.Box3().setFromObject(modelo);
    const centro = caja.getCenter(new THREE.Vector3());
    modelo.position.set(-centro.x, -caja.min.y, -centro.z);
    modelo.updateMatrixWorld(true);
    // Encuadre y cortes sobre la vivienda (sin el terreno)
    const excluir = new Set(cfg.modelo.excluirDelEncuadre || []);
    const total = new THREE.Box3().setFromObject(modelo);
    const casa = new THREE.Box3();
    modelo.traverse((o) => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (ms.every((mat) => excluir.has(mat.name))) return;
      casa.expandByObject(o);
    });
    if (casa.isEmpty()) casa.copy(total);
    casa.min.y = total.min.y;
    iniciarCortes(casa);
    $('cargando').classList.add('oculto');
  } catch (e) {
    console.error(e);
    error('No se pudo cargar el modelo (' + (e.message || e) + ').');
  }
}

// ---------- Cortes ----------
let caja, tamano, escala = 1, unidad = 'm';
const cortes = {
  h:  { eje: 'y', normal: new THREE.Vector3(0, -1, 0), on: false, inv: false, pos: 0.5 },
  v1: { eje: 'x', normal: new THREE.Vector3(-1, 0, 0), on: false, inv: false, pos: 0.5 },
  v2: { eje: 'z', normal: new THREE.Vector3(0, 0, -1), on: false, inv: false, pos: 0.5 }
};
for (const c of Object.values(cortes)) c.plano = new THREE.Plane(c.normal.clone(), 0);

const matPlano = new THREE.MeshBasicMaterial({
  color: 0xb5502c, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false
});
const matBorde = new THREE.LineBasicMaterial({ color: 0xb5502c, transparent: true, opacity: 0.8 });

function iniciarCortes(b) {
  caja = b;
  tamano = b.getSize(new THREE.Vector3());
  const mayor = Math.max(tamano.x, tamano.y, tamano.z);
  // Adivinar unidades del modelo (una vivienda mide entre 3 y 150 m)
  if (mayor > 1500) { escala = 0.01; unidad = 'm'; }        // centímetros
  else if (mayor > 150) { escala = 0.0254; unidad = 'm'; }  // pulgadas
  else if (mayor >= 3) { escala = 1; unidad = 'm'; }
  else { escala = null; }

  const m = 1.06;
  for (const [k, c] of Object.entries(cortes)) {
    let w, h;
    if (c.eje === 'y') { w = tamano.x * m; h = tamano.z * m; }
    else if (c.eje === 'x') { w = tamano.z * m; h = tamano.y * m; }
    else { w = tamano.x * m; h = tamano.y * m; }
    const geo = new THREE.PlaneGeometry(w, h);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, matPlano));
    g.add(new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-w / 2, -h / 2, 0), new THREE.Vector3(w / 2, -h / 2, 0),
        new THREE.Vector3(w / 2, h / 2, 0), new THREE.Vector3(-w / 2, h / 2, 0)
      ]),
      matBorde
    ));
    if (c.eje === 'y') g.rotation.x = -Math.PI / 2;
    if (c.eje === 'x') g.rotation.y = Math.PI / 2;
    g.position.set(0, tamano.y / 2, 0);
    g.visible = false;
    scene.add(g);
    c.ayuda = g;
  }
  cortes.h.pos = posInicialH();
  sincronizarUI();
  aplicarCortes();
  vista('3d', false);
}

// Corte de planta a 1,20 m sobre el piso de planta baja
function nivelPiso() {
  return escala ? (cfg.modelo.nivelPiso || 0) / escala : 0;
}
function posInicialH() {
  if (!escala) return 0.5;
  const y = nivelPiso() + (cfg.modelo.alturaCorteInicial ?? 1.2) / escala;
  return THREE.MathUtils.clamp(y / tamano.y, 0.02, 0.98);
}

function coordenada(c) {
  return THREE.MathUtils.lerp(caja.min[c.eje], caja.max[c.eje], c.pos);
}

function aplicarCortes() {
  if (!caja) return;
  const activos = [];
  for (const c of Object.values(cortes)) {
    const v = coordenada(c);
    const s = c.inv ? -1 : 1;
    c.plano.normal.copy(c.normal).multiplyScalar(s);
    c.plano.constant = v * s;
    if (c.on) activos.push(c.plano);
    c.ayuda.position[c.eje] = v;
    if (c.eje !== 'y') c.ayuda.position.y = caja.min.y + tamano.y / 2;
    c.ayuda.visible = c.on && $('verPlanos').checked;
  }
  const cambio = materiales.size && [...materiales][0].clippingPlanes.length !== activos.length;
  materiales.forEach((m) => {
    m.clippingPlanes = activos;
    if (cambio) m.needsUpdate = true;
  });
  poche.uPocheOn.value = activos.length ? 1 : 0;
}

function texto(c) {
  let v = coordenada(c) - caja.min[c.eje];
  if (escala && c.eje === 'y') {
    const h = (v - nivelPiso()) * escala;
    return 'Altura ' + (h >= 0 ? '+' : '−') + Math.abs(h).toFixed(2).replace('.', ',') + ' m sobre NPT';
  }
  if (escala) return 'Posición ' + (v * escala).toFixed(2).replace('.', ',') + ' ' + unidad;
  return Math.round(c.pos * 100) + ' %';
}

function sincronizarUI() {
  document.querySelectorAll('.corte').forEach((el) => {
    const c = cortes[el.dataset.corte];
    el.classList.toggle('on', c.on);
    el.querySelector('[data-accion=activar]').checked = c.on;
    el.querySelector('[data-accion=mover]').value = Math.round(c.pos * 1000);
    el.querySelector('[data-accion=espejar]').classList.toggle('invertido', c.inv);
    el.querySelector('[data-valor]').textContent = caja ? texto(c) : '—';
  });
}

document.querySelectorAll('.corte').forEach((el) => {
  const c = cortes[el.dataset.corte];
  el.querySelector('[data-accion=activar]').addEventListener('change', (e) => {
    c.on = e.target.checked; sincronizarUI(); aplicarCortes();
  });
  el.querySelector('[data-accion=mover]').addEventListener('input', (e) => {
    c.pos = e.target.value / 1000; sincronizarUI(); aplicarCortes();
  });
  el.querySelector('[data-accion=espejar]').addEventListener('click', () => {
    c.inv = !c.inv; sincronizarUI(); aplicarCortes();
  });
});
$('verPlanos').addEventListener('change', aplicarCortes);

// ---------- Vistas de cámara ----------
let animacion = null;
function vista(tipo, animar = true) {
  if (!caja) return;
  const centro = caja.getCenter(new THREE.Vector3());
  const r = caja.getBoundingSphere(new THREE.Sphere()).radius;
  const fovV = THREE.MathUtils.degToRad(camera.fov / 2);
  const fovH = Math.atan(Math.tan(fovV) * camera.aspect);
  const d = (r / Math.sin(Math.min(fovV, fovH))) * 1.05;
  const dirs = {
    '3d': new THREE.Vector3(1, 0.75, 1.15),
    planta: new THREE.Vector3(0, 1, 0.0001),
    frente: new THREE.Vector3(0, 0.08, 1),
    lateral: new THREE.Vector3(1, 0.08, 0)
  };
  const destino = centro.clone().add(dirs[tipo].normalize().multiplyScalar(d));
  camera.near = r / 200; camera.far = r * 20; camera.updateProjectionMatrix();
  controls.maxDistance = d * 4;
  if (!animar) {
    camera.position.copy(destino); controls.target.copy(centro); controls.update(); return;
  }
  animacion = { p0: camera.position.clone(), t0: controls.target.clone(), p1: destino, t1: centro, ini: performance.now() };
}
document.querySelectorAll('[data-camara]').forEach((b) =>
  b.addEventListener('click', () => vista(b.dataset.camara))
);

$('reset').addEventListener('click', () => {
  for (const c of Object.values(cortes)) { c.on = false; c.inv = false; c.pos = 0.5; }
  if (tamano) cortes.h.pos = posInicialH();
  $('verPlanos').checked = true;
  sincronizarUI(); aplicarCortes(); vista('3d');
});

$('panelToggle').addEventListener('click', () => {
  const p = $('panel');
  p.classList.toggle('cerrado');
  $('panelToggle').setAttribute('aria-expanded', !p.classList.contains('cerrado'));
});
if (matchMedia('(max-width: 760px)').matches) $('panel').classList.add('cerrado');

// ---------- Bucle ----------
renderer.setAnimationLoop((t) => {
  if (animacion) {
    const k = Math.min(1, (t - animacion.ini) / 700);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(animacion.p0, animacion.p1, e);
    controls.target.lerpVectors(animacion.t0, animacion.t1, e);
    if (k === 1) animacion = null;
  }
  controls.update();
  renderer.render(scene, camera);
});

ajustarTamano();
sincronizarUI();
cargar();

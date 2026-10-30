// ==========================================
// SCRIPT PRINCIPAL - VISOR 360 CON ESFERA ALÁMBRICA
// ==========================================
import * as THREE from 'three';
import { 
    renderHotspots, 
    createTempLinkHotspot, 
    onAddInfoClick,
    initHotspotEditor,
    updateHotspotPositions,
    updateDirectrices
} from './hotspot-editor.js';

import {
    initBlueprint,
    preloadBlueprintImage,
    updateBlueprintFromScene,
    updateBlueprintRotation,
    setBlueprintProjectData
} from './blueprint.js';

import * as Cloud from './cloud.js';

// ==========================================
// BLOQUE 1: CONFIGURACIÓN DE LA ESFERA ALÁMBRICA
// ==========================================
const WF = {
    radius:       1.0,
    colorNormal:  0xffffff,
    colorEquator: 0x44ccff,
    opacityNormal:  0.30,
    opacityEquator: 0.75,
    meridianStep: 30,
    parallelLats: [-60, -30, 0, 30, 60],
    position:     { x: 0, y: 0, z: 0 }
};

// ==========================================
// BLOQUE 2: VARIABLES GLOBALES
// ==========================================
let scene, camera, renderer;
let currentSceneIndex = 0;
let projectData = null;
const PLANTA_URL = 'project/planta.png';

let cameraYaw = 0;
let cameraPitch = 0;
let isMouseDown = false;
let lastMouseX = 0, lastMouseY = 0;
let cameraDragEnabled = true;

let wireframeGroup = null;
let wireframeVisible = false;
let wireframeLabelsEl = null;
let wireframeTooltipEl = null;
let wireframeMouseHandler = null;

let blueprintContainer = null;
let blueprintToggle = null;
let blueprintConfigToggle = null;
let blueprintControls = null;
let blueprintEyeBtn = null;
let blueprintAreaBtn = null;

// Mapa en memoria de blobs de imágenes (debe declararse antes de loadScene)
const sceneImageBlobs = {};
const blobUrlCache = new Map();   // blob -> objectURL (evita crear URLs nuevas en cada carga)

// Proyecto en la nube actualmente abierto
let currentProjectId = null;
let readOnly = false;

// ==========================================
// RESOLUCIÓN DE RUTAS DE IMAGEN (memoria → nube → servidor)
// ==========================================
function blobURL(blob) {
    let u = blobUrlCache.get(blob);
    if (!u) { u = URL.createObjectURL(blob); blobUrlCache.set(blob, u); }
    return u;
}
function clearBlobs() {
    for (const key of Object.keys(sceneImageBlobs)) delete sceneImageBlobs[key];
    blobUrlCache.forEach(u => URL.revokeObjectURL(u));
    blobUrlCache.clear();
}
function hasImage(path) {
    return !!(sceneImageBlobs[path] || (projectData && projectData.assetMap && projectData.assetMap[path]));
}
export function resolveUrl(path) {
    if (sceneImageBlobs[path]) return blobURL(sceneImageBlobs[path]);
    const id = projectData && projectData.assetMap && projectData.assetMap[path];
    if (id) return Cloud.assetUrl(id);
    return path;
}
window.resolveUrl = resolveUrl;

// Guarda una imagen del proyecto: la muestra al instante desde memoria y,
// si estamos online, la sube a la nube y anota su id en projectData.assetMap.
async function storeImage(path, blob, { keepPng = false } = {}) {
    if (!Cloud.isCloud()) { sceneImageBlobs[path] = blob; return path; }
    const r = await Cloud.uploadImage(blob, { keepPng });
    let finalPath = path;
    if (!keepPng && r.type === 'image/jpeg') finalPath = path.replace(/\.(png|jpeg|webp|jpg)$/i, '.jpg');
    if (!projectData.assetMap) projectData.assetMap = {};
    projectData.assetMap[finalPath] = r.id;
    sceneImageBlobs[finalPath] = blob;
    return finalPath;
}
// Borra referencias anteriores de las caras de una escena (al reemplazarla)
function forgetScenePaths(base) {
    for (const key of Object.keys(sceneImageBlobs)) if (key.startsWith(base)) delete sceneImageBlobs[key];
    if (projectData.assetMap) for (const key of Object.keys(projectData.assetMap)) if (key.startsWith(base)) delete projectData.assetMap[key];
}

// localStorage puede no estar disponible (ventana privada, vista previa): nunca romper por eso
const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};

// Diálogo dentro de la página (en el link online el navegador bloquea prompt()/confirm())
function uiAsk({ title, text = '', input = null, okLabel = 'Aceptar', danger = false }) {
    return new Promise(resolve => {
        const wrap = document.createElement('div');
        wrap.className = 'pm-modal open ui-ask';
        wrap.innerHTML = `<div class="pm-modal-box" style="max-width:380px">
            <div class="pm-modal-header"><span></span><div class="pm-modal-close">&times;</div></div>
            <div class="pm-modal-body">
                <p class="pm-hint ui-ask-text" style="margin:0 0 12px"></p>
                ${input !== null ? '<input type="text" id="uiAskInput" class="pm-input" style="width:100%;box-sizing:border-box">' : ''}
                <div class="pm-actions">
                    <div class="pm-btn pm-btn--primary ui-ok"></div>
                    <div class="pm-btn pm-btn--secondary ui-cancel">Cancelar</div>
                </div>
            </div></div>`;
        wrap.querySelector('.pm-modal-header span').textContent = title;
        wrap.querySelector('.ui-ask-text').textContent = text;
        const ok = wrap.querySelector('.ui-ok');
        ok.textContent = okLabel;
        if (danger) ok.style.background = 'linear-gradient(135deg,#b00000,#700000)';
        const inp = wrap.querySelector('#uiAskInput');
        if (inp) inp.value = input;
        const close = (v) => { wrap.remove(); window.enableCameraDrag?.(); resolve(v); };
        ok.addEventListener('click', () => close(inp ? inp.value : true));
        wrap.querySelector('.ui-cancel').addEventListener('click', () => close(inp ? null : false));
        wrap.querySelector('.pm-modal-close').addEventListener('click', () => close(inp ? null : false));
        wrap.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') ok.click();
            if (e.key === 'Escape') close(inp ? null : false);
        });
        document.body.appendChild(wrap);
        window.disableCameraDrag?.();
        setTimeout(() => (inp || ok).focus?.(), 50);
        if (inp) setTimeout(() => inp.select(), 60);
    });
}

function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
window.escapeHTML = escapeHTML;

// ==========================================
// BLOQUE 3: REFERENCIAS DOM
// ==========================================
const infoDiv = document.getElementById('info');
const projectNameEl = document.getElementById('projectName');
const sceneNameDisplay = document.getElementById('sceneNameDisplay');
const sceneListEl = document.getElementById('sceneList');
const sceneListUl = document.querySelector('#sceneList .scenes');
const sceneListToggle = document.getElementById('sceneListToggle');
const fullscreenToggle = document.getElementById('fullscreenToggle');
const saveChangesBtn = document.getElementById('saveChangesBtn');
const infoGeneralBtn = document.getElementById('infoGeneralBtn');
const addLinkBtn = document.getElementById('addLinkBtn');
const addInfoBtn = document.getElementById('addInfoBtn');
const wireframeToggle = document.getElementById('wireframeToggle');
const infoTextContainer = document.getElementById('infoTextContainer');
const infoTextContent = document.getElementById('infoTextContent');
const infoModal = document.getElementById('infoModal');
const infoModalBody = document.querySelector('.info-modal-body');
const infoModalClose = document.querySelector('.info-modal-close');

// ==========================================
// BLOQUE 4: FUNCIONES AUXILIARES
// ==========================================
export function showMessage(msg, duration = 2000) {
    if (!infoDiv) return;
    if (!msg) { infoDiv.style.display = 'none'; return; }
    infoDiv.textContent = msg;
    infoDiv.style.display = 'block';
    clearTimeout(infoDiv._timer);
    // duration 0 = mensaje persistente hasta el próximo showMessage
    if (duration > 0) {
        infoDiv._timer = setTimeout(() => {
            if (infoDiv.textContent === msg) infoDiv.style.display = 'none';
        }, duration);
    }
}

function saveToLocalStorage() {
    if (!projectData || readOnly) return;
    lastLocalEdit = Date.now();
    if (Cloud.isCloud()) {
        Cloud.scheduleProjectSave(currentProjectId, projectData);
        return;
    }
    dirtySinceExport = true;
    if (window.STUDIO_WEB) return;
    if (!store.set('mjv_projectData', JSON.stringify(projectData))) {
        showMessage('No se pudo guardar en el navegador (espacio lleno)', 3000);
    }
}

function normalizeProject(p) {
    p.scenes = p.scenes || [];
    p.scenes.forEach(s => {
        s.linkHotspots = s.linkHotspots || [];
        s.infoHotspots = s.infoHotspots || [];
        s.planPosition = s.planPosition || { x: 0.5, y: 0.5 };
        s.planOrientation = s.planOrientation ?? 0;
        s.level = s.level ?? 0;
    });
    if (!p.levelScales) p.levelScales = {};
    if (!p.levels) p.levels = [];
    if (!p.assetMap) p.assetMap = {};
    if (!p.settings) p.settings = {};
    if (!p.settings.transition) p.settings.transition = 'zoom';
    if (!p.settings.transitionMs) p.settings.transitionMs = 900;
    return p;
}

function loadFromLocalStorage() {
    const saved = store.get('mjv_projectData');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            parsed.scenes.forEach(s => {
                s.linkHotspots = s.linkHotspots || [];
                s.infoHotspots = s.infoHotspots || [];
                s.planPosition = s.planPosition || { x: 0.5, y: 0.5 };
                s.planOrientation = s.planOrientation ?? 0;
                s.level = s.level ?? 0;
            });
            if (!parsed.levelScales) parsed.levelScales = {};
            projectData = parsed;
            showMessage('Datos cargados desde localStorage', 1500);
            return true;
        } catch(e) { console.warn(e); }
    }
    return false;
}

function restoreOriginalData() {} // legacy, no longer used

// ==========================================
// BLOQUE 5: INICIALIZACIÓN THREE.JS Y CONTROL DE CÁMARA
// ==========================================
function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
    camera.position.set(0, 0, 0);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;';
    document.body.appendChild(renderer.domElement);

    updateCameraRotation();

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Capa para las transiciones entre escenas
    transitionCanvas = document.createElement('canvas');
    transitionCanvas.id = 'transitionCanvas';
    document.body.appendChild(transitionCanvas);

    window.camera = camera;
    window.renderer = renderer;
    window.THREE = THREE;
}

function updateCameraRotation() {
    cameraPitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, cameraPitch));
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(cameraPitch, cameraYaw, 0, 'YXZ'));
    camera.quaternion.copy(quat);
    if (blueprintContainer?.classList.contains('enabled')) {
        updateBlueprintRotation();
    }
}

function onMouseDown(e) {
    if (e.button !== 0) return;
    if (!cameraDragEnabled) return;
    isMouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    document.querySelectorAll('.hs-picker.open').forEach(p => p.classList.remove('open'));
}

function onMouseMove(e) {
    if (!isMouseDown || !cameraDragEnabled) return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    cameraYaw += dx * 0.005;
    cameraPitch += dy * 0.005;
    updateCameraRotation();
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
}

function onMouseUp() {
    isMouseDown = false;
}

// Zoom con rueda del mouse y con pellizco en pantallas táctiles
const FOV_MIN = 30, FOV_MAX = 100;
let pinchStartDist = 0, pinchStartFov = 60;
function setFov(f) {
    camera.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, f));
    camera.updateProjectionMatrix();
}
function onWheel(e) {
    if (transitioning) return;
    e.preventDefault();
    setFov(camera.fov + e.deltaY * 0.04);
}

function onTouchStart(e) {
    if (e.touches.length === 2) {
        isMouseDown = false;
        pinchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchStartFov = camera.fov;
        e.preventDefault();
        return;
    }
    if (e.touches.length === 1 && cameraDragEnabled) {
        isMouseDown = true;
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
        e.preventDefault();
        document.querySelectorAll('.hs-picker.open').forEach(p => p.classList.remove('open'));
    }
}

function onTouchMove(e) {
    if (e.touches.length === 2 && pinchStartDist > 0) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        setFov(pinchStartFov * (pinchStartDist / d));
        e.preventDefault();
        return;
    }
    if (!isMouseDown || !cameraDragEnabled || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastMouseX;
    const dy = e.touches[0].clientY - lastMouseY;
    cameraYaw += dx * 0.005;
    cameraPitch += dy * 0.005;
    updateCameraRotation();
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
    e.preventDefault();
}

function onTouchEnd(e) {
    isMouseDown = false;
    if (!e.touches || e.touches.length < 2) pinchStartDist = 0;
}

window.disableCameraDrag = () => { cameraDragEnabled = false; };
window.enableCameraDrag = () => { cameraDragEnabled = true; };

// ==========================================
// BLOQUE 6: CARGA DE ESCENAS
// ==========================================
let sceneLoadToken = 0;          // evita que una carga vieja pise a una más nueva
let transitionCanvas = null;
let transitioning = false;
const FACES = ['right', 'left', 'up', 'down', 'front', 'back'];

// Cada cara se busca por separado: una escena puede mezclar jpg y png
async function resolveFaceUrls(base) {
    const exts = ['jpg', 'png', 'jpeg', 'webp'];
    const urls = [];
    for (const f of FACES) {
        let found = exts.map(ext => `${base}${f}.${ext}`).find(hasImage);
        if (!found) {
            for (const ext of exts) {
                try {
                    const resp = await fetch(`${base}${f}.${ext}`, { method: 'HEAD' });
                    if (resp.ok) { found = `${base}${f}.${ext}`; break; }
                } catch (e) {}
            }
        }
        urls.push(resolveUrl(found || `${base}${f}.jpg`));
    }
    return urls;
}

function showEmptyState(show) {
    let el = document.getElementById('emptyState');
    if (!show) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div');
    el.id = 'emptyState';
    el.innerHTML = readOnly
        ? `<h2>Proyecto vacío</h2><p>Todavía no hay escenas en este proyecto.</p>`
        : `<h2>Empezá un recorrido</h2><p>Abrí la lista de escenas y usá <b>Añadir escenas</b> para cargar la carpeta <code>project/</code> o una imagen 360°, o cargá un proyecto ZIP.</p>`;
    document.body.appendChild(el);
}

// Carga la escena. Devuelve una promesa que se resuelve cuando la imagen está en pantalla.
function loadScene(index, opts = {}) {
    const sceneData = projectData.scenes[index];
    if (!sceneData) {
        sceneNameDisplay.textContent = projectData.scenes.length ? '' : 'Sin escenas';
        if (projectData.name) projectNameEl.textContent = projectData.name;
        showEmptyState(projectData.scenes.length === 0);
        return Promise.resolve(false);
    }
    showEmptyState(false);
    const token = ++sceneLoadToken;

    currentSceneIndex = index;
    sceneNameDisplay.textContent = sceneData.name || sceneData.id;
    if (projectData.name) projectNameEl.textContent = projectData.name;
    updateSceneListActive(index);
    if (window.removeTempHotspot) window.removeTempHotspot();

    const base = `project/${sceneData.id}/1/`;
    const msgTimer = setTimeout(() => showMessage(`Cargando ${sceneData.name || sceneData.id}...`, 0), 250);

    return resolveFaceUrls(base).then(urls => new Promise(resolve => {
        if (token !== sceneLoadToken) return resolve(false);
        new THREE.CubeTextureLoader().load(urls,
            (texture) => {
                clearTimeout(msgTimer);
                if (token !== sceneLoadToken) { texture.dispose(); return resolve(false); }
                if (scene.background && scene.background.isTexture) scene.background.dispose();
                scene.background = texture;
                showMessage('');
                applyInitialView(sceneData, opts.view);
                loadInfoText(sceneData.id);

                updateBlueprintFromScene(sceneData);
                if (blueprintContainer?.classList.contains('enabled')) {
                    preloadBlueprintImage().catch(err => console.warn('Error loading blueprint image', err));
                }

                renderHotspots();
                updateHotspotPositions();
                document.querySelectorAll('.dx-label').forEach(el => el.remove());
                updateDirectrices();
                updateCommentDisplay(index);
                resolve(true);
            },
            undefined,
            (err) => {
                clearTimeout(msgTimer);
                console.error(err);
                if (token === sceneLoadToken) showMessage('Error al cargar la escena', 4000);
                resolve(false);
            }
        );
    }));
}

// ==========================================
// TRANSICIONES ENTRE ESCENAS
// ==========================================
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function tween(ms, fn) {
    return new Promise(res => {
        const t0 = performance.now();
        const step = (now) => {
            const t = Math.min(1, (now - t0) / ms);
            fn(easeInOut(t));
            if (t < 1) requestAnimationFrame(step); else res();
        };
        requestAnimationFrame(step);
    });
}
function shortestAngle(from, to) {
    let d = (to - from) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}
// Copia el último frame del visor sobre la capa de transición
function snapshotToOverlay() {
    renderer.render(scene, camera);
    const c = transitionCanvas;
    c.width = renderer.domElement.width;
    c.height = renderer.domElement.height;
    c.getContext('2d').drawImage(renderer.domElement, 0, 0);
    c.style.transition = 'none';
    c.style.opacity = '1';
    c.style.transform = 'scale(1)';
    c.style.filter = 'none';
    c.style.display = 'block';
}

// Navegar a otra escena con el efecto configurado.
//   from: { yaw, pitch } del hotspot clickeado (opcional, para el efecto "acercarse")
async function navigateToScene(index, from = null) {
    if (transitioning || !projectData.scenes[index]) return;
    const settings = projectData.settings || {};
    const mode = settings.transition || 'zoom';
    const dur = Math.max(200, Math.min(3000, settings.transitionMs || 900));
    if (mode === 'none' || !scene.background || index === currentSceneIndex) {
        return loadScene(index);
    }
    transitioning = true;
    document.body.classList.add('transitioning');
    const startFov = camera.fov;
    try {
        // 1) Acercarse al hotspot (girar la cámara hacia él y cerrar el FOV)
        if (mode === 'zoom' && from) {
            const y0 = cameraYaw, p0 = cameraPitch;
            const targetYaw = from.yaw + Math.PI;           // la cámara mira hacia -Z
            const dy = shortestAngle(y0, targetYaw);
            const dp = from.pitch - p0;
            await tween(dur * 0.45, t => {
                cameraYaw = y0 + dy * t;
                cameraPitch = p0 + dp * t;
                camera.fov = startFov - (startFov * 0.45) * t;
                camera.updateProjectionMatrix();
                updateCameraRotation();
            });
        }
        // 2) Congelar el frame actual y cargar la escena nueva por debajo
        snapshotToOverlay();
        const ok = await loadScene(index);
        if (!ok) return;
        // 3) Fundido (y en modo zoom, la escena nueva "llega" desde más cerca)
        const fadeMs = mode === 'zoom' ? dur * 0.55 : dur;
        const endFov = camera.fov;
        if (mode === 'zoom') { camera.fov = endFov * 0.8; camera.updateProjectionMatrix(); }
        const c = transitionCanvas;
        void c.offsetWidth;
        c.style.transition = `opacity ${fadeMs}ms ease, transform ${fadeMs}ms ease, filter ${fadeMs}ms ease`;
        c.style.opacity = '0';
        if (mode === 'zoom') { c.style.transform = 'scale(1.25)'; c.style.filter = 'blur(6px)'; }
        await tween(fadeMs, t => {
            if (mode === 'zoom') { camera.fov = endFov * (0.8 + 0.2 * t); camera.updateProjectionMatrix(); }
        });
    } finally {
        transitionCanvas.style.display = 'none';
        document.body.classList.remove('transitioning');
        transitioning = false;
    }
}
window.loadScene = (i) => navigateToScene(i);
window.navigateToScene = navigateToScene;

// ==========================================
// BLOQUE 7: PANELES LATERALES Y EDICIÓN DE NOMBRES
// ==========================================
function closeAllPanels() {
    sceneListEl.classList.remove('enabled');
    sceneListToggle.classList.remove('enabled');
    document.getElementById('addScenesBtn')?.classList.remove('enabled');
    if (blueprintContainer) blueprintContainer.classList.remove('enabled');
    if (blueprintToggle) blueprintToggle.classList.remove('enabled');
    infoTextContainer.classList.remove('enabled');
    infoGeneralBtn?.classList.remove('enabled');
    document.getElementById('addInfoBtn')?.classList.remove('enabled');
    document.getElementById('infoStyleBtn')?.classList.remove('enabled');
    document.getElementById('infoStylePanel')?.classList.remove('enabled');
    document.getElementById('addCommentBtn')?.classList.remove('enabled');
    document.getElementById('commentEditPanel')?.classList.remove('enabled');
    if (blueprintConfigToggle) blueprintConfigToggle.classList.remove('enabled');
    if (blueprintControls) blueprintControls.classList.remove('enabled');
    if (blueprintEyeBtn) blueprintEyeBtn.classList.remove('enabled');
    if (blueprintAreaBtn) blueprintAreaBtn.classList.remove('enabled');
}

function toggleSceneList() {
    const was = sceneListEl.classList.contains('enabled');
    closeAllPanels();
    if (!was) {
        sceneListEl.classList.add('enabled');
        sceneListToggle.classList.add('enabled');
        document.getElementById('addScenesBtn')?.classList.add('enabled');
    }
}

function toggleBlueprint() {
    const was = blueprintContainer?.classList.contains('enabled');
    closeAllPanels();
    if (!was) {
        const open = () => {
            blueprintContainer.classList.add('enabled');
            blueprintToggle.classList.add('enabled');
            blueprintConfigToggle.classList.add('enabled');
            if (blueprintEyeBtn) blueprintEyeBtn.classList.add('enabled');
            if (blueprintAreaBtn) blueprintAreaBtn.classList.add('enabled');
        };
        preloadBlueprintImage().then(() => { open(); updateBlueprintRotation(); })
            .catch(() => showMessage(projectData.levels?.length ? 'No se pudo cargar el plano' : 'Este proyecto todavía no tiene planos', 3000));
    } else {
        if (blueprintConfigToggle) blueprintConfigToggle.classList.remove('enabled');
        if (blueprintEyeBtn) blueprintEyeBtn.classList.remove('enabled');
    }
}

function toggleInfoText() {
    const was = infoGeneralBtn?.classList.contains('enabled');
    closeAllPanels();
    if (!was) {
        infoGeneralBtn?.classList.add('enabled');
        document.getElementById('addInfoBtn')?.classList.add('enabled');
        document.getElementById('infoStyleBtn')?.classList.add('enabled');
        document.getElementById('addCommentBtn')?.classList.add('enabled');
    }
}

function editProjectName() {
    if (readOnly) return;
    const currentName = projectData.name || 'Proyecto sin nombre';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'project-name-input';
    projectNameEl.replaceWith(input);
    input.focus();
    input.select();
    let done = false;   // Enter/Escape + blur no deben ejecutar dos veces
    const finishEdit = (save) => {
        if (done) return;
        done = true;
        if (save) {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                projectData.name = newName;
                projectNameEl.textContent = newName;
                saveToLocalStorage();
                showMessage('Nombre del proyecto actualizado', 1500);
            }
        }
        input.replaceWith(projectNameEl);
    };
    input.addEventListener('blur', () => finishEdit(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEdit(true);
        if (e.key === 'Escape') finishEdit(false);
    });
}

function editCurrentSceneName() {
    if (readOnly) return;
    const scene = projectData.scenes[currentSceneIndex];
    if (!scene) return;
    const currentName = scene.name || scene.id;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'scene-name-input';
    sceneNameDisplay.replaceWith(input);
    input.focus();
    input.select();
    let done = false;   // Enter/Escape + blur no deben ejecutar dos veces
    const finishEdit = (save) => {
        if (done) return;
        done = true;
        if (save) {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                scene.name = newName;
                sceneNameDisplay.textContent = newName;
                saveToLocalStorage();
                populateSceneList();
                renderHotspots();
                showMessage(`Escena renombrada a "${newName}"`, 1500);
            }
        }
        input.replaceWith(sceneNameDisplay);
    };
    input.addEventListener('blur', () => finishEdit(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEdit(true);
        if (e.key === 'Escape') finishEdit(false);
    });
}

// ==========================================
// LISTA DE ESCENAS (CON SELECTOR DE NIVEL)
// ==========================================
function populateSceneList() {
    sceneListUl.innerHTML = '';
    const levelsList = projectData.levels || [];

    projectData.scenes.forEach((s, idx) => {
        const li = document.createElement('li');
        li.className = 'scene';
        if (idx === currentSceneIndex) li.classList.add('current');
        li.style.position = 'relative';
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.justifyContent = 'space-between';
        li.style.gap = '8px';
        li.style.padding = '8px 12px';

        const nameContainer = document.createElement('div');
        nameContainer.style.display = 'flex';
        nameContainer.style.alignItems = 'center';
        nameContainer.style.gap = '6px';
        nameContainer.style.flex = '1';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = s.name || s.id;
        nameSpan.style.whiteSpace = 'nowrap';
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';

        const editIcon = document.createElement('img');
        editIcon.src = 'img/pencil.png';
        editIcon.alt = 'Editar';
        editIcon.className = 'scene-edit-icon';
        editIcon.title = 'Editar nombre';
        editIcon.style.width = '14px';
        editIcon.style.height = '14px';
        editIcon.style.cursor = 'pointer';
        editIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            editSceneName(idx, nameSpan);
        });

        const replaceIcon = document.createElement('img');
        replaceIcon.src = 'img/restore.png';
        replaceIcon.alt = 'Reemplazar';
        replaceIcon.className = 'scene-edit-icon';
        replaceIcon.title = 'Reemplazar imágenes de la escena';
        replaceIcon.style.width = '14px';
        replaceIcon.style.height = '14px';
        replaceIcon.style.cursor = 'pointer';
        replaceIcon.style.opacity = '0.6';
        replaceIcon.addEventListener('mouseover', () => replaceIcon.style.opacity = '1');
        replaceIcon.addEventListener('mouseout',  () => replaceIcon.style.opacity = '0.6');
        replaceIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            openReplaceSceneModal(idx);
        });

        nameContainer.appendChild(nameSpan);
        nameContainer.appendChild(editIcon);
        nameContainer.appendChild(replaceIcon);

        const levelSelect = document.createElement('select');
        levelSelect.className = 'scene-level-select';
        levelSelect.title = 'Plano asociado a esta escena';
        levelSelect.style.backgroundColor = 'rgba(0,0,0,0.6)';
        levelSelect.style.color = 'white';
        levelSelect.style.border = '1px solid #ffaa00';
        levelSelect.style.borderRadius = '12px';
        levelSelect.style.padding = '4px 8px';
        levelSelect.style.fontSize = '11px';
        levelSelect.style.cursor = 'pointer';
        levelSelect.style.outline = 'none';

        levelsList.forEach((levelFile, levelIdx) => {
            const option = document.createElement('option');
            option.value = levelIdx;
            option.textContent = levelFile.replace(/\.(png|jpe?g|webp)$/i, '').replace(/_/g, ' ');
            if (s.level === levelIdx) option.selected = true;
            levelSelect.appendChild(option);
        });

        if (levelsList.length === 0) {
            const option = document.createElement('option');
            option.value = 0;
            option.textContent = 'nivel_1';
            levelSelect.appendChild(option);
            if (s.level === undefined || s.level === 0) option.selected = true;
        }

        levelSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            const newLevel = parseInt(levelSelect.value, 10);
            if (s.level !== newLevel) {
                s.level = newLevel;
                saveToLocalStorage();
                const levelName = levelSelect.options[levelSelect.selectedIndex].text;
                showMessage(`Nivel "${levelName}" asignado a "${s.name || s.id}"`, 2000);
                if (idx === currentSceneIndex) {
                    updateBlueprintFromScene(s);
                    preloadBlueprintImage()
                        .then(() => {
                            if (window.updateBlueprintDotPosition) {
                                const pos = s.planPosition || { x: 0.5, y: 0.5 };
                                window.updateBlueprintDotPosition(pos.x, pos.y);
                            }
                            showMessage(`Plano cambiado a "${levelName}"`, 1500);
                        })
                        .catch(() => showMessage(`Error: No se pudo cargar el nivel "${levelName}"`, 3000));
                }
            }
        });

        if (readOnly) levelSelect.disabled = true;
        li.appendChild(nameContainer);
        li.appendChild(levelSelect);

        li.addEventListener('mouseenter', () => {
            if (window.showThumbnailForScene) window.showThumbnailForScene(s.id, li);
        });
        li.addEventListener('mouseleave', () => {
            if (window.hideThumbnail) window.hideThumbnail();
        });
        li.addEventListener('click', (e) => {
            if (e.target === levelSelect || editIcon.contains(e.target) || replaceIcon.contains(e.target)) return;
            closeAllPanels();
            if (window.hideThumbnail) window.hideThumbnail();
            navigateToScene(idx);
        });

        sceneListUl.appendChild(li);
    });
}

function editSceneName(sceneIndex, nameSpan) {
    const scene = projectData.scenes[sceneIndex];
    if (!scene) return;
    const currentName = scene.name || scene.id;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'scene-list-input';
    nameSpan.replaceWith(input);
    input.focus();
    input.select();
    let done = false;   // Enter/Escape + blur no deben ejecutar dos veces
    const finishEdit = (save) => {
        if (done) return;
        done = true;
        if (save) {
            const newName = input.value.trim();
            if (newName && newName !== currentName) {
                scene.name = newName;
                nameSpan.textContent = newName;
                if (sceneIndex === currentSceneIndex) sceneNameDisplay.textContent = newName;
                saveToLocalStorage();
                populateSceneList();
                renderHotspots();
                showMessage(`Escena renombrada a "${newName}"`, 1500);
            }
        }
        input.replaceWith(nameSpan);
    };
    input.addEventListener('blur', () => finishEdit(true));
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEdit(true);
        if (e.key === 'Escape') finishEdit(false);
    });
}

function updateSceneListActive(idx) {
    document.querySelectorAll('#sceneList .scene').forEach((item, i) => {
        item.classList.toggle('current', i === idx);
    });
}

// ==========================================
// REEMPLAZAR ESCENA
// ==========================================
let replaceSceneIndex = null;
let replaceSceneMode = 'cubemap';
let replaceSceneFiles = null;   // File objects
let replaceEquirectFile = null;

function openReplaceSceneModal(idx) {
    replaceSceneIndex = idx;
    replaceSceneMode = 'cubemap';
    replaceSceneFiles = null;
    replaceEquirectFile = null;
    const scene = projectData.scenes[idx];
    document.getElementById('replaceSceneTitle').textContent = scene.name || scene.id;
    document.getElementById('replaceSceneModal').classList.add('open');
    document.getElementById('rSceneProgress').style.display = 'none';
    document.getElementById('rCubemapPreview').style.display = 'none';
    document.getElementById('rCubemapPreview').innerHTML = '';
    document.getElementById('rEquirectPreview').style.display = 'none';
    document.querySelectorAll('#replaceSceneModal .pm-type-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.rmode === 'cubemap'));
    document.getElementById('rMode-cubemap').style.display = '';
    document.getElementById('rMode-equirect').style.display = 'none';
}
function closeReplaceSceneModal() {
    document.getElementById('replaceSceneModal').classList.remove('open');
    replaceSceneIndex = null;
}

function setReplaceMode(mode) {
    replaceSceneMode = mode;
    document.querySelectorAll('#replaceSceneModal .pm-type-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.rmode === mode));
    document.getElementById('rMode-cubemap').style.display  = mode === 'cubemap'  ? '' : 'none';
    document.getElementById('rMode-equirect').style.display = mode === 'equirect' ? '' : 'none';
}

function processReplaceCubemap(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    const faces = parseCubemapFolder(files);
    replaceSceneFiles = faces;
    // Show mini preview
    const preview = document.getElementById('rCubemapPreview');
    preview.innerHTML = '';
    const faceOrder = ['right','left','up','down','front','back'];
    const missing = faceOrder.filter(f => !faces[f]);
    const chips = document.createElement('div');
    chips.className = 'pm-file-list';
    faceOrder.forEach(face => {
        const chip = document.createElement('div');
        chip.className = `pm-file-chip ${faces[face] ? 'ok' : 'warn'}`;
        chip.textContent = faces[face] ? `✓ ${face}` : `✗ ${face}`;
        chips.appendChild(chip);
    });
    preview.appendChild(chips);
    if (missing.length) {
        const warn = document.createElement('p');
        warn.className = 'pm-hint';
        warn.style.color = '#ffcc66';
        warn.textContent = `⚠ Faltan: ${missing.join(', ')}`;
        preview.appendChild(warn);
    }
    preview.style.display = '';
}

function processReplaceEquirect(file) {
    replaceEquirectFile = file;
    const url = URL.createObjectURL(file);
    const img = document.getElementById('rEquirectImg');
    const info = document.getElementById('rEquirectInfo');
    img.src = url;
    img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        const ok = Math.abs(ratio - 2) < 0.15;
        info.textContent = `${img.naturalWidth}×${img.naturalHeight}px · ratio ${ratio.toFixed(2)}:1 ${ok ? '✓' : '⚠ se esperaba 2:1'}`;
        info.style.color = ok ? '#88ffaa' : '#ffcc66';
    };
    document.getElementById('rEquirectPreview').style.display = '';
}

async function confirmReplaceScene() {
    if (replaceSceneIndex === null) return;
    const scene = projectData.scenes[replaceSceneIndex];
    const base = `project/${scene.id}/1/`;

    if (replaceSceneMode === 'cubemap' && !replaceSceneFiles) { showMessage('Seleccioná las imágenes primero', 2000); return; }
    if (replaceSceneMode === 'equirect' && !replaceEquirectFile) { showMessage('Seleccioná una imagen primero', 2000); return; }

    if (replaceSceneMode === 'cubemap') {
        const missing = FACE_NAMES.filter(f => !replaceSceneFiles[f]);
        if (missing.length) { showMessage(`Faltan caras: ${missing.join(', ')}`, 3000); return; }
    }

    const fillEl = document.getElementById('rSceneProgressFill');
    const statusEl = document.getElementById('rSceneStatus');
    document.getElementById('rSceneProgress').style.display = '';
    fillEl.style.width = '10%';
    const idxAtStart = replaceSceneIndex;

    try {
        let faceBlobs;
        if (replaceSceneMode === 'cubemap') {
            faceBlobs = replaceSceneFiles;
        } else {
            statusEl.textContent = 'Convirtiendo equirectangular...';
            faceBlobs = await equirectToCubemap(replaceEquirectFile, (p) => {
                fillEl.style.width = `${10 + p * 40}%`;
            });
        }
        // Borrar referencias anteriores de esta escena recién ahora (si algo falla antes, queda la vieja)
        forgetScenePaths(base);
        let i = 0;
        for (const [face, file] of Object.entries(faceBlobs)) {
            const ext = (file.name ? file.name.split('.').pop() : 'jpg').toLowerCase();
            statusEl.textContent = Cloud.isCloud() ? `Subiendo ${face} (${i + 1}/6)...` : 'Guardando imágenes...';
            await storeImage(`${base}${face}.${ext}`, file);
            fillEl.style.width = `${50 + (++i / 6) * 45}%`;
        }

        fillEl.style.width = '100%';
        statusEl.textContent = '¡Reemplazado!';
        saveToLocalStorage();

        setTimeout(() => {
            closeReplaceSceneModal();
            // Si es la escena activa, recargarla (replaceSceneIndex ya se limpió al cerrar)
            if (idxAtStart === currentSceneIndex) loadScene(currentSceneIndex);
            showMessage(`"${scene.name || scene.id}" actualizada ✓`, 3000);
        }, 400);

    } catch(err) {
        console.error(err);
        showMessage(uploadErrorText(err), 4000);
        document.getElementById('rSceneProgress').style.display = 'none';
    }
}

function initReplaceSceneModal() {
    document.getElementById('replaceSceneModalClose')?.addEventListener('click', closeReplaceSceneModal);
    document.getElementById('replaceSceneModalClose2')?.addEventListener('click', closeReplaceSceneModal);
    document.getElementById('replaceSceneModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('replaceSceneModal')) closeReplaceSceneModal();
    });
    document.querySelectorAll('#replaceSceneModal .pm-type-btn').forEach(btn => {
        btn.addEventListener('click', () => setReplaceMode(btn.dataset.rmode));
    });

    const cubemapDZ = document.getElementById('rCubemapDZ');
    const cubemapInput = document.getElementById('rCubemapInput');
    cubemapDZ?.addEventListener('click', () => cubemapInput.click());
    cubemapInput?.addEventListener('change', (e) => { if (e.target.files.length) processReplaceCubemap(e.target.files); });
    cubemapDZ?.addEventListener('dragover', (e) => { e.preventDefault(); cubemapDZ.classList.add('drag-over'); });
    cubemapDZ?.addEventListener('dragleave', () => cubemapDZ.classList.remove('drag-over'));
    cubemapDZ?.addEventListener('drop', (e) => {
        e.preventDefault(); cubemapDZ.classList.remove('drag-over');
        if (e.dataTransfer.files.length) processReplaceCubemap(e.dataTransfer.files);
    });

    const equirectDZ = document.getElementById('rEquirectDZ');
    const equirectInput = document.getElementById('rEquirectInput');
    equirectDZ?.addEventListener('click', () => equirectInput.click());
    equirectInput?.addEventListener('change', (e) => { if (e.target.files[0]) processReplaceEquirect(e.target.files[0]); });
    equirectDZ?.addEventListener('dragover', (e) => { e.preventDefault(); equirectDZ.classList.add('drag-over'); });
    equirectDZ?.addEventListener('dragleave', () => equirectDZ.classList.remove('drag-over'));
    equirectDZ?.addEventListener('drop', (e) => {
        e.preventDefault(); equirectDZ.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) processReplaceEquirect(f);
    });

    document.getElementById('rSceneConfirmBtn')?.addEventListener('click', confirmReplaceScene);
}



let addScenesMode = 'project';
let detectedLevels = [];
let detectedScenes = []; // [{ id, name, files: {right,left,...}, equirectFile, type }]

function openAddScenesModal() {
    if (readOnly) return;
    document.getElementById('addScenesModal').classList.add('open');
    setAddScenesMode('project');
    detectedScenes = [];
    detectedLevels = [];
    document.getElementById('asProjectPreview').style.display = 'none';
    document.getElementById('asProjectPreview').innerHTML = '';
    document.getElementById('asSinglePreview').style.display = 'none';
    document.getElementById('asSinglePreview').innerHTML = '';
    document.getElementById('asEquirectPreview').style.display = 'none';
    document.getElementById('asSingleName').value = '';
    document.getElementById('asEquirectName').value = '';
    document.getElementById('asScenesProgress').style.display = 'none';
}
function closeAddScenesModal() {
    document.getElementById('addScenesModal').classList.remove('open');
    detectedScenes = [];
}

function setAddScenesMode(mode) {
    addScenesMode = mode;
    document.querySelectorAll('#addScenesModal .pm-type-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
    ['project','single','equirect'].forEach(m => {
        document.getElementById(`asMode-${m}`).style.display = m === mode ? '' : 'none';
    });
}

// Detecta el nombre de cara desde el nombre de archivo
function detectFace(filename) {
    const n = filename.toLowerCase().replace(/\.(jpg|jpeg|png|webp)$/, '');
    if (/right|_r$|_px/.test(n))           return 'right';
    if (/left|_l$|_nx/.test(n))            return 'left';
    if (/up|top|_u$|_py/.test(n))          return 'up';
    if (/down|bottom|_d$|_ny/.test(n))     return 'down';
    if (/front|forward|_f$|_pz/.test(n))   return 'front';
    if (/back|rear|_b$|_nz/.test(n))       return 'back';
    return null;
}

// Parsea los archivos de una carpeta de escena y devuelve las caras encontradas
function parseCubemapFolder(files) {
    const faces = {};
    const unmatched = [];
    for (const f of files) {
        if (!f.type.startsWith('image/')) continue;
        const face = detectFace(f.name);
        if (face && !faces[face]) faces[face] = f;
        else if (!face) unmatched.push(f);
    }
    // Asignar los no detectados en orden si faltan caras
    const faceOrder = ['right','left','up','down','front','back'];
    let ui = 0;
    for (const face of faceOrder) {
        if (!faces[face] && ui < unmatched.length) faces[face] = unmatched[ui++];
    }
    return faces;
}

// Genera un object URL para thumbnail (front o primera cara disponible)
function makeFaceThumbURL(faces) {
    const f = faces['front'] || faces['right'] || Object.values(faces)[0];
    if (!f) return null;
    return URL.createObjectURL(f);
}

// Procesar carpeta completa de proyecto
function processProjectFolder(fileList) {
    const files = Array.from(fileList);
    // Planos: cualquier imagen dentro de una carpeta "niveles" / "planos"
    detectedLevels = files.filter(f => {
        const parts = (f.webkitRelativePath || f.name).toLowerCase().split('/');
        return /\.(png|jpe?g|webp)$/i.test(f.name) && parts.slice(0, -1).some(p => p === 'niveles' || p === 'planos');
    });
    // Agrupar por primer segmento de ruta relativa
    const folders = {};
    for (const f of files) {
        const parts = (f.webkitRelativePath || f.name).split('/');
        if (parts.slice(0, -1).some(p => /^(niveles|planos)$/i.test(p))) continue;
        // Estructura esperada: project/escenaN/1/face.jpg o escenaN/1/face.jpg
        // Detectar el segmento que parece ID de escena
        let sceneId = null;
        for (let i = 0; i < parts.length - 1; i++) {
            // Si el siguiente segmento es '1' o similar, este es el sceneId
            if (/^\d+$/.test(parts[i + 1]) || parts[i + 1] === '1') {
                sceneId = parts[i];
                break;
            }
        }
        if (!sceneId) continue;
        if (!folders[sceneId]) folders[sceneId] = [];
        folders[sceneId].push(f);
    }

    detectedScenes = [];
    for (const [sceneId, sceneFiles] of Object.entries(folders)) {
        const faces = parseCubemapFolder(sceneFiles);
        const faceCount = Object.keys(faces).length;
        detectedScenes.push({
            id: sceneId,
            name: sceneId.replace(/_/g, ' '),
            faces,
            faceCount,
            type: 'cubemap'
        });
    }

    // Ordenar por id natural
    detectedScenes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    renderScenePreviewCards('asProjectPreview');
    if (detectedLevels.length) {
        const p = document.createElement('p');
        p.className = 'pm-hint';
        p.style.textAlign = 'center';
        p.textContent = `+ ${detectedLevels.length} plano${detectedLevels.length !== 1 ? 's' : ''}: ${detectedLevels.map(f => f.name).join(', ')}`;
        document.getElementById('asProjectPreview').appendChild(p);
    }
}

// Sube/añade imágenes de planos al proyecto (sin duplicar nombres)
async function addLevelFiles(files, statusEl) {
    if (!projectData.levels) projectData.levels = [];
    let n = 0;
    for (const f of files) {
        const name = f.name.replace(/\s+/g, '_');
        if (statusEl) statusEl.textContent = `Subiendo plano ${name}...`;
        await storeImage(`project/niveles/${name}`, f, { keepPng: true });
        if (!projectData.levels.some(l => l.toLowerCase() === name.toLowerCase())) projectData.levels.push(name);
        n++;
    }
    return n;
}
window.addLevelFiles = async (files) => {
    try {
        showMessage('Subiendo plano...', 0);
        const n = await addLevelFiles(files);
        saveToLocalStorage();
        populateSceneList();
        showMessage(`${n} plano${n !== 1 ? 's' : ''} añadido${n !== 1 ? 's' : ''} ✓ — asignalo a cada escena desde la lista`, 4000);
    } catch (e) { console.error(e); showMessage(uploadErrorText(e), 4000); }
};

function uploadErrorText(err) {
    const code = err && err.code;
    if (code === 'too_large') return 'Imagen demasiado grande (máx. 20 MB)';
    if (code === 'quota_or_state') return 'Se llenó el espacio de almacenamiento del Studio';
    if (code === 'rate_limited') return 'Demasiadas subidas seguidas, probá en unos segundos';
    if (err && /permiso/i.test(err.message || '')) return 'Tu usuario no tiene permiso para subir imágenes';
    return 'Error al procesar las imágenes';
}

// Procesar carpeta de una sola escena
function processSingleFolder(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    const folderName = files.length
        ? (files[0].webkitRelativePath || files[0].name).split('/')[0]
        : 'escena';
    const faces = parseCubemapFolder(files);
    const faceCount = Object.keys(faces).length;

    detectedScenes = [{
        id: folderName,
        name: document.getElementById('asSingleName').value.trim() || folderName.replace(/_/g, ' '),
        faces,
        faceCount,
        type: 'cubemap'
    }];

    document.getElementById('asSingleName').value = detectedScenes[0].name;
    renderScenePreviewCards('asSinglePreview');
}

// Procesar imagen equirectangular
function processEquirectFile(file) {
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const customName = document.getElementById('asEquirectName').value.trim() || baseName;
    detectedScenes = [{
        id: baseName,
        name: customName,
        equirectFile: file,
        faceCount: 1,
        type: 'equirect'
    }];
    document.getElementById('asEquirectName').value = customName;

    // Preview
    const url = URL.createObjectURL(file);
    const img = document.getElementById('asEquirectImg');
    const info = document.getElementById('asEquirectInfo');
    img.src = url;
    img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        const ok = Math.abs(ratio - 2) < 0.15;
        info.textContent = `${img.naturalWidth}×${img.naturalHeight}px · ratio ${ratio.toFixed(2)}:1 ${ok ? '✓' : '⚠ se esperaba 2:1'}`;
        info.style.color = ok ? '#88ffaa' : '#ffcc66';
    };
    document.getElementById('asEquirectPreview').style.display = '';
}

// Renderiza las tarjetas de preview
function renderScenePreviewCards(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    container.style.display = '';

    if (detectedScenes.length === 0) {
        container.innerHTML = '<p class="pm-hint" style="text-align:center;padding:12px 0">No se detectaron escenas válidas</p>';
        return;
    }

    const cards = document.createElement('div');
    cards.className = 'as-scene-cards';

    detectedScenes.forEach((sc, idx) => {
        const card = document.createElement('div');
        card.className = `as-scene-card ${sc.faceCount < 6 && sc.type === 'cubemap' ? 'error' : ''}`;

        // Thumbnail
        if (sc.type === 'cubemap' && sc.faces) {
            const thumbURL = makeFaceThumbURL(sc.faces);
            if (thumbURL) {
                const img = document.createElement('img');
                img.className = 'as-scene-thumb';
                img.src = thumbURL;
                card.appendChild(img);
            } else {
                const ph = document.createElement('div');
                ph.className = 'as-scene-thumb-placeholder';
                ph.textContent = '⬡';
                card.appendChild(ph);
            }
        } else if (sc.type === 'equirect' && sc.equirectFile) {
            const img = document.createElement('img');
            img.className = 'as-scene-thumb';
            img.src = URL.createObjectURL(sc.equirectFile);
            card.appendChild(img);
        }

        // Info
        const info = document.createElement('div');
        info.className = 'as-scene-info';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'as-scene-name-input';
        nameInput.value = sc.name;
        nameInput.addEventListener('input', () => { detectedScenes[idx].name = nameInput.value; });

        const meta = document.createElement('div');
        meta.className = `as-scene-meta ${sc.type === 'cubemap' && sc.faceCount >= 6 ? 'ok' : sc.type === 'equirect' ? 'ok' : 'warn'}`;
        if (sc.type === 'cubemap') {
            const found = Object.keys(sc.faces || {});
            const missing = ['right','left','up','down','front','back'].filter(f => !sc.faces[f]);
            meta.textContent = sc.faceCount >= 6
                ? `✓ 6 caras detectadas`
                : `⚠ Faltan: ${missing.join(', ')}`;
        } else {
            meta.textContent = '✓ Equirectangular · se convertirá a cubemap';
        }

        info.appendChild(nameInput);
        info.appendChild(meta);
        card.appendChild(info);

        // Botón quitar
        const remove = document.createElement('div');
        remove.className = 'as-scene-remove';
        remove.textContent = '×';
        remove.title = 'Quitar de la lista';
        remove.addEventListener('click', () => {
            detectedScenes.splice(idx, 1);
            renderScenePreviewCards(containerId);
        });
        card.appendChild(remove);
        cards.appendChild(card);
    });

    container.appendChild(cards);

    // Resumen
    const summary = document.createElement('p');
    summary.className = 'pm-hint';
    summary.style.textAlign = 'center';
    summary.style.marginTop = '8px';
    const valid = detectedScenes.filter(s => s.type === 'equirect' || s.faceCount >= 6).length;
    summary.textContent = `${detectedScenes.length} escena${detectedScenes.length !== 1 ? 's' : ''} detectada${detectedScenes.length !== 1 ? 's' : ''} · ${valid} lista${valid !== 1 ? 's' : ''} para añadir`;
    container.appendChild(summary);
}

// Confirmar y añadir todas las escenas detectadas
async function confirmAddScenes() {
    if (addingScenes) return;
    const toAdd = detectedScenes.filter(s => s.type === 'equirect' || s.faceCount >= 6);
    const levelsToAdd = addScenesMode === 'project' ? detectedLevels : [];
    if (toAdd.length === 0 && levelsToAdd.length === 0) { showMessage('No hay escenas válidas para añadir', 2500); return; }
    addingScenes = true;
    const startCount = projectData.scenes.length;
    let added = 0;

    const progressEl = document.getElementById('asScenesProgress');
    const fillEl = document.getElementById('asScenesProgressFill');
    const statusEl = document.getElementById('asScenesStatus');
    progressEl.style.display = '';

    const existingIds = projectData.scenes.map(s => s.id);
    let counter = projectData.scenes.length + 1;
    const getUniqueId = (preferredId) => {
        if (!existingIds.includes(preferredId)) { existingIds.push(preferredId); return preferredId; }
        while (existingIds.includes(`escena${counter}`)) counter++;
        const id = `escena${counter++}`;
        existingIds.push(id);
        return id;
    };

    for (let i = 0; i < toAdd.length; i++) {
        const sc = toAdd[i];
        const pct = Math.round((i / toAdd.length) * 90);
        fillEl.style.width = `${pct}%`;
        statusEl.textContent = `Procesando "${sc.name}" (${i + 1}/${toAdd.length})...`;

        const sceneId = getUniqueId(sc.id);
        const base = `project/${sceneId}/1/`;

        try {
            let faceBlobs = sc.faces;
            if (sc.type !== 'cubemap') {
                // Convertir equirectangular
                statusEl.textContent = `Convirtiendo "${sc.name}" a cubemap...`;
                faceBlobs = await equirectToCubemap(sc.equirectFile, (p) => {
                    fillEl.style.width = `${pct + Math.round(p * (45 / toAdd.length))}%`;
                });
            }
            let fi = 0;
            for (const [face, file] of Object.entries(faceBlobs)) {
                const ext = (file.name ? file.name.split('.').pop() : 'jpg').toLowerCase();
                if (Cloud.isCloud()) statusEl.textContent = `Subiendo "${sc.name}" (${i + 1}/${toAdd.length}) · ${++fi}/6`;
                await storeImage(`${base}${face}.${ext}`, file);
            }
            added++;

            projectData.scenes.push({
                id: sceneId,
                name: sc.name || sceneId,
                initialViewParameters: { yaw: 0, pitch: 0, fov: 1.2 },
                planPosition: { x: 0.5, y: 0.5 },
                planOrientation: 0,
                level: 0,
                linkHotspots: [],
                infoHotspots: []
            });
        } catch(err) {
            console.error(`Error procesando ${sc.name}:`, err);
            showMessage(`Error con "${sc.name}": ${uploadErrorText(err)}`, 4000);
            if (err && err.code === 'quota_or_state') break;
        }
        // Guardar a medida que avanza: si se corta la subida no se pierde lo ya subido
        if (Cloud.isCloud()) saveToLocalStorage();
    }

    let levelsAdded = 0;
    try { levelsAdded = await addLevelFiles(levelsToAdd, statusEl); }
    catch (err) { console.error(err); showMessage(`Planos: ${uploadErrorText(err)}`, 4000); }

    fillEl.style.width = '100%';
    statusEl.textContent = `¡${added} escena${added !== 1 ? 's' : ''} añadida${added !== 1 ? 's' : ''}!`;
    window.projectData = projectData;
    saveToLocalStorage();
    populateSceneList();
    addingScenes = false;

    setTimeout(() => {
        closeAddScenesModal();
        // Navegar a la primera escena añadida (antes se calculaba mal si alguna fallaba)
        if (added > 0) loadScene(startCount);
        const extra = levelsAdded ? ` y ${levelsAdded} plano${levelsAdded !== 1 ? 's' : ''}` : '';
        showMessage(`${added} escena${added !== 1 ? 's' : ''} añadida${added !== 1 ? 's' : ''}${extra} ✓`, 3000);
    }, 500);
}
let addingScenes = false;

function initAddScenesModal() {
    // Abrir desde botón en la lista
    document.getElementById('addScenesBtn')?.addEventListener('click', openAddScenesModal);
    document.getElementById('addScenesModalClose')?.addEventListener('click', closeAddScenesModal);
    document.getElementById('addScenesModalClose2')?.addEventListener('click', closeAddScenesModal);
    document.getElementById('addScenesModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('addScenesModal')) closeAddScenesModal();
    });

    // Selector de modo
    document.querySelectorAll('#addScenesModal .pm-type-btn').forEach(btn => {
        btn.addEventListener('click', () => setAddScenesMode(btn.dataset.mode));
    });

    // Modo proyecto completo
    const projectDZ = document.getElementById('asProjectDZ');
    const projectInput = document.getElementById('asProjectInput');
    projectDZ?.addEventListener('click', () => projectInput.click());
    projectInput?.addEventListener('change', (e) => { if (e.target.files.length) processProjectFolder(e.target.files); });
    projectDZ?.addEventListener('dragover', (e) => { e.preventDefault(); projectDZ.classList.add('drag-over'); });
    projectDZ?.addEventListener('dragleave', () => projectDZ.classList.remove('drag-over'));
    projectDZ?.addEventListener('drop', (e) => {
        e.preventDefault(); projectDZ.classList.remove('drag-over');
        if (e.dataTransfer.files.length) processProjectFolder(e.dataTransfer.files);
    });

    // Modo escena individual
    const singleDZ = document.getElementById('asSingleDZ');
    const singleInput = document.getElementById('asSingleInput');
    singleDZ?.addEventListener('click', () => singleInput.click());
    singleInput?.addEventListener('change', (e) => { if (e.target.files.length) processSingleFolder(e.target.files); });
    singleDZ?.addEventListener('dragover', (e) => { e.preventDefault(); singleDZ.classList.add('drag-over'); });
    singleDZ?.addEventListener('dragleave', () => singleDZ.classList.remove('drag-over'));
    singleDZ?.addEventListener('drop', (e) => {
        e.preventDefault(); singleDZ.classList.remove('drag-over');
        if (e.dataTransfer.files.length) processSingleFolder(e.dataTransfer.files);
    });
    document.getElementById('asSingleName')?.addEventListener('input', (e) => {
        if (detectedScenes[0]) detectedScenes[0].name = e.target.value;
    });

    // Modo equirectangular
    const equirectDZ = document.getElementById('asEquirectDZ');
    const equirectInput = document.getElementById('asEquirectInput');
    equirectDZ?.addEventListener('click', () => equirectInput.click());
    equirectInput?.addEventListener('change', (e) => { if (e.target.files[0]) processEquirectFile(e.target.files[0]); });
    equirectDZ?.addEventListener('dragover', (e) => { e.preventDefault(); equirectDZ.classList.add('drag-over'); });
    equirectDZ?.addEventListener('dragleave', () => equirectDZ.classList.remove('drag-over'));
    equirectDZ?.addEventListener('drop', (e) => {
        e.preventDefault(); equirectDZ.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) processEquirectFile(f);
    });
    document.getElementById('asEquirectName')?.addEventListener('input', (e) => {
        if (detectedScenes[0]) { detectedScenes[0].name = e.target.value; detectedScenes[0].id = e.target.value; }
    });

    // Confirmar
    document.getElementById('asScenesConfirmBtn')?.addEventListener('click', confirmAddScenes);
}

function handleSaveChanges() {
    exportProjectAsZip();
}

async function exportProjectAsZip() {
    showMessage('Preparando ZIP...', 0);
    const zip = new JSZip();


    // Solo se exportan las escenas y planos que siguen en el proyecto
    const added = new Set();
    const addPath = async (path) => {
        if (added.has(path)) return true;
        if (sceneImageBlobs[path]) { zip.file(path, sceneImageBlobs[path]); added.add(path); return true; }
        if (!hasImage(path) && Cloud.isCloud()) return false;
        try {
            const r = await fetch(resolveUrl(path));
            if (r.ok) { zip.file(path, await r.blob()); added.add(path); return true; }
        } catch (e) {}
        return false;
    };

    let n = 0;
    for (const s of projectData.scenes) {
        const base = `project/${s.id}/1/`;
        showMessage(`Preparando ZIP... escena ${++n}/${projectData.scenes.length}`, 0);
        for (const face of FACES) {
            for (const ext of ['jpg','png','jpeg','webp']) {
                if (await addPath(`${base}${face}.${ext}`)) break;
            }
        }
        if (!Cloud.isCloud()) {
            try { const r = await fetch(`project/${s.id}/info.txt`); if (r.ok) zip.file(`project/${s.id}/info.txt`, await r.text()); } catch(e) {}
        }
    }

    // Planos / niveles
    for (const level of (projectData.levels || [])) await addPath(`project/niveles/${level}`);
    if (!Cloud.isCloud()) await addPath('project/planta.png');

    // data.js sin el mapa de la nube (es interno de esta instalación)
    const exportData = JSON.parse(JSON.stringify(projectData));
    delete exportData.assetMap;
    zip.file('data.js', `var APP_DATA = ${JSON.stringify(exportData, null, 4)};\n`);

    const content = await zip.generateAsync({ type: 'blob' }, (meta) => {
        showMessage(`Generando ZIP... ${Math.round(meta.percent)}%`, 0);
    });
    const filename = `${(projectData.name || 'proyecto').replace(/[^\w\-]+/g,'_')}.zip`;
    const dl = window.claude?.use ? await window.claude.use('downloads').catch(() => null) : null;
    if (dl) {
        try {
            showMessage('');
            await dl.save({ filename, data: content });
            dirtySinceExport = false;
            showMessage('Proyecto exportado ✓', 3000);
        } catch (e) {
            showMessage(e && e.code === 'declined' ? 'Descarga cancelada' : 'No se pudo descargar el ZIP', 3000);
        }
        return;
    }
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revocar enseguida cancelaba la descarga en algunos navegadores
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    dirtySinceExport = false;
    showMessage('Proyecto exportado ✓', 3000);
}
let dirtySinceExport = false;
// Versión web: avisar antes de cerrar si hay cambios sin exportar (no quedan guardados en el servidor)
window.addEventListener('beforeunload', (e) => {
    if (!window.STUDIO_WEB || Cloud.isCloud() || !dirtySinceExport) return;
    e.preventDefault();
    e.returnValue = '';
});

// ---- CARGAR PROYECTO DESDE ZIP ----
function openLoadProjectModal() {
    document.getElementById('loadProjectModal').classList.add('open');
}
function closeLoadProjectModal() {
    document.getElementById('loadProjectModal').classList.remove('open');
    document.getElementById('loadProjectProgress').style.display = 'none';
}

async function loadProjectFromZip(file) {
    const progressEl = document.getElementById('loadProjectProgress');
    const fillEl = document.getElementById('loadProjectProgressFill');
    const statusEl = document.getElementById('loadProjectStatus');
    progressEl.style.display = '';
    fillEl.style.width = '10%';
    statusEl.textContent = 'Leyendo ZIP...';

    try {
        const zip = await JSZip.loadAsync(file);
        fillEl.style.width = '30%';
        statusEl.textContent = 'Cargando datos...';

        // Leer data.js (también si el ZIP tiene una carpeta raíz, ej. "MiProyecto/data.js")
        const dataName = Object.keys(zip.files).filter(n => /(^|\/)data\.js$/i.test(n))
            .sort((a, b) => a.split('/').length - b.split('/').length)[0];
        if (!dataName) { showMessage('ZIP inválido: falta data.js', 4000); closeLoadProjectModal(); return; }
        const prefix = dataName.slice(0, dataName.length - 'data.js'.length);
        const dataText = await zip.file(dataName).async('text');
        const loadedData = parseDataJs(dataText);
        if (!loadedData || !loadedData.scenes) { showMessage('data.js inválido', 4000); closeLoadProjectModal(); return; }

        fillEl.style.width = '40%';
        statusEl.textContent = 'Cargando imágenes...';

        const newData = normalizeProject(loadedData);
        const previousData = projectData;
        projectData = newData;           // storeImage escribe en el assetMap del proyecto nuevo
        projectData.assetMap = {};
        clearBlobs();

        const imageFiles = Object.keys(zip.files)
            .filter(n => n.startsWith(prefix) && /\.(jpg|jpeg|png|webp)$/i.test(n) && !zip.files[n].dir);
        let loaded = 0;
        try {
            for (const imgPath of imageFiles) {
                const rel = imgPath.slice(prefix.length);
                if (!rel.startsWith('project/')) continue;
                const blob = await zip.file(imgPath).async('blob');
                const typed = blob.type ? blob : new Blob([blob], { type: /\.png$/i.test(rel) ? 'image/png' : 'image/jpeg' });
                statusEl.textContent = Cloud.isCloud() ? `Subiendo imágenes ${loaded + 1}/${imageFiles.length}...` : 'Cargando imágenes...';
                const isLevel = rel.startsWith('project/niveles/');
                const finalPath = await storeImage(rel, typed, { keepPng: isLevel });
                if (isLevel && finalPath !== rel) {
                    // el plano se convirtió a JPG: actualizar el nombre en la lista de niveles
                    const oldName = rel.split('/').pop(), newName = finalPath.split('/').pop();
                    projectData.levels = projectData.levels.map(l => l === oldName ? newName : l);
                }
                loaded++;
                fillEl.style.width = `${40 + Math.round((loaded / imageFiles.length) * 50)}%`;
            }
        } catch (e) {
            projectData = previousData;
            throw e;
        }

        fillEl.style.width = '95%';
        statusEl.textContent = 'Inicializando visor...';

        if (Cloud.isCloud()) currentProjectId = Cloud.newProjectId();
        applyProject(projectData, 0);
        saveToLocalStorage();
        if (Cloud.isCloud()) { await Cloud.flushProjectSave(); Cloud.watchProject(currentProjectId, onRemoteProjectChange); }

        dirtySinceExport = false;   // recién cargado: no hay nada nuevo que exportar
        fillEl.style.width = '100%';
        statusEl.textContent = '¡Listo!';

        setTimeout(() => {
            closeLoadProjectModal();
            showMessage(`Proyecto "${projectData.name || 'sin nombre'}" cargado ✓`, 3000);
        }, 400);

    } catch(err) {
        console.error(err);
        showMessage(err && err.code ? uploadErrorText(err) : 'Error al cargar el ZIP', 4000);
        closeLoadProjectModal();
    }
}

// ---- AÑADIR ESCENA ----
let addSceneType = 'cubemap';
let cubemapFiles = {};   // { right: File, left: File, ... }
let equirectFileObj = null;

const FACE_NAMES = ['right','left','up','down','front','back'];

function openAddSceneModal() {
    document.getElementById('addSceneModal').classList.add('open');
    document.getElementById('newSceneName').value = '';
    document.getElementById('addSceneProgress').style.display = 'none';
    cubemapFiles = {};
    equirectFileObj = null;
    document.getElementById('cubemapFileList').innerHTML = '';
    document.getElementById('cubemapMapping').style.display = 'none';
    document.getElementById('equirectPreview').style.display = 'none';
    setAddSceneType('cubemap');
}
function closeAddSceneModal() {
    document.getElementById('addSceneModal').classList.remove('open');
}

function setAddSceneType(type) {
    addSceneType = type;
    document.querySelectorAll('.pm-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    document.getElementById('cubemapZone').style.display   = type === 'cubemap'  ? '' : 'none';
    document.getElementById('equirectZone').style.display  = type === 'equirect' ? '' : 'none';
}

function detectFaceFromFilename(filename) {
    const n = filename.toLowerCase().replace(/\.(jpg|jpeg|png|webp)$/, '');
    if (/right|_r$|_px/.test(n)) return 'right';
    if (/left|_l$|_nx/.test(n))  return 'left';
    if (/up|top|_u$|_py/.test(n)) return 'up';
    if (/down|bottom|_d$|_ny/.test(n)) return 'down';
    if (/front|_f$|_pz/.test(n)) return 'front';
    if (/back|rear|_b$|_nz/.test(n)) return 'back';
    return null;
}

function renderCubemapFileList(files) {
    const listEl = document.getElementById('cubemapFileList');
    const mappingEl = document.getElementById('cubemapMapping');
    const rowsEl = document.getElementById('cubemapMappingRows');
    listEl.innerHTML = '';
    rowsEl.innerHTML = '';

    // Auto-detect faces
    const assigned = {};
    for (const f of files) {
        const face = detectFaceFromFilename(f.name);
        if (face && !assigned[face]) assigned[face] = f;
    }
    // For undetected, assign in order
    let unassigned = files.filter(f => !Object.values(assigned).includes(f));
    for (const face of FACE_NAMES) {
        if (!assigned[face] && unassigned.length) assigned[face] = unassigned.shift();
    }
    cubemapFiles = assigned;

    // Chips
    for (const f of files) {
        const chip = document.createElement('div');
        const face = Object.keys(assigned).find(k => assigned[k] === f);
        chip.className = `pm-file-chip ${face ? 'ok' : 'warn'}`;
        chip.textContent = `${face ? face + ': ' : ''}${f.name}`;
        listEl.appendChild(chip);
    }

    // Mapping selects
    mappingEl.style.display = '';
    for (const face of FACE_NAMES) {
        const row = document.createElement('div');
        row.className = 'pm-mapping-row';
        const label = document.createElement('div');
        label.className = 'pm-mapping-face';
        label.textContent = face;
        const sel = document.createElement('select');
        sel.className = 'pm-mapping-select';
        sel.dataset.face = face;
        const none = document.createElement('option');
        none.value = ''; none.textContent = '— sin asignar —';
        sel.appendChild(none);
        for (const f of files) {
            const opt = document.createElement('option');
            opt.value = f.name; opt.textContent = f.name;
            if (assigned[face] && assigned[face].name === f.name) opt.selected = true;
            sel.appendChild(opt);
        }
        sel.addEventListener('change', () => {
            const f = files.find(x => x.name === sel.value);
            cubemapFiles[face] = f || null;
        });
        row.appendChild(label);
        row.appendChild(sel);
        rowsEl.appendChild(row);
    }
}

function renderEquirectPreview(file) {
    equirectFileObj = file;
    const url = URL.createObjectURL(file);
    const img = document.getElementById('equirectPreviewImg');
    const info = document.getElementById('equirectInfo');
    img.src = url;
    img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        const ok = Math.abs(ratio - 2) < 0.15;
        info.textContent = `${img.naturalWidth} × ${img.naturalHeight}px — proporción ${ratio.toFixed(2)}:1 ${ok ? '✓ correcta' : '⚠ se esperaba 2:1'}`;
        info.style.color = ok ? '#88ffaa' : '#ffcc66';
    };
    document.getElementById('equirectPreview').style.display = '';
}

async function confirmAddScene() {
    const nameInput = document.getElementById('newSceneName').value.trim();
    if (!nameInput) { showMessage('Ingresá un nombre para la escena', 2000); return; }

    if (addSceneType === 'cubemap') {
        const missing = FACE_NAMES.filter(f => !cubemapFiles[f]);
        if (missing.length > 0) { showMessage(`Faltan caras: ${missing.join(', ')}`, 3000); return; }
    } else {
        if (!equirectFileObj) { showMessage('Seleccioná una imagen equirectangular', 2000); return; }
    }

    const progressEl = document.getElementById('addSceneProgress');
    const fillEl = document.getElementById('addSceneProgressFill');
    const statusEl = document.getElementById('addSceneStatus');
    progressEl.style.display = '';
    fillEl.style.width = '10%';

    // Generar ID único
    const existingIds = projectData.scenes.map(s => s.id);
    let n = projectData.scenes.length + 1;
    while (existingIds.includes(`escena${n}`)) n++;
    const sceneId = `escena${n}`;
    const base = `project/${sceneId}/1/`;

    try {
        if (addSceneType === 'cubemap') {
            statusEl.textContent = 'Guardando imágenes...';
            let i = 0;
            for (const face of FACE_NAMES) {
                const file = cubemapFiles[face];
                const ext = file.name.split('.').pop().toLowerCase();
                sceneImageBlobs[`${base}${face}.${ext}`] = file;
                i++;
                fillEl.style.width = `${10 + (i / 6) * 70}%`;
            }
        } else {
            statusEl.textContent = 'Procesando equirectangular...';
            fillEl.style.width = '40%';
            // Convertir equirectangular a cubemap usando Three.js
            const faces = await equirectToCubemap(equirectFileObj, (p) => {
                fillEl.style.width = `${40 + p * 50}%`;
            });
            for (const [face, blob] of Object.entries(faces)) {
                sceneImageBlobs[`${base}${face}.jpg`] = blob;
            }
        }

        fillEl.style.width = '90%';
        statusEl.textContent = 'Añadiendo escena...';

        // Añadir escena a projectData
        const newScene = {
            id: sceneId,
            name: nameInput,
            initialViewParameters: { yaw: 0, pitch: 0, fov: 1.2 },
            planPosition: { x: 0.5, y: 0.5 },
            planOrientation: 0,
            level: 0,
            linkHotspots: [],
            infoHotspots: []
        };
        projectData.scenes.push(newScene);
        window.projectData = projectData;
        saveToLocalStorage();
        populateSceneList();

        fillEl.style.width = '100%';
        statusEl.textContent = '¡Escena añadida!';

        setTimeout(() => {
            closeAddSceneModal();
            // Ir a la nueva escena
            currentSceneIndex = projectData.scenes.length - 1;
            loadScene(currentSceneIndex);
            showMessage(`Escena "${nameInput}" añadida ✓`, 3000);
        }, 400);

    } catch(err) {
        console.error(err);
        showMessage('Error al procesar las imágenes', 4000);
        progressEl.style.display = 'none';
    }
}

// Convierte una equirectangular a las 6 caras del cubemap (CPU, sin WebGL extra).
// Convención: el centro de la imagen queda al frente de la vista inicial (yaw 0)
// y la imagen avanza hacia la derecha al girar a la derecha.
async function equirectToCubemap(file, onProgress) {
    const bmp = await createImageBitmap(file);
    const W = Math.min(bmp.width, 8192), H = Math.min(bmp.height, 4096);
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(bmp, 0, 0, W, H);
    bmp.close && bmp.close();
    const sd = sctx.getImageData(0, 0, W, H).data;
    const size = Math.max(256, Math.min(2048, Math.round(W / 4)));

    // Dirección de muestreo del cubemap (convención OpenGL) para cada cara y píxel
    // a = columna, b = fila, ambos en [-1, 1] (b hacia abajo)
    const faceDir = {
        right: (a, b) => [ 1, -b, -a],
        left:  (a, b) => [-1, -b,  a],
        up:    (a, b) => [ a,  1,  b],
        down:  (a, b) => [ a, -1, -b],
        front: (a, b) => [ a, -b,  1],
        back:  (a, b) => [-a, -b, -1],
    };
    const out = {};
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const names = Object.keys(faceDir);
    for (let fi = 0; fi < names.length; fi++) {
        const name = names[fi];
        const img = ctx.createImageData(size, size);
        const d = img.data;
        const fn = faceDir[name];
        for (let y = 0; y < size; y++) {
            const b = (2 * (y + 0.5) / size) - 1;
            for (let x = 0; x < size; x++) {
                const a = (2 * (x + 0.5) / size) - 1;
                const c = fn(a, b);
                // three.js dibuja los CubeTexture de fondo con X invertido
                const vx = -c[0], vy = c[1], vz = c[2];
                const len = Math.hypot(vx, vy, vz);
                const lon = Math.atan2(vx, -vz);              // 0 = frente (-Z), + = derecha
                const lat = Math.asin(vy / len);
                let u = (lon / (2 * Math.PI) + 0.5) * W - 0.5;
                let v = (0.5 - lat / Math.PI) * H - 0.5;
                // bilinear
                let x0 = Math.floor(u), y0 = Math.floor(v);
                const fx = u - x0, fy = v - y0;
                let x1 = x0 + 1, y1 = y0 + 1;
                x0 = ((x0 % W) + W) % W; x1 = ((x1 % W) + W) % W;
                y0 = Math.max(0, Math.min(H - 1, y0)); y1 = Math.max(0, Math.min(H - 1, y1));
                const i00 = (y0 * W + x0) * 4, i10 = (y0 * W + x1) * 4, i01 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4;
                const o = (y * size + x) * 4;
                for (let k = 0; k < 3; k++) {
                    const top = sd[i00 + k] * (1 - fx) + sd[i10 + k] * fx;
                    const bot = sd[i01 + k] * (1 - fx) + sd[i11 + k] * fx;
                    d[o + k] = top * (1 - fy) + bot * fy;
                }
                d[o + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        out[name] = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
        if (onProgress) onProgress((fi + 1) / names.length);
        await new Promise(r => setTimeout(r, 0)); // no congelar la interfaz
    }
    return out;
}
window.equirectToCubemap = equirectToCubemap;

// ==========================================
// BLOQUE 9: ESFERA ALÁMBRICA (WIREFRAME)
// ==========================================
function createWireframeSphere() {
    const group = new THREE.Group();
    const matNormal  = new THREE.LineBasicMaterial({ color: WF.colorNormal,  transparent: true, opacity: WF.opacityNormal,  depthWrite: false });
    const matEquator = new THREE.LineBasicMaterial({ color: WF.colorEquator, transparent: true, opacity: WF.opacityEquator, depthWrite: false });

    const meridianCount = Math.round(360 / WF.meridianStep);
    for (let i = 0; i < meridianCount; i++) {
        const theta = (i / meridianCount) * Math.PI * 2;
        const pts = [];
        for (let lat = -88; lat <= 88; lat += 2) {
            const phi = (90 - lat) * Math.PI / 180;
            pts.push(new THREE.Vector3(
                WF.radius * Math.sin(phi) * Math.cos(theta) + WF.position.x,
                WF.radius * Math.cos(phi) + WF.position.y,
                WF.radius * Math.sin(phi) * Math.sin(theta) + WF.position.z
            ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        group.add(new THREE.Line(geo, matNormal));
    }

    WF.parallelLats.forEach(lat => {
        const isEquator = lat === 0;
        const phi = (90 - lat) * Math.PI / 180;
        const r   = WF.radius * Math.sin(phi);
        const y   = WF.radius * Math.cos(phi);
        const pts = [];
        const segments = 128;
        for (let i = 0; i <= segments; i++) {
            const t = (i / segments) * Math.PI * 2;
            pts.push(new THREE.Vector3(
                r * Math.cos(t) + WF.position.x,
                y + WF.position.y,
                r * Math.sin(t) + WF.position.z
            ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        group.add(new THREE.LineLoop(geo, isEquator ? matEquator : matNormal));
    });
    return group;
}

function createWireframeLabels() {
    if (wireframeLabelsEl) { wireframeLabelsEl.remove(); wireframeLabelsEl = null; }
    const container = document.createElement('div');
    container.id = 'wf-labels';
    container.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:11;';
    const meridianCount = Math.round(360 / WF.meridianStep);
    for (let i = 0; i < meridianCount; i++) {
        const yawDeg = i * WF.meridianStep;
        const yawRad = yawDeg * Math.PI / 180;
        const baseX = Math.sin(yawRad) * WF.radius;
        const baseZ = Math.cos(yawRad) * WF.radius;
        const px = baseX + WF.position.x;
        const py = WF.position.y;
        const pz = baseZ + WF.position.z;
        const el = document.createElement('div');
        el.className = 'wf-label wf-label-yaw';
        el.textContent = yawDeg + '°';
        el.dataset.wx = px; el.dataset.wy = py; el.dataset.wz = pz;
        container.appendChild(el);
    }
    WF.parallelLats.forEach(lat => {
        if (lat === 0) return;
        const phi = (90 - lat) * Math.PI / 180;
        const baseX = Math.sin(phi) * WF.radius;
        const baseY = Math.cos(phi) * WF.radius;
        const px = baseX + WF.position.x;
        const py = baseY + WF.position.y;
        const pz = WF.position.z;
        const el = document.createElement('div');
        el.className = 'wf-label wf-label-pitch';
        el.textContent = (lat > 0 ? '+' : '') + lat + '°';
        el.dataset.wx = px; el.dataset.wy = py; el.dataset.wz = pz;
        container.appendChild(el);
    });
    document.body.appendChild(container);
    wireframeLabelsEl = container;
}

function updateWireframeLabels() {
    if (!wireframeLabelsEl || !wireframeVisible) return;
    const labels = wireframeLabelsEl.querySelectorAll('.wf-label');
    labels.forEach(el => {
        const worldPos = new THREE.Vector3(parseFloat(el.dataset.wx), parseFloat(el.dataset.wy), parseFloat(el.dataset.wz));
        const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        if (camDir.dot(worldPos) <= 0.1) {
            el.style.visibility = 'hidden';
            return;
        }
        const proj = worldPos.clone().project(camera);
        el.style.visibility = 'visible';
        el.style.left = ((proj.x + 1) / 2) * window.innerWidth + 'px';
        el.style.top  = ((-proj.y + 1) / 2) * window.innerHeight + 'px';
    });
}

function removeWireframeLabels() {
    if (wireframeLabelsEl) { wireframeLabelsEl.remove(); wireframeLabelsEl = null; }
}

function createWireframeTooltip() {
    if (wireframeTooltipEl) return;
    const el = document.createElement('div');
    el.id = 'wf-tooltip';
    el.style.cssText = 'display:none;';
    document.body.appendChild(el);
    wireframeTooltipEl = el;

    const getYawPitchFromScreen = (x, y) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(((x - rect.left)/rect.width)*2-1, -((y - rect.top)/rect.height)*2+1);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(ndc, camera);
        const sphereCenter = new THREE.Vector3(WF.position.x, WF.position.y, WF.position.z);
        const sphere = new THREE.Sphere(sphereCenter, WF.radius);
        const hitPoint = new THREE.Vector3();
        if (raycaster.ray.intersectSphere(sphere, hitPoint)) {
            const dx = hitPoint.x - sphereCenter.x;
            const dy = hitPoint.y - sphereCenter.y;
            const dz = hitPoint.z - sphereCenter.z;
            let yaw = Math.atan2(dx, dz);
            let pitch = Math.asin(Math.max(-1, Math.min(1, dy / WF.radius)));
            return { yaw, pitch };
        }
        return null;
    };

    wireframeMouseHandler = (e) => {
        if (!wireframeVisible) return;
        const coords = getYawPitchFromScreen(e.clientX, e.clientY);
        if (!coords) { el.style.display = 'none'; return; }
        const yawDeg   = (coords.yaw * 180 / Math.PI + 360) % 360;
        const pitchDeg = coords.pitch * 180 / Math.PI;
        el.textContent = `yaw ${yawDeg.toFixed(1)}°  pitch ${pitchDeg.toFixed(1)}°`;
        el.style.display = 'block';
        el.style.left = (e.clientX + 14) + 'px';
        el.style.top  = (e.clientY - 10) + 'px';
    };
    renderer.domElement.addEventListener('mousemove', wireframeMouseHandler);
}

function removeWireframeTooltip() {
    if (wireframeTooltipEl) { wireframeTooltipEl.remove(); wireframeTooltipEl = null; }
    if (wireframeMouseHandler) {
        renderer.domElement.removeEventListener('mousemove', wireframeMouseHandler);
        wireframeMouseHandler = null;
    }
}

function toggleWireframe() {
    if (!wireframeGroup) {
        wireframeGroup = createWireframeSphere();
        scene.add(wireframeGroup);
        wireframeVisible = true;
        wireframeToggle.classList.add('enabled');
        createWireframeLabels();
        createWireframeTooltip();
        showMessage('Cuadrícula activa — mueve el cursor para ver yaw/pitch', 3000);
    } else {
        wireframeGroup.visible = !wireframeGroup.visible;
        wireframeVisible = wireframeGroup.visible;
        if (wireframeVisible) {
            wireframeToggle.classList.add('enabled');
            createWireframeLabels();
            createWireframeTooltip();
            showMessage('Cuadrícula visible', 1000);
        } else {
            wireframeToggle.classList.remove('enabled');
            removeWireframeLabels();
            removeWireframeTooltip();
            showMessage('Cuadrícula oculta', 1000);
        }
    }
}

// ==========================================
// BLOQUE 10: PANEL DESTINO Y MODAL INFO
// ==========================================
function initDestinationPanel() {
    const panel = document.createElement('div');
    panel.id = 'destinationPanel';
    panel.innerHTML = `<div class="dp-header"><span class="dp-title">Ir a la escena…</span><button class="dp-cancel" title="Cancelar">✕</button></div><ul class="dp-list"></ul>`;
    document.body.appendChild(panel);
    panel.querySelector('.dp-cancel').addEventListener('click', () => {
        if (panel) panel.classList.remove('open');
    });
}

function initInfoModal() {
    infoModalClose.addEventListener('click', () => infoModal.style.display = 'none');
    window.addEventListener('click', (e) => { if (e.target === infoModal) infoModal.style.display = 'none'; });
}

// ==========================================
// BLOQUE 11: CONFIGURACIÓN GLOBAL Y ANIMACIÓN
// ==========================================
function applyGlobalSettings() {
    const s = projectData.settings || {};
    if (fullscreenToggle) fullscreenToggle.style.display = s.fullscreenButton !== false ? 'flex' : 'none';
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    if (window.updateHotspotPositions) window.updateHotspotPositions();
    updateDirectrices();
    updateWireframeLabels();
}

// ==========================================
// SISTEMA DE COMENTARIOS DE ESCENA
// ==========================================

function getSceneComment(sceneIdx) {
    return projectData.scenes[sceneIdx]?.comment || '';
}

function setSceneComment(sceneIdx, text) {
    if (projectData.scenes[sceneIdx]) {
        projectData.scenes[sceneIdx].comment = text;
        saveToLocalStorage();
    }
}

function updateCommentDisplay(sceneIdx) {
    const panel = document.getElementById('commentDisplayPanel');
    const textEl = document.getElementById('commentDisplayText');
    const sceneEl = document.getElementById('commentDisplayScene');
    if (!panel || !textEl) return;

    const comment = getSceneComment(sceneIdx);
    if (comment && comment.trim()) {
        sceneEl.textContent = projectData.scenes[sceneIdx]?.name || '';
        textEl.textContent = comment;
        panel.classList.add('visible');
    } else {
        panel.classList.remove('visible');
    }
}

function openCommentEdit(sceneIdx) {
    const panel = document.getElementById('commentEditPanel');
    const textarea = document.getElementById('commentTextarea');
    const title = document.getElementById('commentEditTitle');
    if (!panel || !textarea) return;

    title.textContent = projectData.scenes[sceneIdx]?.name || 'Comentario de escena';
    textarea.value = getSceneComment(sceneIdx);
    panel.classList.add('enabled');
    setTimeout(() => textarea.focus(), 100);
}

function initCommentSystem() {
    const addBtn   = document.getElementById('addCommentBtn');
    const editPanel = document.getElementById('commentEditPanel');
    const closeBtn = document.getElementById('commentEditClose');
    const saveBtn  = document.getElementById('commentSaveBtn');
    const clearBtn = document.getElementById('commentClearBtn');
    const dispClose = document.getElementById('commentDisplayClose');

    addBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = editPanel?.classList.contains('enabled');
        document.getElementById('infoStylePanel')?.classList.remove('enabled');
        if (!isOpen) openCommentEdit(currentSceneIndex);
        else editPanel.classList.remove('enabled');
    });

    closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        editPanel.classList.remove('enabled');
    });

    saveBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = document.getElementById('commentTextarea').value.trim();
        setSceneComment(currentSceneIndex, text);
        editPanel.classList.remove('enabled');
        updateCommentDisplay(currentSceneIndex);
        showMessage('Comentario guardado ✓', 2000);
    });

    clearBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('commentTextarea').value = '';
        setSceneComment(currentSceneIndex, '');
        editPanel.classList.remove('enabled');
        updateCommentDisplay(currentSceneIndex);
        showMessage('Comentario eliminado', 1500);
    });

    dispClose?.addEventListener('click', () => {
        document.getElementById('commentDisplayPanel').classList.remove('visible');
    });
}

// ==========================================
// BLOQUE 12: PROYECTOS (aplicar, nube, cambios remotos)
// ==========================================
function parseDataJs(text) {
    const m = text.match(/APP_DATA\s*=\s*([\s\S]*?);?\s*$/);
    if (m) { try { return JSON.parse(m[1].trim().replace(/;$/, '')); } catch (e) {} }
    // data.js escrito a mano (no es JSON estricto). Solo en modo local:
    // en la nube no se ejecuta código que venga dentro de un archivo.
    if (Cloud.isCloud()) return null;
    try { return new Function(text + '; return APP_DATA;')(); } catch (e) { return null; }
}

// Reemplaza el proyecto abierto y redibuja todo el Studio
function applyProject(data, sceneIdx = 0) {
    projectData = normalizeProject(data);
    window.projectData = projectData;
    setBlueprintProjectData(projectData);
    currentSceneIndex = Math.min(sceneIdx, Math.max(0, projectData.scenes.length - 1));
    populateSceneList();
    applyGlobalSettings();
    projectNameEl.textContent = projectData.name || 'Proyecto sin nombre';
    if (!projectData.scenes.length && scene.background) {
        if (scene.background.isTexture) scene.background.dispose();
        scene.background = null;
    }
    renderHotspots();
    loadScene(currentSceneIndex);
    syncSettingsPanel();
}

// Otro integrante guardó cambios en el mismo proyecto
let lastLocalEdit = 0;
function onRemoteProjectChange(data, byUid) {
    if (Date.now() - lastLocalEdit < 4000 || transitioning) return; // no pisar lo que estás editando
    const sceneId = projectData.scenes[currentSceneIndex]?.id;
    const sameScene = data.scenes?.findIndex(s => s.id === sceneId);
    projectData = normalizeProject(data);
    window.projectData = projectData;
    setBlueprintProjectData(projectData);
    if (sameScene >= 0) currentSceneIndex = sameScene;
    populateSceneList();
    projectNameEl.textContent = projectData.name || 'Proyecto sin nombre';
    renderHotspots();
    updateDirectrices();
    updateCommentDisplay(currentSceneIndex);
    if (projectData.scenes[currentSceneIndex]) updateBlueprintFromScene(projectData.scenes[currentSceneIndex]);
    Cloud.getProfileName(byUid).then(n => showMessage(`${n || 'Otro integrante'} actualizó el proyecto`, 2500));
}

async function openCloudProject(pid) {
    showMessage('Abriendo proyecto...', 0);
    const data = await Cloud.loadProject(pid);
    if (!data) { showMessage('No se encontró el proyecto', 3000); return false; }
    clearBlobs();
    currentProjectId = pid;
    Cloud.markSaved(data);
    store.set('mjv_lastProject', pid);
    applyProject(data, 0);
    Cloud.watchProject(pid, onRemoteProjectChange);
    showMessage(`Proyecto "${data.name || 'sin nombre'}" abierto`, 2000);
    return true;
}

async function createCloudProject(name) {
    clearBlobs();
    currentProjectId = Cloud.newProjectId();
    applyProject({ name: name || 'Proyecto nuevo', scenes: [], levels: [] }, 0);
    saveToLocalStorage();
    await Cloud.flushProjectSave();
    Cloud.watchProject(currentProjectId, onRemoteProjectChange);
}

// ---------- Modal de proyectos en la nube ----------
function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}
async function renderProjectList() {
    const list = document.getElementById('cloudProjectList');
    if (!list) return;
    list.innerHTML = '<p class="pm-hint" style="text-align:center">Cargando proyectos...</p>';
    let items = [];
    try { items = await Cloud.listProjects(); } catch (e) { list.innerHTML = '<p class="pm-hint">No se pudo leer la lista</p>'; return; }
    if (!items.length) { list.innerHTML = '<p class="pm-hint" style="text-align:center">Todavía no hay proyectos guardados.</p>'; return; }
    const names = {};
    try {
        const ids = [...new Set(items.map(i => i.updatedBy).filter(Boolean))];
        await Promise.all(ids.map(async id => { names[id] = await Cloud.getProfileName(id); }));
    } catch (e) {}
    list.innerHTML = '';
    items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'cloud-project-row' + (it.pid === currentProjectId ? ' current' : '');
        const info = document.createElement('div');
        info.className = 'cloud-project-info';
        const t = document.createElement('div'); t.className = 'cloud-project-name'; t.textContent = it.name || 'Sin nombre';
        const m = document.createElement('div'); m.className = 'cloud-project-meta';
        m.textContent = `${it.scenes} escena${it.scenes !== 1 ? 's' : ''} · ${fmtDate(it.updatedAt)}${names[it.updatedBy] ? ' · ' + names[it.updatedBy] : ''}`;
        info.append(t, m);
        row.appendChild(info);
        if (!readOnly && Cloud.getMe()?.canEdit) {
            const del = document.createElement('div');
            del.className = 'cloud-project-del'; del.textContent = '×'; del.title = 'Eliminar proyecto';
            del.addEventListener('click', async (e) => {
                e.stopPropagation();
                const yes = await uiAsk({ title: 'Eliminar proyecto', text: `Se elimina "${it.name}" para todo el equipo. No se puede deshacer.`, okLabel: 'Eliminar', danger: true });
                if (!yes) return;
                await Cloud.deleteProject(it.pid);
                renderProjectList();
            });
            row.appendChild(del);
        }
        row.addEventListener('click', async () => {
            if (await openCloudProject(it.pid)) closeLoadProjectModal();
        });
        list.appendChild(row);
    });
}

// ---------- Panel de accesos (solo dueño / editores) ----------
async function openAccessPanel() {
    const modal = document.getElementById('accessModal');
    const body = document.getElementById('accessList');
    modal.classList.add('open');
    body.innerHTML = '<p class="pm-hint" style="text-align:center">Cargando...</p>';
    let rows = [];
    try { rows = await Cloud.listAccess(); } catch (e) {}
    if (!rows.length) { body.innerHTML = '<p class="pm-hint" style="text-align:center">Sin registros todavía.</p>'; return; }
    body.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'access-table';
    table.innerHTML = '<thead><tr><th>Integrante</th><th>Último ingreso</th><th>Ingresos</th></tr></thead>';
    const tb = document.createElement('tbody');
    rows.forEach(r => {
        const tr = document.createElement('tr');
        const c1 = document.createElement('td');
        const nm = document.createElement('div'); nm.textContent = r.name + (r.isMe ? ' (vos)' : '');
        const em = document.createElement('div'); em.className = 'access-email'; em.textContent = r.email || '';
        c1.append(nm, em);
        const c2 = document.createElement('td'); c2.textContent = fmtDate(r.last);
        const c3 = document.createElement('td'); c3.textContent = r.count || 1;
        c3.title = (r.history || []).slice(-10).reverse().map(fmtDate).join('\n');
        tr.append(c1, c2, c3);
        tb.appendChild(tr);
    });
    table.appendChild(tb);
    body.appendChild(table);
}

// ---------- Panel de ajustes del recorrido (transiciones) ----------
function syncSettingsPanel() {
    const s = projectData?.settings || {};
    const t = document.getElementById('setTransition');
    const d = document.getElementById('setTransitionMs');
    const dv = document.getElementById('setTransitionMsVal');
    if (t) t.value = s.transition || 'zoom';
    if (d) d.value = s.transitionMs || 900;
    if (dv) dv.textContent = `${((s.transitionMs || 900) / 1000).toFixed(1)} s`;
}
function initSettingsPanel() {
    const btn = document.getElementById('settingsBtn');
    const panel = document.getElementById('settingsPanel');
    btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('enabled');
        btn.classList.toggle('enabled', panel.classList.contains('enabled'));
        syncSettingsPanel();
    });
    document.getElementById('settingsPanelClose')?.addEventListener('click', () => {
        panel.classList.remove('enabled'); btn?.classList.remove('enabled');
    });
    document.getElementById('setTransition')?.addEventListener('change', (e) => {
        projectData.settings.transition = e.target.value;
        saveToLocalStorage();
    });
    document.getElementById('setTransitionMs')?.addEventListener('input', (e) => {
        projectData.settings.transitionMs = parseInt(e.target.value, 10);
        document.getElementById('setTransitionMsVal').textContent = `${(projectData.settings.transitionMs / 1000).toFixed(1)} s`;
        saveToLocalStorage();
    });
    document.getElementById('setTransitionPreview')?.addEventListener('click', () => {
        const n = projectData.scenes.length;
        if (n < 2) { showMessage('Necesitás al menos 2 escenas', 2000); return; }
        navigateToScene((currentSceneIndex + 1) % n, { yaw: cameraYaw + Math.PI, pitch: 0 });
    });
    document.getElementById('presentationBtn')?.addEventListener('click', () => setPresentation(true));
}

// Modo presentación: oculta todas las herramientas de edición
function setPresentation(on) {
    document.body.classList.toggle('presentation', on);
    if (on) {
        closeAllPanels();
        document.getElementById('settingsPanel')?.classList.remove('enabled');
        showMessage('Modo presentación · tecla Esc o botón ✎ para volver a editar', 3000);
    }
}

// Usuario sin permiso de escritura: el Studio funciona como visor
function setReadOnly(on) {
    readOnly = on;
    document.body.classList.toggle('readonly', on);
}

// ==========================================
// BLOQUE 13: INICIALIZACIÓN PRINCIPAL
// ==========================================
async function init() {
    const cloud = await Cloud.initCloud();
    const params = new URLSearchParams(location.search);

    if (cloud) {
        document.body.classList.add('cloud');
        if (!cloud.canWrite) setReadOnly(true);
        projectData = normalizeProject({ name: 'MJV Studio', scenes: [], levels: [] });
    } else {
        if (!window.APP_DATA) { showMessage('Error: data.js no encontrado.', 10000); return; }
        window.ORIGINAL_APP_DATA = JSON.parse(JSON.stringify(window.APP_DATA));
        // En la web las imágenes viven solo en memoria: no se restaura un proyecto viejo
        // sin sus imágenes; se trabaja cargando la carpeta o el ZIP exportado.
        if (window.STUDIO_WEB || !loadFromLocalStorage()) projectData = JSON.parse(JSON.stringify(window.APP_DATA));
        normalizeProject(projectData);
    }
    window.projectData = projectData;

    initThree();
    initDestinationPanel();
    initInfoModal();
    populateSceneList();
    applyGlobalSettings();

    initBlueprint(projectData, currentSceneIndex, camera, () => { lastLocalEdit = Date.now(); saveToLocalStorage(); }, showMessage);

    window.updateBlueprintFromScene = updateBlueprintFromScene;
    window.preloadBlueprintImage = preloadBlueprintImage;
    window.updateBlueprintDotPosition = (await import('./blueprint.js')).updateBlueprintDotPosition;

    window.getCurrentSceneIndex = () => currentSceneIndex;
    window.saveToLocalStorage = () => { lastLocalEdit = Date.now(); saveToLocalStorage(); };
    window.isReadOnly = () => readOnly;
    window.showMessage = showMessage;
    window.WF = WF;

    initHotspotEditor();
    initAddScenesModal();
    initCommentSystem();
    initReplaceSceneModal();
    initSettingsPanel();

    if (cloud) {
        Cloud.onSaveStatus((st, msg) => {
            const el = document.getElementById('saveStatus');
            if (!el) return;
            el.dataset.state = st;
            el.textContent = st === 'saving' ? 'Guardando…' : st === 'pending' ? 'Cambios sin guardar' : st === 'saved' ? 'Guardado en la nube ✓' : (msg || 'Error al guardar');
            if (st === 'error') showMessage(msg || 'Error al guardar', 4000);
        });
        window.addEventListener('beforeunload', () => Cloud.flushProjectSave());
        Cloud.logAccess();
        const me = Cloud.getMe();
        const userBadge = document.getElementById('userBadge');
        if (userBadge && me) {
            userBadge.textContent = (me.name || 'Usuario') + (readOnly ? ' · solo lectura' : '');
            userBadge.style.display = '';
        }
        if (me && (me.isOwner || me.canEdit)) {
            const ab = document.getElementById('accessBtn');
            if (ab) { ab.style.display = ''; ab.addEventListener('click', openAccessPanel); }
        }
        // Abrir el último proyecto usado (o el más reciente)
        let opened = false;
        const wanted = params.get('p') || store.get('mjv_lastProject');
        try {
            if (wanted) opened = await openCloudProject(wanted);
            if (!opened) {
                const list = await Cloud.listProjects();
                if (list.length) opened = await openCloudProject(list[0].pid);
            }
        } catch (e) { console.warn(e); }
        if (!opened) {
            if (readOnly) loadScene(0);
            else await createCloudProject('Proyecto nuevo');
        }
    } else {
        setBlueprintProjectData(projectData);
        loadScene(0);
    }
    if (params.get('view') === '1') setPresentation(true);
    
    window.getHotspotWorldPos = (yawRad, pitchRad) => {
        const baseX = Math.sin(yawRad) * Math.cos(pitchRad) * WF.radius;
        const baseY = Math.sin(pitchRad) * WF.radius;
        const baseZ = Math.cos(yawRad) * Math.cos(pitchRad) * WF.radius;
        return new THREE.Vector3(baseX + WF.position.x, baseY + WF.position.y, baseZ + WF.position.z);
    };
    window.getScreenCoordsFromWorldPos = (worldPos) => {
        const proj = worldPos.clone().project(camera);
        const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        if (cameraDir.dot(worldPos) <= 0) return null;
        return { left: ((proj.x + 1) / 2) * window.innerWidth, top: ((-proj.y + 1) / 2) * window.innerHeight };
    };
    window.updateHotspotPositions = updateHotspotPositions;
    
    window.showThumbnailForScene = (sceneId, targetElement) => {
        if (window._currentThumbnailHover) window._currentThumbnailHover.remove();
        const thumbDiv = document.createElement('div');
        thumbDiv.className = 'scene-thumbnail-hover';
        const img = document.createElement('img');
        const base = `project/${sceneId}/1/front.`;
        const exts = ['jpg', 'png', 'jpeg', 'webp'];
        const known = exts.find(e => hasImage(base + e));
        if (known) img.src = resolveUrl(base + known);
        else {
            const tryNext = (i) => { if (i >= exts.length) return; img.onerror = () => tryNext(i + 1); img.src = base + exts[i]; };
            tryNext(0);
        }
        thumbDiv.appendChild(img);
        document.body.appendChild(thumbDiv);
        window._currentThumbnailHover = thumbDiv;
        const rect = targetElement.getBoundingClientRect();
        thumbDiv.style.right = 'auto';
        thumbDiv.style.left = `${Math.max(8, rect.left - 170)}px`;
        thumbDiv.style.top = `${Math.min(rect.top + rect.height / 2, window.innerHeight - 110)}px`;
    };
    window.hideThumbnail = () => {
        if (window._currentThumbnailHover) {
            window._currentThumbnailHover.remove();
            window._currentThumbnailHover = null;
        }
    };
    
    saveChangesBtn?.addEventListener('click', handleSaveChanges);
    infoGeneralBtn?.addEventListener('click', toggleInfoText);
    addLinkBtn?.addEventListener('click', () => { if (!readOnly) createTempLinkHotspot(); });
    addInfoBtn?.addEventListener('click', () => { if (!readOnly) onAddInfoClick(); });
    wireframeToggle?.addEventListener('click', toggleWireframe);
    sceneListToggle.addEventListener('click', toggleSceneList);

    // Nuevo proyecto
    document.getElementById('newProjectBtn')?.addEventListener('click', async () => {
        if (readOnly) return;
        if (Cloud.isCloud()) {
            const name = await uiAsk({ title: 'Proyecto nuevo', text: 'Nombre del proyecto:', input: 'Proyecto nuevo', okLabel: 'Crear' });
            if (name === null) return;
            await Cloud.flushProjectSave();
            await createCloudProject(name.trim() || 'Proyecto nuevo');
            showMessage('Proyecto creado · añadí escenas desde la lista', 3000);
            return;
        }
        if (await uiAsk({ title: 'Proyecto nuevo', text: 'Se perderán los cambios no exportados del proyecto actual.', okLabel: 'Crear', danger: true })) {
            clearBlobs();
            applyProject(JSON.parse(JSON.stringify(window.ORIGINAL_APP_DATA)), 0);
            saveToLocalStorage();
            showMessage('Nuevo proyecto creado', 2000);
        }
    });

    // Cargar proyecto (nube) / ZIP
    document.getElementById('loadProjectBtn')?.addEventListener('click', () => {
        openLoadProjectModal();
        if (Cloud.isCloud()) renderProjectList();
    });
    document.getElementById('loadProjectModalClose')?.addEventListener('click', closeLoadProjectModal);
    document.getElementById('loadProjectModal')?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('loadProjectModal')) closeLoadProjectModal();
    });
    document.getElementById('accessModalClose')?.addEventListener('click', () => document.getElementById('accessModal').classList.remove('open'));
    document.getElementById('accessModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'accessModal') e.target.classList.remove('open');
    });
    const loadDropZone = document.getElementById('loadDropZone');
    const loadFileInput = document.getElementById('loadProjectFile');
    loadDropZone?.addEventListener('click', () => loadFileInput.click());
    loadFileInput?.addEventListener('change', (e) => { if (e.target.files[0]) loadProjectFromZip(e.target.files[0]); e.target.value = ''; });
    loadDropZone?.addEventListener('dragover', (e) => { e.preventDefault(); loadDropZone.classList.add('drag-over'); });
    loadDropZone?.addEventListener('dragleave', () => loadDropZone.classList.remove('drag-over'));
    loadDropZone?.addEventListener('drop', (e) => {
        e.preventDefault(); loadDropZone.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f && f.name.toLowerCase().endsWith('.zip')) loadProjectFromZip(f);
        else showMessage('Seleccioná un archivo .zip', 2000);
    });

    blueprintToggle = document.getElementById('blueprintToggle');
    blueprintContainer = document.getElementById('blueprintContainer');
    blueprintConfigToggle = document.getElementById('blueprintConfigToggle');
    blueprintControls = document.getElementById('blueprintControls');
    blueprintEyeBtn = document.getElementById('blueprintEyeBtn');
    blueprintAreaBtn = document.getElementById('blueprintAreaBtn');
    
    if (blueprintToggle) blueprintToggle.addEventListener('click', toggleBlueprint);
    
    fullscreenToggle.addEventListener('click', () => {
        if (typeof screenfull !== 'undefined' && screenfull.isEnabled) screenfull.toggle();
        else if (document.documentElement.requestFullscreen) {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
            else document.exitFullscreen();
        }
    });
    if (typeof screenfull !== 'undefined' && screenfull.isEnabled) {
        screenfull.on('change', () => fullscreenToggle.classList.toggle('enabled', screenfull.isFullscreen));
    }
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.body.classList.contains('presentation')) setPresentation(false);
    });
    document.getElementById('exitPresentationBtn')?.addEventListener('click', () => setPresentation(false));
    
    projectNameEl.addEventListener('click', editProjectName);
    sceneNameDisplay.addEventListener('click', editCurrentSceneName);
    
    animate();
}

function applyInitialView(sceneData) {
    const params = sceneData.initialViewParameters || { yaw: 0, pitch: 0, fov: 1.2 };
    cameraYaw = params.yaw || 0;
    cameraPitch = params.pitch || 0;
    camera.fov = Math.max(FOV_MIN, Math.min(FOV_MAX, (params.fov || 1.2) * 50));
    camera.updateProjectionMatrix();
    updateCameraRotation();
}

function loadInfoText(sceneId) {
    if (Cloud.isCloud()) { infoTextContent.textContent = 'No hay información adicional para esta escena.'; return; }
    fetch(`project/${sceneId}/info.txt`)
        .then(res => res.ok ? res.text() : null)
        .then(text => {
            if (text) infoTextContent.textContent = text;
            else infoTextContent.textContent = 'No hay información adicional para esta escena.';
        })
        .catch(() => { infoTextContent.textContent = 'No se pudo cargar la información.'; });
}

init();

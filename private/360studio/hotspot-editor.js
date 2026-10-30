// ==========================================
// HOTSPOT EDITOR - LÓGICA COMPLETA DE HOTSPOTS
// ==========================================

import * as THREE from 'three';

// ==========================================
// BLOQUE 1: VARIABLES INTERNAS DEL MÓDULO
// ==========================================
let tempHotspot = null;           // { element, yaw, pitch, id, targetIndex }
let dragActive = false;
let draggedHotspotId = null;
let currentThumbnailHover = null; // para miniaturas flotantes
let animationFrameId = null;      // para el bucle del hotspot temporal

// ==========================================
// BLOQUE 2: FUNCIONES AUXILIARES (compartidas con script.js)
// ==========================================
function showMessage(msg, duration = 2000) {
    if (window.showMessage) window.showMessage(msg, duration);
}

function saveToLocalStorage() {
    if (window.saveToLocalStorage) window.saveToLocalStorage();
}

function getProjectData() {
    return window.projectData;
}

function getCurrentSceneIndex() {
    return window.getCurrentSceneIndex ? window.getCurrentSceneIndex() : 0;
}

function getCamera() {
    return window.camera;
}

function getRenderer() {
    return window.renderer;
}

function getWF() {
    return window.WF || { radius: 1.0, position: { x: 0, y: 0, z: 0 } };
}

const isRO = () => !!(window.isReadOnly && window.isReadOnly()) || document.body.classList.contains('presentation');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ==========================================
// BLOQUE 3: CONVERSIÓN DE COORDENADAS (MUNDO -> PANTALLA)
// ==========================================
function getHotspotWorldPos(yawRad, pitchRad) {
    const wf = getWF();
    const radius = wf.radius;
    const center = wf.position;
    const baseX = Math.sin(yawRad) * Math.cos(pitchRad) * radius;
    const baseY = Math.sin(pitchRad) * radius;
    const baseZ = Math.cos(yawRad) * Math.cos(pitchRad) * radius;
    return new THREE.Vector3(
        baseX + center.x,
        baseY + center.y,
        baseZ + center.z
    );
}

function getScreenCoordsFromWorldPos(worldPos) {
    const camera = getCamera();
    if (!camera) return null;
    const proj = worldPos.clone().project(camera);
    const cameraDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (cameraDir.dot(worldPos) <= 0) return null;
    return {
        left: ((proj.x + 1) / 2) * window.innerWidth,
        top: ((-proj.y + 1) / 2) * window.innerHeight
    };
}

// ==========================================
// BLOQUE 4: MINIATURA FLOTANTE PARA HOVER SOBRE ESCENAS
// ==========================================
function showThumbnailForScene(sceneId, mouseX, mouseY) {
    hideThumbnail();
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'scene-thumbnail-hover';
    const img = document.createElement('img');
    const tryExts = ['jpg', 'png', 'jpeg', 'webp'];
    const resolve = window.resolveUrl || (p => p);
    const tryNext = (i) => { if (i >= tryExts.length) return; img.onerror = () => tryNext(i + 1); img.src = resolve(`project/${sceneId}/1/front.${tryExts[i]}`); };
    tryNext(0);
    img.alt = `Vista previa de ${sceneId}`;
    thumbDiv.appendChild(img);
    document.body.appendChild(thumbDiv);
    currentThumbnailHover = thumbDiv;
    moveThumbnail(mouseX, mouseY);
}

function moveThumbnail(mouseX, mouseY) {
    if (!currentThumbnailHover) return;
    currentThumbnailHover.style.left = (mouseX + 24) + 'px';
    currentThumbnailHover.style.top = (mouseY - 70) + 'px';
}

function hideThumbnail() {
    if (currentThumbnailHover) {
        currentThumbnailHover.remove();
        currentThumbnailHover = null;
    }
}

function addThumbnailEventsToPicker(picker) {
    const items = picker.querySelectorAll('.hsp-item[data-index]');
    items.forEach(item => {
        const sceneIndex = parseInt(item.dataset.index);
        const scene = getProjectData().scenes[sceneIndex];
        if (!scene) return;
        const sceneId = scene.id;

        item.addEventListener('mouseenter', (e) => {
            showThumbnailForScene(sceneId, e.clientX, e.clientY);
        });
        item.addEventListener('mousemove', (e) => {
            moveThumbnail(e.clientX, e.clientY);
        });
        item.addEventListener('mouseleave', () => {
            hideThumbnail();
        });
        item.addEventListener('click', () => {
            hideThumbnail();
        });
    });
    picker.addEventListener('mouseleave', () => {
        hideThumbnail();
    });
}

// ==========================================
// BLOQUE 5: RENDERIZADO DE HOTSPOTS (PERMANENTES)
// ==========================================
export function renderHotspots() {
    document.querySelectorAll('.hs-wrap:not(.temp-hotspot)').forEach(el => el.remove());

    const projectData = getProjectData();
    const sceneIdx = getCurrentSceneIndex();
    const sd = projectData.scenes[sceneIdx];
    if (!sd) return;

    // LINK HOTSPOTS
    (sd.linkHotspots || []).forEach(hs => {
        const destScene = projectData.scenes[hs.targetIndex];
        const destName = destScene ? (destScene.name || destScene.id) : '?';
        const wrap = createHotspotElement(hs, 'link', destName, false);
        document.body.appendChild(wrap);
    });

    // INFO HOTSPOTS → renderizados solo como directrices SVG, no como íconos
    updateHotspotPositions();
}

// ==========================================
// CREACIÓN VISUAL HOTSPOT
// ==========================================
function createHotspotElement(hs, type, label, isTemporary = false) {
    const wrap = document.createElement('div');
    wrap.className = 'hs-wrap';
    if (isTemporary) wrap.classList.add('temp-hotspot');
    wrap.setAttribute('data-id', hs.id);

    wrap.style.position = 'absolute';
    wrap.style.width = '32px';
    wrap.style.height = '32px';
    wrap.style.pointerEvents = 'auto';
    wrap.style.cursor = 'grab';
    wrap.style.display = 'block';

    const icon = type === 'link' ? 'link.png' : 'info.png';
    wrap.innerHTML = `
        <div class="hs-portal">
            <img src="img/${icon}" class="hs-${type}-img" draggable="false">
            <div class="hs-label">${esc(label)}</div>
        </div>
        <button class="hs-edit-btn" title="Destino"></button>
        <div class="hs-picker"></div>
        <button class="hs-delete-btn" title="Eliminar"></button>
    `;

    const picker = wrap.querySelector('.hs-picker');
    const projectData = getProjectData();
    const currentIdx = getCurrentSceneIndex();

    // Rellenar picker según tipo
    if (type === 'link') {
        const items = projectData.scenes
            .filter((_, idx) => idx !== currentIdx)
            .map((s, idx) => {
                const originalIdx = projectData.scenes.findIndex(sc => sc.id === s.id);
                return `<li class="hsp-item" data-index="${originalIdx}">${esc(s.name || s.id)}</li>`;
            })
            .join('');
        picker.innerHTML = `
            <ul class="hsp-list">
                <li class="hsp-header">Seleccionar destino</li>
                ${items}
            </ul>
        `;
    } else {
        picker.innerHTML = `
            <ul class="hsp-list">
                <li class="hsp-header">Info hotspot</li>
                <li class="hsp-item" data-action="edit">✏️ Editar texto</li>
                <li class="hsp-item hsp-delete" data-action="delete">🗑 Eliminar</li>
            </ul>
        `;
    }

    // Botón editar (abrir picker)
    const editBtn = wrap.querySelector('.hs-edit-btn');
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.hs-picker.open').forEach(p => p.classList.remove('open'));
        picker.classList.add('open');
        const rect = picker.getBoundingClientRect();
        if (rect.bottom > window.innerHeight) {
            picker.classList.add('up');
        } else {
            picker.classList.remove('up');
        }
        addThumbnailEventsToPicker(picker);
    });

    // Eventos del picker
    picker.addEventListener('click', (e) => {
        e.stopPropagation();
        hideThumbnail();
        const li = e.target.closest('.hsp-item');
        if (!li) return;
        const action = li.dataset.action;

        // Eliminar
        if (action === 'delete') {
            if (isTemporary) {
                removeTempHotspot();
            } else {
                deleteHotspotById(hs.id, type);
            }
            picker.classList.remove('open');
            return;
        }

        // Link: asignar destino
        if (type === 'link' && li.dataset.index) {
            const targetIndex = parseInt(li.dataset.index, 10);
            if (isTemporary) {
                // Crear hotspot permanente con los datos actuales del temporal
                const newHotspot = {
                    id: `link_${Date.now()}_${Math.random()}`,
                    yaw: hs.yaw,
                    pitch: hs.pitch,
                    targetIndex
                };
                projectData.scenes[currentIdx].linkHotspots.push(newHotspot);
                saveToLocalStorage();
                renderHotspots();
                showMessage(`Link creado → ${projectData.scenes[targetIndex].name}`, 2000);
                removeTempHotspot();
            } else {
                hs.targetIndex = targetIndex;
                saveToLocalStorage();
                renderHotspots();
                showMessage(`Destino cambiado a "${projectData.scenes[targetIndex].name}"`);
            }
        }
        // Info: editar texto
        else if (type === 'info' && action === 'edit') {
            const newContent = prompt('Editar contenido del info hotspot:', hs.content);
            if (newContent !== null) {
                hs.content = newContent;
                saveToLocalStorage();
                renderHotspots();
                showMessage('Info actualizado');
            }
        }

        picker.classList.remove('open');
        hideThumbnail();
    });

    // Drag & Drop (arrastre del hotspot)
    const portalDrag = wrap.querySelector('.hs-portal');
    let isDraggingHS = false;
    let startX = 0, startY = 0;

    const onMouseDownHS = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        if (isRO()) return;
        startX = e.clientX;
        startY = e.clientY;
        isDraggingHS = false;
        if (picker.classList.contains('open')) picker.classList.remove('open');
        window.addEventListener('mousemove', onMouseMoveHS);
        window.addEventListener('mouseup', onMouseUpHS);
    };

    const onMouseMoveHS = (e) => {
        const dist = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (!isDraggingHS && dist > 3) {
            isDraggingHS = true;
            startDraggingHotspot(hs.id, isTemporary);
        }
    };

    const onMouseUpHS = () => {
        isDraggingHS = false;
        window.removeEventListener('mousemove', onMouseMoveHS);
        window.removeEventListener('mouseup', onMouseUpHS);
    };

    portalDrag.addEventListener('mousedown', onMouseDownHS);

    // Botón eliminar
    const delBtn = wrap.querySelector('.hs-delete-btn');
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        hideThumbnail();
        if (isTemporary) {
            removeTempHotspot();
        } else {
            deleteHotspotById(hs.id, type);
        }
        picker.classList.remove('open');
    });

    // ==============================================
    // Navegación al hacer clic (solo para links)
    // Diferenciando entre clic y arrastre
    // ==============================================
    if (type === 'link') {
        const portal = wrap.querySelector('.hs-portal');
        portal.style.cursor = 'pointer';
        
        let isDragIntent = false;
        let dragStartX = 0, dragStartY = 0;
        
        const onPortalMouseDown = (e) => {
            if (e.button !== 0) return;
            isDragIntent = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            window.addEventListener('mousemove', onPortalMouseMove);
            window.addEventListener('mouseup', onPortalMouseUp);
        };
        
        const onPortalMouseMove = (e) => {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            if (Math.hypot(dx, dy) > 5) {
                isDragIntent = true;
                window.removeEventListener('mousemove', onPortalMouseMove);
                window.removeEventListener('mouseup', onPortalMouseUp);
            }
        };
        
        const onPortalMouseUp = (e) => {
            window.removeEventListener('mousemove', onPortalMouseMove);
            window.removeEventListener('mouseup', onPortalMouseUp);
            if (!isDragIntent) {
                // Solo navega si no hubo arrastre
                e.stopPropagation();
                if (isTemporary) {
                    showMessage('Asigna un destino primero usando el botón editar', 2000);
                    return;
                }
                const targetIdx = hs.targetIndex;
                if (targetIdx !== undefined && targetIdx !== null && window.navigateToScene) {
                    window.navigateToScene(targetIdx, { yaw: hs.yaw, pitch: hs.pitch });
                } else {
                    showMessage('Este link no tiene destino asignado', 1500);
                }
            }
            isDragIntent = false;
        };
        
        portal.addEventListener('mousedown', onPortalMouseDown);

        // Pantallas táctiles: un toque navega (antes solo respondía al mouse)
        let touchStart = null;
        portal.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            e.stopPropagation();
        }, { passive: true });
        portal.addEventListener('touchend', (e) => {
            if (!touchStart) return;
            const t = e.changedTouches[0];
            const moved = Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > 10;
            touchStart = null;
            if (moved || isTemporary) return;
            e.preventDefault();
            e.stopPropagation();
            if (hs.targetIndex !== undefined && hs.targetIndex !== null && window.navigateToScene) {
                window.navigateToScene(hs.targetIndex, { yaw: hs.yaw, pitch: hs.pitch });
            }
        });
    }

    return wrap;
}

// ==========================================
// DELETE HOTSPOT
// ==========================================
function deleteHotspotById(id, type) {
    const projectData = getProjectData();
    const sceneIdx = getCurrentSceneIndex();
    const sd = projectData.scenes[sceneIdx];
    if (!sd) return;
    if (type === 'link') {
        sd.linkHotspots = (sd.linkHotspots || []).filter(h => h.id !== id);
    } else {
        sd.infoHotspots = (sd.infoHotspots || []).filter(h => h.id !== id);
    }
    saveToLocalStorage();
    renderHotspots();
    showMessage('Hotspot eliminado');
}

// ==========================================
// POSICIONAMIENTO HOTSPOTS
// ==========================================
export function updateHotspotPositions() {
    document.querySelectorAll('.hs-wrap').forEach(wrap => {
        const id = wrap.getAttribute('data-id');
        if (!id) return;
        let hs = null;
        if (tempHotspot && tempHotspot.id === id) {
            hs = tempHotspot;
        } else {
            const projectData = getProjectData();
            const sceneIdx = getCurrentSceneIndex();
            const sd = projectData && projectData.scenes[sceneIdx];
            if (!sd) return;
            hs = sd.linkHotspots?.find(h => h.id === id);
            if (!hs) hs = sd.infoHotspots?.find(h => h.id === id);
        }
        if (!hs) { wrap.style.display = 'none'; return; }
        const worldPos = getHotspotWorldPos(hs.yaw, hs.pitch);
        const screenPos = getScreenCoordsFromWorldPos(worldPos);
        if (screenPos) {
            wrap.style.display = 'block';
            wrap.style.left = screenPos.left + 'px';
            wrap.style.top = screenPos.top + 'px';
        } else {
            wrap.style.display = 'none';
        }
    });
}

// ==========================================
// BLOQUE 6: ARRASTRE DE HOTSPOTS
// ==========================================
function startDraggingHotspot(hotspotId, isTemporary = false) {
    dragActive = true;
    draggedHotspotId = hotspotId;
    document.body.style.cursor = 'grabbing';
    if (window.disableCameraDrag) window.disableCameraDrag();
}

function onDragMouseMove(e) {
    if (!dragActive || !draggedHotspotId) return;
    const camera = getCamera();
    const renderer = getRenderer();
    if (!camera || !renderer) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const clientX = e.clientX ?? (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY ?? (e.touches ? e.touches[0].clientY : 0);
    const ndc = new THREE.Vector2(((clientX - rect.left)/rect.width)*2-1, -((clientY - rect.top)/rect.height)*2+1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const wf = getWF();
    const sphereCenter = new THREE.Vector3(wf.position.x, wf.position.y, wf.position.z);
    const sphere = new THREE.Sphere(sphereCenter, wf.radius);
    const hitPoint = new THREE.Vector3();
    if (raycaster.ray.intersectSphere(sphere, hitPoint)) {
        const dx = hitPoint.x - sphereCenter.x;
        const dy = hitPoint.y - sphereCenter.y;
        const dz = hitPoint.z - sphereCenter.z;
        const yaw = Math.atan2(dx, dz);
        const pitch = Math.asin(Math.max(-1, Math.min(1, dy / wf.radius)));
        
        if (tempHotspot && tempHotspot.id === draggedHotspotId) {
            tempHotspot.yaw = yaw;
            tempHotspot.pitch = pitch;
            updateHotspotPositions();
        } else {
            const projectData = getProjectData();
            const sceneIdx = getCurrentSceneIndex();
            const sd = projectData.scenes[sceneIdx];
            let hs = sd.linkHotspots?.find(h => h.id === draggedHotspotId);
            if (!hs) hs = sd.infoHotspots?.find(h => h.id === draggedHotspotId);
            if (hs) {
                hs.yaw = yaw;
                hs.pitch = pitch;
                updateHotspotPositions();
            }
        }
    }
}

function stopDraggingHotspot() {
    if (!dragActive) return;
    // Guardar una sola vez al soltar (antes guardaba en cada movimiento)
    if (!(tempHotspot && tempHotspot.id === draggedHotspotId)) saveToLocalStorage();
    dragActive = false;
    draggedHotspotId = null;
    document.body.style.cursor = '';
    if (window.enableCameraDrag) window.enableCameraDrag();
    if (tempHotspot) {
        updateHotspotPositions();
    }
    showMessage('Hotspot reubicado', 1000);
}

export function initDragEvents() {
    window.addEventListener('mousemove', onDragMouseMove);
    window.addEventListener('mouseup', stopDraggingHotspot);
    window.addEventListener('touchmove', onDragMouseMove);
    window.addEventListener('touchend', stopDraggingHotspot);
}

// ==========================================
// BLOQUE 7: HOTSPOT TEMPORAL (CREACIÓN Y ELIMINACIÓN)
// ==========================================
function getCurrentCameraDirectionYawPitch() {
    const camera = getCamera();
    if (!camera) return { yaw: 0, pitch: 0 };
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const yaw = Math.atan2(dir.x, dir.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));
    return { yaw, pitch };
}

export function createTempLinkHotspot() {
    if (tempHotspot) removeTempHotspot();

    const { yaw, pitch } = getCurrentCameraDirectionYawPitch();
    const id = `temp_${Date.now()}`;

    const tempObj = {
        id,
        yaw,
        pitch,
        targetIndex: null,
        element: null
    };
    tempHotspot = tempObj;

    const wrap = createHotspotElement(tempObj, 'link', 'no asignado', true);
    wrap.setAttribute('data-id', id);
    document.body.appendChild(wrap);
    tempObj.element = wrap;

    // Bucle de actualización continua
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    const updateLoop = () => {
        if (!tempHotspot) return;
        updateHotspotPositions();
        animationFrameId = requestAnimationFrame(updateLoop);
    };
    animationFrameId = requestAnimationFrame(updateLoop);

    showMessage('Mové la cámara o arrastrá el hotspot antes de asignar destino', 4000);
}

function removeTempHotspot() {
    if (tempHotspot) {
        if (tempHotspot.element) tempHotspot.element.remove();
        tempHotspot = null;
    }
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    hideThumbnail();
}

// ==========================================
// BLOQUE 8: DIRECTRICES (INFO HOTSPOTS PRO)
// ==========================================

let svgOverlay = null;
let isCreatingDirectrix = false;
let selectedDirectrixId = null;

const DEFAULT_DIRECTRIX_STYLE = {
    lineColor:'#ffffff', lineWidth:1.5, lineDash:'none',
    textColor:'#ffffff', startCap:'none', endCap:'none'
};

function getDirectrixStyle() {
    const pd = getProjectData();
    if (!pd.directrixStyle) pd.directrixStyle = Object.assign({}, DEFAULT_DIRECTRIX_STYLE);
    const s = pd.directrixStyle;
    if (s.startCap === undefined) s.startCap = 'none';
    if (s.endCap   === undefined) s.endCap   = 'none';
    return s;
}

function initSVGOverlay() {
    if (svgOverlay) return;
    svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgOverlay.id = 'directrix-svg';
    svgOverlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50;overflow:visible;';
    document.body.appendChild(svgOverlay);
}

function screenToSphere(cx, cy) {
    const camera = getCamera(), renderer = getRenderer();
    if (!camera || !renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1,
                                  -((cy - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, camera);
    const wf = getWF();
    const center = new THREE.Vector3(wf.position.x, wf.position.y, wf.position.z);
    const hit = new THREE.Vector3();
    if (!rc.ray.intersectSphere(new THREE.Sphere(center, wf.radius), hit)) return null;
    const dx = hit.x - center.x, dy = hit.y - center.y, dz = hit.z - center.z;
    return { yaw: Math.atan2(dx, dz), pitch: Math.asin(Math.max(-1, Math.min(1, dy / wf.radius))) };
}

/* ── DOM handle persistente para el punto (sobrevive al rebuild del SVG) ───── */
function getOrCreateDotHandle(hs) {
    const domId = 'dx-dot-' + hs.id;
    let el = document.getElementById(domId);
    if (el) return el;

    el = document.createElement('div');
    el.id = domId;
    el.className = 'dx-dot-handle';
    el.setAttribute('data-id', hs.id);

    // Botón × eliminar
    const delBtn = document.createElement('div');
    delBtn.className = 'dx-dot-delete-btn';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        deleteDirectrix(hs.id);
    });
    el.appendChild(delBtn);

    // Drag del punto sobre la esfera
    el.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || isRO()) return;
        e.stopPropagation();
        e.preventDefault();
        el.style.cursor = 'grabbing';
        if (window.disableCameraDrag) window.disableCameraDrag();
        const onMove = function(ev) {
            const pos = screenToSphere(ev.clientX, ev.clientY);
            if (!pos) return;
            hs.yaw = pos.yaw;
            hs.pitch = pos.pitch;
            const wp = getHotspotWorldPos(hs.yaw, hs.pitch);
            const sp = getScreenCoordsFromWorldPos(wp);
            if (sp) { el.style.left = sp.left + 'px'; el.style.top = sp.top + 'px'; }
        };
        const onUp = function() {
            el.style.cursor = 'grab';
            if (window.enableCameraDrag) window.enableCameraDrag();
            saveToLocalStorage();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });

    document.body.appendChild(el);
    return el;
}

/* ── Label DOM persistente ─────────────────────────────────────────────────── */
function getOrCreateLabel(hs) {
    let label = document.getElementById('dx-label-' + hs.id);
    if (label) return label;

    label = document.createElement('div');
    label.id = 'dx-label-' + hs.id;
    label.className = 'dx-label';
    label.setAttribute('data-id', hs.id);
    label._dragging = false;

    // Click = editar texto (si no fue arrastre)
    label.addEventListener('click', function(e) {
        if (label._dragging || isRO()) return;
        if (label.querySelector('.dx-text-input')) return;
        e.stopPropagation();
        startEditDirectrixText(hs.id);
    });

    // Mousedown = posible arrastre del label
    label.addEventListener('mousedown', function(e) {
        if (e.button !== 0 || isRO()) return;
        if (label.querySelector('.dx-text-input')) return;
        e.stopPropagation();
        e.preventDefault();
        label._dragging = false;
        if (window.disableCameraDrag) window.disableCameraDrag();
        const sx = e.clientX, sy = e.clientY;
        const sox = hs.labelOffsetX || 130, soy = hs.labelOffsetY || -70;
        const onMove = function(ev) {
            if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) label._dragging = true;
            if (label._dragging) {
                hs.labelOffsetX = sox + (ev.clientX - sx);
                hs.labelOffsetY = soy + (ev.clientY - sy);
                repositionLabel(label, hs);
            }
        };
        const onUp = function() {
            if (window.enableCameraDrag) window.enableCameraDrag();
            if (label._dragging) saveToLocalStorage();
            setTimeout(function() { label._dragging = false; }, 50);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });

    document.body.appendChild(label);
    return label;
}

function repositionLabel(label, hs) {
    const wp = getHotspotWorldPos(hs.yaw, hs.pitch);
    const sp = getScreenCoordsFromWorldPos(wp);
    if (!sp) return;
    const ox = sp.left, oy = sp.top;
    const lx = ox + (hs.labelOffsetX || 130);
    const ly = oy + (hs.labelOffsetY || -70);
    const ddx = lx - ox, ddy = ly - oy;
    const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    const ky = oy + (ddy / len) * Math.min(55, len * 0.45);
    const hz = ddx >= 0 ? 1 : -1;
    label.style.left = lx + 'px';
    label.style.top  = ky + 'px';
    label.style.transform = hz >= 0 ? 'translate(6px,-50%)' : 'translate(calc(-100% - 6px),-50%)';
}

function updateLabelContent(label, hs) {
    if (label.querySelector('.dx-text-input')) return;
    if (isRO() && !hs.text) { label.style.visibility = 'hidden'; } else label.style.visibility = '';
    const txt = hs.text ? esc(hs.text) : '<em style="opacity:.5">Texto...</em>';
    const html = '<div class="dx-label-text" style="cursor:text">' + txt + '</div>';
    if (label._lastHtml === html) return;
    label._lastHtml = html;
    label.innerHTML = html;
}

/* ── SVG: solo líneas, sin eventos (se puede reconstruir cada frame) ─────── */
function buildSVGGroup(hs) {
    const wp = getHotspotWorldPos(hs.yaw, hs.pitch);
    const sp = getScreenCoordsFromWorldPos(wp);
    if (!sp) return null;

    const s   = getDirectrixStyle();
    const col = s.lineColor || '#ffffff';
    const sw  = s.lineWidth  || 1.5;
    const dash = (s.lineDash && s.lineDash !== 'none') ? s.lineDash : null;
    const scap = s.startCap || 'dot';
    const ecap = s.endCap   || 'none';
    const csz  = sw * 3.5;

    const ox = sp.left, oy = sp.top;
    const lx = ox + (hs.labelOffsetX || 130);
    const ly = oy + (hs.labelOffsetY || -70);
    const ddx = lx - ox, ddy = ly - oy;
    const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
    const nx = ddx / len, ny = ddy / len;
    const arm = Math.min(55, len * 0.45);
    const kx = ox + nx * arm, ky = oy + ny * arm;
    const hz = ddx >= 0 ? 1 : -1;

    const ns = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(ns, 'g');
    g.setAttribute('data-id', hs.id);

    const mkL = function(x1, y1, x2, y2) {
        const l = document.createElementNS(ns, 'line');
        l.setAttribute('x1', x1); l.setAttribute('y1', y1);
        l.setAttribute('x2', x2); l.setAttribute('y2', y2);
        l.setAttribute('stroke', col);
        l.setAttribute('stroke-width', sw);
        if (dash) l.setAttribute('stroke-dasharray', dash);
        return l;
    };
    const mkC = function(x, y, r) {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
        c.setAttribute('fill', col); return c;
    };
    const mkA = function(tx, ty, ax, ay, sz) {
        const ln = Math.sqrt(ax*ax+ay*ay)||1;
        const anx = ax/ln, any = ay/ln, px = -any, py = anx;
        const bx = tx-anx*sz, by = ty-any*sz;
        const p = document.createElementNS(ns, 'polygon');
        p.setAttribute('points', tx+','+ty+' '+(bx+px*sz*0.45)+','+(by+py*sz*0.45)+' '+(bx-px*sz*0.45)+','+(by-py*sz*0.45));
        p.setAttribute('fill', col); return p;
    };

    g.appendChild(mkL(ox, oy, kx, ky));
    g.appendChild(mkL(kx, ky, lx, ky));

    if (scap === 'dot')   g.appendChild(mkC(ox, oy, csz * 0.8));
    if (scap === 'arrow') g.appendChild(mkA(ox, oy, -nx, -ny, csz * 1.4));
    if (ecap === 'dot')   g.appendChild(mkC(lx, ky, csz * 0.8));
    if (ecap === 'arrow') g.appendChild(mkA(lx, ky, hz, 0, csz * 1.4));

    return { g: g, ox: ox, oy: oy, lx: lx, ky: ky, hz: hz };
}

function updateAllDirectrices() {
    if (!svgOverlay) return;
    svgOverlay.innerHTML = ''; // OK: solo líneas, sin eventos

    const pd = getProjectData();
    const sceneIdx = getCurrentSceneIndex();
    const sd = pd && pd.scenes && pd.scenes[sceneIdx];
    const hotspots = (sd && sd.infoHotspots) || [];
    const activeIds = {};
    hotspots.forEach(function(h) { activeIds[h.id] = true; });

    // Limpiar handles y labels huérfanos
    document.querySelectorAll('.dx-dot-handle').forEach(function(el) {
        if (!activeIds[el.getAttribute('data-id')]) el.remove();
    });
    document.querySelectorAll('.dx-label').forEach(function(el) {
        if (!activeIds[el.getAttribute('data-id')]) el.remove();
    });

    hotspots.forEach(function(hs) {
        const dotHandle = getOrCreateDotHandle(hs);
        const result = buildSVGGroup(hs);

        if (!result) {
            dotHandle.style.display = 'none';
            const lbl = document.getElementById('dx-label-' + hs.id);
            if (lbl) lbl.style.display = 'none';
            return;
        }

        svgOverlay.appendChild(result.g);

        // Posicionar dot handle sobre el punto
        dotHandle.style.display = '';
        dotHandle.style.left = result.ox + 'px';
        dotHandle.style.top  = result.oy + 'px';
        dotHandle.style.setProperty('--dot-color', getDirectrixStyle().lineColor || '#ffffff');

        // Label
        const label = getOrCreateLabel(hs);
        updateLabelContent(label, hs);
        label.style.left = result.lx + 'px';
        label.style.top  = result.ky + 'px';
        label.style.transform = result.hz >= 0 ? 'translate(6px,-50%)' : 'translate(calc(-100% - 6px),-50%)';
        label.style.display = '';
        label.style.color = getDirectrixStyle().textColor || '#ffffff';
    });
}

function deleteDirectrix(id) {
    const pd = getProjectData();
    const sceneIdx = getCurrentSceneIndex();
    const sd = pd.scenes[sceneIdx];
    sd.infoHotspots = (sd.infoHotspots || []).filter(function(h) { return h.id !== id; });
    const dh = document.getElementById('dx-dot-' + id);
    if (dh) dh.remove();
    const lbl = document.getElementById('dx-label-' + id);
    if (lbl) lbl.remove();
    if (selectedDirectrixId === id) selectedDirectrixId = null;
    saveToLocalStorage();
    updateAllDirectrices();
    showMessage('Directriz eliminada', 1500);
}

function startEditDirectrixText(id) {
    const pd = getProjectData();
    const sceneIdx = getCurrentSceneIndex();
    const hs = (pd.scenes[sceneIdx].infoHotspots || []).find(function(h) { return h.id === id; });
    if (!hs) return;
    const label = document.getElementById('dx-label-' + id);
    const textEl = label && label.querySelector('.dx-label-text');
    if (!textEl || label.querySelector('.dx-text-input')) return;

    if (window.disableCameraDrag) window.disableCameraDrag();

    // Input que se auto-ajusta al contenido
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'dx-text-input';
    input.value = hs.text || '';
    input.placeholder = 'Texto...';
    input.style.width = '80px'; // mínimo inicial

    // Auto-resize al escribir
    const resize = function() {
        const tmp = document.createElement('span');
        tmp.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:12px Segoe UI,sans-serif;padding:3px 8px;';
        tmp.textContent = input.value || input.placeholder;
        document.body.appendChild(tmp);
        input.style.width = Math.max(80, tmp.offsetWidth + 16) + 'px';
        tmp.remove();
    };
    input.addEventListener('input', resize);

    textEl.replaceWith(input);
    resize();

    let finished = false;
    const finish = function() {
        if (finished) return;
        finished = true;
        if (window.enableCameraDrag) window.enableCameraDrag();
        hs.text = input.value.trim() || '';
        if (label) label._lastHtml = null;
        saveToLocalStorage();
        updateAllDirectrices();
    };

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            finish();
        }
        e.stopPropagation();
    });
    input.addEventListener('blur', function() {
        setTimeout(finish, 50);
    });
    input.addEventListener('mousedown', function(e) { e.stopPropagation(); });
    input.addEventListener('click', function(e) { e.stopPropagation(); });
    requestAnimationFrame(function() { input.focus(); input.select(); resize(); });
}

function onSceneClickForDirectrix(e) {
    if (!isCreatingDirectrix) return;
    if (e.target.closest && (e.target.closest('.dx-label') || e.target.closest('.dx-dot-handle') || e.target.closest('#directrix-svg'))) return;
    e.stopPropagation();
    const pos = screenToSphere(e.clientX, e.clientY);
    if (!pos) { showMessage('Hacé click sobre la esfera 360°', 1500); return; }
    const pd = getProjectData();
    const sceneIdx = getCurrentSceneIndex();
    const sd = pd.scenes[sceneIdx];
    if (!sd.infoHotspots) sd.infoHotspots = [];
    const newHs = { id: 'info_' + Date.now(), yaw: pos.yaw, pitch: pos.pitch, text: '', labelOffsetX: 130, labelOffsetY: -70 };
    sd.infoHotspots.push(newHs);
    saveToLocalStorage();
    cancelDirectrixCreation();
    selectedDirectrixId = newHs.id;
    updateAllDirectrices();
    setTimeout(function() { startEditDirectrixText(newHs.id); }, 120);
    showMessage('Directriz creada · Click en el texto para editarlo', 3000);
}

function cancelDirectrixCreation(msg) {
    isCreatingDirectrix = false;
    document.body.style.cursor = '';
    document.body.classList.remove('creating-directrix');
    window.removeEventListener('click', onSceneClickForDirectrix, true);
    window.removeEventListener('keydown', onDirectrixEsc);
    if (msg) showMessage(msg, 1000);
}
// Un solo listener de Esc (antes se sumaba uno nuevo cada vez que se activaba el modo)
function onDirectrixEsc(e) {
    if (e.key === 'Escape' && isCreatingDirectrix) cancelDirectrixCreation('Creación cancelada');
}

export function onAddInfoClick() {
    if (isCreatingDirectrix) { cancelDirectrixCreation('Creación cancelada'); return; }
    isCreatingDirectrix = true;
    document.body.style.cursor = 'crosshair';
    document.body.classList.add('creating-directrix');
    window.addEventListener('click', onSceneClickForDirectrix, true);
    window.addEventListener('keydown', onDirectrixEsc);
    showMessage('Click en la escena para anclar · Esc para cancelar', 3000);
}

export function updateDirectrices() {
    updateAllDirectrices();
}

// BLOQUE 9: INICIALIZACIÓN DEL MÓDULO
// ==========================================
function initInfoStylePanel() {
    const btn   = document.getElementById('infoStyleBtn');
    const panel = document.getElementById('infoStylePanel');
    const closeBtn = document.getElementById('infoStylePanelClose');

    if (!btn || !panel) return;

    // Sincronizar UI con los valores guardados
    const syncUI = () => {
        const s = getDirectrixStyle();
        const lc  = document.getElementById('dxLineColor');
        const lw  = document.getElementById('dxLineWidth');
        const lwv = document.getElementById('dxLineWidthVal');
        const ld  = document.getElementById('dxLineDash');
        const tc  = document.getElementById('dxTextColor');
        const sc  = document.getElementById('dxStartCap');
        const ec  = document.getElementById('dxEndCap');
        if (lc)  lc.value  = s.lineColor  || '#ffffff';
        if (lw)  lw.value  = s.lineWidth  || 1.5;
        if (lwv) lwv.textContent = `${s.lineWidth || 1.5}px`;
        if (ld)  ld.value  = s.lineDash   || 'none';
        if (tc)  tc.value  = s.textColor  || '#ffffff';
        if (sc)  sc.value  = s.startCap   || 'dot';
        if (ec)  ec.value  = s.endCap     || 'none';
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.toggle('enabled');
        if (panel.classList.contains('enabled')) syncUI();
    });

    closeBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        panel.classList.remove('enabled');
    });

    document.getElementById('dxLineColor')?.addEventListener('input', (e) => {
        getDirectrixStyle().lineColor = e.target.value;
        saveToLocalStorage(); updateAllDirectrices();
    });
    document.getElementById('dxLineWidth')?.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('dxLineWidthVal').textContent = `${val}px`;
        getDirectrixStyle().lineWidth = val;
        saveToLocalStorage(); updateAllDirectrices();
    });
    document.getElementById('dxLineDash')?.addEventListener('change', (e) => {
        getDirectrixStyle().lineDash = e.target.value;
        saveToLocalStorage(); updateAllDirectrices();
    });
    document.getElementById('dxStartCap')?.addEventListener('change', (e) => {
        getDirectrixStyle().startCap = e.target.value;
        saveToLocalStorage(); updateAllDirectrices();
    });
    document.getElementById('dxEndCap')?.addEventListener('change', (e) => {
        getDirectrixStyle().endCap = e.target.value;
        saveToLocalStorage(); updateAllDirectrices();
    });
    document.getElementById('dxTextColor')?.addEventListener('input', (e) => {
        getDirectrixStyle().textColor = e.target.value;
        document.querySelectorAll('.dx-label').forEach(el => { el.style.color = e.target.value; });
        saveToLocalStorage(); updateAllDirectrices();
    });
}

export function initHotspotEditor() {
    initDragEvents();
    initSVGOverlay();
    initInfoStylePanel();
    // Deseleccionar directriz al hacer click en la escena
    window.addEventListener('click', (e) => {
        if (isCreatingDirectrix) return;
        if (e.target.closest('.dx-label') || e.target.closest('#directrix-svg')) return;
        if (selectedDirectrixId) { selectedDirectrixId = null; updateAllDirectrices(); }
    });
    window.renderHotspots = renderHotspots;
    window.createTempLinkHotspot = createTempLinkHotspot;
    window.removeTempHotspot = removeTempHotspot;
}
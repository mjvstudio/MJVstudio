// ==========================================
// BLUEPRINT MODULE - Gestión del plano interactivo con marcadores
// ==========================================
import * as THREE from 'three';

let projectData = null;
let currentSceneIndex = 0;
let camera = null;
let blueprintImageLoaded = false;
let savedPlanPosition = { x: 0.5, y: 0.5 };
let isDraggingBlueprintDot = false;
let blueprintScale = 1;
let lastBlueprintAngle = 0;
let accumulatedBlueprintRotation = 0;

let offsetX = 0;
let offsetY = 0;

let blueprintContainer = null;
let blueprintImage = null;
let blueprintDot = null;
let blueprintMarkersContainer = null;
let bpScaleSlider = null, bpScaleValue = null;
let bpOffsetXSlider = null, bpOffsetXValue = null;
let bpOffsetYSlider = null, bpOffsetYValue = null;
let blueprintConfigToggle = null;
let blueprintAddMarkerBtn = null;
let blueprintControls = null;

// Nuevos elementos UI
let blueprintEyeBtn = null;
let blueprintEyePanel = null;
let blueprintAreaBtn = null;
let blueprintAreaPanel = null;
let blueprintDotToggle = null;
let bpOrientationSlider = null;
let bpOrientationValue = null;

// Editor de áreas
let svgAreas = null;
let selectedAreaIdx = null;
let isDrawingArea = false;
let editMode = false;      // true = handles visibles para editar
let drawStartUV = null;
let drawRectEl = null;
let snapActive = false;

// Estilo global de áreas (compartido por todas)
const DEFAULT_AREA_STYLE = {
    fillEnabled:  true,
    fillType:     'solid',    // 'solid' | 'hatch45' | 'hatch135' | 'cross' | 'dots'
    fillColor:    '#cc0000',
    fillOpacity:  0.30,
    strokeEnabled: true,
    strokeColor:  '#cc0000',
    strokeDash:   'none',
    strokeWidth:  1.5
};

let onSaveCallback = null;
let onMessageCallback = null;

// Estado para añadir marcador
let addingMarkerMode = false;

function showMessage(msg, duration = 2000) {
    if (onMessageCallback) onMessageCallback(msg, duration);
}
function saveToLocalStorage() {
    if (onSaveCallback) onSaveCallback();
}

function applyImageTransform() {
    if (!blueprintImage) return;
    const translateX = (offsetX / 100) * 50;
    const translateY = (offsetY / 100) * 50;
    blueprintImage.style.transform = `translate(${translateX}%, ${translateY}%) scale(${blueprintScale})`;
    requestAnimationFrame(() => {
        updateBlueprintDotPosition(savedPlanPosition.x, savedPlanPosition.y);
        renderMarkers();
        renderAreas();
    });
}

function getCurrentLevel() {
    const sceneData = projectData.scenes[currentSceneIndex];
    return sceneData ? (sceneData.level ?? 0) : 0;
}
const isRO = () => !!(window.isReadOnly && window.isReadOnly());

// El proyecto abierto cambia al cargar un ZIP / abrir otro proyecto: antes este
// módulo seguía editando el objeto viejo y esos cambios se perdían.
export function setBlueprintProjectData(data) {
    projectData = data;
    if (!projectData.levelSettings) projectData.levelSettings = {};
    if (!projectData.levelMarkers) projectData.levelMarkers = {};
    if (!projectData.areaStyle) projectData.areaStyle = { ...DEFAULT_AREA_STYLE };
    if (currentSceneIndex >= projectData.scenes.length) currentSceneIndex = 0;
    blueprintImageLoaded = false;
}

function getLevelMarkers() {
    const level = getCurrentLevel();
    if (!projectData.levelMarkers) projectData.levelMarkers = {};
    if (!projectData.levelMarkers[level]) projectData.levelMarkers[level] = [];
    return projectData.levelMarkers[level];
}

function saveMarkers(markers) {
    const level = getCurrentLevel();
    if (!projectData.levelMarkers) projectData.levelMarkers = {};
    projectData.levelMarkers[level] = markers;
    saveToLocalStorage();
}

function getCurrentLevelSettings() {
    const level = getCurrentLevel();
    if (!projectData.levelSettings) projectData.levelSettings = {};
    if (!projectData.levelSettings[level]) {
        projectData.levelSettings[level] = { scale: 50, offsetX: 0, offsetY: 0 };
    }
    return projectData.levelSettings[level];
}
function setCurrentLevelScale(value) {
    const settings = getCurrentLevelSettings();
    settings.scale = value;
    saveToLocalStorage();
}
function setCurrentLevelOffsetX(value) {
    const settings = getCurrentLevelSettings();
    settings.offsetX = value;
    saveToLocalStorage();
}
function setCurrentLevelOffsetY(value) {
    const settings = getCurrentLevelSettings();
    settings.offsetY = value;
    saveToLocalStorage();
}

export function preloadBlueprintImage() {
    const sceneData = projectData.scenes[currentSceneIndex];
    const levelIndex = sceneData ? (sceneData.level ?? 0) : 0;
    const levels = projectData.levels || [];
    const levelFile = levels[levelIndex] || levels[0];
    if (!levelFile) return Promise.reject(new Error('sin planos'));
    const path = `project/niveles/${levelFile}`;
    const levelUrl = window.resolveUrl ? window.resolveUrl(path) : path;
    if (blueprintImage.getAttribute('src') === levelUrl && blueprintImage.complete && blueprintImage.naturalWidth) {
        blueprintImageLoaded = true;
        updateBlueprintDotPosition(savedPlanPosition.x, savedPlanPosition.y);
        renderMarkers();
        renderAreas();
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        blueprintImage.onload = () => {
            blueprintImageLoaded = true;
            updateBlueprintDotPosition(savedPlanPosition.x, savedPlanPosition.y);
            renderMarkers();
            renderAreas();
            resolve();
        };
        blueprintImage.onerror = () => {
            blueprintImageLoaded = false;
            reject();
        };
        blueprintImage.src = levelUrl;
    });
}

export function updateBlueprintDotPosition(x, y) {
    if (!blueprintDot || !blueprintImage.complete) return;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    const wrapper = blueprintImage.parentElement;
    const rect = blueprintImage.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const relativeX = rect.left - wrapperRect.left;
    const relativeY = rect.top - wrapperRect.top;
    const px = relativeX + (x * rect.width);
    const py = relativeY + (y * rect.height);
    blueprintDot.style.left = `${px}px`;
    blueprintDot.style.top = `${py}px`;
}

export function updateBlueprintRotation() {
    if (!blueprintDot || !camera) return;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let rawAngle = THREE.MathUtils.radToDeg(Math.atan2(-forward.x, forward.z));
    let delta = rawAngle - lastBlueprintAngle;
    if (delta > 180) delta -= 360;
    else if (delta < -180) delta += 360;
    accumulatedBlueprintRotation += delta;
    lastBlueprintAngle = rawAngle;
    const sceneData = projectData.scenes[currentSceneIndex];
    const calibrationOffset = (sceneData && sceneData.planOrientation) || 0;
    const finalRotation = accumulatedBlueprintRotation + calibrationOffset;
    blueprintDot.style.transform = `translate(-50%, -50%) rotate(${finalRotation}deg)`;
}

export function initBlueprintDraggable() {
    const wrapper = blueprintImage.parentElement;
    const getPos = (e) => {
        const cx = e.touches ? e.touches[0].clientX : e.clientX;
        const cy = e.touches ? e.touches[0].clientY : e.clientY;
        const rect = blueprintImage.getBoundingClientRect();
        let x = (cx - rect.left) / rect.width;
        let y = (cy - rect.top) / rect.height;
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
        return { x, y };
    };
    blueprintDot.addEventListener('mousedown', (e) => {
        if (isRO()) return;
        e.preventDefault();
        e.stopPropagation();
        isDraggingBlueprintDot = true;
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDraggingBlueprintDot) return;
        const { x, y } = getPos(e);
        updateBlueprintDotPosition(x, y);
        const sceneData = projectData.scenes[currentSceneIndex];
        if (!sceneData) return;
        sceneData.planPosition = { x, y };
        savedPlanPosition = { x, y };
    });
    window.addEventListener('mouseup', () => {
        // Guardar una sola vez al soltar (antes guardaba en cada movimiento del mouse)
        if (isDraggingBlueprintDot) saveToLocalStorage();
        isDraggingBlueprintDot = false;
    });

    // Recalcular posiciones cuando el contenedor cambie de tamaño
    const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
            updateBlueprintDotPosition(savedPlanPosition.x, savedPlanPosition.y);
            renderMarkers();
            renderAreas();
        });
    });
    resizeObserver.observe(blueprintImage.parentElement);
}

// ==================== MARCADORES ====================
function renderMarkers() {
    if (!blueprintMarkersContainer) return;
    blueprintMarkersContainer.innerHTML = '';
    const markers = getLevelMarkers();
    markers.forEach((marker, idx) => {
        const markerDiv = document.createElement('div');
        markerDiv.className = 'blueprint-marker';
        markerDiv.setAttribute('data-idx', idx);
        const img = document.createElement('img');
        img.src = 'img/eye.png';
        img.draggable = false;
        markerDiv.appendChild(img);
        blueprintMarkersContainer.appendChild(markerDiv);
        updateMarkerPosition(markerDiv, marker.x, marker.y);
        makeMarkerDraggable(markerDiv, idx);
    });
}

function updateMarkerPosition(markerDiv, x, y) {
    if (!blueprintImage.complete) return;
    const rect = blueprintImage.getBoundingClientRect();
    const wrapperRect = blueprintMarkersContainer.parentElement.getBoundingClientRect();
    const relativeX = rect.left - wrapperRect.left;
    const relativeY = rect.top - wrapperRect.top;
    const px = relativeX + (x * rect.width);
    const py = relativeY + (y * rect.height);
    markerDiv.style.left = `${px}px`;
    markerDiv.style.top = `${py}px`;
}

function makeMarkerDraggable(markerDiv, markerIdx) {
    let dragging = false;
    let startX, startY;
    const onMouseDown = (e) => {
        if (e.button !== 0 || isRO()) return;
        e.stopPropagation();
        dragging = true;
        startX = e.clientX;
        startY = e.clientY;
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };
    const onMouseMove = (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const currentLeft = parseFloat(markerDiv.style.left);
        const currentTop = parseFloat(markerDiv.style.top);
        let newLeft = currentLeft + dx;
        let newTop = currentTop + dy;
        const rect = blueprintImage.getBoundingClientRect();
        const wrapperRect = blueprintMarkersContainer.parentElement.getBoundingClientRect();
        const relativeX = rect.left - wrapperRect.left;
        const relativeY = rect.top - wrapperRect.top;
        let uvX = (newLeft - relativeX) / rect.width;
        let uvY = (newTop - relativeY) / rect.height;
        uvX = Math.max(0, Math.min(1, uvX));
        uvY = Math.max(0, Math.min(1, uvY));
        markerDiv.style.left = `${relativeX + uvX * rect.width}px`;
        markerDiv.style.top = `${relativeY + uvY * rect.height}px`;
        const markers = getLevelMarkers();
        if (markers[markerIdx]) {
            markers[markerIdx].x = uvX;
            markers[markerIdx].y = uvY;
        }
        startX = e.clientX;
        startY = e.clientY;
    };
    const onMouseUp = () => {
        if (dragging) saveMarkers(getLevelMarkers());
        dragging = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    };
    markerDiv.addEventListener('mousedown', onMouseDown);
}

function addMarkerAtUV(uvX, uvY) {
    const markers = getLevelMarkers();
    markers.push({ x: uvX, y: uvY });
    saveMarkers(markers);
    renderMarkers();
    showMessage('Ubicación añadida en el plano', 1500);
}

function startAddMarkerMode() {
    addingMarkerMode = true;
    showMessage('Haz clic en el plano para añadir una ubicación', 2000);
    const wrapper = blueprintImage.parentElement;
    const onClickPlane = (e) => {
        if (!addingMarkerMode) return;
        const rect = blueprintImage.getBoundingClientRect();
        const cx = e.clientX;
        const cy = e.clientY;
        let uvX = (cx - rect.left) / rect.width;
        let uvY = (cy - rect.top) / rect.height;
        if (uvX >= 0 && uvX <= 1 && uvY >= 0 && uvY <= 1) {
            addMarkerAtUV(uvX, uvY);
            addingMarkerMode = false;
            wrapper.removeEventListener('click', onClickPlane);
        }
    };
    wrapper.addEventListener('click', onClickPlane);
    setTimeout(() => {
        if (addingMarkerMode) {
            addingMarkerMode = false;
            wrapper.removeEventListener('click', onClickPlane);
            showMessage('Modo añadir ubicación desactivado', 1500);
        }
    }, 10000);
}

// ==================== ÁREAS / POLÍGONOS ====================

function getSceneAreas() {
    const scene = projectData.scenes[currentSceneIndex];
    if (!scene) return [];
    if (!scene.areas) scene.areas = [];
    return scene.areas;
}

function getAreaStyle() {
    if (!projectData.areaStyle) projectData.areaStyle = { ...DEFAULT_AREA_STYLE };
    // Migrate old style objects that lack new fields
    const s = projectData.areaStyle;
    if (s.fillEnabled === undefined) s.fillEnabled = true;
    if (s.fillType === undefined) s.fillType = 'solid';
    if (s.strokeEnabled === undefined) s.strokeEnabled = true;
    if (s.strokeColor === undefined) s.strokeColor = s.fillColor || '#cc0000';
    return s;
}

// Create or reuse a SVG <defs> pattern for hatch fills
function ensureHatchPattern(svgEl, type, color, opacity) {
    const id = `bp-hatch-${type}`;
    let defs = svgEl.querySelector('defs');
    if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svgEl.prepend(defs); }
    // Remove old pattern of same id so color updates apply
    const old = defs.querySelector(`#${id}`);
    if (old) old.remove();

    const pat = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pat.setAttribute('id', id);
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('width', '8');
    pat.setAttribute('height', '8');

    const hex = color || '#cc0000';
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const stroke = `rgba(${r},${g},${b},${opacity})`;

    const makeLine = (x1,y1,x2,y2) => {
        const l = document.createElementNS('http://www.w3.org/2000/svg','line');
        l.setAttribute('x1',x1); l.setAttribute('y1',y1);
        l.setAttribute('x2',x2); l.setAttribute('y2',y2);
        l.setAttribute('stroke', stroke);
        l.setAttribute('stroke-width','1');
        return l;
    };
    const makeCirc = (cx,cy) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg','circle');
        c.setAttribute('cx',cx); c.setAttribute('cy',cy); c.setAttribute('r','1');
        c.setAttribute('fill', stroke);
        return c;
    };

    if (type === 'hatch45')  { pat.appendChild(makeLine(0,8,8,0)); pat.appendChild(makeLine(-2,2,2,-2)); pat.appendChild(makeLine(6,10,10,6)); }
    if (type === 'hatch135') { pat.appendChild(makeLine(0,0,8,8)); pat.appendChild(makeLine(-2,6,2,10)); pat.appendChild(makeLine(6,-2,10,2)); }
    if (type === 'cross')    { pat.appendChild(makeLine(0,8,8,0)); pat.appendChild(makeLine(0,0,8,8)); }
    if (type === 'dots')     { pat.appendChild(makeCirc(2,2)); pat.appendChild(makeCirc(6,6)); }

    defs.appendChild(pat);
    return `url(#${id})`;
}

function applyPolyStyle(poly, isSelected) {
    const s = getAreaStyle();
    const hex   = s.fillColor   || '#cc0000';
    const shex  = s.strokeColor || hex;
    const op    = s.fillOpacity !== undefined ? s.fillOpacity : 0.30;
    const selExtra = isSelected ? 0.12 : 0;

    // FILL
    if (!s.fillEnabled) {
        poly.style.fill = 'none';
    } else if (s.fillType && s.fillType !== 'solid') {
        poly.style.fill = ensureHatchPattern(svgAreas, s.fillType, hex, Math.min(op + selExtra, 1));
    } else {
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        poly.style.fill = `rgba(${r},${g},${b},${Math.min(op + selExtra, 1)})`;
    }

    // STROKE
    if (!s.strokeEnabled) {
        poly.style.stroke = 'none';
        poly.style.strokeWidth = 0;
    } else {
        const r = parseInt(shex.slice(1,3),16), g = parseInt(shex.slice(3,5),16), b = parseInt(shex.slice(5,7),16);
        poly.style.stroke = `rgba(${r},${g},${b},${isSelected ? 1 : 0.85})`;
        poly.style.strokeWidth = s.strokeWidth || 1.5;
        const dash = s.strokeDash || 'none';
        poly.style.strokeDasharray = dash === 'none' ? '' : dash;
    }
}

function saveAreas() {
    saveToLocalStorage();
}

function uvToSVG(uvX, uvY) {
    const rect = blueprintImage.getBoundingClientRect();
    const wrapperRect = svgAreas.parentElement.getBoundingClientRect();
    return {
        x: (rect.left - wrapperRect.left) + uvX * rect.width,
        y: (rect.top - wrapperRect.top) + uvY * rect.height
    };
}

function clientToUV(cx, cy) {
    const rect = blueprintImage.getBoundingClientRect();
    return {
        x: Math.max(0, Math.min(1, (cx - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (cy - rect.top) / rect.height))
    };
}

function pointsToPolygonStr(points) {
    return points.map(p => {
        const px = uvToSVG(p.x, p.y);
        return `${px.x},${px.y}`;
    }).join(' ');
}

function renderAreas() {
    if (!svgAreas) return;
    svgAreas.innerHTML = '';
    const areas = getSceneAreas();
    areas.forEach((area, aIdx) => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', pointsToPolygonStr(area.points));
        poly.classList.add('bp-area-poly');
        applyPolyStyle(poly, aIdx === selectedAreaIdx);
        if (aIdx === selectedAreaIdx) poly.classList.add('selected');
        poly.style.pointerEvents = 'all';
        poly.addEventListener('mousedown', (e) => {
            if (isDrawingArea || isRO()) return;
            e.stopPropagation();
            selectArea(aIdx);
        });
        g.appendChild(poly);

        // Handles solo en modo edición y cuando el área está seleccionada
        if (editMode && aIdx === selectedAreaIdx) {
            area.points.forEach((pt, pIdx) => {
                const pos = uvToSVG(pt.x, pt.y);
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', pos.x);
                circle.setAttribute('cy', pos.y);
                circle.setAttribute('r', 5);
                circle.classList.add('bp-vertex-handle');
                circle.style.pointerEvents = 'all';
                makeVertexDraggable(circle, aIdx, pIdx);
                g.appendChild(circle);
            });

            const pts = area.points;
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                const b = pts[(i + 1) % pts.length];
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                const mpos = uvToSVG(mid.x, mid.y);
                const edgeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                edgeHandle.setAttribute('cx', mpos.x);
                edgeHandle.setAttribute('cy', mpos.y);
                edgeHandle.setAttribute('r', 3.5);
                edgeHandle.classList.add('bp-edge-handle');
                edgeHandle.style.pointerEvents = 'all';
                edgeHandle.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const areas2 = getSceneAreas();
                    areas2[aIdx].points.splice(i + 1, 0, { x: mid.x, y: mid.y });
                    saveAreas();
                    renderAreas();
                    renderAreaList();
                });
                g.appendChild(edgeHandle);
            }
        }
        svgAreas.appendChild(g);
    });
}

function makeVertexDraggable(circle, aIdx, pIdx) {
    let dragging = false;
    let dragStartUV = null;
    circle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        dragging = true;
        dragStartUV = clientToUV(e.clientX, e.clientY);
        const onMove = (ev) => {
            if (!dragging) return;
            let uv = clientToUV(ev.clientX, ev.clientY);
            // Snap ortogonal con Shift
            if (ev.shiftKey) {
                const dx = Math.abs(uv.x - dragStartUV.x);
                const dy = Math.abs(uv.y - dragStartUV.y);
                if (dx > dy) uv = { x: uv.x, y: dragStartUV.y };
                else uv = { x: dragStartUV.x, y: uv.y };
                blueprintImage.parentElement.classList.add('snap-active');
            } else {
                blueprintImage.parentElement.classList.remove('snap-active');
            }
            const areas = getSceneAreas();
            areas[aIdx].points[pIdx] = uv;
            const pos = uvToSVG(uv.x, uv.y);
            circle.setAttribute('cx', pos.x);
            circle.setAttribute('cy', pos.y);
            // Antes se llamaba renderAreas() acá: destruía el círculo que se estaba
            // arrastrando y el arrastre se cortaba. Ahora solo se actualiza el polígono.
            const g = circle.parentElement;
            const poly = g && g.querySelector('polygon');
            if (poly) poly.setAttribute('points', pointsToPolygonStr(areas[aIdx].points));
        };
        const onUp = () => {
            dragging = false;
            dragStartUV = null;
            blueprintImage.parentElement.classList.remove('snap-active');
            saveAreas();
            renderAreas();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });
}

function selectArea(idx) {
    selectedAreaIdx = idx;
    if (idx === null) editMode = false;
    renderAreas();
    renderAreaList();
    const delBtn  = document.getElementById('bpDeleteAreaBtn');
    const editBtn = document.getElementById('bpEditAreaBtn');
    if (delBtn)  delBtn.style.display  = idx !== null ? '' : 'none';
    if (editBtn) editBtn.style.display = idx !== null ? '' : 'none';
    if (editBtn) editBtn.classList.toggle('active', editMode);
}

function renderAreaList() {
    const list = document.getElementById('bpAreaList');
    if (!list) return;
    list.innerHTML = '';
    const areas = getSceneAreas();
    if (areas.length === 0) {
        list.innerHTML = '<p style="color:rgba(255,255,255,0.4);font-size:11px;font-family:monospace;margin:0;text-align:center;padding:8px 0">Sin áreas definidas</p>';
        return;
    }
    areas.forEach((area, idx) => {
        const item = document.createElement('div');
        item.className = 'bp-area-item' + (idx === selectedAreaIdx ? ' selected' : '');
        item.innerHTML = `
            <span class="bp-area-item-name">Área ${idx + 1}</span>
            <span class="bp-area-item-del" data-idx="${idx}" title="Eliminar">×</span>
        `;
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('bp-area-item-del')) return;
            editMode = false;
            selectArea(idx);
        });
        item.querySelector('.bp-area-item-del').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteArea(idx);
        });
        list.appendChild(item);
    });
}

function deleteArea(idx) {
    const areas = getSceneAreas();
    areas.splice(idx, 1);
    if (selectedAreaIdx === idx) selectedAreaIdx = null;
    else if (selectedAreaIdx > idx) selectedAreaIdx--;
    saveAreas();
    renderAreas();
    renderAreaList();
    const delBtn = document.getElementById('bpDeleteAreaBtn');
    if (delBtn) delBtn.style.display = selectedAreaIdx !== null ? '' : 'none';
}

function startDrawingArea() {
    if (isDrawingArea) return;
    isDrawingArea = true;
    selectedAreaIdx = null;
    renderAreas();
    const wrapper = blueprintImage.parentElement;
    wrapper.classList.add('drawing-area');
    showMessage('Haz click y arrastra para definir el área', 2500);

    const onMouseDown = (e) => {
        if (!isDrawingArea) return;
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        drawStartUV = clientToUV(e.clientX, e.clientY);
        drawRectEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        drawRectEl.classList.add('bp-area-poly', 'drawing');
        applyPolyStyle(drawRectEl, false);
        drawRectEl.style.opacity = '0.6';
        svgAreas.appendChild(drawRectEl);

        const onMouseMove = (ev) => {
            if (!drawStartUV) return;
            const cur = clientToUV(ev.clientX, ev.clientY);
            const a = drawStartUV, b = cur;
            const rectPoints = [
                { x: a.x, y: a.y }, { x: b.x, y: a.y },
                { x: b.x, y: b.y }, { x: a.x, y: b.y }
            ];
            drawRectEl.setAttribute('points', pointsToPolygonStr(rectPoints));
        };

        const onMouseUp = (ev) => {
            wrapper.removeEventListener('mousemove', onMouseMove);
            wrapper.removeEventListener('mouseup', onMouseUp);
            wrapper.removeEventListener('mousedown', onMouseDown);
            wrapper.classList.remove('drawing-area');
            isDrawingArea = false;
            const end = clientToUV(ev.clientX, ev.clientY);
            const a = drawStartUV;
            if (Math.abs(end.x - a.x) > 0.01 && Math.abs(end.y - a.y) > 0.01) {
                const newArea = {
                    points: [
                        { x: a.x, y: a.y }, { x: end.x, y: a.y },
                        { x: end.x, y: end.y }, { x: a.x, y: end.y }
                    ]
                };
                const areas = getSceneAreas();
                areas.push(newArea);
                selectedAreaIdx = areas.length - 1;
                editMode = false;
                saveAreas();
                showMessage('Área creada. Seleccionala en el panel y usá "Editar polígono" para ajustar vértices.', 3000);
            } else {
                if (drawRectEl && svgAreas.contains(drawRectEl)) svgAreas.removeChild(drawRectEl);
            }
            drawStartUV = null;
            drawRectEl = null;
            renderAreas();
            renderAreaList();
            const delBtn = document.getElementById('bpDeleteAreaBtn');
            if (delBtn) delBtn.style.display = selectedAreaIdx !== null ? '' : 'none';
        };

        wrapper.addEventListener('mousemove', onMouseMove);
        wrapper.addEventListener('mouseup', onMouseUp);
    };

    wrapper.addEventListener('mousedown', onMouseDown);

    const onKey = (e) => {
        if (e.key === 'Escape' && isDrawingArea) {
            isDrawingArea = false;
            wrapper.classList.remove('drawing-area');
            wrapper.removeEventListener('mousedown', onMouseDown);
            if (drawRectEl && svgAreas.contains(drawRectEl)) svgAreas.removeChild(drawRectEl);
            drawRectEl = null;
            drawStartUV = null;
            showMessage('Modo dibujo cancelado', 1500);
            window.removeEventListener('keydown', onKey);
        }
    };
    window.addEventListener('keydown', onKey);
}

// ==================== CONTROLES ====================
function bindControls() {
    const settings = getCurrentLevelSettings();
    bpScaleSlider.value = settings.scale;
    bpScaleValue.textContent = `${settings.scale}%`;
    blueprintScale = settings.scale / 100;
    offsetX = settings.offsetX;
    offsetY = settings.offsetY;
    bpOffsetXSlider.value = offsetX;
    bpOffsetXValue.textContent = `${offsetX}%`;
    bpOffsetYSlider.value = offsetY;
    bpOffsetYValue.textContent = `${offsetY}%`;
    applyImageTransform();

    bpScaleSlider.addEventListener('input', () => {
        const newScale = parseInt(bpScaleSlider.value, 10);
        bpScaleValue.textContent = `${newScale}%`;
        blueprintScale = newScale / 100;
        applyImageTransform();
        setCurrentLevelScale(newScale);
        showMessage(`Escala: ${newScale}%`, 1000);
    });
    bpOffsetXSlider.addEventListener('input', () => {
        offsetX = parseInt(bpOffsetXSlider.value, 10);
        bpOffsetXValue.textContent = `${offsetX}%`;
        applyImageTransform();
        setCurrentLevelOffsetX(offsetX);
        showMessage(`Desplazamiento X: ${offsetX}%`, 1000);
    });
    bpOffsetYSlider.addEventListener('input', () => {
        offsetY = parseInt(bpOffsetYSlider.value, 10);
        bpOffsetYValue.textContent = `${offsetY}%`;
        applyImageTransform();
        setCurrentLevelOffsetY(offsetY);
        showMessage(`Desplazamiento Y: ${offsetY}%`, 1000);
    });

    blueprintConfigToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        blueprintControls.classList.toggle('enabled');
        blueprintEyePanel.classList.remove('enabled');
        blueprintAreaPanel.classList.remove('enabled');
        if (blueprintControls.classList.contains('enabled')) {
            const s = getCurrentLevelSettings();
            bpScaleSlider.value = s.scale;
            bpScaleValue.textContent = `${s.scale}%`;
            blueprintScale = s.scale / 100;
            offsetX = s.offsetX;
            offsetY = s.offsetY;
            bpOffsetXSlider.value = offsetX;
            bpOffsetXValue.textContent = `${offsetX}%`;
            bpOffsetYSlider.value = offsetY;
            bpOffsetYValue.textContent = `${offsetY}%`;
            applyImageTransform();
        }
    });

    // Subir una imagen de plano nueva al proyecto
    const lvlInput = document.getElementById('bpAddLevelInput');
    document.getElementById('bpAddLevelBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isRO()) lvlInput?.click();
    });
    lvlInput?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length && window.addLevelFiles) await window.addLevelFiles(files);
    });

    blueprintAddMarkerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startAddMarkerMode();
    });

    blueprintEyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        blueprintEyePanel.classList.toggle('enabled');
        blueprintControls.classList.remove('enabled');
        blueprintAreaPanel.classList.remove('enabled');
    });
    document.getElementById('blueprintEyePanelClose').addEventListener('click', (e) => {
        e.stopPropagation();
        blueprintEyePanel.classList.remove('enabled');
    });

    document.getElementById('blueprintAreaPanelClose').addEventListener('click', (e) => {
        e.stopPropagation();
        blueprintAreaPanel.classList.remove('enabled');
    });

    blueprintDotToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = blueprintDotToggle.classList.toggle('active');
        blueprintDot.style.display = isActive ? '' : 'none';
        if (projectData.scenes[currentSceneIndex]) projectData.scenes[currentSceneIndex].showDot = isActive;
        saveToLocalStorage();
    });

    bpOrientationSlider.addEventListener('input', () => {
        const val = parseInt(bpOrientationSlider.value, 10);
        bpOrientationValue.textContent = `${val}°`;
        if (!projectData.scenes[currentSceneIndex]) return;
        projectData.scenes[currentSceneIndex].planOrientation = val;
        saveToLocalStorage();
        updateBlueprintRotation();
    });

    // Botón añadir área
    document.getElementById('bpAddAreaBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        blueprintAreaPanel.classList.remove('enabled');
        startDrawingArea();
    });

    // Botón editar polígono — activa/desactiva modo edición
    document.getElementById('bpEditAreaBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedAreaIdx === null) return;
        editMode = !editMode;
        e.currentTarget.classList.toggle('active', editMode);
        renderAreas();
        showMessage(editMode ? 'Modo edición activo. Arrastrá vértices con Shift para snap ortogonal.' : 'Modo edición desactivado.', 2000);
    });

    document.getElementById('bpDeleteAreaBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedAreaIdx !== null) deleteArea(selectedAreaIdx);
    });

    svgAreas.addEventListener('mousedown', (e) => {
        if (e.target === svgAreas) {
            editMode = false;
            selectArea(null);
        }
    });

    // Controles de estilo global de áreas
    const syncStyleUI = () => {
        const s = getAreaStyle();
        const fillColorEl      = document.getElementById('bpAreaFillColor');
        const opacityEl        = document.getElementById('bpAreaOpacity');
        const opacityValEl     = document.getElementById('bpAreaOpacityVal');
        const fillTypeEl       = document.getElementById('bpAreaFillType');
        const fillToggleEl     = document.getElementById('bpFillToggle');
        const fillOptionsEl    = document.getElementById('bpFillOptions');
        const strokeColorEl    = document.getElementById('bpAreaStrokeColor');
        const dashEl           = document.getElementById('bpAreaStrokeDash');
        const strokeWidthEl    = document.getElementById('bpAreaStrokeWidth');
        const strokeWidthValEl = document.getElementById('bpAreaStrokeWidthVal');
        const strokeToggleEl   = document.getElementById('bpStrokeToggle');
        const strokeOptionsEl  = document.getElementById('bpStrokeOptions');

        if (fillColorEl)      fillColorEl.value      = s.fillColor   || '#cc0000';
        if (strokeColorEl)    strokeColorEl.value    = s.strokeColor || '#cc0000';
        if (opacityEl)        opacityEl.value        = Math.round((s.fillOpacity || 0.30) * 100);
        if (opacityValEl)     opacityValEl.textContent = `${Math.round((s.fillOpacity || 0.30) * 100)}%`;
        if (fillTypeEl)       fillTypeEl.value       = s.fillType    || 'solid';
        if (dashEl)           dashEl.value           = s.strokeDash  || 'none';
        if (strokeWidthEl)    strokeWidthEl.value    = s.strokeWidth || 1.5;
        if (strokeWidthValEl) strokeWidthValEl.textContent = `${s.strokeWidth || 1.5}px`;
        const fe = s.fillEnabled !== false;
        const se = s.strokeEnabled !== false;
        if (fillToggleEl)    fillToggleEl.classList.toggle('active', fe);
        if (fillOptionsEl)   fillOptionsEl.style.opacity  = fe ? '1' : '0.35';
        if (strokeToggleEl)  strokeToggleEl.classList.toggle('active', se);
        if (strokeOptionsEl) strokeOptionsEl.style.opacity = se ? '1' : '0.35';
    };
    syncStyleUI();

    // Fill toggle
    document.getElementById('bpFillToggle').addEventListener('click', (e) => {
        e.stopPropagation();
        getAreaStyle().fillEnabled = !getAreaStyle().fillEnabled;
        saveToLocalStorage(); syncStyleUI(); renderAreas();
    });
    // Stroke toggle
    document.getElementById('bpStrokeToggle').addEventListener('click', (e) => {
        e.stopPropagation();
        getAreaStyle().strokeEnabled = !getAreaStyle().strokeEnabled;
        saveToLocalStorage(); syncStyleUI(); renderAreas();
    });
    document.getElementById('bpAreaFillType').addEventListener('change', (e) => {
        getAreaStyle().fillType = e.target.value;
        saveToLocalStorage(); renderAreas();
    });
    document.getElementById('bpAreaFillColor').addEventListener('input', (e) => {
        getAreaStyle().fillColor = e.target.value;
        saveToLocalStorage(); renderAreas();
    });
    document.getElementById('bpAreaOpacity').addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        document.getElementById('bpAreaOpacityVal').textContent = `${val}%`;
        getAreaStyle().fillOpacity = val / 100;
        saveToLocalStorage(); renderAreas();
    });
    document.getElementById('bpAreaStrokeColor').addEventListener('input', (e) => {
        getAreaStyle().strokeColor = e.target.value;
        saveToLocalStorage(); renderAreas();
    });
    document.getElementById('bpAreaStrokeDash').addEventListener('change', (e) => {
        getAreaStyle().strokeDash = e.target.value;
        saveToLocalStorage(); renderAreas();
    });
    document.getElementById('bpAreaStrokeWidth').addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        document.getElementById('bpAreaStrokeWidthVal').textContent = `${val}px`;
        getAreaStyle().strokeWidth = val;
        saveToLocalStorage(); renderAreas();
    });

    // Abrir panel area
    blueprintAreaBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        blueprintAreaPanel.classList.toggle('enabled');
        blueprintControls.classList.remove('enabled');
        blueprintEyePanel.classList.remove('enabled');
        if (blueprintAreaPanel.classList.contains('enabled')) syncStyleUI();
    });
}

export function updateBlueprintFromScene(sceneData, sceneIndex) {
    if (sceneIndex !== undefined) currentSceneIndex = sceneIndex;
    else {
        const found = projectData.scenes.findIndex(s => s.id === sceneData.id);
        if (found !== -1) currentSceneIndex = found;
    }
    const planPos = sceneData.planPosition || { x: 0.5, y: 0.5 };
    savedPlanPosition = planPos;
    if (blueprintImageLoaded) updateBlueprintDotPosition(planPos.x, planPos.y);

    sceneData.planOrientation = sceneData.planOrientation ?? 0;

    // Resetear acumuladores de rotación
    accumulatedBlueprintRotation = 0;
    if (camera) {
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        lastBlueprintAngle = THREE.MathUtils.radToDeg(Math.atan2(-forward.x, forward.z));
    }
    updateBlueprintRotation();

    // Sincronizar slider de orientación
    if (bpOrientationSlider) {
        bpOrientationSlider.value = sceneData.planOrientation;
        bpOrientationValue.textContent = `${sceneData.planOrientation}°`;
    }

    // Visibilidad del dot por escena
    const showDot = sceneData.showDot !== false;
    blueprintDot.style.display = showDot ? '' : 'none';
    if (blueprintDotToggle) {
        blueprintDotToggle.classList.toggle('active', showDot);
    }

    const settings = getCurrentLevelSettings();
    blueprintScale = settings.scale / 100;
    offsetX = settings.offsetX;
    offsetY = settings.offsetY;
    applyImageTransform();
    if (bpScaleSlider && blueprintControls?.classList.contains('enabled')) {
        bpScaleSlider.value = settings.scale;
        bpScaleValue.textContent = `${settings.scale}%`;
        bpOffsetXSlider.value = offsetX;
        bpOffsetXValue.textContent = `${offsetX}%`;
        bpOffsetYSlider.value = offsetY;
        bpOffsetYValue.textContent = `${offsetY}%`;
    }

    renderMarkers();

    // Áreas: resetear selección y redibujar
    selectedAreaIdx = null;
    editMode = false;
    renderAreas();
    renderAreaList();
    const delBtn = document.getElementById('bpDeleteAreaBtn');
    if (delBtn) delBtn.style.display = 'none';
}

export function initBlueprint(data, sceneIdx, cam, saveCallback, messageCallback) {
    projectData = data;
    currentSceneIndex = sceneIdx;
    camera = cam;
    onSaveCallback = saveCallback;
    onMessageCallback = messageCallback;

    if (!projectData.levelSettings) projectData.levelSettings = {};
    if (!projectData.levelMarkers) projectData.levelMarkers = {};
    if (!projectData.areaStyle) projectData.areaStyle = { ...DEFAULT_AREA_STYLE };

    blueprintContainer = document.getElementById('blueprintContainer');
    blueprintImage = document.getElementById('blueprintImage');
    blueprintDot = document.getElementById('blueprintDot');
    blueprintMarkersContainer = document.getElementById('blueprintMarkers');
    bpScaleSlider = document.getElementById('bpScaleSlider');
    bpScaleValue = document.getElementById('bpScaleValue');
    bpOffsetXSlider = document.getElementById('bpOffsetXSlider');
    bpOffsetXValue = document.getElementById('bpOffsetXValue');
    bpOffsetYSlider = document.getElementById('bpOffsetYSlider');
    bpOffsetYValue = document.getElementById('bpOffsetYValue');
    blueprintConfigToggle = document.getElementById('blueprintConfigToggle');
    blueprintAddMarkerBtn = document.getElementById('blueprintAddMarkerBtn');
    blueprintControls = document.getElementById('blueprintControls');
    blueprintEyeBtn = document.getElementById('blueprintEyeBtn');
    blueprintEyePanel = document.getElementById('blueprintEyePanel');
    blueprintAreaBtn = document.getElementById('blueprintAreaBtn');
    blueprintAreaPanel = document.getElementById('blueprintAreaPanel');
    blueprintDotToggle = document.getElementById('blueprintDotToggle');
    bpOrientationSlider = document.getElementById('bpOrientationSlider');
    bpOrientationValue = document.getElementById('bpOrientationValue');
    svgAreas = document.getElementById('blueprintAreas');

    if (!blueprintImage || !blueprintDot) {
        console.warn('Blueprint DOM elements not found');
        return;
    }
    bindControls();
    initBlueprintDraggable();
}
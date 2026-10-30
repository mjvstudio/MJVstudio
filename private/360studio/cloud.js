// ==========================================
// CLOUD - Persistencia online (proyectos, imágenes, usuarios y accesos)
// ==========================================
// Cuando el Studio se abre desde su link privado, usa:
//   · db     → proyectos (projects/<pid>) y registro de accesos (access/<uid>)
//   · assets → imágenes de escenas y planos
//   · user   → quién está usando el programa
// Abierto en local (Live Server, etc.) todo esto devuelve null y el Studio
// funciona como siempre con localStorage.

let db = null, assets = null, user = null;
let me = null;               // { id, name, email, canEdit, isOwner }
let canWrite = false;
let ready = null;

const CLOUD_TIMEOUT = 6000;

function withTimeout(p, ms) {
    return Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
}

export function initCloud() {
    if (ready) return ready;
    ready = (async () => {
        if (!window.claude || typeof window.claude.use !== 'function') return null;
        try {
            [db, assets, user] = await withTimeout(Promise.all([
                window.claude.use('db'),
                window.claude.use('assets'),
                window.claude.use('user')
            ]), CLOUD_TIMEOUT) || [null, null, null];
        } catch (e) { console.warn('Cloud no disponible', e); return null; }
        if (!db || !user) { db = null; return null; }

        const v = await user.me().catch(() => null);
        const id = await user.id().catch(() => null);
        const w = await user.can('data.write').catch(() => null);
        canWrite = w !== false;
        me = {
            id,
            name: (v && v.name) || '',
            email: (v && v.email) || null,
            canEdit: !!(v && v.canEdit),
            isOwner: !!(v && v.isOwner)
        };
        return { me, canWrite, canUpload: !!assets };
    })();
    return ready;
}

export const isCloud = () => !!db;
export const getMe = () => me;
export const cloudCanWrite = () => canWrite;
export const cloudCanUpload = () => !!assets;

// ---------- Registro de accesos ----------
export async function logAccess() {
    if (!db || !me || !me.id || !canWrite) return;
    try {
        const ref = db.doc(`access/${me.id}`);
        const snap = await ref.get();
        const prev = snap.exists ? snap.data() : {};
        const now = new Date().toISOString();
        const history = Array.isArray(prev.history) ? prev.history.slice(-99) : [];
        history.push(now);
        await ref.set({ uid: me.id, last: now, first: prev.first || now, count: (prev.count || 0) + 1, history });
    } catch (e) { console.warn('No se pudo registrar el acceso', e); }
}

export async function listAccess() {
    if (!db) return [];
    const snap = await db.collection('access').orderBy('last', 'desc').limit(200).get();
    const rows = snap.docs.filter(d => d.exists).map(d => ({ id: d.id, ...d.data() }));
    const ids = rows.map(r => r.uid || r.id);
    let profiles = {};
    try { profiles = await user.profiles(ids); } catch (e) {}
    return rows.map(r => {
        const p = profiles[r.uid || r.id] || {};
        return { ...r, name: p.name || 'Usuario', email: p.email || '', isMe: !!p.isMe };
    });
}

export async function getProfileName(uid) {
    if (!user || !uid) return '';
    try { const p = await user.profiles([uid]); return (p[uid] && p[uid].name) || ''; } catch (e) { return ''; }
}

// ---------- Proyectos ----------
export async function listProjects() {
    if (!db) return [];
    const snap = await db.collection('projects').orderBy('updatedAt', 'desc').limit(100).get();
    return snap.docs.filter(d => d.exists).map(d => {
        const x = d.data();
        return { pid: d.id, name: x.name, updatedAt: x.updatedAt, updatedBy: x.updatedBy, scenes: (x.data && x.data.scenes || []).length };
    });
}

export async function loadProject(pid) {
    if (!db) return null;
    const snap = await db.doc(`projects/${pid}`).get();
    if (!snap.exists) return null;
    return JSON.parse(JSON.stringify(snap.data().data));
}

export function newProjectId() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Guardado con "debounce": una escritura a la vez por documento.
let pending = null, saving = false, saveTimer = null, lastSavedJson = '';
let onStatus = () => {};
export function onSaveStatus(fn) { onStatus = fn; }

export function scheduleProjectSave(pid, data, delay = 1200) {
    if (!db || !canWrite || !pid) return;
    pending = { pid, data };
    clearTimeout(saveTimer);
    onStatus('pending');
    saveTimer = setTimeout(flushProjectSave, delay);
}

export async function flushProjectSave() {
    if (!pending || saving) return;
    const { pid, data } = pending;
    pending = null;
    const json = JSON.stringify(data);
    if (json === lastSavedJson) { onStatus('saved'); return; }
    if (json.length > 250000) { onStatus('error', 'El proyecto supera el tamaño máximo (250 KB de datos)'); return; }
    saving = true;
    onStatus('saving');
    try {
        await db.doc(`projects/${pid}`).set({
            name: data.name || 'Proyecto',
            data: JSON.parse(json),
            updatedAt: new Date().toISOString(),
            updatedBy: me ? me.id : null
        });
        lastSavedJson = json;
        try { localStorage.setItem('mjv_lastProject', pid); } catch (e) {}
        onStatus('saved');
    } catch (e) {
        console.error(e);
        onStatus('error', e && e.code === 'invalid_argument' ? 'Sin permiso para guardar' : 'Error al guardar en la nube');
    } finally {
        saving = false;
        if (pending) flushProjectSave();
    }
}

export function markSaved(data) { lastSavedJson = JSON.stringify(data); }

export async function deleteProject(pid) {
    if (!db) return;
    await db.doc(`projects/${pid}`).delete();
}

// Escucha cambios hechos por otros integrantes en el proyecto abierto.
let unsub = null;
export function watchProject(pid, onRemote) {
    if (unsub) { unsub(); unsub = null; }
    if (!db || !pid) return;
    unsub = db.doc(`projects/${pid}`).onSnapshot(snap => {
        if (!snap.exists || snap.metadata.hasPendingWrites) return;
        const x = snap.data();
        const json = JSON.stringify(x.data);
        if (json === lastSavedJson) return;
        if (me && x.updatedBy === me.id) return;
        lastSavedJson = json;
        onRemote(JSON.parse(json), x.updatedBy);
    }, err => console.warn('watchProject', err));
}

// ---------- Imágenes ----------
// Convierte a JPEG (máx. 4096px de lado) para que entren en la cuota y carguen rápido.
async function compressImage(blob, { maxSide = 4096, quality = 0.88, keepPng = false } = {}) {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (!keepPng) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close && bmp.close();
    const type = keepPng ? 'image/png' : 'image/jpeg';
    return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), type, quality));
}

export async function uploadImage(blob, opts = {}) {
    if (!assets) throw new Error('Sin permiso para subir imágenes');
    let out = blob;
    try {
        if (opts.keepPng) {
            if (blob.size > 18 * 1024 * 1024) out = await compressImage(blob, { maxSide: 6000, keepPng: false });
        } else {
            out = await compressImage(blob, opts);
        }
    } catch (e) { console.warn('No se pudo comprimir, se sube el original', e); }
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const r = await assets.upload(out, { type: out.type || 'image/jpeg' });
            return { id: r.id, type: out.type };
        } catch (e) {
            lastErr = e;
            if (e && e.code === 'rate_limited') { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
            throw e;
        }
    }
    throw lastErr;
}

export const assetUrl = (id) => '/_blob/' + id;

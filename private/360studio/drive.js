// ==========================================
// GOOGLE DRIVE — cargar la carpeta "MJV 360 Studio - <Proyecto>" desde Drive
// ==========================================
// Funciona en el link de Claude: usa el Google Drive que cada persona tiene conectado
// en Claude (sus permisos, sin contraseñas en la página). Baja SOLO lo que el Studio
// necesita de cada espacio: el render (x4 si no es muy pesado, si no el normal, si no
// la referencia de SketchUp), _espacio.json, _puntos.json y los planos.

// En TU WEB (mjvstudio.com) se conecta directo con Google: cada integrante entra con su
// cuenta de Google (ventana de Google) y el Studio lee la carpeta con la API de Drive.
// Necesita el "ID de cliente" de Google en google-config.js (ver instrucciones ahí).

const SERVER = 'Google Drive';
const FOLDER = 'application/vnd.google-apps.folder';
let MAX_X4_BYTES = 9 * 1024 * 1024;   // por el conector de Claude; directo con Google no hay límite práctico
let mcp = null;
let mode = null;          // 'claude' | 'google'
let gToken = null, gTokenExp = 0, gClient = null;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const gcfg = () => window.MJV_GOOGLE || {};
export const googleConfigured = () => !!(gcfg().clientId && /apps\.googleusercontent\.com$/.test(gcfg().clientId));

export async function initDrive() {
    if (window.claude && typeof window.claude.use === 'function') {
        try { mcp = await window.claude.use('mcp'); } catch (e) { mcp = null; }
        if (mcp) { mode = 'claude'; return true; }
    }
    if (googleConfigured()) { mode = 'google'; MAX_X4_BYTES = 40 * 1024 * 1024; return true; }
    return null;
}
export const driveReady = () => !!mode;
export const driveMode = () => mode;
export const googleSignedIn = () => !!gToken && Date.now() < gTokenExp;

function loadGsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.onload = () => res();
        s.onerror = () => rej({ code: 'gsi_failed' });
        document.head.appendChild(s);
    });
}

// Ventana de Google para entrar (tiene que llamarse desde un clic)
export async function googleSignIn() {
    await loadGsi();
    return new Promise((resolve, reject) => {
        gClient = google.accounts.oauth2.initTokenClient({
            client_id: gcfg().clientId,
            scope: SCOPE,
            callback: (r) => {
                if (r && r.access_token) {
                    gToken = r.access_token;
                    gTokenExp = Date.now() + ((+r.expires_in || 3600) - 60) * 1000;
                    resolve(true);
                } else reject({ code: 'google_denied', detail: r && r.error });
            },
            error_callback: (e) => reject({ code: e && e.type === 'popup_closed' ? 'google_closed' : 'google_denied' })
        });
        gClient.requestAccessToken({ prompt: googleSignedIn() ? '' : 'select_account' });
    });
}

async function gfetch(url, asBlob) {
    if (!googleSignedIn()) throw { code: 'google_signin' };
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + gToken } });
    if (r.status === 401) { gToken = null; throw { code: 'google_signin' }; }
    if (r.status === 403 || r.status === 404) throw { code: 'google_forbidden' };
    if (!r.ok) throw { code: 'server_unavailable' };
    return asBlob ? r.blob() : r.json();
}
const GAPI = 'https://www.googleapis.com/drive/v3/files';
const G_FIELDS = 'nextPageToken,files(id,name,mimeType,size,modifiedTime)';
async function gList(query, max = 1000) {
    const out = [];
    let pageToken = '';
    for (let i = 0; i < 20 && out.length < max; i++) {
        const u = `${GAPI}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(G_FIELDS)}&pageSize=1000` +
                  `&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=modifiedTime desc${pageToken ? '&pageToken=' + pageToken : ''}`;
        const p = await gfetch(u);
        (p.files || []).forEach(f => out.push({ id: f.id, title: f.name, mimeType: f.mimeType, fileSize: f.size, modifiedTime: f.modifiedTime }));
        pageToken = p.nextPageToken;
        if (!pageToken) break;
    }
    return out;
}

export function driveErrorText(e) {
    const c = e && e.code;
    if (c === 'google_signin') return 'Entrá con tu cuenta de Google para ver tu Drive.';
    if (c === 'google_closed') return 'Se cerró la ventana de Google antes de terminar.';
    if (c === 'google_denied') return 'Google no dio acceso. Revisá que tu cuenta esté en "Usuarios de prueba" del proyecto de Google.';
    if (c === 'google_forbidden') return 'Tu cuenta de Google no tiene acceso a esa carpeta (pedí que te la compartan).';
    if (c === 'gsi_failed') return 'No se pudo abrir el inicio de sesión de Google (revisá la conexión o un bloqueador).';
    if (c === 'server_not_connected') return 'Conectá Google Drive en Claude: Configuración → Conectores.';
    if (c === 'needs_reauth') return 'Volvé a conectar Google Drive en Claude: Configuración → Conectores.';
    if (c === 'not_in_manifest' || c === 'approval_required') return 'Hace falta permitir el acceso a Google Drive para esta página.';
    if (c === 'selection_required') return 'Elegí cuál cuenta de Google Drive usar (aviso de Claude) y probá de nuevo.';
    if (c === 'server_unavailable') return 'Google Drive no responde ahora. Probá en unos segundos.';
    return 'No se pudo leer Google Drive.';
}

async function call(tool, input) {
    if (!mcp) throw { code: 'not_granted' };
    let last;
    for (let i = 0; i < 2; i++) {
        try {
            const r = await mcp.callTool(SERVER, tool, input, { cache: false });
            if (r && r.payload !== undefined) return r.payload;
            const t = r && r.content && r.content.find(b => b.type === 'text');
            return t ? JSON.parse(t.text) : r;
        } catch (e) {
            last = e;
            if (!(e && (e.retryable || e.code === 'server_unavailable'))) break;
            await new Promise(r => setTimeout(r, (e.retryAfterMs || 1500)));
        }
    }
    throw last;
}

const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function searchAll(query, max = 400) {
    const out = [];
    let pageToken;
    for (let guard = 0; guard < 60 && out.length < max; guard++) {
        const p = await call('search_files', { query, pageSize: 100, excludeContentSnippets: true, ...(pageToken ? { pageToken } : {}) });
        const files = (p && p.files) || [];
        out.push(...files);
        pageToken = p && p.nextPageToken;
        if (!pageToken || !files.length) break;
    }
    const seen = new Set();
    return out.filter(f => f && f.id && !seen.has(f.id) && seen.add(f.id));
}

// Carpetas del proyecto (por defecto, las que arma el bridge: "MJV 360 Studio - …")
export async function findProjectFolders(text) {
    const t = (text || '').trim() || 'MJV 360 Studio';
    if (mode === 'google') return gList(`mimeType = '${FOLDER}' and name contains '${q(t)}' and trashed = false`, 60);
    const list = await searchAll(`mimeType = '${FOLDER}' and title contains '${q(t)}'`, 60);
    return list.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
}

const children = (id) => mode === 'google'
    ? gList(`'${q(id)}' in parents and trashed = false`)
    : searchAll(`parentId = '${q(id)}'`);

function b64ToBlob(b64, type) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type || 'application/octet-stream' });
}

async function download(f) {
    if (mode === 'google') {
        const blob = await gfetch(`${GAPI}/${encodeURIComponent(f.id)}?alt=media&supportsAllDrives=true`, true);
        return new File([blob], f.title, { type: f.mimeType || blob.type || '', lastModified: Date.parse(f.modifiedTime) || Date.now() });
    }
    const p = await call('download_file_content', { fileId: f.id });
    if (!p || !p.content) throw { code: 'upstream_error' };
    const file = new File([b64ToBlob(p.content, f.mimeType || p.mimeType)], f.title, {
        type: f.mimeType || p.mimeType || '',
        lastModified: Date.parse(f.modifiedTime) || Date.now()
    });
    return file;
}

const isImg = f => /^image\//.test(f.mimeType || '') || /\.(jpe?g|png|webp)$/i.test(f.title || '');
const REF = / - 1 ARRASTRAR A CHATGPT\.(jpe?g|png|webp)$/i;
const RENDER = / - 5 RENDER IA\.(jpe?g|png|webp)$/i;
const X4 = / - 5 RENDER IA x4\.(jpe?g|png|webp)$/i;
const SKIP = /^(_anteriores)$|datos tecnicos|^\./i;
const LEVELS = /^(niveles|planos)$/i;

// Devuelve File[] con webkitRelativePath "<Carpeta>/<Espacio>/<archivo>", igual que al
// elegir la carpeta en la compu, para usar exactamente el mismo proceso de importación.
export async function loadProjectFolder(folder, onProgress = () => {}) {
    onProgress(0, 'Leyendo la carpeta en Drive…');
    const root = folder.title || 'Proyecto';
    const top = await children(folder.id);
    const picks = [];          // { f, path }
    const subs = top.filter(f => f.mimeType === FOLDER && !SKIP.test(f.title || ''));
    const puntos = top.find(f => f.title === '_puntos.json');
    if (puntos) picks.push({ f: puntos, path: `${root}/_puntos.json` });

    let n = 0;
    for (const sub of subs) {
        onProgress(0.05 + 0.25 * (n++ / Math.max(1, subs.length)), `Revisando "${sub.title}"…`);
        const inside = await children(sub.id);
        if (LEVELS.test(sub.title)) {
            inside.filter(isImg).forEach(f => picks.push({ f, path: `${root}/${sub.title}/${f.title}` }));
            continue;
        }
        const imgs = inside.filter(isImg);
        const ref = imgs.find(f => REF.test(f.title));
        const meta = inside.find(f => f.title === '_espacio.json');
        if (!ref && !meta) continue;
        const x4 = imgs.find(f => X4.test(f.title) && (+f.fileSize || 0) <= MAX_X4_BYTES);
        const render = x4 || imgs.find(f => RENDER.test(f.title)) ||
            imgs.filter(f => f !== ref && !X4.test(f.title))
                .sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)))[0];
        const img = render || ref;
        if (img) picks.push({ f: img, path: `${root}/${sub.title}/${img.title}` });
        if (meta) picks.push({ f: meta, path: `${root}/${sub.title}/_espacio.json` });
    }
    if (!picks.some(p => isImg(p.f))) return [];

    // Descargas de a 3 en paralelo
    const files = new Array(picks.length);
    let done = 0, i = 0;
    const worker = async () => {
        while (i < picks.length) {
            const k = i++;
            const { f, path } = picks[k];
            const file = await download(f);
            Object.defineProperty(file, 'webkitRelativePath', { value: path });
            files[k] = file;
            done++;
            onProgress(0.3 + 0.7 * (done / picks.length), `Bajando de Drive ${done}/${picks.length}…`);
        }
    };
    await Promise.all([worker(), worker(), worker()]);
    return files;
}

// ==========================================
// GOOGLE DRIVE — cargar la carpeta "MJV 360 Studio - <Proyecto>" desde Drive
// ==========================================
// Funciona en el link de Claude: usa el Google Drive que cada persona tiene conectado
// en Claude (sus permisos, sin contraseñas en la página). Baja SOLO lo que el Studio
// necesita de cada espacio: el render (x4 si no es muy pesado, si no el normal, si no
// la referencia de SketchUp), _espacio.json, _puntos.json y los planos.

const SERVER = 'Google Drive';
const FOLDER = 'application/vnd.google-apps.folder';
const MAX_X4_BYTES = 9 * 1024 * 1024;   // más que esto viaja lento por el conector
let mcp = null;

export async function initDrive() {
    if (!window.claude || typeof window.claude.use !== 'function') return null;
    try { mcp = await window.claude.use('mcp'); } catch (e) { mcp = null; }
    return mcp;
}
export const driveReady = () => !!mcp;

export function driveErrorText(e) {
    const c = e && e.code;
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
    const list = await searchAll(`mimeType = '${FOLDER}' and title contains '${q(t)}'`, 60);
    return list.sort((a, b) => String(b.modifiedTime).localeCompare(String(a.modifiedTime)));
}

const children = (id) => searchAll(`parentId = '${q(id)}'`);

function b64ToBlob(b64, type) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: type || 'application/octet-stream' });
}

async function download(f) {
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

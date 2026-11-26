// Fotos das peças e looks: ficam no aparelho (IndexedDB) e, pelo WordPress, são copiadas para o perfil
// da usuária para aparecerem nos outros aparelhos. Na tela: <img data-photo="id"> é preenchida sozinha.
const DB = 'minharotina-fotos', STORE = 'p', PEND = 'minharotina.fotos.pend';
const mem = new Map();
let dbp = null;
const W = () => window.MR_WP || null;

function db() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return (dbp ||= new Promise((res) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result); r.onerror = () => res(null);
    } catch { res(null); }
  }));
}
async function idb(mode, fn) {
  const d = await db(); if (!d) return null;
  return new Promise((res) => {
    try { const tx = d.transaction(STORE, mode); const req = fn(tx.objectStore(STORE)); tx.oncomplete = () => res(req?.result ?? null); tx.onerror = () => res(null); }
    catch { res(null); }
  });
}
const pend = () => { try { return JSON.parse(localStorage.getItem(PEND)) || []; } catch { return []; } };
const setPend = (l) => { try { localStorage.setItem(PEND, JSON.stringify([...new Set(l)])); } catch { /* ignora */ } };

async function wp(method, body, q = '') {
  const res = await fetch(W().rest + 'foto' + q, { method, credentials: 'same-origin', cache: 'no-store',
    headers: { 'X-WP-Nonce': W().nonce, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
  return data;
}
async function upload(id, data) {
  if (!W()?.rest) return;
  try { await wp('POST', { id, data }); setPend(pend().filter((x) => x !== id)); }
  catch { setPend([...pend(), id]); }
}
/** envia fotos que ficaram pendentes (sem internet na hora) */
export async function flushPhotos() {
  if (!W()?.rest || !navigator.onLine) return;
  for (const id of pend()) { const d = await getPhoto(id, { local: true }); if (d) await upload(id, d); else setPend(pend().filter((x) => x !== id)); }
}

/** reduz a foto (lado maior = max px) e devolve um JPEG em dataURL */
export function resizePhoto(file, max = 720) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não consegui abrir essa foto.')); };
    img.src = url;
  });
}
export async function putPhoto(id, data) {
  mem.set(id, data);
  await idb('readwrite', (s) => s.put(data, id));
  upload(id, data);
}
export async function getPhoto(id, { local = false } = {}) {
  if (!id) return null;
  if (mem.has(id)) return mem.get(id);
  let d = await idb('readonly', (s) => s.get(id));
  if (!d && !local && W()?.rest && navigator.onLine) {
    try { d = (await wp('GET', null, `?id=${encodeURIComponent(id)}`)).data || null; if (d) await idb('readwrite', (s) => s.put(d, id)); } catch { d = null; }
  }
  if (d) mem.set(id, d);
  return d;
}
export async function delPhoto(id) {
  mem.delete(id); await idb('readwrite', (s) => s.delete(id));
  if (W()?.rest) wp('DELETE', null, `?id=${encodeURIComponent(id)}`).catch(() => {});
}

/** preenche as <img data-photo> que ainda estão vazias */
const loading = new Set();
export function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]:not([src])').forEach(async (img) => {
    const id = img.dataset.photo; if (loading.has(img)) return; loading.add(img);
    const d = await getPhoto(id); loading.delete(img);
    if (d) { img.src = d; img.closest('.ph')?.classList.add('has'); } else img.closest('.ph')?.classList.add('none');
  });
}
// qualquer tela nova (inclusive janelas que abrem por baixo) ganha as fotos
if (typeof MutationObserver !== 'undefined') {
  new MutationObserver((ms) => { if (ms.some((m) => m.addedNodes.length)) hydratePhotos(); }).observe(document.documentElement, { childList: true, subtree: true });
}
window.addEventListener('online', () => flushPhotos());

/** recorta um pedaço (frações 0–1 de x, y, largura, altura) e reduz o resultado */
export function cropPhoto(dataUrl, r, max = 720) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = Math.max(0, r.x * img.naturalWidth), sy = Math.max(0, r.y * img.naturalHeight);
      const sw = Math.min(img.naturalWidth - sx, r.w * img.naturalWidth), sh = Math.min(img.naturalHeight - sy, r.h * img.naturalHeight);
      const k = Math.min(1, max / Math.max(sw, sh));
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * k)); c.height = Math.max(1, Math.round(sh * k));
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Não consegui recortar a foto.'));
    img.src = dataUrl;
  });
}

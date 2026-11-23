// Sincronização entre aparelhos pelo WordPress (só quando o app é aberto pelo plugin).
// Regra: vence a versão alterada por último. Num aparelho novo, primeiro baixa o que já está salvo.
import { state, hooks, replaceState } from './store.js';

const KEY = 'minharotina.sync';
const W = () => window.MR_WP || null;
let info = read();
let timer = null, busy = false, started = false;
const listeners = [];
function read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
function persist() { try { localStorage.setItem(KEY, JSON.stringify(info)); } catch { /* ignora */ } }
const emit = (ev) => listeners.forEach((f) => f(ev));

export const onSync = (f) => listeners.push(f);
export const syncEnabled = () => !!W()?.rest;
export const syncInfo = () => ({ ...info, enabled: syncEnabled() });

async function api(method, body) {
  const res = await fetch(W().rest + 'dados', {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: { 'X-WP-Nonce': W().nonce, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) return { conflict: true, ...data };
  if (!res.ok) throw new Error(data.message || (res.status === 401 || res.status === 403 ? 'Sessão do WordPress expirou — abra o app de novo.' : `Erro ${res.status}`));
  return data;
}

async function push(force = false) {
  if (force) (state.meta ||= {}).updatedAt = Date.now();
  const t = state.meta?.updatedAt || Date.now();
  const r = await api('POST', { data: state, updatedAt: t });
  if (r.conflict && r.data) { replaceState(r.data, { fromSync: true }); emit('pulled'); }
}

/** compara com o WordPress e baixa ou envia o que for mais novo */
export async function syncNow() {
  if (!syncEnabled() || busy || !navigator.onLine) return;
  busy = true;
  try {
    clearTimeout(timer); timer = null;
    const r = await api('GET');
    const local = state.meta?.updatedAt || 0;
    // backup novo enviado pelo painel do WordPress acabou de ser carregado aqui
    const boot = Number(localStorage.getItem('minharotina.boot')) || 0;
    if (boot && info.boot !== boot) {
      info.boot = boot; info.first ||= Date.now();
      if (r.data && r.updatedAt > boot * 1000) { replaceState(r.data, { fromSync: true }); emit('pulled'); } else await push(true);
    } else if (!info.first) {
      // primeira vez neste aparelho: se já existe algo salvo, ele vem para cá
      if (r.data) { replaceState(r.data, { fromSync: true }); emit('pulled'); } else await push();
      info.first = Date.now();
    } else if (r.data && r.updatedAt > local + 500) { replaceState(r.data, { fromSync: true }); emit('pulled'); }
    else if (!r.data || local > (r.updatedAt || 0) + 500) await push();
    info.last = Date.now(); info.error = ''; persist(); emit('synced');
  } catch (e) {
    info.error = e.message; persist(); emit('error');
  } finally { busy = false; }
}

function schedulePush() {
  if (!syncEnabled() || !info.first) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    timer = null;
    if (busy || !navigator.onLine) return;
    busy = true;
    try { await push(); info.last = Date.now(); info.error = ''; persist(); emit('synced'); }
    catch (e) { info.error = e.message; persist(); emit('error'); }
    finally { busy = false; }
  }, 1500);
}

export function startSync() {
  if (!syncEnabled() || started) return;
  started = true;
  hooks.afterSave = schedulePush;
  syncNow();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  window.addEventListener('online', () => syncNow());
  setInterval(() => { if (!document.hidden) syncNow(); }, 30000);
}

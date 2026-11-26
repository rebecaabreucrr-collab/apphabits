// Persistência local (localStorage) — tudo fica salvo no próprio celular.
import { defaultState, defaultHome, guessSkinIcon } from './defaults.js';

const BASE = 'minharotina.v1';
let KEY = BASE;
export let state;

/** com login: cada conta tem seus próprios dados neste aparelho.
 *  Na primeira vez, os dados que já existiam (sem dona) passam para a conta. */
export function useAccount(uid, name = '') {
  const k = `${BASE}.${uid}`;
  let isNew = false;
  if (!localStorage.getItem(k)) {
    const legacy = localStorage.getItem(BASE);
    if (legacy && !localStorage.getItem('minharotina.owner')) {
      localStorage.setItem(k, legacy);
      localStorage.setItem('minharotina.owner', uid);
    } else isNew = true;
  }
  KEY = k;
  load();
  if (isNew && name) { state.profile.name = name; write(); }
  return isNew;
}
export function useLocal() { KEY = BASE; load(); }

export function load() {
  version++;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
  state = saved && typeof saved === 'object' ? saved : defaultState();
  fill(state, defaultState());
  migrate(state);
  return state;
}

// ajustes de versões anteriores
function migrate(s) {
  if (!s.profile.nameSet) { if (!s.profile.name) s.profile.name = 'Rebeca'; s.profile.nameSet = true; }
  for (const c of s.challenges || []) for (const g of c.goals) {
    if (!g.link && /^beber 2l de água$/i.test(g.text)) { g.link = '__agua'; g.text = 'Bater a meta de água'; }
  }
  const est = s.routine.find((r) => r.id === 'r-estudo');
  if (est && est.type === 'normal' && !s.profile.studyMigrated) est.type = 'estudo';
  s.profile.studyMigrated = true;
  // Metas (com o desafio dentro): troca a aba Desafio por Metas, uma vez
  if (!s.profile.metasTab) {
    s.profile.metasTab = true;
    const tabs = s.settings.tabs || [];
    const i = tabs.findIndex((t) => t.id === 'desafio');
    if (i >= 0) tabs[i] = { id: 'metas', label: 'Metas' };
    else if (tabs.length < 5 && !tabs.some((t) => t.id === 'metas')) tabs.push({ id: 'metas', label: 'Metas' });
  }
  // revisão semanal saiu do app
  s.settings.dash = s.settings.dash.filter((x) => x.id !== 'semanal');
  for (const d of ['resumo', 'semana', 'agua', 'cards', 'rotina', 'desafio', 'frase']) {
    if (!s.settings.dash.some((x) => x.id === d)) s.settings.dash[d === 'frase' ? 'unshift' : 'push']({ id: d, on: true });
  }
  if (!s.profile.phraseMigrated) {
    const fr = s.settings.dash.find((x) => x.id === 'frase'); if (fr) fr.on = true;
    s.profile.phraseMigrated = true;
  }
  // cabelo: vários produtos por passo/máscara
  const hm = s.hair?.maskProducts || {};
  for (const k of Object.keys(hm)) if (!Array.isArray(hm[k])) hm[k] = hm[k] ? [hm[k]] : [];
  for (const st of s.hair?.steps || []) if (!Array.isArray(st.productIds)) { st.productIds = st.productId ? [st.productId] : []; delete st.productId; }
  // skincare: cada passo ganha um ícone
  for (const r of Object.values(s.skincare || {})) for (const st of r.steps || []) {
    if (!st.icon) st.icon = guessSkinIcon((s.products || []).find((p) => p.id === st.productId)?.name || '');
  }
  // estudo: cada horário vira "manhã" ou "noite"
  for (const r of s.routine || []) if (r.type === 'estudo' && !r.slot) {
    const [h, m] = String(r.time || '0:0').split(':').map(Number);
    r.slot = h * 60 + m < 15 * 60 ? 'manha' : 'noite';
  }
  // aba Inglês (uma vez): entra na barra logo depois de Estudo
  if (!s.profile.englishTab) {
    s.profile.englishTab = true;
    const tabs = s.settings.tabs || [];
    if (!tabs.some((t) => t.id === 'ingles') && tabs.length < 5) {
      const i = tabs.findIndex((t) => t.id === 'estudo');
      tabs.splice(i >= 0 ? i + 1 : tabs.length, 0, { id: 'ingles', label: 'Inglês' });
    }
  }
  // sequências ficam dentro do relatório (sem aba ou card próprio)
  s.settings.tabs = (s.settings.tabs || []).filter((t) => t.id !== 'sequencias');
  if (s.settings.home?.cards) s.settings.home.cards = s.settings.home.cards.filter((c) => c.id !== 'sequencias');
  const H = defaultHome();
  s.settings.home ||= H;
  for (const k of Object.keys(H)) if (s.settings.home[k] === undefined) s.settings.home[k] = H[k];
  for (const c of H.cards) if (!s.settings.home.cards.some((x) => x.id === c.id)) s.settings.home.cards.push(c);
}

// garante que chaves novas existam após atualizações do app
function fill(target, defs) {
  for (const k of Object.keys(defs)) {
    if (target[k] === undefined) target[k] = defs[k];
    else if (defs[k] && typeof defs[k] === 'object' && !Array.isArray(defs[k]) && typeof target[k] === 'object' && !Array.isArray(target[k])
      && !['done', 'workoutLog', 'skinLog', 'log', 'checks', 'plan', 'periodDays', 'logs', 'medLog'].includes(k)) fill(target[k], defs[k]);
  }
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); alert('Não foi possível salvar os dados.'); }
}
/** avisos para a sincronização (preenchido por sync.js) */
export const hooks = { afterSave: null };
/** muda a cada alteração (para caches de cálculo) */
export let version = 0;

export function save() {
  (state.meta ||= {}).updatedAt = Date.now(); version++;
  write();
  hooks.afterSave?.();
}

/** fromSync: dados vindos de outro aparelho — mantém a data deles e não reenvia */
export function replaceState(obj, { fromSync = false } = {}) {
  state = obj; fill(state, defaultState()); migrate(state);
  version++;
  if (fromSync) write(); else save();
}

export function resetState() {
  state = defaultState(); save();
}

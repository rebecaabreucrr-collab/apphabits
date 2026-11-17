// Persistência local (localStorage) — tudo fica salvo no próprio celular.
import { defaultState, defaultHome } from './defaults.js';

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
  for (const d of ['resumo', 'semana', 'agua', 'cards', 'rotina', 'desafio', 'frase']) {
    if (!s.settings.dash.some((x) => x.id === d)) s.settings.dash[d === 'frase' ? 'unshift' : 'push']({ id: d, on: true });
  }
  if (!s.profile.phraseMigrated) {
    const fr = s.settings.dash.find((x) => x.id === 'frase'); if (fr) fr.on = true;
    s.profile.phraseMigrated = true;
  }
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
export function save() { write(); }

export function replaceState(obj) {
  state = obj; fill(state, defaultState()); migrate(state); save();
}

export function resetState() {
  state = defaultState(); save();
}

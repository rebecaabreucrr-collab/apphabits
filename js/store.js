// Persistência local (localStorage) — tudo fica salvo no próprio celular.
import { defaultState } from './defaults.js';

const KEY = 'minharotina.v1';
export let state;

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
  for (const d of ['resumo', 'semana', 'agua', 'cards', 'rotina', 'desafio']) {
    if (!s.settings.dash.some((x) => x.id === d)) s.settings.dash.push({ id: d, on: true });
  }
}

// garante que chaves novas existam após atualizações do app
function fill(target, defs) {
  for (const k of Object.keys(defs)) {
    if (target[k] === undefined) target[k] = defs[k];
    else if (defs[k] && typeof defs[k] === 'object' && !Array.isArray(defs[k]) && typeof target[k] === 'object' && !Array.isArray(target[k])
      && !['done', 'workoutLog', 'skinLog', 'log', 'checks', 'plan', 'periodDays', 'logs', 'medLog'].includes(k)) fill(target[k], defs[k]);
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); alert('Não foi possível salvar os dados.'); }
}

export function replaceState(obj) {
  state = obj; fill(state, defaultState()); migrate(state); save();
}

export function resetState() {
  state = defaultState(); save();
}

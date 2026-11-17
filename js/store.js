// Persistência local (localStorage) — tudo fica salvo no próprio celular.
import { defaultState } from './defaults.js';

const KEY = 'minharotina.v1';
export let state;

export function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { saved = null; }
  state = saved && typeof saved === 'object' ? saved : defaultState();
  fill(state, defaultState());
  return state;
}

// garante que chaves novas existam após atualizações do app
function fill(target, defs) {
  for (const k of Object.keys(defs)) {
    if (target[k] === undefined) target[k] = defs[k];
    else if (defs[k] && typeof defs[k] === 'object' && !Array.isArray(defs[k]) && typeof target[k] === 'object' && !Array.isArray(target[k])
      && !['done', 'workoutLog', 'skinLog', 'log', 'checks', 'plan'].includes(k)) fill(target[k], defs[k]);
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.error(e); alert('Não foi possível salvar os dados.'); }
}

export function replaceState(obj) {
  state = obj; fill(state, defaultState()); save();
}

export function resetState() {
  state = defaultState(); save();
}

// Ponto de entrada: roteador, eventos, barra de abas e service worker.
import { load, state } from './store.js';
import { $, dateKey, fmtTimer, esc } from './utils.js';
import { iconize, svg } from './icons.js';
import { TAB_DEFS } from './defaults.js';
import { routes as meds } from './view-meds.js';
import { routes as study, studyElapsed } from './view-study.js';
import { A, C, ui, setRender, closeSheet } from './ui.js';
import { timerElapsed } from './logic.js';
import { routes as today } from './view-today.js';
import { routes as care } from './view-care.js';
import { routes as reading } from './view-reading.js';
import { routes as challenge } from './view-challenge.js';
import { routes as more } from './view-more.js';
import { routes as cycle } from './view-cycle.js';

load();
const routes = { ...today, ...care, ...reading, ...challenge, ...more, ...cycle, ...meds, ...study };

function tabIds() { return ['hoje', ...state.settings.tabs.map((t) => t.id), 'mais']; }
function renderTabs() {
  const labels = Object.fromEntries(state.settings.tabs.map((t) => [t.id, t.label]));
  const ids = tabIds();
  const bar = $('#tabbar');
  bar.style.gridTemplateColumns = `repeat(${ids.length}, 1fr)`;
  bar.innerHTML = ids.map((id) => `<a href="#/${id}" data-tab="${id}">${svg(TAB_DEFS[id].icon)}<span>${esc(labels[id] || TAB_DEFS[id].label)}</span></a>`).join('');
}
function applyLook() {
  const st = state.settings;
  const root = document.documentElement;
  root.className = `layout-${st.layout || 'rosa'}`;
  if (st.theme === 'auto') delete root.dataset.theme; else root.dataset.theme = st.theme;
}

let lastPath = null;
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  return { path: path || 'hoje', params: new URLSearchParams(qs || '') };
}
function render() {
  const { path, params } = parseHash();
  const route = routes[path] || routes.hoje;
  const same = path === lastPath;
  const y = window.scrollY;
  const view = $('#view');
  applyLook();
  renderTabs();
  try {
    view.innerHTML = route.render(params);
    iconize(view);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h2>Ops! Algo deu errado.</h2><p class="muted small">${String(e.message || e)}</p><a class="btn primary" href="#/hoje">Voltar ao início</a></div>`;
  }
  const active = tabIds().includes(route.tab) ? route.tab : 'mais';
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === active));
  if (same) window.scrollTo(0, y); else { window.scrollTo(0, 0); view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
  lastPath = path;
}
setRender(render);
window.addEventListener('hashchange', () => { closeSheet(); render(); });

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = A[el.dataset.act];
  if (typeof fn === 'function') { e.preventDefault(); fn(el, e); }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = C[el.dataset.change];
  if (typeof fn === 'function') fn(el, e);
});

// cronômetro ao vivo
setInterval(() => {
  const els = document.querySelectorAll('[data-timer]');
  if (els.length && state.reading.timer.running) els.forEach((el) => { el.textContent = fmtTimer(timerElapsed()); });
  const st = document.querySelectorAll('[data-study-timer]');
  if (st.length && state.study.timer.running) st.forEach((el) => { el.textContent = fmtTimer(studyElapsed()); });
}, 1000);

// virada do dia com o app aberto
let lastToday = dateKey();
function checkDay() {
  const t = dateKey();
  if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; render(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkDay(); render(); } });
setInterval(checkDay, 60000);

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    reg.update();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update(); });
  }).catch((e) => console.warn('SW', e));
  // quando uma versão nova é instalada, recarrega sozinho
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true; location.reload();
  });
}

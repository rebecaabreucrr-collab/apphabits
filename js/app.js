// Ponto de entrada: roteador, eventos, barra de abas e service worker.
import { load, state } from './store.js';
import { $, dateKey, fmtTimer } from './utils.js';
import { A, C, ui, setRender, closeSheet } from './ui.js';
import { timerElapsed } from './logic.js';
import { routes as today } from './view-today.js';
import { routes as care } from './view-care.js';
import { routes as reading } from './view-reading.js';
import { routes as challenge } from './view-challenge.js';
import { routes as more } from './view-more.js';

load();
const routes = { ...today, ...care, ...reading, ...challenge, ...more };

const TABS = [
  ['hoje', 'Hoje', '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'],
  ['desafio', 'Desafio', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>'],
  ['leitura', 'Leitura', '<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5z"/><path d="M12 6v13.5"/>'],
  ['cuidados', 'Cuidados', '<path d="M12 21s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.8C19.5 16.4 12 21 12 21z"/>'],
  ['mais', 'Mais', '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'],
];
$('#tabbar').innerHTML = TABS.map(([id, label, svg]) =>
  `<a href="#/${id}" data-tab="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg><span>${label}</span></a>`).join('');

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
  try {
    view.innerHTML = route.render(params);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card"><h2>Ops! Algo deu errado.</h2><p class="muted small">${String(e.message || e)}</p><a class="btn primary" href="#/hoje">Voltar ao início</a></div>`;
  }
  document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === route.tab));
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
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
}

// Ponto de entrada: roteador, eventos, barra de abas e service worker.
import { load, state } from './store.js';
import { $, dateKey, fmtTimer, esc, greeting } from './utils.js';
import { iconize, svg } from './icons.js';
import { TAB_DEFS } from './defaults.js';
import { routes as meds } from './view-meds.js';
import { routes as report } from './view-report.js';
import { routes as finance } from './view-finance.js';
import { routes as study, studyElapsed, englishElapsed } from './view-study.js';
import { A, C, ui, setRender, closeSheet, toast } from './ui.js';
import { timerElapsed } from './logic.js';
import { routes as today } from './view-today.js';
import { routes as care } from './view-care.js';
import { routes as reading } from './view-reading.js';
import { routes as challenge } from './view-challenge.js';
import { routes as more } from './view-more.js';
import { routes as cycle } from './view-cycle.js';

import { authEnabled, isLoggedIn, currentUser, consumeAuthRedirect, ensureFresh, signOut } from './auth.js';
import { renderLogin, renderNewPassword, setOnLogged } from './view-auth.js';
import { useAccount, useLocal } from './store.js';

// login: só vale quando o Supabase estiver configurado (js/config.js)
const redirect = authEnabled() ? consumeAuthRedirect() : null;
if (authEnabled() && isLoggedIn()) useAccount(currentUser().id); else load();
setOnLogged((name) => {
  const isNew = useAccount(currentUser().id, name || currentUser().name);
  ui.authMsg = null; ui.authMode = 'entrar';
  if (location.hash.startsWith('#/nova-senha')) location.hash = '#/hoje';
  render();
  if (isNew) setTimeout(() => toast(`Bem-vinda${name ? ', ' + name : ''}! 💜`), 300);
});
A.logout = () => logout();
export async function logout() {
  await signOut();
  useLocal();
  location.hash = '#/hoje';
  render();
}
if (redirect?.error) setTimeout(() => { ui.authMsg = { text: redirect.error }; render(); }, 0);
if (redirect?.type === 'signup' || redirect?.type === 'magiclink') setTimeout(() => toast('E-mail confirmado! 💜'), 400);
if (authEnabled() && isLoggedIn()) ensureFresh().catch(() => { if (!isLoggedIn()) render(); });
const routes = { ...today, ...care, ...reading, ...challenge, ...more, ...cycle, ...meds, ...study, ...report, ...finance };

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
  const locked = authEnabled() && (!isLoggedIn() || path === 'nova-senha');
  document.body.classList.toggle('locked', locked);
  if (locked) {
    $('#tabbar').innerHTML = '';
    view.innerHTML = path === 'nova-senha' && isLoggedIn() ? renderNewPassword() : renderLogin();
    iconize(view);
    lastPath = 'login';
    return;
  }
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
window.addEventListener('hashchange', () => {
  closeSheet();
  // link do e-mail aberto com o app já aberto
  if (authEnabled() && /access_token=|error_description=/.test(location.hash)) {
    const r = consumeAuthRedirect();
    if (r?.error) ui.authMsg = { text: r.error };
    else if (isLoggedIn()) useAccount(currentUser().id);
  }
  render();
});

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
  document.querySelectorAll('[data-track-timer]').forEach((el) => {
    const key = el.dataset.trackTimer;
    if (state[key]?.timer.running) el.textContent = fmtTimer(key === 'study' ? studyElapsed() : englishElapsed());
  });
}, 1000);

// virada do dia com o app aberto
let lastToday = dateKey();
let lastGreeting = greeting();
function checkDay() {
  const t = dateKey();
  if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; lastGreeting = greeting(); render(); return; }
  // troca bom dia / boa tarde / boa noite (e o ícone) com o app aberto
  if (greeting() !== lastGreeting) { lastGreeting = greeting(); if (!document.querySelector('#sheet-root.open')) render(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { checkDay(); render(); } });
setInterval(checkDay, 60000);

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { updateViaCache: 'none' }).then((reg) => {
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

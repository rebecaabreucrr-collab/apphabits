// Infra de interface: ações, folhas (bottom sheets), avisos e componentes visuais.
import { $, esc, dateKey } from './utils.js';
import { iconize } from './icons.js';

export const A = {}; // ações de clique: data-act="nome"
export const C = {}; // ações de change: data-change="nome"
export const ui = { date: dateKey(), careTab: 'skincare', skinKey: 'am' };

let renderFn = () => {};
export const setRender = (f) => { renderFn = f; };
export const rerender = () => renderFn();
export const go = (hash) => { if (location.hash === hash) rerender(); else location.hash = hash; };

/* ---------- Bottom sheet ---------- */
let sheetSubmit = null;
export function sheet(title, body, { onSubmit, onMount } = {}) {
  const root = $('#sheet-root');
  root.innerHTML = `
    <div class="sheet-backdrop" data-act="closeSheet"></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-handle"></div>
      <div class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-act="closeSheet" aria-label="Fechar">✕</button></div>
      <div class="sheet-body">${body}</div>
    </div>`;
  iconize(root);
  root.classList.add('open');
  document.body.classList.add('noscroll');
  sheetSubmit = onSubmit || null;
  const form = root.querySelector('form');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const res = sheetSubmit ? sheetSubmit(new FormData(form), form) : undefined;
    if (res !== false) { closeSheet(); rerender(); }
  });
  onMount?.(root.querySelector('.sheet'));
}
export function closeSheet() {
  const root = $('#sheet-root');
  root.classList.remove('open');
  root.innerHTML = '';
  document.body.classList.remove('noscroll');
}
A.closeSheet = closeSheet;

export function confirmSheet(title, text, okLabel, onOk, danger = true) {
  sheet(title, `<p class="muted">${esc(text)}</p>
    <div class="row gap mt"><button class="btn ghost grow" data-act="closeSheet">Cancelar</button>
    <button class="btn ${danger ? 'danger' : 'primary'} grow" id="confirm-ok">${esc(okLabel)}</button></div>`,
  { onMount: (r) => r.querySelector('#confirm-ok').addEventListener('click', () => { onOk(); closeSheet(); rerender(); }) });
}

/* ---------- Toast ---------- */
let toastT;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  iconize(t);
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Componentes ---------- */
export function ring(pct, { size = 120, stroke = 12, label = '', sub = '', cls = '' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  return `<div class="ring ${cls}" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-bg"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-fg"
        stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-label"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>
  </div>`;
}

export const bar = (pct, color = '') => `<div class="bar ${color}"><span style="width:${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%"></span></div>`;

export const check = (on, act, data = '', label = 'Marcar') =>
  `<button class="check ${on ? 'on' : ''}" data-act="${act}" ${data} aria-pressed="${on}" aria-label="${esc(label)}"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" /></svg></button>`;

export const pageHead = (title, back = '#/hoje', right = '') =>
  `<header class="page-head"><a class="back" href="${back}" aria-label="Voltar">‹</a><h1>${esc(title)}</h1><div class="ph-right">${right}</div></header>`;

export const empty = (icon, title, text, btn = '') =>
  `<div class="empty"><div class="empty-icon">${icon}</div><h3>${esc(title)}</h3><p class="muted">${esc(text)}</p>${btn}</div>`;

export const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(label)}</option>`;

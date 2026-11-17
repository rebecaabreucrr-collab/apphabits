// Utilitários gerais (datas, formatação, escape de HTML)
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-5);
export const pad = (n) => String(n).padStart(2, '0');

export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dateKey(d); };
/** b - a, em dias */
export const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 86400000);
export const weekday = (k) => parseKey(k).getDay();
/** segunda-feira da semana de k */
export const weekStart = (k) => { const wd = weekday(k); return addDays(k, wd === 0 ? -6 : 1 - wd); };

export const WD = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const WD_FULL = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export const fmtLong = (k) => { const d = parseKey(k); const w = WD_FULL[d.getDay()]; return `${w[0].toUpperCase() + w.slice(1)}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`; };
export const fmtShort = (k) => { const d = parseKey(k); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
export const fmtRel = (k, base = dateKey()) => {
  const n = diffDays(base, k);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  if (n > 1 && n < 7) return `${WD_FULL[weekday(k)]} (em ${n} dias)`;
  if (n < 0) return `há ${-n} dias`;
  return `${fmtShort(k)} (em ${n} dias)`;
};

export const toMin = (t) => { if (!t) return 9999; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const fmtTimer = (sec) => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};
export const fmtMinutes = (min) => {
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
};

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
/** ícone que acompanha a saudação: manhã, tarde ou noite */
export const greetingIcon = () => { const h = new Date().getHours(); return h < 12 ? '🌅' : h < 18 ? '☀️' : '🌙'; };

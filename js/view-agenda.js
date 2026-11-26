// Agenda: compromissos pessoais + leitura da Google Agenda (pelo endereço secreto iCal, via plugin do WordPress).
import { state, save } from './store.js';
import { esc, dateKey, addDays, parseKey, fmtLong, fmtShort, uid, pad, WD, MONTHS } from './utils.js';
import { A, C, ui, sheet, rerender, toast, empty, confirmSheet } from './ui.js';
import { parseICS, expandEvents } from './ical.js';

const AG = () => (state.agenda ||= { items: [] });
const W = () => window.MR_WP || null;
const wpOn = () => !!W()?.rest;

/* ---------- Google Agenda (cache só neste aparelho) ---------- */
const GKEY = 'minharotina.gcal';
let gcache = (() => { try { return JSON.parse(localStorage.getItem(GKEY)) || {}; } catch { return {}; } })();
let gparsed = null; let gbusy = false;
function gstore(obj) {
  gcache = obj; gparsed = null;
  try { localStorage.setItem(GKEY, JSON.stringify(obj)); } catch { /* agenda grande demais para guardar: fica só na memória */ }
}
const gEvents = () => (gparsed ||= gcache.ics ? parseICS(gcache.ics) : []);

async function gapi(method, body, query = '') {
  const res = await fetch(W().rest + 'agenda' + query, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: { 'X-WP-Nonce': W().nonce, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
  return data;
}
/** busca a agenda no WordPress (no máximo a cada 10 min, a não ser que peça) */
async function gRefresh(force = false) {
  if (!wpOn() || gbusy) return;
  if (!force && gcache.checked && Date.now() - gcache.checked < 10 * 60000) return;
  gbusy = true;
  try {
    const r = await gapi('GET', null, force ? '?refresh=1' : '');
    gstore(r.configured ? { configured: true, ics: r.ics, at: r.at, checked: Date.now(), error: '' } : { configured: false, checked: Date.now() });
  } catch (e) { gstore({ ...gcache, checked: Date.now(), error: e.message }); }
  finally { gbusy = false; }
  if (location.hash.startsWith('#/agenda') || location.hash.startsWith('#/hoje') || location.hash === '') rerender();
}

/* ---------- eventos do período (meus + Google) ---------- */
const normT = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function eventsBetween(s, e) {
  const g = expandEvents(gEvents(), s, e).map((x) => ({ ...x, src: 'google' }));
  const mine = AG().items.filter((x) => x.date >= s && x.date <= e)
    // já enviado ao Google e aparecendo lá: mostra só uma vez
    .filter((x) => !(x.sent && g.some((y) => y.date === x.date && normT(y.title) === normT(x.title))))
    .map((x) => ({ ...x, src: 'meu' }));
  return [...g, ...mine].sort((a, b) => (a.date + (a.allDay ? '' : a.time || '99')).localeCompare(b.date + (b.allDay ? '' : b.time || '99')));
}
const when = (x) => (x.allDay ? 'Dia todo' : `${x.time || ''}${x.end ? '–' + x.end : ''}`);

/* ---------- link para criar o evento na Google Agenda ---------- */
function googleLink(x) {
  const d = x.date.replace(/-/g, '');
  let dates;
  if (x.allDay || !x.time) dates = `${d}/${addDays(x.date, 1).replace(/-/g, '')}`;
  else {
    const endT = x.end || (() => { const [h, m] = x.time.split(':').map(Number); const t = Math.min(23 * 60 + 59, h * 60 + m + 60); return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`; })();
    dates = `${d}T${x.time.replace(':', '')}00/${d}T${endT.replace(':', '')}00`;
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  const q = new URLSearchParams({ action: 'TEMPLATE', text: x.title, dates, details: x.notes || '', location: x.location || '', ctz: tz });
  return `https://calendar.google.com/calendar/render?${q}`;
}

/* ---------- tela ---------- */
function monthGrid(month, sel) {
  const first = parseKey(month + '-01');
  const startOff = (first.getDay() + 6) % 7; // semana começa na segunda
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const evs = eventsBetween(month + '-01', `${month}-${pad(dim)}`);
  const count = {}; for (const x of evs) count[x.date] = (count[x.date] || 0) + 1;
  const today = dateKey();
  let cells = '';
  for (let i = 0; i < startOff; i++) cells += '<span></span>';
  for (let d = 1; d <= dim; d++) {
    const k = `${month}-${pad(d)}`;
    cells += `<button class="ag-day ${k === sel ? 'sel' : ''} ${k === today ? 'today' : ''}" data-act="agPick" data-d="${k}"><b>${d}</b>${count[k] ? `<i>${count[k] > 3 ? '•••' : '•'.repeat(count[k])}</i>` : '<i></i>'}</button>`;
  }
  return `<div class="ag-grid">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<small>${WD[w][0]}</small>`).join('')}${cells}</div>`;
}
function itemRow(x) {
  return `<li class="ag-item ${x.src}" data-act="agOpen" data-src="${x.src}" data-id="${esc(x.src === 'meu' ? x.id : x.uid)}" data-d="${x.date}">
    <span class="ag-time">${esc(when(x))}</span>
    <div class="grow"><b>${esc(x.title)}</b>${x.location ? `<small>📍 ${esc(x.location)}</small>` : ''}</div>
    ${x.src === 'google' ? '<span class="ag-tag">Google</span>' : x.sent ? '<span class="ag-tag mine">no Google</span>' : ''}</li>`;
}
function googleCard() {
  if (!wpOn()) return `<section class="card ag-google"><h2>Google Agenda</h2><p class="small muted">Para ver a sua Google Agenda aqui, abra o app pelo endereço do WordPress (seusite/minha-rotina/). Os compromissos que você cria aqui continuam funcionando.</p></section>`;
  if (!gcache.configured) return `<section class="card ag-google"><h2>Conectar a Google Agenda</h2>
    <p class="small muted">Assim os compromissos da sua Google Agenda aparecem aqui. É grátis e só leitura. Para criar eventos no Google, use o botão em cada compromisso daqui.</p>
    <ol class="small ag-steps"><li>No computador, abra <b>calendar.google.com</b>.</li><li>Na lateral, passe o mouse na sua agenda → <b>⋮</b> → <b>Configurações e compartilhamento</b>.</li>
      <li>Desça até <b>Integrar agenda</b> e copie o <b>Endereço secreto no formato iCal</b>.</li><li>Cole abaixo e toque em Conectar.</li></ol>
    <form class="form" id="ag-connect"><input name="url" placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autocomplete="off" required>
      <button class="btn primary block">Conectar</button></form>
    <p class="small muted">O endereço fica guardado só no seu perfil do WordPress. Não compartilhe esse endereço com ninguém.</p>
    ${gcache.error ? `<p class="small err">${esc(gcache.error)}</p>` : ''}</section>`;
  const at = gcache.at ? new Date(gcache.at) : null;
  return `<section class="card ag-google"><div class="card-head"><h2>Google Agenda conectada ✓</h2></div>
    <p class="small muted">${at ? `Atualizada às ${pad(at.getHours())}:${pad(at.getMinutes())} de ${fmtShort(dateKey(at))}` : 'Buscando…'} · ${gEvents().length} eventos lidos · atualiza sozinha a cada 10 minutos</p>
    ${gcache.error ? `<p class="small err">${esc(gcache.error)}</p>` : ''}
    <div class="row gap"><button class="btn small" data-act="agRefresh">🔄 Atualizar agora</button><button class="btn small ghost" data-act="agDisconnect">Desconectar</button></div></section>`;
}
function renderAgenda() {
  gRefresh();
  const today = dateKey();
  const sel = ui.agDay || today;
  const month = ui.agMonth || sel.slice(0, 7);
  const mDate = parseKey(month + '-01');
  const dayEvs = eventsBetween(sel, sel);
  const next = eventsBetween(addDays(today, 1), addDays(today, 7));
  return `<header class="page-head top"><h1>Agenda</h1><div class="ph-right"><button class="link" data-act="agNew">+ Compromisso</button></div></header>
  <section class="card">
    <div class="rep-nav"><button class="icon-btn" data-act="agMonth" data-n="-1" aria-label="Mês anterior">‹</button>
      <b>${MONTHS[mDate.getMonth()][0].toUpperCase() + MONTHS[mDate.getMonth()].slice(1)} ${mDate.getFullYear()}</b>
      <button class="icon-btn" data-act="agMonth" data-n="1" aria-label="Próximo mês">›</button></div>
    ${monthGrid(month, sel)}
    ${sel !== today || month !== today.slice(0, 7) ? '<button class="link ag-today" data-act="agToday">Voltar para hoje</button>' : ''}
  </section>
  <section class="card"><div class="card-head"><h2>${sel === today ? 'Hoje' : fmtLong(sel)}</h2><button class="link" data-act="agNew" data-d="${sel}">+ Adicionar</button></div>
    ${dayEvs.length ? `<ul class="ag-list">${dayEvs.map(itemRow).join('')}</ul>` : '<p class="muted small">Nenhum compromisso neste dia.</p>'}</section>
  ${sel === today ? `<section class="card"><h2>Próximos 7 dias</h2>${next.length ? (() => {
    const by = {}; next.forEach((x) => (by[x.date] ||= []).push(x));
    return Object.entries(by).map(([d, xs]) => `<h4 class="ag-dh">${fmtLong(d)}</h4><ul class="ag-list">${xs.map(itemRow).join('')}</ul>`).join('');
  })() : '<p class="muted small">Nada marcado para os próximos dias.</p>'}</section>` : ''}
  ${googleCard()}`;
}

/* ---------- ações ---------- */
A.agPick = (el) => { ui.agDay = el.dataset.d; rerender(); };
A.agToday = () => { ui.agDay = dateKey(); ui.agMonth = null; rerender(); };
A.agMonth = (el) => {
  const d = parseKey((ui.agMonth || (ui.agDay || dateKey()).slice(0, 7)) + '-01'); d.setMonth(d.getMonth() + Number(el.dataset.n));
  ui.agMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; ui.agDay = ui.agMonth === dateKey().slice(0, 7) ? dateKey() : ui.agMonth + '-01'; rerender();
};
A.agRefresh = async () => { toast('Atualizando a agenda…'); await gRefresh(true); toast(gcache.error ? gcache.error : 'Agenda atualizada ✓'); };
A.agDisconnect = () => confirmSheet('Desconectar a Google Agenda?', 'Os eventos do Google deixam de aparecer aqui. Seus compromissos do app continuam.', 'Desconectar', async () => {
  try { await gapi('POST', { url: '' }); gstore({ configured: false, checked: Date.now() }); toast('Google Agenda desconectada'); } catch (e) { toast(e.message); }
  rerender();
});
document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'ag-connect') return;
  e.preventDefault();
  const url = String(new FormData(e.target).get('url') || '').trim();
  const btn = e.target.querySelector('button'); btn.disabled = true; btn.textContent = 'Conectando…';
  try {
    const r = await gapi('POST', { url });
    gstore({ configured: true, ics: r.ics, at: r.at, checked: Date.now(), error: '' });
    toast('Google Agenda conectada ✓');
  } catch (err) { gstore({ ...gcache, configured: false, error: err.message }); toast(err.message); }
  rerender();
});

function itemSheet(x, date) {
  const it = x || { title: '', date: date || ui.agDay || dateKey(), time: '', end: '', allDay: false, location: '', notes: '' };
  sheet(x ? 'Editar compromisso' : 'Novo compromisso', `<form class="form">
    <label class="field"><span>O que é</span><input name="title" required value="${esc(it.title)}" placeholder="Ex.: Dentista, aniversário da Ana"></label>
    <label class="field"><span>Data</span><input type="date" name="date" required value="${it.date}"></label>
    <label class="toggle-row"><span><b>Dia todo</b></span><input type="checkbox" class="switch" name="allDay" ${it.allDay ? 'checked' : ''}></label>
    <div class="row gap ag-times"><label class="field grow"><span>Começa</span><input type="time" name="time" value="${it.time || ''}"></label>
      <label class="field grow"><span>Termina</span><input type="time" name="end" value="${it.end || ''}"></label></div>
    <label class="field"><span>Local (opcional)</span><input name="location" value="${esc(it.location || '')}"></label>
    <label class="field"><span>Observação (opcional)</span><textarea name="notes" rows="2">${esc(it.notes || '')}</textarea></label>
    <label class="toggle-row"><span><b>Mandar para a Google Agenda</b><small>abre o Google com tudo preenchido; é só tocar em Salvar lá</small></span><input type="checkbox" class="switch" name="toGoogle" ${x ? '' : 'checked'}></label>
    <button class="btn primary block">Salvar</button>
    ${x ? '<button type="button" class="btn danger-ghost block" id="ag-del">Excluir compromisso</button>' : ''}</form>`, {
    onMount: (root) => {
      const ad = root.querySelector('[name=allDay]'); const tm = root.querySelector('.ag-times');
      const sync = () => { tm.style.display = ad.checked ? 'none' : ''; }; ad.addEventListener('change', sync); sync();
      root.querySelector('#ag-del')?.addEventListener('click', () => { AG().items = AG().items.filter((y) => y !== x); save(); A.closeSheet(); rerender(); toast('Compromisso excluído'); });
    },
    onSubmit: (fd) => {
      const data = { title: String(fd.get('title')).trim(), date: fd.get('date'), allDay: !!fd.get('allDay'), time: fd.get('allDay') ? '' : fd.get('time') || '',
        end: fd.get('allDay') ? '' : fd.get('end') || '', location: String(fd.get('location') || '').trim(), notes: String(fd.get('notes') || '').trim() };
      if (!data.title || !data.date) return false;
      let item = x;
      if (x) Object.assign(x, data); else { item = { id: uid(), ...data, sent: false }; AG().items.push(item); }
      if (fd.get('toGoogle')) { item.sent = true; window.open(googleLink(item), '_blank', 'noopener'); }
      ui.agDay = data.date; ui.agMonth = null;
      save(); toast(fd.get('toGoogle') ? 'Salvo — confirme no Google Agenda' : 'Compromisso salvo 📅');
    },
  });
}
A.agNew = (el) => itemSheet(null, el?.dataset?.d);
A.agOpen = (el) => {
  if (el.dataset.src === 'meu') return itemSheet(AG().items.find((x) => x.id === el.dataset.id));
  const x = expandEvents(gEvents(), el.dataset.d, el.dataset.d).find((y) => y.uid === el.dataset.id); if (!x) return;
  const [y, m, d] = x.date.split('-');
  sheet(x.title, `<p class="muted">${fmtLong(x.date)} · ${esc(when(x))}${x.multi ? ` · dia ${x.multi}` : ''}</p>
    ${x.location ? `<p>📍 ${esc(x.location)}</p>` : ''}${x.notes ? `<p class="note">${esc(x.notes).replace(/\n/g, '<br>')}</p>` : ''}
    <p class="small muted">Evento da Google Agenda. Para mudar, edite no Google.</p>
    <a class="btn ghost block" href="https://calendar.google.com/calendar/r/day/${y}/${Number(m)}/${Number(d)}" target="_blank" rel="noopener">Abrir no Google Agenda</a>`);
};

/** tile da tela inicial: próximo compromisso */
export function agendaTile() {
  gRefresh();
  const t = dateKey(); const now = new Date(); const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const up = eventsBetween(t, addDays(t, 7)).filter((x) => x.date > t || x.allDay || !x.time || (x.end || x.time) >= hm);
  const todayN = up.filter((x) => x.date === t).length;
  const n = up[0];
  if (!n) return `<a class="tile t-sky" href="#/agenda"><span class="tile-ico">📅</span><div><b>Agenda livre</b><small>nada nos próximos 7 dias</small></div></a>`;
  return `<a class="tile t-sky" href="#/agenda"><span class="tile-ico">📅</span><div><b>${esc(n.title)}</b>
    <small>${n.date === t ? 'hoje' : n.date === addDays(t, 1) ? 'amanhã' : fmtShort(n.date)} · ${esc(when(n))}${todayN > 1 ? ` · +${todayN - 1} hoje` : ''}</small></div></a>`;
}

export const routes = { agenda: { render: renderAgenda, tab: 'agenda' } };

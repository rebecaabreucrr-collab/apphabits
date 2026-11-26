// Agenda: mostra só as agendas do Google escolhidas (ex.: Pessoal, Rotina, Aniversários) e permite
// criar, editar e apagar eventos nelas pelo app (API do Google Agenda, pelo plugin do WordPress).
// Sem o WordPress/Google conectado, guarda compromissos só no app.
import { state, save } from './store.js';
import { esc, dateKey, addDays, parseKey, fmtLong, fmtShort, uid, pad, WD, MONTHS } from './utils.js';
import { A, C, ui, sheet, rerender, toast, confirmSheet, closeSheet, opt } from './ui.js';

const AG = () => (state.agenda ||= { items: [] });
const W = () => window.MR_WP || null;
const wpOn = () => !!W()?.rest;
const TZ = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

/* ---------- Google (cache só neste aparelho) ---------- */
const GKEY = 'minharotina.gagenda';
let G = (() => { try { return JSON.parse(localStorage.getItem(GKEY)) || {}; } catch { return {}; } })();
// G = { status: {configured, connected, connect, selected}, calendars: [], events: [], range: {s,e}, at, error }
G.at = 0; // ao abrir o app, confere de novo com o WordPress/Google (mantém o que já tinha para mostrar na hora)
try { localStorage.removeItem('minharotina.gcal'); } catch { /* versão antiga (iCal) */ }
const gsave = () => { try { localStorage.setItem(GKEY, JSON.stringify(G)); } catch { /* sem espaço: fica na memória */ } };
let busy = false;
const linked = () => wpOn() && G.status?.connected;
const selCals = () => (G.calendars || []).filter((c) => (G.status?.selected || []).includes(c.id));
const writable = () => selCals().filter((c) => c.write);

async function gapi(method, path, { body, query = '' } = {}) {
  const res = await fetch(W().rest + 'google' + path + query, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: { 'X-WP-Nonce': W().nonce, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
  return data;
}
const rerenderIfHere = () => { const h = location.hash; if (h.startsWith('#/agenda') || h.startsWith('#/hoje') || h.startsWith('#/looks') || h === '') rerender(); };

/** status + agendas + eventos do período (no máximo a cada 3 min, a não ser que force) */
async function gRefresh({ force = false, s, e } = {}) {
  if (!wpOn() || busy) return;
  const ws = s || G.range?.s || dateKey(); const we = e || G.range?.e || addDays(dateKey(), 40);
  const covered = G.range && ws >= G.range.s && we <= G.range.e;
  const age = G.at ? Date.now() - G.at : Infinity;
  if (!force && covered && age < 3 * 60000) return;
  // depois de erro, sem conexão ou sem agenda marcada: espera um pouco antes de tentar de novo
  if (!force && age < 20000 && (G.error || !G.status?.connected || !selCals().length)) return;
  busy = true;
  try {
    G.status = await gapi('GET', '');
    let r = { s: ws, e: we };
    if (G.range && !force) r = { s: G.range.s < ws ? G.range.s : ws, e: G.range.e > we ? G.range.e : we };
    if (Math.round((parseKey(r.e) - parseKey(r.s)) / 86400000) > 160) r = { s: ws, e: we };
    if (G.status.connected) {
      if (force || !G.calendars?.length) G.calendars = (await gapi('GET', '/agendas', { query: force ? '?refresh=1' : '' })).calendars;
      G.events = selCals().length ? (await gapi('GET', '/eventos', { query: `?start=${r.s}&end=${r.e}&tz=${encodeURIComponent(TZ())}` })).events : [];
    }
    G.range = r; G.error = '';
  } catch (err) { G.error = err.message; }
  finally { G.at = Date.now(); busy = false; gsave(); }
  rerenderIfHere();
}
/** garante que o período está carregado (pede ao Google se precisar) */
function need(s, e) {
  if (!wpOn()) return;
  const r = G.range;
  gRefresh({ s: !r || s < r.s ? s : r.s, e: !r || e > r.e ? e : r.e });
}

/* ---------- eventos do período ---------- */
const normT = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function eventsBetween(s, e) {
  need(s, e);
  let list;
  if (linked()) {
    list = [];
    for (const x of G.events || []) {
      if (!(G.status.selected || []).includes(x.cal)) continue;
      // evento de vários dias aparece em cada dia
      for (let d = x.date; d <= (x.endDate || x.date); d = addDays(d, 1)) if (d >= s && d <= e) list.push({ ...x, date: d, src: 'google', multi: x.endDate > x.date });
    }
  } else list = AG().items.filter((x) => x.date >= s && x.date <= e).map((x) => ({ ...x, src: 'meu' }));
  return list.sort((a, b) => (a.date + (a.allDay ? '' : a.time || '99')).localeCompare(b.date + (b.allDay ? '' : b.time || '99')));
}
const when = (x) => (x.allDay ? 'Dia todo' : `${x.time || ''}${x.end ? '–' + x.end : ''}`);

/* ---------- tela ---------- */
function monthGrid(month, sel) {
  const first = parseKey(month + '-01');
  const startOff = (first.getDay() + 6) % 7; // semana começa na segunda
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const evs = eventsBetween(month + '-01', `${month}-${pad(dim)}`);
  const by = {}; for (const x of evs) (by[x.date] ||= []).push(x);
  const today = dateKey();
  let cells = '';
  for (let i = 0; i < startOff; i++) cells += '<span></span>';
  for (let d = 1; d <= dim; d++) {
    const k = `${month}-${pad(d)}`; const xs = by[k] || [];
    cells += `<button class="ag-day ${k === sel ? 'sel' : ''} ${k === today ? 'today' : ''}" data-act="agPick" data-d="${k}"><b>${d}</b><i>${xs.slice(0, 3).map((x) => `<em style="background:${x.color || 'var(--accent)'}"></em>`).join('')}</i></button>`;
  }
  return `<div class="ag-grid">${[1, 2, 3, 4, 5, 6, 0].map((w) => `<small>${WD[w][0]}</small>`).join('')}${cells}</div>`;
}
function itemRow(x) {
  return `<li class="ag-item ${x.src}" style="--cal:${x.color || 'var(--accent)'}" data-act="agOpen" data-src="${x.src}" data-id="${esc(x.id)}" data-cal="${esc(x.cal || '')}" data-d="${x.date}">
    <span class="ag-time">${esc(when(x))}</span>
    <div class="grow"><b>${esc(x.title)}</b>${x.location ? `<small>📍 ${esc(x.location)}</small>` : ''}${x.calName && selCals().length > 1 ? `<small class="ag-cal">${esc(x.calName)}</small>` : ''}</div></li>`;
}
function googleCard() {
  if (!wpOn()) return `<section class="card ag-google"><h2>Google Agenda</h2><p class="small muted">Para usar a sua Google Agenda aqui, abra o app pelo endereço do WordPress (seusite/minha-rotina/). Por enquanto, os compromissos ficam só no app.</p></section>`;
  const st = G.status;
  if (!st) return `<section class="card ag-google"><p class="small muted">Verificando a Google Agenda…</p></section>`;
  if (!st.configured) return `<section class="card ag-google"><h2>Google Agenda</h2><p class="small muted">Falta configurar a ligação com o Google no painel do WordPress: <b>Minha Rotina → Google Agenda</b> (tem o passo a passo lá). Depois volte aqui e toque em Conectar.</p></section>`;
  if (!st.connected) return `<section class="card ag-google"><h2>Conectar a Google Agenda</h2>
    <p class="small muted">Você vai entrar na sua conta Google e permitir o acesso. Se aparecer “app não verificado”, toque em <b>Avançado → Acessar</b> (é o seu próprio app).</p>
    <a class="btn primary block" href="${esc(st.connect)}">Conectar com o Google</a>
    ${G.error ? `<p class="small err">${esc(G.error)}</p>` : ''}</section>`;
  const cals = G.calendars || [];
  return `<section class="card ag-google"><div class="card-head"><h2>Agendas do Google</h2><button class="link" data-act="agRefresh">🔄 Atualizar</button></div>
    <p class="small muted">Marque as agendas que aparecem no app.${G.at ? ` Atualizado às ${pad(new Date(G.at).getHours())}:${pad(new Date(G.at).getMinutes())}.` : ''}</p>
    ${cals.map((c) => `<label class="toggle-row"><span><b><i class="ag-dot" style="background:${c.color}"></i>${esc(c.name)}</b><small>${c.write ? 'pode criar e editar' : 'só leitura'}</small></span>
      <input type="checkbox" class="switch" data-change="agCal" data-id="${esc(c.id)}" ${(st.selected || []).includes(c.id) ? 'checked' : ''}></label>`).join('')}
    ${G.error ? `<p class="small err">${esc(G.error)}</p>` : ''}
    <button class="btn small ghost mt" data-act="agDisconnect">Desconectar do Google</button></section>`;
}
function oldItemsCard() {
  const n = AG().items.length; if (!linked() || !n || !writable().length) return '';
  return `<section class="card"><h2>Compromissos antigos do app</h2><p class="small muted">${n} compromisso(s) que você criou antes de conectar o Google. Quer mandar para a sua agenda?</p>
    <div class="row gap"><select class="mini-select" id="ag-move-cal">${writable().map((c) => opt(c.id, c.name, '')).join('')}</select>
      <button class="btn small" data-act="agMoveOld">Enviar para o Google</button><button class="btn small ghost" data-act="agDropOld">Apagar</button></div></section>`;
}
function renderAgenda(p) {
  const g = p?.get?.('g');
  if (g) { setTimeout(() => { history.replaceState(null, '', '#/agenda'); gRefresh({ force: true }); toast(g === 'ok' ? 'Google Agenda conectada ✓ Escolha as agendas' : 'Não foi possível conectar. Tente de novo.'); }, 0); }
  if (wpOn() && !G.status) gRefresh({});
  const today = dateKey();
  const sel = ui.agDay || today;
  const month = ui.agMonth || sel.slice(0, 7);
  const mDate = parseKey(month + '-01');
  const dayEvs = eventsBetween(sel, sel);
  const next = eventsBetween(addDays(today, 1), addDays(today, 7));
  const canAdd = !wpOn() || !G.status?.connected || writable().length;
  const needPick = linked() && !selCals().length;
  return `<header class="page-head top"><h1>Agenda</h1><div class="ph-right">${canAdd && !needPick ? '<button class="link" data-act="agNew">+ Evento</button>' : ''}</div></header>
  ${needPick ? '<section class="card"><b>Escolha quais agendas do Google aparecem aqui</b><p class="small muted">Lá embaixo, marque por exemplo Pessoal, Rotina e Aniversários.</p></section>' : ''}
  <section class="card">
    <div class="rep-nav"><button class="icon-btn" data-act="agMonth" data-n="-1" aria-label="Mês anterior">‹</button>
      <b>${MONTHS[mDate.getMonth()][0].toUpperCase() + MONTHS[mDate.getMonth()].slice(1)} ${mDate.getFullYear()}</b>
      <button class="icon-btn" data-act="agMonth" data-n="1" aria-label="Próximo mês">›</button></div>
    ${monthGrid(month, sel)}
    ${sel !== today || month !== today.slice(0, 7) ? '<button class="link ag-today" data-act="agToday">Voltar para hoje</button>' : ''}
  </section>
  <section class="card"><div class="card-head"><h2>${sel === today ? 'Hoje' : fmtLong(sel)}</h2>${canAdd && !needPick ? `<button class="link" data-act="agNew" data-d="${sel}">+ Adicionar</button>` : ''}</div>
    ${dayEvs.length ? `<ul class="ag-list">${dayEvs.map(itemRow).join('')}</ul>` : '<p class="muted small">Nada neste dia.</p>'}</section>
  ${sel === today ? `<section class="card"><h2>Próximos 7 dias</h2>${next.length ? (() => {
    const by = {}; next.forEach((x) => (by[x.date] ||= []).push(x));
    return Object.entries(by).map(([d, xs]) => `<h4 class="ag-dh">${fmtLong(d)}</h4><ul class="ag-list">${xs.map(itemRow).join('')}</ul>`).join('');
  })() : '<p class="muted small">Nada marcado para os próximos dias.</p>'}</section>` : ''}
  ${oldItemsCard()}
  ${googleCard()}`;
}

/* ---------- ações ---------- */
A.agPick = (el) => { ui.agDay = el.dataset.d; rerender(); };
A.agToday = () => { ui.agDay = dateKey(); ui.agMonth = null; rerender(); };
A.agMonth = (el) => {
  const d = parseKey((ui.agMonth || (ui.agDay || dateKey()).slice(0, 7)) + '-01'); d.setMonth(d.getMonth() + Number(el.dataset.n));
  ui.agMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; ui.agDay = ui.agMonth === dateKey().slice(0, 7) ? dateKey() : ui.agMonth + '-01'; rerender();
};
A.agRefresh = async () => { toast('Atualizando…'); await gRefresh({ force: true }); toast(G.error || 'Agenda atualizada ✓'); };
C.agCal = async (el) => {
  const cur = new Set(G.status?.selected || []); el.checked ? cur.add(el.dataset.id) : cur.delete(el.dataset.id);
  try { const r = await gapi('POST', '/agendas', { body: { selected: [...cur] } }); G.status.selected = r.selected; gsave(); await gRefresh({ force: true, s: G.range?.s, e: G.range?.e }); }
  catch (err) { toast(err.message); rerender(); }
};
A.agDisconnect = () => confirmSheet('Desconectar do Google?', 'Os eventos do Google deixam de aparecer aqui. Nada é apagado na sua Google Agenda.', 'Desconectar', async () => {
  try { await gapi('POST', '/desconectar'); G = { status: { ...G.status, connected: false } }; gsave(); toast('Google Agenda desconectada'); } catch (err) { toast(err.message); }
  rerender();
});
A.agMoveOld = async () => {
  const cal = document.getElementById('ag-move-cal')?.value; if (!cal) return;
  toast('Enviando…'); let ok = 0;
  for (const x of [...AG().items]) {
    try { await gapi('POST', '/eventos', { body: { cal, title: x.title, date: x.date, time: x.time, end: x.end, allDay: x.allDay, location: x.location, notes: x.notes, tz: TZ() } }); AG().items = AG().items.filter((y) => y !== x); ok++; }
    catch (err) { toast(err.message); break; }
  }
  save(); await gRefresh({ force: true, s: G.range?.s, e: G.range?.e }); toast(`${ok} compromisso(s) enviados para o Google ✓`);
};
A.agDropOld = () => confirmSheet('Apagar compromissos antigos?', 'Eles só existem no app (não estão no Google).', 'Apagar', () => { AG().items = []; save(); });

function eventSheet(x, date) {
  const google = linked();
  const it = x || { title: '', date: date || ui.agDay || dateKey(), time: '', end: '', allDay: false, location: '', notes: '', cal: writable()[0]?.id };
  const canEdit = !google || !x || x.edit;
  if (google && x && !canEdit) {
    return sheet(x.title, `<p class="muted">${fmtLong(x.date)} · ${esc(when(x))}</p>${x.location ? `<p>📍 ${esc(x.location)}</p>` : ''}${x.notes ? `<p class="note">${esc(x.notes).replace(/\n/g, '<br>')}</p>` : ''}
      <p class="small muted">${esc(x.calName || '')} é só leitura${/anivers|birthday|contact/i.test(x.cal + x.calName) ? ' (os aniversários vêm dos seus Contatos do Google — mude por lá)' : ''}.</p>`);
  }
  sheet(x ? 'Editar evento' : 'Novo evento', `<form class="form">
    <label class="field"><span>O que é</span><input name="title" required value="${esc(it.title)}" placeholder="Ex.: Dentista, aniversário da Ana"></label>
    ${google ? `<label class="field"><span>Agenda</span><select name="cal" ${x ? 'disabled' : ''}>${writable().map((c) => opt(c.id, c.name, it.cal)).join('')}</select></label>` : ''}
    <label class="field"><span>Data</span><input type="date" name="date" required value="${it.date}"></label>
    <label class="toggle-row"><span><b>Dia todo</b></span><input type="checkbox" class="switch" name="allDay" ${it.allDay ? 'checked' : ''}></label>
    <div class="row gap ag-times"><label class="field grow"><span>Começa</span><input type="time" name="time" value="${it.time || ''}"></label>
      <label class="field grow"><span>Termina</span><input type="time" name="end" value="${it.end || ''}"></label></div>
    <label class="field"><span>Local (opcional)</span><input name="location" value="${esc(it.location || '')}"></label>
    <label class="field"><span>Observação (opcional)</span><textarea name="notes" rows="2">${esc(it.notes || '')}</textarea></label>
    ${x?.recurring ? '<p class="small muted">Este evento se repete: a mudança vale só para este dia.</p>' : ''}
    <button class="btn primary block">Salvar</button>
    ${x ? '<button type="button" class="btn danger-ghost block" id="ag-del">Apagar evento</button>' : ''}</form>`, {
    onMount: (root) => {
      const ad = root.querySelector('[name=allDay]'); const tm = root.querySelector('.ag-times');
      const sync = () => { tm.style.display = ad.checked ? 'none' : ''; }; ad.addEventListener('change', sync); sync();
      root.querySelector('#ag-del')?.addEventListener('click', () => confirmSheet('Apagar evento?', google ? 'Ele também será apagado da sua Google Agenda.' : '', 'Apagar', async () => {
        if (google) {
          try { await gapi('DELETE', '/eventos', { query: `?cal=${encodeURIComponent(x.cal)}&id=${encodeURIComponent(x.id)}` }); G.events = G.events.filter((y) => !(y.id === x.id && y.cal === x.cal)); gsave(); toast('Evento apagado'); }
          catch (err) { toast(err.message); }
          rerender();
        } else { AG().items = AG().items.filter((y) => y.id !== x.id); save(); toast('Compromisso apagado'); }
      }));
    },
    onSubmit: (fd, form) => {
      const data = { title: String(fd.get('title')).trim(), date: fd.get('date'), allDay: !!fd.get('allDay'), time: fd.get('allDay') ? '' : fd.get('time') || '',
        end: fd.get('allDay') ? '' : fd.get('end') || '', location: String(fd.get('location') || '').trim(), notes: String(fd.get('notes') || '').trim() };
      if (!data.title || !data.date) return false;
      ui.agDay = data.date; ui.agMonth = null;
      if (!google) {
        if (x) Object.assign(AG().items.find((y) => y.id === x.id) || {}, data); else AG().items.push({ id: uid(), ...data });
        save(); toast('Compromisso salvo 📅'); return undefined;
      }
      const btn = form.querySelector('button.primary'); btn.disabled = true; btn.textContent = 'Salvando no Google…';
      const cal = x ? x.cal : fd.get('cal');
      gapi('POST', '/eventos', { body: { ...data, cal, id: x?.id || '', tz: TZ() } })
        .then(async () => { closeSheet(); toast('Salvo na Google Agenda ✓'); await gRefresh({ force: true, s: G.range?.s, e: G.range?.e }); })
        .catch((err) => { btn.disabled = false; btn.textContent = 'Salvar'; toast(err.message); });
      return false; // fecha só depois que o Google confirmar
    },
  });
}
A.agNew = (el) => { if (linked() && !writable().length) return toast('Marque uma agenda em que você pode escrever'); eventSheet(null, el?.dataset?.d); };
A.agOpen = (el) => {
  if (el.dataset.src === 'meu') return eventSheet(AG().items.find((x) => x.id === el.dataset.id) ? { ...AG().items.find((x) => x.id === el.dataset.id) } : null);
  const x = (G.events || []).find((y) => y.id === el.dataset.id && y.cal === el.dataset.cal); if (x) eventSheet(x);
};

/** tile da tela inicial: próximo compromisso */
export function agendaTile() {
  const t = dateKey(); const now = new Date(); const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const up = eventsBetween(t, addDays(t, 7)).filter((x) => x.date > t || x.allDay || !x.time || (x.end || x.time) >= hm);
  const todayN = up.filter((x) => x.date === t).length;
  const n = up[0];
  if (!n) return `<a class="tile t-sky" href="#/agenda"><span class="tile-ico">📅</span><div><b>Agenda livre</b><small>nada nos próximos 7 dias</small></div></a>`;
  return `<a class="tile t-sky" href="#/agenda"><span class="tile-ico">📅</span><div><b>${esc(n.title)}</b>
    <small>${n.date === t ? 'hoje' : n.date === addDays(t, 1) ? 'amanhã' : fmtShort(n.date)} · ${esc(when(n))}${todayN > 1 ? ` · +${todayN - 1} hoje` : ''}</small></div></a>`;
}

export const routes = { agenda: { render: renderAgenda, tab: 'agenda' } };

// Agenda: mostra só as agendas do Google escolhidas (ex.: Pessoal, Rotina, Aniversários) e permite
// criar, editar e apagar eventos nelas pelo app (API do Google Agenda, pelo plugin do WordPress).
// Sem o WordPress/Google conectado, guarda compromissos só no app.
import { state } from './store.js';
import { esc, dateKey, addDays, parseKey, fmtLong, fmtShort, pad, MONTHS } from './utils.js';
import { A, C, ui, sheet, rerender, toast, confirmSheet } from './ui.js';

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
/** calendário do mês em grade: cada dia mostra os compromissos (horário + nome) e "+N" quando não cabem */
function monthGrid(month, sel) {
  const first = parseKey(month + '-01');
  const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const gs = addDays(month + '-01', -((first.getDay() + 6) % 7)); // segunda-feira da 1ª semana
  const last = `${month}-${pad(dim)}`; const ge = addDays(last, (7 - parseKey(last).getDay()) % 7); // domingo da última semana
  const by = {}; for (const x of eventsBetween(gs, ge)) (by[x.date] ||= []).push(x);
  const today = dateKey(); const MAX = 3;
  let cells = '';
  for (let k = gs; k <= ge; k = addDays(k, 1)) {
    const xs = by[k] || []; const out = !k.startsWith(month);
    cells += `<div class="agm-day ${out ? 'out' : ''} ${k === sel ? 'sel' : ''} ${k === today ? 'today' : ''}" data-act="agPick" data-d="${k}" role="button" tabindex="0">
      <b class="agm-n">${Number(k.slice(8))}</b>
      ${xs.slice(0, MAX).map((x) => `<button class="agm-ev ${x.allDay ? 'all' : ''}" style="--cal:${x.color || 'var(--accent)'}" data-act="agOpen" data-src="${x.src}" data-id="${esc(x.id)}" data-cal="${esc(x.cal || '')}" data-d="${x.date}" title="${esc(`${when(x)} ${x.title}`)}">${x.allDay ? '' : `<span class="agm-t">${esc(x.time)}</span> `}<span class="agm-x">${esc(x.title)}</span></button>`).join('')}
      ${xs.length > MAX ? `<small class="agm-more">+${xs.length - MAX}</small>` : ''}</div>`;
  }
  return `<div class="agm"><div class="agm-wd">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((w) => `<small>${w}</small>`).join('')}</div><div class="agm-grid">${cells}</div></div>`;
}
function itemRow(x) {
  return `<li class="ag-item ${x.src}" style="--cal:${x.color || 'var(--accent)'}" data-act="agOpen" data-src="${x.src}" data-id="${esc(x.id)}" data-cal="${esc(x.cal || '')}" data-d="${x.date}">
    <span class="ag-time">${esc(when(x))}</span>
    <div class="grow"><b>${esc(x.title)}</b>${x.location ? `<small>📍 ${esc(x.location)}</small>` : ''}${x.calName && selCals().length > 1 ? `<small class="ag-cal">${esc(x.calName)}</small>` : ''}</div></li>`;
}
/** lista lateral: Minhas agendas (posso editar) e Outras agendas (só leitura), com a cor de cada uma */
function googleCard() {
  if (!wpOn()) return `<section class="card ag-side"><h2>Google Agenda</h2><p class="small muted">A agenda vem da sua Google Agenda. Para ver aqui, abra o app pelo endereço do WordPress (seusite/minha-rotina/) — no celular também, e adicione à Tela de Início por esse endereço.</p></section>`;
  const st = G.status;
  if (!st) return `<section class="card ag-side"><p class="small muted">Verificando a Google Agenda…</p></section>`;
  if (!st.configured) return `<section class="card ag-side"><h2>Google Agenda</h2><p class="small muted">Falta configurar a ligação com o Google no painel do WordPress: <b>Minha Rotina → Google Agenda</b> (tem o passo a passo lá). Depois volte aqui e toque em Conectar.</p></section>`;
  if (!st.connected) return `<section class="card ag-side"><h2>Conectar a Google Agenda</h2>
    <p class="small muted">Você vai entrar na sua conta Google e permitir o acesso. Se aparecer “app não verificado”, toque em <b>Avançado → Acessar</b> (é o seu próprio app).</p>
    <a class="btn primary block" href="${esc(st.connect)}">Conectar com o Google</a>
    ${G.error ? `<p class="small err">${esc(G.error)}</p>` : ''}</section>`;
  const cals = G.calendars || []; const on = new Set(st.selected || []);
  const row = (c) => `<label class="ag-cb" style="--cal:${c.color}"><input type="checkbox" data-change="agCal" data-id="${esc(c.id)}" ${on.has(c.id) ? 'checked' : ''}><i></i><span>${esc(c.name)}</span></label>`;
  const mine = cals.filter((c) => c.write); const other = cals.filter((c) => !c.write);
  return `<section class="card ag-side">
    ${mine.length ? `<h4>Minhas agendas</h4>${mine.map(row).join('')}` : ''}
    ${other.length ? `<h4>Outras agendas</h4>${other.map(row).join('')}` : ''}
    ${G.error ? `<p class="small err">${esc(G.error)}</p>` : ''}
    <details class="ag-conn"><summary>Conexão com o Google</summary>
      <p class="small muted">Conectada (só visualização).${G.at ? ` Atualizado às ${pad(new Date(G.at).getHours())}:${pad(new Date(G.at).getMinutes())}.` : ''} Só as agendas marcadas aparecem no app. Para criar ou mudar compromissos, use o Google Agenda — o app atualiza sozinho.</p>
      <div class="row gap wrap"><button class="btn small" data-act="agRefresh">🔄 Atualizar</button><button class="btn small ghost" data-act="agDisconnect">Desconectar</button></div></details>
  </section>`;
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
  const needPick = linked() && !selCals().length;
  return `<header class="page-head top"><h1>Agenda</h1></header>
  ${needPick ? '<section class="card"><b>Escolha quais agendas do Google aparecem aqui</b><p class="small muted">Na lista de agendas, marque Compromissos pessoais, Rotina e Aniversários.</p></section>' : ''}
  <div class="ag-wrap">
    <div class="ag-main">
      <div class="agm-head"><button class="icon-btn" data-act="agMonth" data-n="-1" aria-label="Mês anterior">‹</button>
        <h2>${MONTHS[mDate.getMonth()][0].toUpperCase() + MONTHS[mDate.getMonth()].slice(1)} ${mDate.getFullYear()}</h2>
        <span class="grow"></span><button class="btn small ghost" data-act="agToday">Hoje</button>
        <button class="icon-btn" data-act="agMonth" data-n="1" aria-label="Próximo mês">›</button></div>
      ${monthGrid(month, sel)}
    </div>
    <aside class="ag-aside">
      <section class="card ag-daycard"><div class="card-head"><h2>${sel === today ? 'Hoje' : fmtLong(sel)}</h2></div>
        ${dayEvs.length ? `<ul class="ag-list">${dayEvs.map(itemRow).join('')}</ul>` : '<p class="muted small">Nada neste dia.</p>'}</section>
      ${googleCard()}
    </aside>
  </div>`;
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
/** detalhes do compromisso (só visualização: mudanças são feitas no Google Agenda) */
function eventSheet(x) {
  const [y, m, d] = x.date.split('-');
  const gl = x.link || `https://calendar.google.com/calendar/r/day/${y}/${Number(m)}/${Number(d)}`;
  sheet(x.title, `<p class="muted">${fmtLong(x.date)} · ${esc(when(x))}</p>
    ${x.calName ? `<p class="ag-calname"><i class="ag-dot" style="background:${x.color || 'var(--accent)'}"></i>${esc(x.calName)}</p>` : ''}
    ${x.location ? `<p>📍 ${esc(x.location)}</p>` : ''}${x.notes ? `<p class="note">${esc(x.notes).replace(/\n/g, '<br>')}</p>` : ''}
    ${x.src === 'google' ? `<p class="small muted">Para mudar ou apagar, use o Google Agenda.</p><a class="btn primary block" href="${esc(gl)}" target="_blank" rel="noopener">Abrir no Google Agenda</a>` : ''}`);
}
A.agOpen = (el) => {
  const x = el.dataset.src === 'meu' ? AG().items.find((y) => y.id === el.dataset.id) : (G.events || []).find((y) => y.id === el.dataset.id && y.cal === el.dataset.cal);
  if (x) eventSheet({ ...x, src: el.dataset.src, date: el.dataset.d || x.date });
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

// Sequências (letra B): quantos dias seguidos cada hábito foi cumprido, recorde e dias de pausa.
// Só contam os dias em que o hábito está programado; dia sem hábito ou dia de pausa não quebra a sequência.
import { state, save, version } from './store.js';
import { esc, dateKey, addDays, weekStart, fmtShort, MONTHS } from './utils.js';
import { A, C, rerender, toast, confirmSheet } from './ui.js';
import { tasksFor, isDone, waterTotal, medTasks } from './logic.js';
import { sinceDate } from './view-report.js';

const S = () => (state.streaks ||= { on: true, inList: true, hidden: [], pauses: {}, perMonth: 2 });
const MAX_DAYS = 730;
const MILESTONES = [3, 7, 14, 21, 30, 45, 60, 90, 100, 150, 200, 365];

/* ---------- hábitos que entram ---------- */
export function habits() {
  const list = state.routine.map((r) => ({ id: r.id, title: r.title, icon: r.icon, color: r.color, task: r,
    unit: r.flexWeekly ? 'semana' : r.days.length === 7 && r.type !== 'cabelo' ? 'dia' : 'vez' }));
  list.push({ id: '__agua', title: 'Meta de água', icon: '💧', color: 'sky', unit: 'dia' });
  if (state.meds.some((m) => m.active)) list.push({ id: '__remedios', title: 'Remédios do dia', icon: '💊', color: 'violet', unit: 'dia' });
  return list;
}
export const visibleHabits = () => habits().filter((h) => !S().hidden.includes(h.id));
const unitLabel = (h, n) => (h.unit === 'semana' ? (n === 1 ? 'semana' : 'semanas') : h.unit === 'dia' ? (n === 1 ? 'dia' : 'dias') : n === 1 ? 'vez' : 'vezes');
export const streakText = (h, n) => `${n} ${unitLabel(h, n)}${h.unit === 'dia' ? ' seguidos' : ' seguidas'}`.replace('1 dia seguidos', '1 dia').replace('1 vez seguidas', '1 vez').replace('1 semana seguidas', '1 semana');

/* ---------- cálculo (com memória até o próximo salvamento) ---------- */
let memo = { key: '', sched: new Map(), res: new Map() };
function fresh() {
  const key = `${version}|${dateKey()}`;
  if (memo.key !== key) memo = { key, sched: new Map(), res: new Map() };
}
function scheduledIds(d) {
  let s = memo.sched.get(d);
  if (!s) { s = new Set(tasksFor(d).filter((t) => t.kind === 'routine').map((t) => t.id)); memo.sched.set(d, s); }
  return s;
}
const paused = (d) => !!S().pauses[d];
function scheduled(h, d) {
  if (h.id === '__agua') return true;
  if (h.id === '__remedios') return state.meds.some((m) => m.active);
  return scheduledIds(d).has(h.id);
}
function doneOn(h, d) {
  if (h.id === '__agua') return waterTotal(d) >= (state.water.goal || 0);
  if (h.id === '__remedios') { const ts = medTasks(); return ts.length > 0 && ts.every((t) => isDone(t, d)); }
  return !!state.done[d]?.[h.id];
}

/** { cur, best, today: 'feito' | 'falta' | 'livre' } */
export function streakOf(h) {
  fresh();
  if (memo.res.has(h.id)) return memo.res.get(h.id);
  const today = dateKey();
  let start = sinceDate(); const min = addDays(today, -MAX_DAYS); if (start < min) start = min;
  let run = 0, best = 0, todayState = 'livre';
  if (h.task?.flexWeekly) {
    // "um dos dias da semana": conta semanas seguidas
    const cw = weekStart(today);
    for (let ws = weekStart(start); ws <= cw; ws = addDays(ws, 7)) {
      if (h.task.from && addDays(ws, 6) < h.task.from) continue;
      const days = h.task.days.map((wd) => addDays(ws, (wd + 6) % 7));
      if (days.length && days.every(paused)) continue;
      if (isDone(h.task, ws)) { run++; if (ws === cw) todayState = 'feito'; }
      else if (ws === cw) todayState = days.some((d) => d >= today) ? 'falta' : 'livre';
      else run = 0;
      best = Math.max(best, run);
    }
  } else {
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (!scheduled(h, d) || paused(d)) continue;
      if (doneOn(h, d)) { run++; if (d === today) todayState = 'feito'; }
      else if (d === today) todayState = 'falta'; // ainda dá tempo hoje
      else run = 0;
      best = Math.max(best, run);
    }
  }
  const r = { cur: run, best, today: todayState };
  memo.res.set(h.id, r);
  return r;
}
export const streakById = (id) => { const h = habits().find((x) => x.id === id); return h ? { h, ...streakOf(h) } : null; };

/** chama ao marcar uma tarefa: comemora marcos (3, 7, 14, 21, 30 dias…) */
export function celebrate(id) {
  if (!S().on) return false;
  const s = streakById(id); if (!s || S().hidden.includes(id) || s.today !== 'feito') return false;
  if (!MILESTONES.includes(s.cur)) return false;
  toast(`🔥 ${streakText(s.h, s.cur)} de ${s.h.title}!${s.cur >= s.best ? ' Novo recorde!' : ''}`);
  return true;
}
/** selo pequeno para a lista do dia */
export function streakBadge(id) {
  if (!S().on || !S().inList || S().hidden.includes(id)) return '';
  const s = streakById(id); if (!s || s.cur < 2) return '';
  return `<span class="streak-badge ${s.today === 'feito' ? 'lit' : ''}" title="${esc(streakText(s.h, s.cur))}">🔥 ${s.cur}</span>`;
}

/* ---------- pausas ---------- */
const monthOf = (d) => d.slice(0, 7);
const pausesIn = (m) => Object.keys(S().pauses).filter((d) => monthOf(d) === m);
const PAUSE_REASONS = { doente: 'Doente', viagem: 'Viagem', descanso: 'Descanso', outro: 'Outro' };

/* ---------- tela ---------- */
function renderStreaks() {
  const st = S(); const today = dateKey();
  const list = visibleHabits().map((h) => ({ h, ...streakOf(h) })).sort((a, b) => b.cur - a.cur || b.best - a.best);
  const top = list[0];
  const active = list.filter((x) => x.cur > 0).length;
  const atRisk = list.filter((x) => x.cur > 0 && x.today === 'falta');
  const m = monthOf(today); const used = pausesIn(m);
  const yest = addDays(today, -1);
  const row = (x) => `<li class="streak-row ${x.today === 'feito' ? 'lit' : ''}">
    <span class="t-icon bg-soft-${x.h.color || 'rose'}">${x.h.icon || '✅'}</span>
    <div class="grow"><b>${esc(x.h.title)}</b><small>${x.today === 'feito' ? 'feito hoje ✓' : x.today === 'falta' ? (x.cur ? 'faça hoje para manter' : 'comece hoje') : 'hoje não tem'} · recorde ${x.best}</small></div>
    <span class="streak-num"><span class="fl">🔥</span><b>${x.cur}</b><small>${unitLabel(x.h, x.cur)}</small></span></li>`;
  return `<header class="page-head top"><h1>Sequências</h1></header>
  <section class="card streak-hero">
    <span class="streak-big">🔥</span>
    <div class="grow">${top && top.cur ? `<small>Maior sequência agora</small><b>${streakText(top.h, top.cur)}</b><small>${esc(top.h.title)} · ${active} hábito${active === 1 ? '' : 's'} em sequência</small>`
      : '<b>Comece hoje 💜</b><small>Cada hábito cumprido no dia em que está programado soma 1. Dia sem o hábito ou dia de pausa não quebra.</small>'}</div>
  </section>
  ${atRisk.length ? `<section class="card warn-soft"><b>Para não perder hoje</b><small>${atRisk.map((x) => `${esc(x.h.title)} (🔥 ${x.cur})`).join(' · ')}</small></section>` : ''}
  ${!st.on ? '<p class="muted small">As sequências estão desligadas. Ligue nas opções abaixo.</p>' : ''}
  <section class="card"><ul class="mini-list streak-list">${list.map(row).join('')}</ul></section>
  <section class="card">
    <div class="card-head"><h2>Dias de pausa</h2><small>${used.length} de ${st.perMonth} em ${MONTHS[Number(m.slice(5)) - 1]}</small></div>
    <p class="small muted">Ficou doente ou viajou? Marque o dia como pausa e nenhuma sequência zera.</p>
    ${used.length < st.perMonth ? `<div class="row gap wrap mt">
      <select class="mini-select" id="pause-reason">${Object.entries(PAUSE_REASONS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
      ${!st.pauses[today] ? '<button class="btn small" data-act="streakPause" data-d="' + today + '">Pausar hoje</button>' : ''}
      ${!st.pauses[yest] && monthOf(yest) === m ? '<button class="btn small ghost" data-act="streakPause" data-d="' + yest + '">Pausar ontem</button>' : ''}</div>`
      : '<p class="small mt">Você já usou as pausas deste mês.</p>'}
    ${Object.keys(st.pauses).length ? `<ul class="mini-list mt">${Object.keys(st.pauses).sort().reverse().slice(0, 6).map((d) => `<li><div class="grow"><b>${fmtShort(d)}</b><small>${PAUSE_REASONS[st.pauses[d]] || ''}</small></div>
      <button class="icon-btn sm" data-act="streakUnpause" data-d="${d}" aria-label="Tirar pausa">✕</button></li>`).join('')}</ul>` : ''}
  </section>
  <section class="card">
    <h2>Opções</h2>
    <label class="toggle-row"><span><b>Contar sequências</b></span><input type="checkbox" class="switch" data-change="streakSet" data-k="on" ${st.on ? 'checked' : ''}></label>
    <label class="toggle-row"><span><b>Mostrar 🔥 na rotina do dia</b></span><input type="checkbox" class="switch" data-change="streakSet" data-k="inList" ${st.inList ? 'checked' : ''}></label>
    <label class="toggle-row"><span><b>Pausas por mês</b></span><select class="mini-select" data-change="streakSet" data-k="perMonth">${[0, 1, 2, 3, 4].map((n) => `<option value="${n}" ${n === st.perMonth ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    <details class="mt"><summary><b>Escolher hábitos</b> <small class="muted">${habits().length - st.hidden.length} de ${habits().length}</small></summary>
      ${habits().map((h) => `<label class="toggle-row"><span><b>${h.icon || ''} ${esc(h.title)}</b></span><input type="checkbox" class="switch" data-change="streakHabit" data-id="${h.id}" ${st.hidden.includes(h.id) ? '' : 'checked'}></label>`).join('')}
    </details>
  </section>`;
}

A.streakPause = (el) => {
  const st = S(); const d = el.dataset.d;
  if (pausesIn(monthOf(d)).length >= st.perMonth) { toast('Você já usou as pausas deste mês'); return; }
  st.pauses[d] = document.getElementById('pause-reason')?.value || 'outro';
  save(); toast(`${fmtShort(d)} marcado como pausa — suas sequências estão protegidas`); rerender();
};
A.streakUnpause = (el) => confirmSheet('Tirar pausa?', `O dia ${fmtShort(el.dataset.d)} volta a contar normalmente.`, 'Tirar pausa', () => { delete S().pauses[el.dataset.d]; save(); rerender(); }, false);
C.streakSet = (el) => { const k = el.dataset.k; S()[k] = k === 'perMonth' ? Number(el.value) : el.checked; save(); rerender(); };
C.streakHabit = (el) => {
  const st = S(); const id = el.dataset.id;
  st.hidden = el.checked ? st.hidden.filter((x) => x !== id) : [...new Set([...st.hidden, id])];
  save(); rerender();
};

/** tile da tela inicial */
export function streaksTile() {
  if (!S().on) return `<a class="tile t-rose" href="#/sequencias"><span class="tile-ico">🔥</span><div><b>Sequências</b><small>desligadas</small></div></a>`;
  const list = visibleHabits().map((h) => ({ h, ...streakOf(h) })).sort((a, b) => b.cur - a.cur);
  const top = list[0]; const risk = list.filter((x) => x.cur > 0 && x.today === 'falta').length;
  if (!top || !top.cur) return `<a class="tile t-rose" href="#/sequencias"><span class="tile-ico">🔥</span><div><b>Sequências</b><small>comece hoje</small></div></a>`;
  return `<a class="tile t-rose" href="#/sequencias"><span class="tile-ico">🔥</span><div><b>${streakText(top.h, top.cur)}</b>
    <small>${esc(top.h.title)}${risk ? ` · ${risk} para manter hoje` : ' · tudo em dia'}</small></div></a>`;
}

export const routes = { sequencias: { render: renderStreaks, tab: 'sequencias' } };

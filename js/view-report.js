// Relatório de produtividade: semana, mês e ano (todas as tarefas e hábitos, menos finanças).
import { state } from './store.js';
import { esc, dateKey, addDays, weekStart, parseKey, MONTHS, WD, fmtMinutes, fmtShort, diffDays } from './utils.js';
import { A, ui, rerender, ring, bar, toast } from './ui.js';
import { sleepRange } from './view-sleep.js';
import { streaksCard, streakLine } from './view-streaks.js';
import { tasksFor, isDone, waterTotal, medPerDay, medTaken, activeChallenge, challengeDay, dayScore, workoutFor } from './logic.js';

const PERIODS = { semana: 'Semana', mes: 'Mês', ano: 'Ano' };
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** primeiro dia com algum registro (dias antes disso não entram no relatório) */
export function sinceDate() {
  const keys = [
    ...Object.keys(state.done || {}), ...Object.keys(state.water?.log || {}), ...Object.keys(state.medLog || {}),
    ...Object.keys(state.skinLog || {}), ...Object.keys(state.workoutLog || {}), ...Object.keys(state.hair?.log || {}),
    ...(state.reading?.sessions || []).map((x) => x.date), ...(state.study?.sessions || []).map((x) => x.date),
    ...(state.english?.sessions || []).map((x) => x.date),
  ].filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  return keys[0] || dateKey();
}

function range(period, anchor) {
  if (period === 'semana') { const s = weekStart(anchor); return [s, addDays(s, 6)]; }
  if (period === 'mes') { const s = anchor.slice(0, 8) + '01'; const d = parseKey(s); return [s, dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0))]; }
  const y = anchor.slice(0, 4); return [`${y}-01-01`, `${y}-12-31`];
}
function shift(period, anchor, n) {
  const d = parseKey(anchor);
  if (period === 'semana') return addDays(anchor, 7 * n);
  if (period === 'mes') return dateKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
  return `${d.getFullYear() + n}-01-01`;
}
function label(period, s, e) {
  const d = parseKey(s);
  if (period === 'semana') return `${fmtShort(s)} a ${fmtShort(e)}`;
  if (period === 'mes') return `${MONTHS[d.getMonth()][0].toUpperCase() + MONTHS[d.getMonth()].slice(1)} de ${d.getFullYear()}`;
  return String(d.getFullYear());
}

/** calcula tudo do período [s, e] (até hoje e a partir do primeiro uso) */
export function computeReport(s, e) {
  const today = dateKey(); const since = sinceDate();
  const start = s < since ? since : s; const end = e > today ? today : e;
  const days = []; const per = {}; let total = 0, done = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    let t = 0, k = 0;
    for (const task of tasksFor(d)) {
      // tarefa "um dos dias da semana" conta uma vez: no dia em que foi feita, ou no último dia dela
      if (task.flexWeekly) {
        const when = isDone(task, d);
        const lastDay = [...task.days].map((wd) => addDays(weekStart(d), (wd + 6) % 7)).sort().pop();
        if (when ? when !== d : d !== lastDay && d !== end) continue;
      }
      const key = task.kind === 'med' ? `med:${task.medId}` : task.id;
      const ok = !!isDone(task, d);
      t++; if (ok) k++;
      const p = (per[key] ||= { id: key, title: task.title, icon: task.icon, color: task.color, total: 0, done: 0 });
      p.total++; if (ok) p.done++;
    }
    total += t; done += k;
    days.push({ d, t, k, p: t ? k / t : null });
  }
  // hábitos
  const n = days.length;
  const goal = state.water.goal;
  const waterDays = days.filter(({ d }) => waterTotal(d) >= goal).length;
  const waterAvg = n ? Math.round(days.reduce((a, { d }) => a + waterTotal(d), 0) / n) : 0;
  let medT = 0, medE = 0;
  for (const { d } of days) for (const m of state.meds.filter((x) => x.active)) { medE += medPerDay(m); medT += Math.min(medTaken(d, m.id), medPerDay(m)); }
  const inRange = (x) => x.date >= start && x.date <= end;
  const secs = (arr) => (arr || []).filter(inRange).reduce((a, x) => a + (x.seconds || 0), 0);
  const read = (state.reading.sessions || []).filter(inRange);
  const pages = read.reduce((a, x) => a + Math.max(0, (x.to || 0) - (x.from || 0)), 0);
  const booksDone = state.books.filter((b) => b.finished && b.finished >= start && b.finished <= end).length;
  const hairLogs = Object.entries(state.hair.log || {}).filter(([d]) => d >= start && d <= end).length;
  let workDone = 0, workPlan = 0;
  for (const { d } of days) { if (workoutFor(d)) { workPlan++; const l = state.workoutLog[d]; const w = workoutFor(d); if (l && w.exercises.length && w.exercises.every((x) => l.ex[x.id])) workDone++; } }
  const c = activeChallenge();
  let chal = null;
  if (c) { const cd = days.filter(({ d }) => { const i = challengeDay(c, d); return i >= 1 && i <= c.days; }); if (cd.length) chal = { name: c.name, avg: cd.reduce((a, { d }) => a + dayScore(c, d), 0) / cd.length, days: cd.length }; }
  const valid = days.filter((x) => x.t);
  const best = valid.reduce((b, x) => (!b || x.p > b.p ? x : b), null);
  return { start, end, n, days, per, total, done, rate: total ? done / total : 0,
    perfect: valid.filter((x) => x.p >= 1).length, good: valid.filter((x) => x.p >= 0.8).length, best,
    habits: { waterDays, waterAvg, medT, medE, study: secs(state.study.sessions), english: secs(state.english?.sessions),
      readSec: secs(read), pages, booksDone, hairLogs, workDone, workPlan, chal } };
}

function chart(period, r, s, e) {
  // barras: dias (semana/mês) ou meses (ano)
  let items;
  if (period === 'ano') {
    items = MONTHS.map((m, i) => {
      const ds = r.days.filter((x) => parseKey(x.d).getMonth() === i && x.t);
      const t = ds.reduce((a, x) => a + x.t, 0), k = ds.reduce((a, x) => a + x.k, 0);
      return { lab: m.slice(0, 3), v: t ? k / t : null, tip: t ? `${m}: ${pct(k, t)}% (${k}/${t})` : `${m}: sem dados` };
    });
  } else {
    items = [];
    for (let d = s; d <= e; d = addDays(d, 1)) {
      const x = r.days.find((y) => y.d === d);
      items.push({ lab: period === 'semana' ? WD[parseKey(d).getDay()] : String(parseKey(d).getDate()),
        v: x && x.t ? x.p : null, tip: x && x.t ? `${fmtShort(d)}: ${pct(x.k, x.t)}% (${x.k}/${x.t})` : `${fmtShort(d)}: sem dados` });
    }
  }
  const W = 340, H = 150, padB = 18, gap = 2;
  const bw = (W - gap * (items.length - 1)) / items.length;
  const showVal = items.length <= 12;
  const every = items.length > 12 ? 5 : 1;
  return `<svg class="rep-chart" viewBox="0 0 ${W} ${H + 14}" role="img" aria-label="Conclusão por ${period === 'ano' ? 'mês' : 'dia'}">
    ${[0.5, 1].map((g) => `<line x1="0" x2="${W}" y1="${(H - padB) * (1 - g) + 6}" y2="${(H - padB) * (1 - g) + 6}" class="rep-grid"/>`).join('')}
    ${items.map((it, i) => {
      const x = i * (bw + gap); const h = it.v === null ? 0 : Math.max(3, (H - padB) * it.v); const y = H - padB - h + 6;
      return `<g class="rep-bar" data-act="repTip" data-tip="${esc(it.tip)}">
        <rect x="${x}" y="6" width="${bw}" height="${H - padB}" class="rep-hit"/>
        ${it.v === null ? `<rect x="${x}" y="${H - padB + 4}" width="${bw}" height="2" rx="1" class="rep-none"/>`
          : `<path d="M${x},${y + h} V${y + Math.min(4, h)} Q${x},${y} ${x + Math.min(4, bw / 2)},${y} H${x + bw - Math.min(4, bw / 2)} Q${x + bw},${y} ${x + bw},${y + Math.min(4, h)} V${y + h} Z" class="rep-fill ${it.v >= 1 ? 'full' : ''}"><title>${esc(it.tip)}</title></path>`}
        ${showVal && it.v !== null ? `<text x="${x + bw / 2}" y="${y - 3}" class="rep-val">${Math.round(it.v * 100)}</text>` : ''}
        ${i % every === 0 || i === items.length - 1 ? `<text x="${x + bw / 2}" y="${H + 10}" class="rep-lab">${it.lab}</text>` : ''}
      </g>`;
    }).join('')}
  </svg>`;
}

function renderReport() {
  const period = ui.repPeriod || 'semana';
  const anchor = ui.repAnchor || dateKey();
  const [s, e] = range(period, anchor);
  const r = computeReport(s, e);
  const [ps, pe] = range(period, shift(period, anchor, -1));
  const prev = computeReport(ps, pe);
  const diff = prev.total ? Math.round((r.rate - prev.rate) * 100) : null;
  const tasks = Object.values(r.per).sort((a, b) => b.done / b.total - a.done / a.total || b.total - a.total);
  const h = r.habits;
  const future = s > dateKey();
  const habit = (ic, name, val, sub, p) => `<div class="rep-habit"><span class="t-icon bg-soft-violet">${ic}</span><div class="grow"><b>${name}</b><small>${sub}</small>${p !== null ? bar(p) : ''}</div><b class="rep-hv">${val}</b></div>`;
  const msg = r.rate >= 0.85 ? 'Período incrível! 🏆' : r.rate >= 0.6 ? 'Muito bem, constância em dia! 💜' : r.rate >= 0.35 ? 'Bom caminho, dá para subir mais ✨' : r.total ? 'Recomeçar faz parte. Bora! 🌱' : 'Sem registros neste período';
  return `<header class="page-head top"><h1>Relatório</h1></header>
  <div class="seg">${Object.entries(PERIODS).map(([k, l]) => `<button class="${k === period ? 'on' : ''}" data-act="repPeriod" data-p="${k}">${l}</button>`).join('')}</div>
  <div class="rep-nav"><button class="icon-btn" data-act="repShift" data-n="-1" aria-label="Anterior">‹</button><b>${label(period, s, e)}</b>
    <button class="icon-btn" data-act="repShift" data-n="1" aria-label="Próximo" ${e >= dateKey() ? 'disabled' : ''}>›</button></div>
  ${future || !r.n ? '<section class="card"><p class="muted center">Ainda não há dados neste período.</p></section>' : `
  <section class="card rep-hero">
    ${ring(r.rate, { size: 108, stroke: 11, label: `${Math.round(r.rate * 100)}%`, sub: 'concluído' })}
    <div class="grow"><b>${msg}</b><small>${r.done} de ${r.total} tarefas e hábitos feitos</small>
      ${diff !== null ? `<span class="rep-diff ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} pontos vs. ${period === 'semana' ? 'semana' : period === 'mes' ? 'mês' : 'ano'} anterior</span>` : ''}</div>
  </section>
  <div class="stats three">
    <div class="stat"><span>⭐</span><b>${r.perfect}</b><small>dias 100%</small></div>
    <div class="stat"><span>⚡</span><b>${r.good}</b><small>dias acima de 80%</small></div>
    <div class="stat"><span>🏆</span><b>${r.best ? fmtShort(r.best.d) : '–'}</b><small>melhor dia${r.best ? ` (${Math.round(r.best.p * 100)}%)` : ''}</small></div>
  </div>
  ${streaksCard()}
  <section class="card"><div class="card-head"><h2>Conclusão por ${period === 'ano' ? 'mês' : 'dia'}</h2><small>toque numa barra</small></div>${chart(period, r, s, e)}</section>
  <section class="card"><h2>Hábitos</h2>
    ${habit('💧', 'Água', `${h.waterDays}/${r.n}`, `dias com a meta batida · média ${h.waterAvg} ml/dia`, r.n ? h.waterDays / r.n : 0)}
    ${h.medE ? habit('💊', 'Remédios', `${pct(h.medT, h.medE)}%`, `${h.medT} de ${h.medE} doses tomadas`, h.medT / h.medE) : ''}
    ${h.workPlan ? habit('🏋️‍♀️', 'Treinos', `${h.workDone}/${h.workPlan}`, 'treinos completos (todos os exercícios)', h.workDone / h.workPlan) : ''}
    ${habit('📚', 'Estudo', fmtMinutes(h.study / 60), `média ${fmtMinutes(h.study / 60 / (r.n || 1))} por dia`, null)}
    ${habit('💬', 'Inglês', fmtMinutes(h.english / 60), `média ${fmtMinutes(h.english / 60 / (r.n || 1))} por dia`, null)}
    ${habit('📖', 'Leitura', fmtMinutes(h.readSec / 60), `${h.pages} páginas${h.booksDone ? ` · ${h.booksDone} livro(s) concluído(s)` : ''}`, null)}
    ${(() => { const sl = sleepRange(r.start, r.end); return sl.n ? habit('🌙', 'Sono', fmtMinutes(sl.avg * 60), `média por noite · ${sl.ok} de ${sl.n} noites na meta`, sl.ok / sl.n) : ''; })()}
    ${habit('💇‍♀️', 'Cabelo', String(h.hairLogs), 'lavagens registradas', null)}
    ${h.chal ? habit('🎯', 'Desafio', `${Math.round(h.chal.avg * 100)}%`, `${esc(h.chal.name)} · média em ${h.chal.days} dia(s)`, h.chal.avg) : ''}
  </section>
  <section class="card"><div class="card-head"><h2>Cada tarefa</h2><small>${tasks.length} itens</small></div>
    <ul class="rep-tasks">${tasks.map((t) => `<li><span class="t-icon bg-soft-${t.color || 'rose'}">${t.icon || '✅'}</span>
      <div class="grow"><div class="row between"><b>${esc(t.title)}</b><small>${t.done}/${t.total}</small></div>${bar(t.done / t.total)}${streakLine(t.id)}</div>
      <b class="rep-pct ${t.done / t.total >= 0.8 ? 'hi' : t.done / t.total < 0.4 ? 'lo' : ''}">${pct(t.done, t.total)}%</b></li>`).join('')}</ul>
  </section>
  <p class="small muted center">Finanças não entram no relatório. Os dias antes do primeiro uso do app também não contam.</p>`}`;
}

A.repPeriod = (el) => { ui.repPeriod = el.dataset.p; ui.repAnchor = dateKey(); rerender(); };
A.repShift = (el) => { const p = ui.repPeriod || 'semana'; const next = shift(p, ui.repAnchor || dateKey(), Number(el.dataset.n)); if (next > dateKey() && Number(el.dataset.n) > 0 && range(p, next)[0] > dateKey()) return; ui.repAnchor = next; rerender(); };
A.repTip = (el) => toast(el.dataset.tip);

export const routes = { relatorio: { render: renderReport, tab: 'relatorio' } };

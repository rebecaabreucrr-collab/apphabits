// Tela "Hoje": dashboard do dia, linha do tempo e desafio.
import { state, save } from './store.js';
import { esc, dateKey, addDays, weekStart, parseKey, WD, fmtLong, greeting, toMin, nowMin, fmtMinutes, fmtRel, WD_FULL, weekday } from './utils.js';
import { A, ui, ring, check, sheet, go, rerender, toast, empty } from './ui.js';
import { tasksFor, isDone, toggleDone, dayProgress, findTask, hairDay, workoutFor, workoutLog, readingDay,
  activeChallenge, challengeDay, goalDone, nextWashes, peekSkin, setDone, dayScore } from './logic.js';
import { MASKS } from './defaults.js';
import { taskSheet } from './forms.js';
import { bar } from './ui.js';
import { cycleStats, predictions, dayInfo as cycleDayInfo, cycleSummary, PHASES } from './cycle.js';

function subtitle(t, k) {
  const parts = [];
  if (t.end) parts.push(`até ${t.end}`);
  switch (t.type) {
    case 'treino': {
      const w = workoutFor(k);
      if (w) {
        const l = state.workoutLog[k]; const n = l ? Object.values(l.ex).filter(Boolean).length : 0;
        parts.push(`${w.name} · ${n}/${w.exercises.length} exercícios`);
      } else parts.push('Sem treino definido · toque para escolher');
      break;
    }
    case 'skincare': {
      const r = state.skincare[t.routineKey || 'am'];
      const l = peekSkin(k, t.routineKey || 'am');
      const n = l ? r.steps.filter((s) => l.steps[s.id]).length : 0;
      parts.push(`${n}/${r.steps.length} passos`);
      break;
    }
    case 'cabelo': {
      const h = hairDay(k);
      parts.push(`${MASKS[h.mask]?.icon} ${MASKS[h.mask]?.label}${h.mask === 'reconstrucao' ? ' + acidificante' : ''} · tônico`);
      break;
    }
    case 'leitura': {
      const b = state.books.find((x) => x.id === state.reading.activeBookId);
      const r = readingDay(k);
      parts.push(b ? esc(b.title) : 'Escolha um livro');
      if (r.sec) parts.push(`${fmtMinutes(r.sec / 60)} · ${r.pages} pág.`);
      break;
    }
    case 'palavra': parts.push('Toque para ouvir'); break;
  }
  if (t.flexWeekly) {
    const d = isDone(t, k);
    if (d && d !== k) parts.push(`feita na ${WD_FULL[weekday(d)]} ✓`);
    else if (!d) parts.push(t.days.map((x) => WD[x]).join(' ou '));
  }
  return parts.join(' · ');
}

function taskRow(t, k, highlight) {
  const done = !!isDone(t, k);
  const special = ['treino', 'skincare', 'cabelo', 'leitura', 'palavra'].includes(t.type);
  return `<li class="task ${done ? 'done' : ''} ${highlight ? 'now' : ''}">
    <div class="t-time">${esc(t.time || '—')}</div>
    <button class="t-main" data-act="openTask" data-id="${t.id}">
      <span class="t-icon bg-soft-${t.color || 'rose'}">${t.icon || '✅'}</span>
      <span class="t-text"><b>${esc(t.title)}</b><small>${subtitle(t, k)}</small></span>
      ${special ? '<span class="t-go">›</span>' : ''}
    </button>
    ${check(done, 'toggleTask', `data-id="${t.id}"`, `Concluir ${t.title}`)}
  </li>`;
}

const miniRing = (pct, size, stroke, inner = '', cls = '') => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<span class="mring ${cls}" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="mr-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="mr-fg" stroke-dasharray="${c}"
      stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, pct)))}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg><span>${inner}</span></span>`;
};

function weekStrip(k) {
  const ws = weekStart(k); const today = dateKey();
  const st = cycleStats(); const pred = predictions(st);
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const p = d <= today ? dayProgress(d).pct : 0;
    const ph = cycleDayInfo(d, st, pred).phase;
    const dot = ['menstruacao', 'prevista', 'fertil', 'ovulacao'].includes(ph) ? `<i class="cdot cd-${PHASES[ph].color}" title="${PHASES[ph].label}"></i>` : '<i class="cdot"></i>';
    html += `<button class="wday2 ${d === k ? 'sel' : ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}" data-act="pickDay" data-d="${d}">
      <small>${WD[parseKey(d).getDay()]}</small>${miniRing(p, 38, 4, parseKey(d).getDate(), p >= 1 ? 'full' : '')}${dot}</button>`;
  }
  return `<div class="week2">
    <button class="icon-btn" data-act="weekShift" data-n="-7" aria-label="Semana anterior">‹</button>
    <div class="week-days">${html}</div>
    <button class="icon-btn" data-act="weekShift" data-n="7" aria-label="Próxima semana">›</button></div>`;
}

function heroNow(tasks, k, p) {
  const today = dateKey();
  if (k !== today) {
    return `<div class="dh-now"><b class="dh-msg">${p.pct >= 1 ? 'Dia completo ✨' : k < today ? 'Dia passado' : 'Planejamento'}</b>
      <span>${p.done} de ${p.total} tarefas concluídas</span></div>`;
  }
  const m = nowMin();
  const current = tasks.find((t) => t.end && toMin(t.time) <= m && m < toMin(t.end) && !isDone(t, k));
  const next = tasks.find((t) => t.time && toMin(t.time) > m && !isDone(t, k));
  if (!current && !next) {
    return `<div class="dh-now"><b class="dh-msg">${p.pct >= 1 ? 'Tudo feito! 🎉' : 'Reta final do dia'}</b><span>${p.done} de ${p.total} tarefas concluídas</span></div>`;
  }
  const block = (label, t, info) => `<button class="dh-block" data-act="openTask" data-id="${t.id}"><small>${label}</small>
    <b>${t.icon} ${esc(t.title)}</b><span>${info}</span></button>`;
  return `<div class="dh-now">
    ${current ? block('AGORA', current, `até ${current.end}`) : ''}
    ${next ? block('A SEGUIR', next, `${next.time} · em ${fmtMinutes(toMin(next.time) - m)}`) : ''}</div>`;
}

function cycleTile(k) {
  const sum = cycleSummary(dateKey());
  if (sum.empty) return `<a class="tile tile-wide tile-cycle" href="#/ciclo"><span class="tile-ico">🌸</span>
    <div><b>Meu ciclo</b><small>Toque para registrar sua menstruação</small></div></a>`;
  const { st, pred, info } = sum;
  const len = info.len || st.cycleLen;
  let seg = '';
  for (let i = 0; i < len; i++) {
    const d = addDays(info.start, i);
    const ph = cycleDayInfo(d, st, pred).phase;
    seg += `<i class="cseg cd-${PHASES[ph]?.color || 'neutral'} ${d === dateKey() ? 'now' : ''}"></i>`;
  }
  const ph = PHASES[info.phase] || PHASES.folicular;
  return `<a class="tile tile-wide tile-cycle" href="#/ciclo">
    <div class="tc-top"><span class="tile-ico">${ph.icon}</span>
      <div class="grow"><small>Meu ciclo · dia ${info.cycleDay}</small><b>${sum.inPeriod ? `${sum.title} ${sum.sub}` : sum.late ? `Menstruação: ${sum.title} ${sum.sub}` : `Menstruação em ${sum.title}`}</b>
      <small>${sum.fertileText} · chance ${sum.chance.toLowerCase()}</small></div><span class="t-go">›</span></div>
    <div class="cbar">${seg}</div>
    <div class="cbar-legend"><span><i class="cdot cd-period"></i>menstruação</span><span><i class="cdot cd-fertile"></i>fértil</span><span><i class="cdot cd-ovulation"></i>ovulação</span></div>
  </a>`;
}

function tiles(k) {
  const out = [cycleTile(k)];
  const c = activeChallenge();
  if (c) {
    const d = challengeDay(c, k);
    const inRange = d >= 1 && d <= c.days;
    out.push(`<a class="tile t-violet" href="#/desafio">${miniRing(inRange ? dayScore(c, k) : 0, 54, 6, inRange ? `${Math.round(dayScore(c, k) * 100)}%` : '🎯', 'tile-ring')}
      <div><b>${inRange ? `Dia ${d}/${c.days}` : d < 1 ? 'Em breve' : 'Concluído'}</b><small>Desafio</small></div></a>`);
  } else out.push(`<a class="tile t-violet" href="#/desafio"><span class="tile-ico">🎯</span><div><b>Criar desafio</b><small>20 dias</small></div></a>`);
  const w = workoutFor(k);
  const wl = state.workoutLog[k];
  const wn = w && wl ? w.exercises.filter((e) => wl.ex[e.id]).length : 0;
  out.push(`<a class="tile t-rose" href="#/treino?d=${k}"><span class="tile-ico">🏋️‍♀️</span><div><b>${w ? esc(w.name) : 'Descanso'}</b>
    <small>${w ? `${wn}/${w.exercises.length} exercícios` : 'sem treino hoje'}</small>${w ? bar(wn / (w.exercises.length || 1)) : ''}</div></a>`);
  const nw = nextWashes(k, 1)[0];
  if (nw) out.push(`<a class="tile t-sky" href="#/cabelo?d=${nw.date}"><span class="tile-ico">${MASKS[nw.mask].icon}</span><div>
    <b>${nw.date === k ? 'Lavar hoje' : fmtRel(nw.date, k).replace(/ \(.*\)/, '')}</b><small>Cabelo · ${MASKS[nw.mask].label}</small></div></a>`);
  const r = readingDay(k);
  const b = state.books.find((x) => x.id === state.reading.activeBookId);
  const bp = b && b.pages ? (b.current || 0) / b.pages : 0;
  out.push(`<a class="tile t-orange" href="#/leitura"><span class="tile-ico">📖</span><div><b>${fmtMinutes(r.sec / 60)} · ${r.pages} pág.</b>
    <small>${b ? `${esc(b.title)} · ${Math.round(bp * 100)}%` : 'Leitura de hoje'}</small>${b ? bar(bp) : ''}</div></a>`);
  const sk = (key) => { const rr = state.skincare[key]; const l = peekSkin(k, key); return [l ? rr.steps.filter((s) => l.steps[s.id]).length : 0, rr.steps.length]; };
  const [a1, a2] = sk('am'), [p1, p2] = sk('pm');
  out.push(`<a class="tile t-emerald" href="#/skincare?r=${nowMin() >= 15 * 60 && k === dateKey() ? 'pm' : 'am'}&d=${k}"><span class="tile-ico">🧴</span><div><b>Skincare</b>
    <small>☀️ ${a1}/${a2} · 🌙 ${p1}/${p2}</small>${bar((a1 + p1) / ((a2 + p2) || 1))}</div></a>`);
  return `<div class="tiles">${out.join('')}</div>`;
}

const GROUPS = [
  ['Manhã', '🌅', (t) => t.time && toMin(t.time) < 12 * 60],
  ['Tarde', '☀️', (t) => t.time && toMin(t.time) >= 12 * 60 && toMin(t.time) < 18 * 60],
  ['Noite', '🌙', (t) => t.time && toMin(t.time) >= 18 * 60],
  ['Qualquer hora', '🕐', (t) => !t.time],
];

function challengeCard(k) {
  const c = activeChallenge();
  if (!c) return `<a class="card challenge-mini empty-mini" href="#/desafio">🎯 <b>Criar um desafio de 20 dias</b><span class="t-go">›</span></a>`;
  const d = challengeDay(c, k);
  if (d < 1 || d > c.days) return '';
  return `<section class="card">
    <div class="card-head"><h2>🎯 ${esc(c.name)}</h2><a class="link" href="#/desafio">Dia ${d}/${c.days} ›</a></div>
    <ul class="goals">${c.goals.map((g) => {
      const on = goalDone(c, g, k);
      const auto = g.link && !c.checks[k]?.[g.id] && on;
      return `<li class="${on ? 'done' : ''}">${check(on, 'goalToggle', `data-c="${c.id}" data-g="${g.id}" data-d="${k}"`, g.text)}
        <span>${esc(g.text)}${auto ? ' <small class="muted">· automático</small>' : ''}</span></li>`;
    }).join('')}</ul>
  </section>`;
}

export function renderToday() {
  const k = ui.date; const today = dateKey();
  const tasks = tasksFor(k);
  const p = dayProgress(k);
  const m = nowMin();
  const name = state.profile.name ? `, ${esc(state.profile.name)}` : '';
  const highlightId = k === today ? (tasks.find((t) => t.end && toMin(t.time) <= m && m < toMin(t.end))
    || tasks.find((t) => t.time && toMin(t.time) > m))?.id : null;
  const late = k === today ? tasks.filter((t) => t.time && toMin(t.time) <= m && !isDone(t, k) && !(t.end && m < toMin(t.end))).length : 0;
  const initial = (state.profile.name || '✨').trim().slice(0, 1).toUpperCase();
  const groups = GROUPS.map(([label, icon, fn]) => {
    const list = tasks.filter(fn);
    if (!list.length) return '';
    const d = list.filter((t) => isDone(t, k)).length;
    return `<div class="tgroup"><div class="tg-head"><span>${icon} ${label}</span><small>${d}/${list.length}</small></div>
      <ul class="timeline">${list.map((t) => taskRow(t, k, t.id === highlightId)).join('')}</ul></div>`;
  }).join('');
  return `
  <header class="dash-top">
    <div><p class="hello2">${k === today ? greeting() + name : 'Planejamento'} ${k === today ? '☀️' : '🗓️'}</p>
    <h1 class="date-title2">${fmtLong(k)}</h1></div>
    ${k !== today ? `<button class="btn small primary" data-act="pickDay" data-d="${today}">Hoje</button>` : `<a class="avatar" href="#/config" aria-label="Perfil">${esc(initial)}</a>`}
  </header>
  <section class="dash-hero">
    <div class="dh-body">
      ${ring(p.pct, { size: 128, stroke: 12, label: `${Math.round(p.pct * 100)}%`, sub: 'do dia', cls: 'light' })}
      ${heroNow(tasks, k, p)}
    </div>
    <div class="dh-foot">
      <span>✅ ${p.done} feita${p.done === 1 ? '' : 's'}</span><span>⏳ ${p.total - p.done} pendente${p.total - p.done === 1 ? '' : 's'}</span>
      ${late ? `<span class="dh-late">⚠️ ${late} atrasada${late > 1 ? 's' : ''}</span>` : ''}
    </div>
  </section>
  ${weekStrip(k)}
  ${tiles(k)}
  <section class="card">
    <div class="card-head"><h2>Rotina do dia</h2><button class="link" data-act="addTask">+ Adicionar</button></div>
    ${tasks.length ? groups : empty('🌤️', 'Nada por aqui', 'Adicione tarefas para este dia.')}
  </section>
  ${challengeCard(k)}
  <button class="fab" data-act="addTask" aria-label="Adicionar tarefa">+</button>`;
}

/* ---------- ações ---------- */
A.pickDay = (el) => { ui.date = el.dataset.d; rerender(); };
A.weekShift = (el) => { ui.date = addDays(ui.date, Number(el.dataset.n)); rerender(); };
A.addTask = () => taskSheet(undefined, { date: ui.date });
A.toggleTask = (el) => {
  const t = findTask(el.dataset.id); if (!t) return;
  toggleDone(t, ui.date);
  if (isDone(t, ui.date) && navigator.vibrate) navigator.vibrate(15);
  const p = dayProgress(ui.date);
  if (p.pct >= 1 && isDone(t, ui.date)) toast('Dia 100% concluído! 🎉');
  rerender();
};
A.goalToggle = (el) => {
  const c = state.challenges.find((x) => x.id === el.dataset.c); if (!c) return;
  const g = c.goals.find((x) => x.id === el.dataset.g); const k = el.dataset.d;
  const day = (c.checks[k] ||= {});
  if (goalDone(c, g, k)) {
    delete day[g.id];
    if (g.link) { const t = findTask(g.link); if (t && isDone(t, k)) setDone(t, k, false); }
  } else day[g.id] = true;
  save(); rerender();
};
A.openTask = (el) => {
  const t = findTask(el.dataset.id); if (!t) return;
  const k = ui.date;
  if (t.type === 'treino') return go(`#/treino?d=${k}`);
  if (t.type === 'skincare') return go(`#/skincare?r=${t.routineKey || 'am'}&d=${k}`);
  if (t.type === 'cabelo') return go(`#/cabelo?d=${k}`);
  if (t.type === 'leitura') return go('#/leitura');
  const done = !!isDone(t, k);
  sheet(`${t.icon || ''} ${t.title}`, `
    <p class="muted">${t.time ? `${t.time}${t.end ? ' – ' + t.end : ''} · ` : ''}${state.routine.includes(t) ? 'Rotina fixa (' + t.days.map((d) => WD[d]).join(', ') + ')' : 'Só neste dia'}</p>
    ${t.link ? `<a class="btn primary block" href="${esc(t.link)}" target="_blank" rel="noopener">▶︎ Abrir ${t.type === 'palavra' ? 'a Palavra do dia' : 'link'}</a>` : ''}
    <button class="btn ${done ? 'ghost' : 'success'} block" data-act="sheetToggle" data-id="${t.id}">${done ? 'Desmarcar' : '✓ Marcar como feita'}</button>
    <button class="btn ghost block" data-act="editTask" data-id="${t.id}">✎ Editar</button>`);
};
A.sheetToggle = (el) => { const t = findTask(el.dataset.id); toggleDone(t, ui.date); A.closeSheet(); rerender(); };
A.editTask = (el) => { const t = findTask(el.dataset.id); taskSheet(t, { date: ui.date }); };

export const routes = { hoje: { render: renderToday, tab: 'hoje' } };

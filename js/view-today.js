// Tela "Hoje": dashboard do dia, linha do tempo e desafio.
import { state, save } from './store.js';
import { esc, dateKey, addDays, weekStart, parseKey, WD, fmtLong, greeting, toMin, nowMin, fmtMinutes, fmtRel, WD_FULL, weekday } from './utils.js';
import { A, ui, ring, check, sheet, go, rerender, toast, empty } from './ui.js';
import { tasksFor, isDone, toggleDone, dayProgress, findTask, hairDay, workoutFor, workoutLog, readingDay,
  activeChallenge, challengeDay, goalDone, nextWashes, peekSkin, setDone, dayScore } from './logic.js';
import { MASKS } from './defaults.js';
import { taskSheet } from './forms.js';

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

function weekStrip(k) {
  const ws = weekStart(k); const today = dateKey();
  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i);
    const p = d <= today ? dayProgress(d).pct : 0;
    html += `<button class="wday ${d === k ? 'sel' : ''} ${d === today ? 'today' : ''}" data-act="pickDay" data-d="${d}">
      <small>${WD[parseKey(d).getDay()]}</small><b>${parseKey(d).getDate()}</b>
      <i class="wdot" style="--p:${Math.round(p * 100)}%"></i></button>`;
  }
  return `<div class="week">
    <button class="icon-btn" data-act="weekShift" data-n="-7" aria-label="Semana anterior">‹</button>
    <div class="week-days">${html}</div>
    <button class="icon-btn" data-act="weekShift" data-n="7" aria-label="Próxima semana">›</button></div>`;
}

function nowCard(tasks, k) {
  if (k !== dateKey() || !tasks.length) return '';
  const m = nowMin();
  const current = tasks.find((t) => t.end && toMin(t.time) <= m && m < toMin(t.end) && !isDone(t, k));
  const next = tasks.find((t) => t.time && toMin(t.time) > m && !isDone(t, k));
  const late = tasks.filter((t) => t.time && toMin(t.time) <= m && !isDone(t, k) && t !== current).length;
  if (!current && !next && !late) return `<div class="card now-card ok">🎉 <b>Tudo feito por hoje!</b> Você arrasou.</div>`;
  const inMin = next ? toMin(next.time) - m : 0;
  return `<div class="card now-card">
    ${current ? `<div class="nc-row"><span class="pill">Agora</span><b>${current.icon} ${esc(current.title)}</b><small>até ${current.end}</small></div>` : ''}
    ${next ? `<div class="nc-row"><span class="pill soft">Próximo</span><b>${next.icon} ${esc(next.title)}</b><small>${next.time} · em ${fmtMinutes(inMin)}</small></div>` : ''}
    ${late ? `<div class="nc-row late"><span class="pill warn">${late}</span><small>tarefa${late > 1 ? 's' : ''} do horário já passou${late > 1 ? 'ram' : ''} e não ${late > 1 ? 'foram marcadas' : 'foi marcada'}</small></div>` : ''}
  </div>`;
}

function statChips(k) {
  const chips = [];
  const c = activeChallenge();
  if (c) {
    const d = challengeDay(c, k);
    if (d >= 1 && d <= c.days) chips.push(`<a class="stat" href="#/desafio"><span>🔥</span><b>Dia ${d}/${c.days}</b><small>desafio</small></a>`);
  }
  const w = workoutFor(k);
  chips.push(`<a class="stat" href="#/treino?d=${k}"><span>🏋️‍♀️</span><b>${w ? esc(w.name) : 'Descanso'}</b><small>treino</small></a>`);
  const nw = nextWashes(k, 1)[0];
  if (nw) chips.push(`<a class="stat" href="#/cabelo?d=${nw.date}"><span>${MASKS[nw.mask].icon}</span><b>${nw.date === k ? 'Lavar hoje' : fmtRel(nw.date, k)}</b><small>${MASKS[nw.mask].label}</small></a>`);
  const r = readingDay(k);
  chips.push(`<a class="stat" href="#/leitura"><span>📖</span><b>${fmtMinutes(r.sec / 60)}</b><small>${r.pages} pág. lidas</small></a>`);
  return `<div class="stats">${chips.join('')}</div>`;
}

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
  const msg = p.pct >= 1 ? 'Dia completo! ✨' : p.pct >= 0.5 ? 'Mais da metade, continua!' : p.done ? 'Bom começo, segue firme!' : 'Vamos começar? 💪';
  const highlightId = k === today ? (tasks.find((t) => t.end && toMin(t.time) <= m && m < toMin(t.end))
    || tasks.find((t) => t.time && toMin(t.time) > m))?.id : null;
  return `
  <header class="hero">
    <div class="hero-top">
      <div><p class="hello">${k === today ? greeting() + name : 'Planejamento'} ${k === today ? '☀️' : '🗓️'}</p>
      <h1 class="date-title">${fmtLong(k)}</h1></div>
      ${k !== today ? `<button class="btn small glass" data-act="pickDay" data-d="${today}">Hoje</button>` : ''}
    </div>
    <div class="hero-body">
      ${ring(p.pct, { size: 112, stroke: 11, label: `${Math.round(p.pct * 100)}%`, sub: `${p.done}/${p.total}`, cls: 'light' })}
      <div class="hero-text"><b>${msg}</b><span>${p.done} de ${p.total} tarefas concluídas</span>
      ${state.challenges.length && activeChallenge() ? (() => { const c = activeChallenge(); const d = challengeDay(c, k);
        return d >= 1 && d <= c.days ? `<span class="hero-chal">Desafio: dia ${d} de ${c.days} · ${Math.round(dayScore(c, k) * 100)}% hoje</span>` : ''; })() : ''}
      </div>
    </div>
  </header>
  ${weekStrip(k)}
  ${statChips(k)}
  ${nowCard(tasks, k)}
  <section class="card">
    <div class="card-head"><h2>Rotina do dia</h2><button class="link" data-act="addTask">+ Adicionar</button></div>
    ${tasks.length ? `<ul class="timeline">${tasks.map((t) => taskRow(t, k, t.id === highlightId)).join('')}</ul>`
      : empty('🌤️', 'Nada por aqui', 'Adicione tarefas para este dia.')}
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

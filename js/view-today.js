// Tela "Hoje": dashboard do dia, linha do tempo e desafio.
import { state, save } from './store.js';
import { esc, dateKey, addDays, weekStart, parseKey, WD, fmtLong, greeting, toMin, nowMin, fmtMinutes, fmtRel, WD_FULL, weekday } from './utils.js';
import { A, C, ui, ring, check, sheet, go, rerender, toast, empty, opt } from './ui.js';
import { tasksFor, isDone, toggleDone, dayProgress, findTask, hairDay, workoutFor, workoutLog, readingDay,
  activeChallenge, challengeDay, goalDone, nextWashes, peekSkin, setDone, dayScore, taskStatus, waterTotal, addWater, undoWater,
  medPerDay, medTaken } from './logic.js';
import { cycleWheel } from './view-cycle.js';
import { studyDay } from './view-study.js';
import { MASKS, PHRASES } from './defaults.js';
import { taskSheet, avatarHtml } from './forms.js';
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
    case 'estudo': { const sec = studyDay(k); parts.push(sec ? `${fmtMinutes(sec / 60)} estudados hoje` : 'Toque para abrir o cronômetro'); break; }
    case 'remedio': {
      const md = state.meds.find((x) => x.id === t.medId);
      parts.push(`${t.qty} ${md?.unit || 'dose'}${t.qty > 1 ? 's' : ''} · ${medTaken(k, t.medId)}/${md ? medPerDay(md) : 0} hoje`);
      break;
    }
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
  const special = ['treino', 'skincare', 'cabelo', 'leitura', 'palavra', 'remedio', 'estudo'].includes(t.type);
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
    const dot = !state.settings.home.showWeekCycle ? '' : ['menstruacao', 'prevista', 'fertil', 'ovulacao'].includes(ph) ? `<i class="cdot cd-${PHASES[ph].color}" title="${PHASES[ph].label}"></i>` : '<i class="cdot"></i>';
    html += `<button class="wday2 ${d === k ? 'sel' : ''} ${d === today ? 'today' : ''} ${d > today ? 'future' : ''}" data-act="pickDay" data-d="${d}">
      <small>${WD[parseKey(d).getDay()]}</small>${miniRing(p, 38, 4, parseKey(d).getDate(), p >= 1 ? 'full' : '')}${dot}</button>`;
  }
  return `<div class="week2">
    <button class="icon-btn" data-act="weekShift" data-n="-7" aria-label="Semana anterior">‹</button>
    <div class="week-days">${html}</div>
    <button class="icon-btn" data-act="weekShift" data-n="7" aria-label="Próxima semana">›</button></div>`;
}

function habitsSquare(k, tasks) {
  const c = { done: 0, pending: 0, late: 0 };
  tasks.forEach((t) => c[taskStatus(t, k)]++);
  const pct = tasks.length ? c.done / tasks.length : 0;
  const donePct = Math.round(pct * 100);
  const f = ui.taskFilter;
  const chip = (key, ic, n, label) => `<button class="sq-chip ${key} ${f === key ? 'on' : ''}" data-act="taskFilter" data-f="${key}">${ic}<b>${n}</b><small>${label}</small></button>`;
  return `<section class="square sq-habits">
    <div class="sq-head"><span>Hábitos</span><small>${tasks.length} tarefas</small></div>
    ${ring(pct, { size: 92, stroke: 9, label: `${donePct}%`, sub: donePct >= 100 ? 'completo' : 'feito', cls: 'light' })}
    <div class="sq-chips">${chip('done', '✅', c.done, 'feitas')}${chip('pending', '⏳', c.pending, 'pendentes')}${chip('late', '⚠️', c.late, 'atrasadas')}</div>
  </section>`;
}

function cycleSquare() {
  const sum = cycleSummary(dateKey());
  if (sum.empty) return `<a class="square sq-cycle" href="#/ciclo"><div class="sq-head"><span>Meu ciclo</span></div>
    <div class="sq-empty">🌸<b>Registrar menstruação</b></div></a>`;
  const ph = PHASES[sum.info.phase] || PHASES.folicular;
  return `<a class="square sq-cycle" href="#/ciclo"><div class="sq-head"><span>Meu ciclo</span><small>dia ${sum.cycleDay}</small></div>
    ${cycleWheel(sum, 132)}<small class="sq-foot">${ph.icon} ${ph.label}</small></a>`;
}

export const WATER_SIZES = [100, 150, 200, 250, 300, 350, 400, 500, 600, 750, 1000];
export const mlLabel = (ml) => (ml >= 1000 ? `${ml} ml (${(ml / 1000).toLocaleString('pt-BR')} L)` : `${ml} ml`);

function waterCard(k) {
  const tot = waterTotal(k), goal = state.water.goal;
  const pct = Math.min(1, tot / goal);
  const sel = ui.waterSel || 200;
  const log = state.water.log[k] || [];
  return `<section class="card water">
    <div class="water-top"><span class="t-icon bg-soft-sky">💧</span>
      <div class="grow"><b>Água · ${tot} ml de ${goal} ml</b><small>${tot >= goal ? 'Meta batida! 💜' : `faltam ${goal - tot} ml`}</small></div>
      ${log.length ? `<button class="icon-btn sm" data-act="waterUndo" data-d="${k}" aria-label="Desfazer o último">↺</button>` : ''}</div>
    <div class="water-bar"><span style="width:${pct * 100}%"></span>${[0.25, 0.5, 0.75].map((x) => `<i style="left:${x * 100}%"></i>`).join('')}</div>
    <small class="water-q">Quanto você tomou?</small>
    <div class="water-form">
      <label class="ml-input"><input type="number" inputmode="numeric" id="water-ml" min="10" max="3000" step="10" value="${sel}" aria-label="Quantidade em ml"><span>ml</span></label>
      <select class="mini-select water-pick" data-change="waterPick" aria-label="Escolher quantidade">${opt('', 'Escolher', '')}${WATER_SIZES.map((ml) => opt(ml, mlLabel(ml), '')).join('')}</select>
    </div>
    <button class="btn primary block water-add" data-act="waterAddInput" data-d="${k}">+ Adicionar</button>
    ${log.length ? `<small class="water-log">Hoje: ${log.map((v) => `${v} ml`).join(' + ')}</small>` : ''}
  </section>`;
}

function tileMap(k) {
  const T = {};
  const c = activeChallenge();
  if (c) {
    const d = challengeDay(c, k);
    const inRange = d >= 1 && d <= c.days;
    T.desafio = `<a class="tile t-violet" href="#/desafio">${miniRing(inRange ? dayScore(c, k) : 0, 54, 6, inRange ? `${Math.round(dayScore(c, k) * 100)}%` : '🎯', 'tile-ring')}
      <div><b>${inRange ? `Dia ${d}/${c.days}` : d < 1 ? 'Em breve' : 'Concluído'}</b><small>Desafio</small></div></a>`;
  } else T.desafio = `<a class="tile t-violet" href="#/desafio"><span class="tile-ico">🎯</span><div><b>Criar desafio</b><small>20 dias</small></div></a>`;
  const w = workoutFor(k);
  const wl = state.workoutLog[k];
  const wn = w && wl ? w.exercises.filter((e) => wl.ex[e.id]).length : 0;
  T.treino = `<a class="tile t-rose" href="#/treino?d=${k}"><span class="tile-ico">🏋️‍♀️</span><div><b>${w ? esc(w.name) : 'Descanso'}</b>
    <small>${w ? `${wn}/${w.exercises.length} exercícios` : 'sem treino hoje'}</small>${w ? bar(wn / (w.exercises.length || 1)) : ''}</div></a>`;
  const meds = state.meds.filter((m) => m.active);
  if (meds.length) {
    const tot = meds.reduce((a, m) => a + medPerDay(m), 0), tk = meds.reduce((a, m) => a + Math.min(medTaken(k, m.id), medPerDay(m)), 0);
    T.remedios = `<a class="tile t-sky" href="#/remedios"><span class="tile-ico">💊</span><div><b>${tk}/${tot} doses</b><small>Remédios</small>${bar(tot ? tk / tot : 0)}</div></a>`;
  }
  const nw = nextWashes(k, 1)[0];
  if (nw) T.cabelo = `<a class="tile t-sky" href="#/cabelo?d=${nw.date}"><span class="tile-ico">${MASKS[nw.mask].icon}</span><div>
    <b>${nw.date === k ? 'Lavar hoje' : fmtRel(nw.date, k).replace(/ \(.*\)/, '')}</b><small>Cabelo · ${MASKS[nw.mask].label}</small></div></a>`;
  const st = studyDay(k);
  const lastSt = [...state.study.sessions].sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')))[0];
  T.estudo = `<a class="tile t-sky" href="#/estudo"><span class="tile-ico">📚</span><div><b>${fmtMinutes(st / 60)} de estudo</b>
    <small>${lastSt ? esc(lastSt.materia) : 'Estudo de hoje'}</small></div></a>`;
  const r = readingDay(k);
  const b = state.books.find((x) => x.id === state.reading.activeBookId);
  const bp = b && b.pages ? (b.current || 0) / b.pages : 0;
  T.leitura = `<a class="tile t-orange" href="#/leitura"><span class="tile-ico">📖</span><div><b>${fmtMinutes(r.sec / 60)} · ${r.pages} pág.</b>
    <small>${b ? `${esc(b.title)} · ${Math.round(bp * 100)}%` : 'Leitura de hoje'}</small>${b ? bar(bp) : ''}</div></a>`;
  const sk = (key) => { const rr = state.skincare[key]; const l = peekSkin(k, key); return [l ? rr.steps.filter((s) => l.steps[s.id]).length : 0, rr.steps.length]; };
  const [a1, a2] = sk('am'), [p1, p2] = sk('pm');
  T.skincare = `<a class="tile t-emerald" href="#/skincare?r=${nowMin() >= 15 * 60 && k === dateKey() ? 'pm' : 'am'}&d=${k}"><span class="tile-ico">🧴</span><div><b>Skincare</b>
    <small>☀️ ${a1}/${a2} · 🌙 ${p1}/${p2}</small>${bar((a1 + p1) / ((a2 + p2) || 1))}</div></a>`;
  const wt = waterTotal(k);
  T.agua = `<a class="tile t-sky" href="#/hoje"><span class="tile-ico">💧</span><div><b>${wt} ml</b><small>de ${state.water.goal} ml de água</small>${bar(wt / state.water.goal)}</div></a>`;
  const cs = cycleSummary(dateKey());
  T.ciclo = cs.empty ? `<a class="tile t-rose" href="#/ciclo"><span class="tile-ico">🌸</span><div><b>Meu ciclo</b><small>registrar</small></div></a>`
    : `<a class="tile t-rose" href="#/ciclo"><span class="tile-ico">🌸</span><div><b>${cs.inPeriod ? `${cs.title} ${cs.sub}` : `Menstruação em ${cs.title}`}</b><small>${cs.fertileText}</small></div></a>`;
  return T;
}

function tiles(k) {
  const H = state.settings.home;
  const T = tileMap(k);
  const list = H.cards.filter((c) => c.on && T[c.id]).map((c) => T[c.id]);
  if (!list.length) return '';
  return `<div class="tiles ${H.cardsLayout === 'lista' ? 'as-list' : ''}">${list.join('')}</div>`;
}

/* quadrado da direita (escolhido em Mais → Tela inicial) */
function sideSquare(k) {
  const kind = state.settings.home.square2 || 'ciclo';
  const sq = (href, title, sub, inner, foot, cls = '') => `<a class="square sq-alt ${cls}" href="${href}"><div class="sq-head"><span>${title}</span><small>${sub}</small></div>${inner}<small class="sq-foot">${foot}</small></a>`;
  if (kind === 'agua') {
    const t = waterTotal(k), g = state.water.goal;
    return sq('#/hoje', 'Água', `meta ${g} ml`, ring(t / g, { size: 104, stroke: 10, label: `${t}`, sub: 'ml', cls: 'water-ring' }), t >= g ? 'Meta batida! 💜' : `faltam ${g - t} ml`);
  }
  if (kind === 'desafio') {
    const c = activeChallenge();
    if (!c) return sq('#/desafio', 'Desafio', '', '<div class="sq-empty">🎯<b>Criar desafio</b></div>', '');
    const d = challengeDay(c, k), sc = d >= 1 && d <= c.days ? dayScore(c, k) : 0;
    return sq('#/desafio', 'Desafio', d >= 1 && d <= c.days ? `dia ${d}/${c.days}` : '', ring(sc, { size: 104, stroke: 10, label: `${Math.round(sc * 100)}%`, sub: 'hoje' }), esc(c.name));
  }
  if (kind === 'leitura') {
    const b = state.books.find((x) => x.id === state.reading.activeBookId);
    const r = readingDay(k);
    const bp = b && b.pages ? (b.current || 0) / b.pages : 0;
    return sq('#/leitura', 'Leitura', fmtMinutes(r.sec / 60) + ' hoje', ring(bp, { size: 104, stroke: 10, label: `${Math.round(bp * 100)}%`, sub: 'do livro' }), b ? esc(b.title) : 'Escolha um livro');
  }
  if (kind === 'estudo') {
    const sec = studyDay(k);
    const goal = 120 * 60;
    return sq('#/estudo', 'Estudo', 'meta 2h', ring(sec / goal, { size: 104, stroke: 10, label: fmtMinutes(sec / 60), sub: 'hoje' }), 'Toque para estudar');
  }
  if (kind === 'remedios') {
    const meds = state.meds.filter((m) => m.active);
    const tot = meds.reduce((a, m) => a + medPerDay(m), 0), tk = meds.reduce((a, m) => a + Math.min(medTaken(k, m.id), medPerDay(m)), 0);
    return sq('#/remedios', 'Remédios', '', ring(tot ? tk / tot : 0, { size: 104, stroke: 10, label: `${tk}/${tot}`, sub: 'doses' }), tk >= tot ? 'Tudo tomado 💜' : `falta${tot - tk > 1 ? 'm' : ''} ${tot - tk}`);
  }
  return cycleSquare();
}

function phraseCard(k) {
  const H = state.settings.home;
  const list = H.phrase.trim() ? H.phrase.split('\n').map((x) => x.trim()).filter(Boolean) : PHRASES;
  const day = Math.floor(parseKey(k).getTime() / 86400000);
  return `<section class="card phrase-card">✨ <p>${esc(list[day % list.length])}</p></section>`;
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

const FILTERS = { done: 'Feitas', pending: 'Pendentes', late: 'Atrasadas' };

export function renderToday() {
  const k = ui.date; const today = dateKey();
  const tasks = tasksFor(k);
  const m = nowMin();
  const name = state.profile.name ? `, ${esc(state.profile.name)}` : '';
  const highlightId = k === today ? (tasks.find((t) => t.end && toMin(t.time) <= m && m < toMin(t.end))
    || tasks.find((t) => t.time && toMin(t.time) > m))?.id : null;
  const initial = (state.profile.name || '✨').trim().slice(0, 1).toUpperCase();
  const H = state.settings.home;
  const f = ui.taskFilter;
  let shown = f ? tasks.filter((t) => taskStatus(t, k) === f) : tasks;
  if (H.hideDone && f !== 'done') shown = shown.filter((t) => !isDone(t, k));
  const groups = !H.groupRoutine ? `<ul class="timeline">${shown.map((t) => taskRow(t, k, t.id === highlightId)).join('')}</ul>` : GROUPS.map(([label, icon, fn]) => {
    const list = shown.filter(fn);
    if (!list.length) return '';
    const d = list.filter((t) => isDone(t, k)).length;
    return `<div class="tgroup"><div class="tg-head"><span>${icon} ${label}</span><small>${d}/${list.length}</small></div>
      <ul class="timeline">${list.map((t) => taskRow(t, k, t.id === highlightId)).join('')}</ul></div>`;
  }).join('');
  const blocks = {
    frase: phraseCard(k),
    resumo: `<div class="squares">${habitsSquare(k, tasks)}${sideSquare(k)}</div>`,
    semana: weekStrip(k),
    agua: waterCard(k),
    cards: tiles(k),
    rotina: `<section class="card" id="rotina-card">
      <div class="card-head"><h2>Rotina do dia</h2><button class="link" data-act="addTask">+ Adicionar</button></div>
      ${H.showFilters ? `<div class="seg filter-seg">${[['', 'Todas'], ...Object.entries(FILTERS)].map(([key, l]) => `<button class="${(f || '') === key ? 'on' : ''}" data-act="taskFilter" data-f="${key}">${l}</button>`).join('')}</div>` : ''}
      ${shown.length ? groups : f ? `<p class="muted center small">Nenhuma tarefa ${FILTERS[f].toLowerCase()} ${k === today ? 'hoje' : 'neste dia'} 💜</p>`
        : tasks.length ? '<p class="muted center small">Tudo concluído por aqui 💜</p>' : empty('🌤️', 'Nada por aqui', 'Adicione tarefas para este dia.')}
    </section>`,
    desafio: challengeCard(k),
  };
  return `
  <header class="dash-top">
    <div><p class="hello2">${k === today ? greeting() + name : 'Planejamento'} ${k === today ? '☀️' : '🗓️'}</p>
    <h1 class="date-title2">${fmtLong(k)}</h1></div>
    ${k !== today ? `<button class="btn small primary" data-act="pickDay" data-d="${today}">Hoje</button>` : avatarHtml('', '#/mais')}
  </header>
  ${state.settings.dash.filter((x) => x.on).map((x) => blocks[x.id] || '').join('')}
  <button class="fab" data-act="addTask" aria-label="Adicionar tarefa">+</button>`;
}

/* ---------- ações ---------- */
A.pickDay = (el) => { ui.date = el.dataset.d; rerender(); };
A.taskFilter = (el) => {
  const f = el.dataset.f || null;
  ui.taskFilter = ui.taskFilter === f ? null : f;
  rerender();
  if (ui.taskFilter && !el.closest('#rotina-card')) document.getElementById('rotina-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
A.water = (el) => {
  const before = waterTotal(el.dataset.d);
  addWater(el.dataset.d, Number(el.dataset.ml));
  if (before < state.water.goal && waterTotal(el.dataset.d) >= state.water.goal) toast('Meta de água batida! 💧');
  rerender();
};
A.waterUndo = (el) => { undoWater(el.dataset.d); rerender(); };
A.waterSel = (el) => { ui.waterSel = Number(el.dataset.ml); rerender(); };
C.waterPick = (el) => {
  if (!el.value) return;
  ui.waterSel = Number(el.value);
  const inp = document.getElementById('water-ml'); if (inp) inp.value = el.value;
  el.value = '';
};
A.waterAddInput = (el) => {
  const ml = Math.round(Number(document.getElementById('water-ml')?.value));
  if (!ml || ml < 10 || ml > 3000) return toast('Digite uma quantidade entre 10 e 3000 ml');
  ui.waterSel = ml;
  const before = waterTotal(el.dataset.d);
  addWater(el.dataset.d, ml);
  toast(`+${ml} ml 💧`);
  if (before < state.water.goal && waterTotal(el.dataset.d) >= state.water.goal) toast('Meta de água batida! 💧');
  rerender();
};
A.waterOther = (el) => sheet('Quanto você tomou?', `<form class="form">
  <label class="field"><span>Quantidade em ml</span><input type="number" inputmode="numeric" name="ml" min="10" max="3000" step="10" value="${ui.waterSel || 200}" required></label>
  <button class="btn primary block">Adicionar</button></form>`, {
  onSubmit: (fd) => {
    const ml = Math.round(Number(fd.get('ml')));
    if (!ml || ml < 10) return false;
    const before = waterTotal(el.dataset.d);
    addWater(el.dataset.d, ml);
    if (before < state.water.goal && waterTotal(el.dataset.d) >= state.water.goal) toast('Meta de água batida! 💧');
  },
});
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
  if (t.type === 'remedio') return go('#/remedios');
  if (t.type === 'estudo') return go('#/estudo');
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

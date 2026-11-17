// Regras do app: tarefas do dia, cronograma capilar, desafio, leitura, treino.
import { state, save } from './store.js';
import { addDays, diffDays, weekday, weekStart, dateKey, toMin } from './utils.js';
import { MASKS } from './defaults.js';

/* ---------------- Tarefas do dia ---------------- */
export function tasksFor(k) {
  const wd = weekday(k);
  const routine = state.routine
    .filter((r) => r.days.includes(wd))
    .filter((r) => r.type !== 'cabelo' || hairDay(k).isWash)
    .filter((r) => !(r.from && k < r.from))
    .map((r) => ({ ...r, kind: 'routine' }));
  const once = state.oneOff.filter((o) => o.date === k).map((o) => ({ ...o, kind: 'once', days: [] }));
  return [...routine, ...once].sort((a, b) => toMin(a.time) - toMin(b.time));
}

export const findTask = (id) => state.routine.find((r) => r.id === id) || state.oneOff.find((o) => o.id === id);

/** retorna false ou a data em que foi feita (tarefas "um dos dias da semana" contam a semana toda) */
export function isDone(task, k) {
  if (task.flexWeekly) {
    const ws = weekStart(k);
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      if (task.days.includes(weekday(d)) && state.done[d]?.[task.id]) return d;
    }
    return false;
  }
  return state.done[k]?.[task.id] ? k : false;
}

export function setDone(task, k, val) {
  if (task.flexWeekly && !val) {
    const d = isDone(task, k);
    if (d) delete state.done[d][task.id];
  } else if (val) {
    (state.done[k] ||= {})[task.id] = true;
    if (task.type === 'cabelo') ensureHairLog(k);
  } else if (state.done[k]) {
    delete state.done[k][task.id];
  }
  save();
}

export function toggleDone(task, k) { setDone(task, k, !isDone(task, k)); }

/** marca como feitas as tarefas de um tipo naquele dia (ex.: concluir treino) */
export function markTypeDone(k, type, val = true, filter = () => true) {
  tasksFor(k).filter((t) => t.type === type && filter(t)).forEach((t) => setDone(t, k, val));
}

export function dayProgress(k) {
  const t = tasksFor(k);
  const d = t.filter((x) => isDone(x, k)).length;
  return { total: t.length, done: d, pct: t.length ? d / t.length : 0 };
}

export function isTaskIdDone(id, k) {
  const t = findTask(id);
  return t ? !!isDone(t, k) : false;
}

/* ---------------- Cronograma capilar ---------------- */
export function hairDay(k) {
  const h = state.hair;
  const L = h.cycle.length || 1;
  const log = h.log[k];
  const d = diffDays(h.anchorDate, k);
  const scheduled = d >= 0 && d % h.interval === 0;
  const idx = h.anchorIndex + Math.floor(d / h.interval);
  const mask = log?.mask || h.cycle[((idx % L) + L) % L] || 'hidratacao';
  return { isWash: scheduled || !!log, scheduled, mask, idx, log };
}

export function ensureHairLog(k) {
  const h = state.hair;
  if (!h.log[k]) h.log[k] = { mask: hairDay(k).mask, steps: {}, notes: '' };
  return h.log[k];
}

/** lavou num dia que não estava programado: recomeça a contagem a partir de k */
export function washOn(k) {
  const h = state.hair;
  const info = hairDay(k);
  if (!info.scheduled) {
    const d = diffDays(h.anchorDate, k);
    // se a lavagem programada anterior não foi feita, usa a máscara que ficou pendente
    const n = Math.floor(d / h.interval);
    const prevDate = addDays(h.anchorDate, n * h.interval);
    const nextIdx = h.anchorIndex + (d >= 0 && !h.log[prevDate] ? n : n + 1);
    const L = h.cycle.length || 1;
    h.anchorDate = k;
    h.anchorIndex = ((nextIdx % L) + L) % L;
  }
  ensureHairLog(k);
  save();
}

/** adia a lavagem de k para o dia seguinte, mantendo a máscara */
export function postponeWash(k) {
  const h = state.hair;
  const info = hairDay(k);
  const L = h.cycle.length || 1;
  h.anchorDate = addDays(k, 1);
  h.anchorIndex = ((info.idx % L) + L) % L;
  delete h.log[k];
  if (state.done[k]) for (const r of state.routine) if (r.type === 'cabelo') delete state.done[k][r.id];
  save();
}

export function nextWashes(from, count = 6) {
  const out = [];
  for (let i = 0; i < 120 && out.length < count; i++) {
    const k = addDays(from, i);
    const h = hairDay(k);
    if (h.isWash) out.push({ date: k, mask: h.mask });
  }
  return out;
}

export function hairStepsFor(mask) {
  const h = state.hair;
  return h.steps
    .filter((s) => s.when === 'always' || s.when === 'mask' || s.when === mask)
    .map((s) => ({ ...s, productId: s.when === 'mask' ? h.maskProducts[mask] : s.productId,
      label: s.when === 'mask' ? `Máscara de ${MASKS[mask]?.label.toLowerCase()}` : s.label }));
}

export function reconstructionsInMonth(k) {
  const first = k.slice(0, 8) + '01';
  let n = 0;
  for (let i = 0; i < 31; i++) {
    const d = addDays(first, i);
    if (d.slice(0, 7) !== k.slice(0, 7)) break;
    const h = hairDay(d);
    if (h.isWash && h.mask === 'reconstrucao') n++;
  }
  return n;
}

/* ---------------- Skincare ---------------- */
export function skinLog(k, key) {
  const day = (state.skinLog[k] ||= {});
  return (day[key] ||= { steps: {}, how: {}, extras: [], notes: '' });
}
export function peekSkin(k, key) { return state.skinLog[k]?.[key]; }

/* ---------------- Produtos (uso) ---------------- */
export function productUsage() {
  const use = {};
  const add = (pid, k) => {
    if (!pid) return;
    const u = (use[pid] ||= { count: 0, last: null });
    u.count++; if (!u.last || k > u.last) u.last = k;
  };
  for (const [k, day] of Object.entries(state.skinLog)) {
    for (const r of Object.values(day)) {
      Object.values(r.steps || {}).forEach((v) => add(v?.p, k));
      (r.extras || []).forEach((e) => add(e.productId, k));
    }
  }
  for (const [k, l] of Object.entries(state.hair.log)) Object.values(l.steps || {}).forEach((v) => add(v?.p, k));
  return use;
}
export const product = (id) => state.products.find((p) => p.id === id);
export const productName = (id) => { const p = product(id); return p ? p.name + (p.brand ? ` · ${p.brand}` : '') : 'Produto não definido'; };

/* ---------------- Treino ---------------- */
export function workoutFor(k) {
  const log = state.workoutLog[k];
  const id = log?.wid !== undefined ? log.wid : state.workouts.plan[weekday(k)];
  return state.workouts.list.find((w) => w.id === id) || null;
}
export function workoutLog(k) {
  return (state.workoutLog[k] ||= { ex: {}, loads: {} });
}

/* ---------------- Leitura ---------------- */
export function timerElapsed() {
  const t = state.reading.timer;
  return t.acc + (t.running && t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0);
}
export function readingDay(k) {
  const s = state.reading.sessions.filter((x) => x.date === k);
  const sec = s.reduce((a, b) => a + (b.seconds || 0), 0);
  const pages = s.reduce((a, b) => a + Math.max(0, (b.to || 0) - (b.from || 0)), 0);
  return { sessions: s, sec, pages };
}
export function bookStats(b) {
  const s = state.reading.sessions.filter((x) => x.bookId === b.id);
  const sec = s.reduce((a, x) => a + (x.seconds || 0), 0);
  const pages = s.reduce((a, x) => a + Math.max(0, (x.to || 0) - (x.from || 0)), 0);
  const pace = sec > 0 ? pages / (sec / 60) : 0; // páginas/min
  const remaining = Math.max(0, (b.pages || 0) - (b.current || 0));
  return { sessions: s, sec, pages, pace, remaining, etaMin: pace > 0 ? remaining / pace : null,
    pct: b.pages ? Math.min(1, (b.current || 0) / b.pages) : 0 };
}

/* ---------------- Desafio ---------------- */
export const activeChallenge = () => state.challenges.find((c) => c.id === state.activeChallengeId && !c.archived) || null;
export const challengeEnd = (c) => addDays(c.startDate, c.days - 1);
export const challengeDay = (c, k = dateKey()) => diffDays(c.startDate, k) + 1;
export function goalDone(c, g, k) {
  return !!c.checks[k]?.[g.id] || (g.link ? isTaskIdDone(g.link, k) : false);
}
export function dayScore(c, k) {
  if (!c.goals.length) return 0;
  return c.goals.filter((g) => goalDone(c, g, k)).length / c.goals.length;
}
export function challengeStats(c, today = dateKey()) {
  const elapsed = Math.max(0, Math.min(c.days, challengeDay(c, today)));
  let perfect = 0, sum = 0, streak = 0, run = 0;
  for (let i = 0; i < elapsed; i++) {
    const s = dayScore(c, addDays(c.startDate, i));
    sum += s;
    if (s >= 1) { perfect++; run++; } else if (addDays(c.startDate, i) !== today) run = 0;
  }
  streak = run;
  const finished = today > challengeEnd(c);
  return { elapsed, perfect, avg: elapsed ? sum / elapsed : 0, streak, finished, total: c.days,
    overall: c.days ? sum / c.days : 0 };
}

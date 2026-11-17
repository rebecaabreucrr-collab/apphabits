// Regras do app: tarefas do dia, cronograma capilar, desafio, leitura, treino.
import { state, save } from './store.js';
import { addDays, diffDays, weekday, weekStart, dateKey, toMin, nowMin } from './utils.js';
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
  return [...routine, ...once, ...medTasks()].sort((a, b) => toMin(a.time) - toMin(b.time));
}

/* ---------------- Remédios ---------------- */
// cada horário de um remédio vira uma tarefa "virtual" no dia
export function medTasks() {
  const out = [];
  for (const m of state.meds) {
    if (!m.active) continue;
    m.schedule.forEach((s, i) => out.push({ id: `med:${m.id}:${i}`, kind: 'med', type: 'remedio', medId: m.id, slot: i,
      time: s.time, title: m.name, icon: '💊', color: m.color || 'violet', days: [0, 1, 2, 3, 4, 5, 6], qty: s.qty }));
  }
  return out;
}
export const medPerDay = (m) => m.schedule.reduce((a, s) => a + (Number(s.qty) || 0), 0);
export const medTakes = (k, id) => state.medLog[k]?.[id] || [];
export const medTaken = (k, id) => medTakes(k, id).reduce((a, t) => a + (Number(t.q) || 0), 0);
const medCum = (m, i) => m.schedule.slice(0, i + 1).reduce((a, s) => a + (Number(s.qty) || 0), 0);
export function addMedTake(k, id, q = 1, t) {
  const d = new Date();
  const time = t || `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  ((state.medLog[k] ||= {})[id] ||= []).push({ t: time, q: Number(q) || 1 });
  state.medLog[k][id].sort((a, b) => a.t.localeCompare(b.t));
  save();
}
export function removeMedTake(k, id, idx) { medTakes(k, id).splice(idx, 1); save(); }
/** reduz o total tomado no dia até "alvo", removendo as últimas tomadas */
function trimMed(k, id, target) {
  const list = medTakes(k, id);
  while (list.length && medTaken(k, id) > target) {
    const last = list[list.length - 1];
    const over = medTaken(k, id) - target;
    if (last.q > over) last.q -= over; else list.pop();
  }
}

export function findTask(id) {
  if (String(id).startsWith('med:')) return medTasks().find((t) => t.id === id) || null;
  return state.routine.find((r) => r.id === id) || state.oneOff.find((o) => o.id === id);
}

/** retorna false ou a data em que foi feita (tarefas "um dos dias da semana" contam a semana toda) */
export function isDone(task, k) {
  if (task.type === 'remedio') {
    const m = state.meds.find((x) => x.id === task.medId);
    return m && medTaken(k, m.id) >= medCum(m, task.slot) ? k : false;
  }
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
  if (task.type === 'remedio') {
    const m = state.meds.find((x) => x.id === task.medId); if (!m) return;
    const cum = medCum(m, task.slot), taken = medTaken(k, m.id);
    if (val && taken < cum) addMedTake(k, m.id, cum - taken);
    else if (!val && taken >= cum) { trimMed(k, m.id, cum - (Number(task.qty) || 1)); save(); }
    return;
  }
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

/** feitas / pendentes / atrasadas */
export function taskStatus(t, k, now = nowMin(), today = dateKey()) {
  if (isDone(t, k)) return 'done';
  if (k < today) return 'late';
  if (k > today) return 'pending';
  if (t.time && toMin(t.time) <= now && !(t.end && now < toMin(t.end))) return 'late';
  return 'pending';
}

/* ---------------- Água ---------------- */
export const waterTotal = (k) => (state.water.log[k] || []).reduce((a, b) => a + b, 0);
export function addWater(k, ml) { (state.water.log[k] ||= []).push(ml); save(); }
export function undoWater(k) { (state.water.log[k] || []).pop(); save(); }

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

/** define a data da próxima lavagem e a posição no ciclo; limpa registros vazios antes dela */
export function setHairStart(date, idx) {
  const h = state.hair;
  const today = dateKey();
  for (const k of Object.keys(h.log)) {
    const l = h.log[k];
    const empty = !Object.keys(l.steps || {}).length && !l.notes;
    if (k >= today && k <= date && empty) {
      delete h.log[k];
      if (state.done[k]) for (const r of state.routine) if (r.type === 'cabelo') delete state.done[k][r.id];
    }
  }
  h.anchorDate = date;
  h.anchorIndex = Number(idx) || 0;
  save();
}
/** próximo dia de lavagem programado (pela contagem), a partir de k */
export function nextScheduled(k) {
  for (let i = 0; i < 60; i++) { const d = addDays(k, i); if (hairDay(d).scheduled) return d; }
  return k;
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

export const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : v ? [v] : []);
/** produtos possíveis de um passo (vários = o app vai alternando) */
export function stepOptions(s, mask) {
  return s.when === 'mask' ? asList(state.hair.maskProducts[mask]) : asList(s.productIds ?? s.productId);
}
/** lavagens antes de k: as registradas + as programadas de hoje até k */
function washesBefore(k) {
  const today = dateKey(); const out = [];
  for (const [d, l] of Object.entries(state.hair.log)) if (d < k) out.push({ date: d, mask: l.mask, log: l });
  for (let d = today, i = 0; d < k && i < 400; d = addDays(d, 1), i++) {
    if (state.hair.log[d]) continue;
    const h = hairDay(d); if (h.scheduled) out.push({ date: d, mask: h.mask });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
/** qual produto usar neste passo, alternando a cada lavagem em que ele aparece */
function rotate(s, mask, k, opts) {
  if (opts.length < 2) return opts[0] || null;
  let ptr = 0;
  for (const w of washesBefore(k)) {
    const applies = s.when === 'always' || (s.when === 'mask' ? w.mask === mask : w.mask === s.when);
    if (!applies) continue;
    const used = w.log?.steps?.[s.id]?.p || w.log?.pick?.[s.id];
    const i = used ? opts.indexOf(used) : -1;
    ptr = i >= 0 ? i + 1 : ptr + 1;
  }
  return opts[ptr % opts.length];
}
export function hairStepsFor(mask, k = dateKey()) {
  const h = state.hair;
  const log = h.log[k];
  return h.steps
    .filter((s) => s.when === 'always' || s.when === 'mask' || s.when === mask)
    .map((s) => {
      const opts = stepOptions(s, mask);
      const chosen = log?.steps?.[s.id]?.p || log?.pick?.[s.id];
      return { ...s, options: opts, productId: chosen && opts.includes(chosen) ? chosen : rotate(s, mask, k, opts),
        label: s.when === 'mask' ? `Máscara de ${MASKS[mask]?.label.toLowerCase()}` : s.label };
    });
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
  if (g.link === '__agua') return !!c.checks[k]?.[g.id] || waterTotal(k) >= state.water.goal;
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

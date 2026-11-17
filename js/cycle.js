// Ciclo menstrual: períodos, previsões, período fértil e ovulação.
import { state, save } from './store.js';
import { addDays, diffDays, dateKey } from './utils.js';

export const PHASES = {
  menstruacao: { label: 'Menstruação', color: 'period', icon: '🩸' },
  prevista: { label: 'Menstruação prevista', color: 'predicted', icon: '🩸' },
  fertil: { label: 'Período fértil', color: 'fertile', icon: '🌱' },
  ovulacao: { label: 'Ovulação', color: 'ovulation', icon: '🥚' },
  folicular: { label: 'Fase folicular', color: 'neutral', icon: '🌸' },
  lutea: { label: 'Fase lútea', color: 'neutral', icon: '🌙' },
};

export const FLOWS = { leve: 'Leve', medio: 'Médio', intenso: 'Intenso' };
export const SYMPTOMS = ['Cólica', 'Dor de cabeça', 'Inchaço', 'Acne', 'Seios sensíveis', 'Cansaço', 'Desejo por doce', 'Dor nas costas', 'Libido alta', 'Insônia'];
export const MOODS = ['😊 Feliz', '😌 Calma', '🥺 Sensível', '😤 Irritada', '😰 Ansiosa', '😢 Triste', '⚡ Com energia'];

/** agrupa os dias marcados em menstruações (permite 1 dia de falha) */
export function periods() {
  const days = Object.keys(state.cycle.periodDays).filter((k) => state.cycle.periodDays[k]).sort();
  const out = [];
  for (const d of days) {
    const last = out[out.length - 1];
    if (last && diffDays(last.end, d) <= 2) last.end = d;
    else out.push({ start: d, end: d });
  }
  return out;
}

const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

export function cycleStats() {
  const c = state.cycle;
  const ps = periods();
  const gaps = [];
  for (let i = 1; i < ps.length; i++) {
    const g = diffDays(ps[i - 1].start, ps[i].start);
    if (g >= 18 && g <= 50) gaps.push(g);
  }
  const lens = ps.map((p) => diffDays(p.start, p.end) + 1).filter((n) => n <= 10);
  return {
    ps, gaps,
    cycleLen: gaps.length ? Math.round(avg(gaps.slice(-6))) : c.cycleLength,
    periodLen: lens.length ? Math.round(avg(lens.slice(-6))) : c.periodLength,
    luteal: c.luteal || 14,
  };
}

/** próximas datas previstas de menstruação + atraso */
export function predictions(st = cycleStats(), today = dateKey(), count = 8) {
  if (!st.ps.length) return { starts: [], late: 0 };
  const last = st.ps[st.ps.length - 1];
  let s = addDays(last.start, st.cycleLen);
  let late = 0;
  if (s < today && last.end < today) { late = diffDays(s, today); s = today; }
  const starts = [];
  for (let i = 0; i < count; i++) starts.push(addDays(s, i * st.cycleLen));
  return { starts, late };
}

/** informações de um dia: fase, dia do ciclo, ovulação daquele ciclo */
export function dayInfo(k, st = cycleStats(), pred = predictions(st)) {
  if (!st.ps.length) return { phase: null };
  const actual = st.ps.map((p) => p.start);
  const all = [...actual, ...pred.starts.filter((s) => s > actual[actual.length - 1])].sort();
  let start = null;
  for (const s of all) if (s <= k) start = s;
  if (!start) return { phase: state.cycle.periodDays[k] ? 'menstruacao' : null };
  const isPred = !actual.includes(start);
  const next = all.find((s) => s > start);
  const len = next ? diffDays(start, next) : st.cycleLen;
  const cycleDay = diffDays(start, k) + 1;
  const ovu = addDays(start, Math.max(len - st.luteal, 8));
  let phase;
  if (state.cycle.periodDays[k]) phase = 'menstruacao';
  else if (isPred && cycleDay <= st.periodLen) phase = 'prevista';
  else if (k === ovu) phase = 'ovulacao';
  else if (k >= addDays(ovu, -5) && k <= addDays(ovu, 1)) phase = 'fertil';
  else phase = k < ovu ? 'folicular' : 'lutea';
  return { phase, cycleDay, start, len, ovu, isPred, fertileStart: addDays(ovu, -5), fertileEnd: addDays(ovu, 1) };
}

/** resumo para o dashboard e a tela do ciclo */
export function cycleSummary(today = dateKey()) {
  const st = cycleStats();
  if (!st.ps.length) return { empty: true, st };
  const pred = predictions(st, today);
  const info = dayInfo(today, st, pred);
  const next = pred.starts.find((s) => s > today) || pred.starts[0];
  const inPeriod = info.phase === 'menstruacao';
  const curPeriod = st.ps.find((p) => p.start <= today && today <= p.end);
  // próxima ovulação a partir de hoje
  let ovu = info.ovu;
  if (!ovu || addDays(ovu, 1) < today) ovu = addDays(next, Math.max(st.cycleLen - st.luteal, 8));
  const fertileStart = addDays(ovu, -5), fertileEnd = addDays(ovu, 1);
  const inFertile = today >= fertileStart && today <= fertileEnd;
  const daysToOvu = diffDays(today, ovu);
  let chance = 'Baixa';
  if (daysToOvu >= -1 && daysToOvu <= 2) chance = 'Alta';
  else if (inFertile) chance = 'Média';
  let title, sub;
  if (inPeriod && curPeriod) { title = `Dia ${diffDays(curPeriod.start, today) + 1}`; sub = 'da menstruação'; }
  else if (pred.late > 0) { title = `${pred.late} dia${pred.late > 1 ? 's' : ''}`; sub = 'de atraso'; }
  else if (next === today) { title = 'Hoje'; sub = 'menstruação prevista'; }
  else { const n = diffDays(today, next); title = `${n} dia${n > 1 ? 's' : ''}`; sub = 'para a menstruação'; }
  let fertileText;
  if (daysToOvu === 0) fertileText = 'Ovulação hoje';
  else if (inFertile) fertileText = `Período fértil · ovulação ${daysToOvu > 0 ? `em ${daysToOvu} dia${daysToOvu > 1 ? 's' : ''}` : 'foi ontem'}`;
  else if (daysToOvu > 0) { const f = diffDays(today, fertileStart); fertileText = `Período fértil em ${f} dia${f > 1 ? 's' : ''}`; }
  else fertileText = 'Fora do período fértil';
  return { st, pred, info, next, ovu, fertileStart, fertileEnd, inFertile, inPeriod, curPeriod, chance, daysToOvu, title, sub, fertileText,
    late: pred.late, cycleDay: info.cycleDay };
}

/** marca a menstruação começando em k (preenche a duração média, como previsão editável) */
export function markPeriodStart(k) {
  const { periodLen } = cycleStats();
  for (let i = 0; i < periodLen; i++) state.cycle.periodDays[addDays(k, i)] = true;
  save();
}
/** a menstruação acabou em k: remove os dias seguintes já preenchidos */
export function markPeriodEnd(k) {
  const p = periods().find((x) => x.start <= k && k <= x.end);
  if (!p) return;
  for (let d = addDays(k, 1); d <= p.end; d = addDays(d, 1)) delete state.cycle.periodDays[d];
  save();
}
export function togglePeriodDay(k) {
  if (state.cycle.periodDays[k]) delete state.cycle.periodDays[k]; else state.cycle.periodDays[k] = true;
  save();
}
export const cycleLog = (k) => (state.cycle.logs[k] ||= { flow: '', sex: '', symptoms: [], moods: [], notes: '' });

// Tela "Meu ciclo": roda do ciclo, calendário, previsões e registro diário.
import { state, save } from './store.js';
import { esc, dateKey, addDays, diffDays, fmtShort, fmtLong, weekday, MONTHS, WD, pad } from './utils.js';
import { A, C, ui, rerender, toast, pageHead, confirmSheet } from './ui.js';
import { PHASES, FLOWS, SYMPTOMS, MOODS, cycleStats, predictions, dayInfo, cycleSummary, markPeriodStart, markPeriodEnd,
  togglePeriodDay, cycleLog } from './cycle.js';

const TIPS = {
  menstruacao: 'Seu corpo está eliminando o endométrio. Descanse, beba bastante água e, se tiver cólica, prefira treinos mais leves.',
  prevista: 'Sua menstruação deve chegar por esses dias. Deixe o absorvente por perto. 😉',
  folicular: 'O estrogênio está subindo: mais energia e disposição. Ótima fase para treinos intensos e para começar coisas novas.',
  fertil: 'Janela fértil: maior chance de engravidar. O muco costuma ficar mais transparente e elástico.',
  ovulacao: 'Dia provável da ovulação: o pico da fertilidade do ciclo. Muitas mulheres sentem mais energia e libido.',
  lutea: 'A progesterona aumenta. Nos últimos dias podem aparecer inchaço, sensibilidade e sintomas de TPM.',
};

export function cycleWheel(sum, size = 270) {
  const { st, pred, info } = sum;
  const today = dateKey();
  const len = info.len || st.cycleLen;
  const R = size / 2 - 18, c = size / 2;
  let dots = '';
  for (let i = 0; i < len; i++) {
    const d = addDays(info.start, i);
    const ph = dayInfo(d, st, pred).phase;
    const a = (-90 + (i * 360) / len) * (Math.PI / 180);
    const isT = d === today;
    dots += `<circle class="cw cw-${PHASES[ph]?.color || 'neutral'} ${isT ? 'cw-today' : ''}" cx="${(c + R * Math.cos(a)).toFixed(1)}" cy="${(c + R * Math.sin(a)).toFixed(1)}" r="${isT ? 11 : len > 32 ? 4.5 : 5.5}"/>`;
  }
  return `<div class="wheel" style="width:${size}px;height:${size}px"><svg viewBox="0 0 ${size} ${size}" aria-hidden="true">${dots}</svg>
    <div class="wheel-center"><small>${sum.inPeriod ? 'Menstruação' : sum.late ? 'Menstruação' : 'Faltam'}</small><b>${sum.title}</b><small>${sum.sub}</small>
    <span class="wheel-day">Dia ${info.cycleDay} do ciclo</span></div></div>`;
}

function monthCal(ym, edit, sum) {
  const st = sum.st, pred = sum.pred, today = dateKey();
  const first = `${ym}-01`;
  const offset = (weekday(first) + 6) % 7;
  const [y, m] = ym.split('-').map(Number);
  const nDays = new Date(y, m, 0).getDate();
  let cells = '<span></span>'.repeat(offset);
  for (let i = 1; i <= nDays; i++) {
    const d = `${ym}-${pad(i)}`;
    const ph = dayInfo(d, st, pred).phase;
    const l = state.cycle.logs[d];
    const hasLog = l && (l.flow || l.symptoms.length || l.moods.length || l.notes);
    cells += `<button class="cal-d cal-${PHASES[ph]?.color || 'none'} ${d === today ? 'today' : ''} ${d === ui.cycDay ? 'sel' : ''}"
      data-act="${edit ? 'cycToggleDay' : 'cycPickDay'}" data-d="${d}">${i}${hasLog ? '<i></i>' : ''}</button>`;
  }
  return `<div class="cal-head"><button class="icon-btn" data-act="cycMonth" data-n="-1" aria-label="Mês anterior">‹</button>
      <b>${MONTHS[m - 1][0].toUpperCase() + MONTHS[m - 1].slice(1)} ${y}</b>
      <button class="icon-btn" data-act="cycMonth" data-n="1" aria-label="Próximo mês">›</button></div>
    <div class="cal-grid">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<small>${WD[d][0]}</small>`).join('')}${cells}</div>`;
}

function chips(list, selected, act, multi = true) {
  return `<div class="chips">${list.map((v) => {
    const on = multi ? selected.includes(v) : selected === v;
    return `<button class="chip ${on ? 'on' : ''}" data-act="${act}" data-v="${esc(v)}">${esc(v)}</button>`;
  }).join('')}</div>`;
}

function renderCycle() {
  const today = dateKey();
  ui.cycDay ||= today;
  ui.cycMonth ||= today.slice(0, 7);
  const sum = cycleSummary(today);
  if (sum.empty) {
    return `${pageHead('Meu ciclo', '#/hoje')}
    <section class="card cycle-hero center-col"><div class="empty-icon">🌸</div><h2>Vamos acompanhar seu ciclo</h2>
      <p class="muted">Marque o primeiro dia da sua última menstruação no calendário para o app calcular as previsões.</p>
      <button class="btn primary block" data-act="cycStart" data-d="${today}">🩸 Minha menstruação desceu hoje</button></section>
    <section class="card"><p class="small muted">Ou toque nos dias em que você menstruou:</p>${monthCal(ui.cycMonth, true, sum)}</section>`;
  }
  const { st, info } = sum;
  const edit = !!ui.cycEdit;
  const sel = ui.cycDay;
  const selInfo = dayInfo(sel, st, sum.pred);
  const log = state.cycle.logs[sel] || { flow: '', symptoms: [], moods: [], notes: '' };
  const ph = PHASES[info.phase] || PHASES.folicular;
  const history = st.ps.slice(-6).map((p, i, arr) => {
    const nextStart = arr[i + 1]?.start;
    const len = nextStart ? diffDays(p.start, nextStart) : null;
    const plen = diffDays(p.start, p.end) + 1;
    const total = len || Math.max(st.cycleLen, diffDays(p.start, today) + 1);
    return `<li><div class="row between"><b>${fmtShort(p.start)}</b><small>${len ? `ciclo de ${len} dias` : 'ciclo atual'} · ${plen} dia${plen > 1 ? 's' : ''} de menstruação</small></div>
      <div class="hbar"><span class="hb-period" style="width:${(plen / 45) * 100}%"></span><span class="hb-rest" style="width:${((total - plen) / 45) * 100}%"></span></div></li>`;
  }).reverse().join('');

  return `${pageHead('Meu ciclo', '#/hoje', `<button class="link" data-act="cycEdit">${edit ? 'Concluir' : 'Editar datas'}</button>`)}
  <section class="card cycle-hero">
    ${cycleWheel(sum)}
    <div class="cycle-pills">
      <span class="cpill cp-${ph.color}">${ph.icon} ${ph.label}</span>
      <span class="cpill cp-fertile">🌱 Chance de engravidar: <b>${sum.chance}</b></span>
    </div>
    <p class="center fert-line">${sum.fertileText}</p>
    ${sum.inPeriod
      ? `<button class="btn primary block" data-act="cycEnd">✓ Minha menstruação terminou hoje</button>`
      : `<button class="btn primary block" data-act="cycStart" data-d="${today}">🩸 Minha menstruação desceu hoje</button>`}
  </section>

  <div class="stats">
    <div class="stat"><span>🩸</span><b>${fmtShort(sum.next)}</b><small>próxima menstruação</small></div>
    <div class="stat"><span>🥚</span><b>${fmtShort(sum.ovu)}</b><small>ovulação prevista</small></div>
    <div class="stat"><span>🌱</span><b>${fmtShort(sum.fertileStart)}–${fmtShort(sum.fertileEnd)}</b><small>período fértil</small></div>
    <div class="stat"><span>🔄</span><b>${st.cycleLen} dias</b><small>ciclo · ${st.periodLen} dias de menstruação</small></div>
  </div>

  <section class="card tip-card tip-${ph.color}"><b>${ph.icon} ${ph.label}</b><p>${TIPS[info.phase] || ''}</p></section>

  <section class="card" id="cyc-cal">
    ${edit ? '<p class="edit-hint">✏️ Toque nos dias em que você menstruou para marcar ou desmarcar.</p>' : ''}
    ${monthCal(ui.cycMonth, edit, sum)}
    <div class="legend cyc-legend"><span><i class="lg lg-period"></i>Menstruação</span><span><i class="lg lg-predicted"></i>Prevista</span>
      <span><i class="lg lg-fertile"></i>Fértil</span><span><i class="lg lg-ovulation"></i>Ovulação</span></div>
  </section>

  <section class="card">
    <div class="card-head"><h2>${sel === today ? 'Como você está hoje?' : `Registro de ${fmtShort(sel)}`}</h2>
      ${selInfo.phase ? `<span class="cpill cp-${PHASES[selInfo.phase].color} sm">${PHASES[selInfo.phase].label}</span>` : ''}</div>
    <label class="toggle-line"><input type="checkbox" data-change="cycDayPeriod" data-d="${sel}" ${state.cycle.periodDays[sel] ? 'checked' : ''}>
      <span>🩸 Menstruei neste dia</span></label>
    <div class="field mt"><span>Fluxo</span>${chips(Object.values(FLOWS), FLOWS[log.flow] || '', 'cycFlow', false)}</div>
    <div class="field mt"><span>Sintomas</span>${chips(SYMPTOMS, log.symptoms, 'cycSym')}</div>
    <div class="field mt"><span>Humor</span>${chips(MOODS, log.moods, 'cycMood')}</div>
    <label class="field mt"><span>Anotações</span><textarea rows="2" data-change="cycNotes" data-d="${sel}" placeholder="Como está se sentindo?">${esc(log.notes)}</textarea></label>
  </section>

  ${history ? `<section class="card"><h2>Histórico de ciclos</h2><ul class="cyc-hist">${history}</ul></section>` : ''}

  <section class="card"><h2>Ajustes</h2>
    <p class="small muted">Usados enquanto o app ainda não tem histórico suficiente. Depois de 2 ciclos, ele calcula a média sozinho.</p>
    <div class="row gap">
      <label class="field grow"><span>Duração do ciclo (dias)</span><input type="number" inputmode="numeric" min="18" max="50" value="${state.cycle.cycleLength}" data-change="cycSet" data-k="cycleLength"></label>
      <label class="field grow"><span>Duração da menstruação</span><input type="number" inputmode="numeric" min="1" max="10" value="${state.cycle.periodLength}" data-change="cycSet" data-k="periodLength"></label>
    </div>
  </section>
  <p class="small muted center disclaimer">As previsões são estimativas baseadas nos seus registros e não servem como método contraceptivo.</p>`;
}

A.cycStart = (el) => {
  const k = el.dataset.d;
  markPeriodStart(k);
  toast('Menstruação registrada 🩸 previsões atualizadas');
  rerender();
};
A.cycEnd = () => { markPeriodEnd(dateKey()); toast('Fim da menstruação registrado'); rerender(); };
A.cycEdit = () => { ui.cycEdit = !ui.cycEdit; rerender(); if (ui.cycEdit) document.getElementById('cyc-cal')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
A.cycToggleDay = (el) => { togglePeriodDay(el.dataset.d); rerender(); };
A.cycPickDay = (el) => { ui.cycDay = el.dataset.d; rerender(); };
A.cycMonth = (el) => {
  const [y, m] = ui.cycMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + Number(el.dataset.n), 1);
  ui.cycMonth = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; rerender();
};
A.cycFlow = (el) => {
  const l = cycleLog(ui.cycDay);
  const key = Object.keys(FLOWS).find((k) => FLOWS[k] === el.dataset.v);
  l.flow = l.flow === key ? '' : key;
  if (l.flow && !state.cycle.periodDays[ui.cycDay]) state.cycle.periodDays[ui.cycDay] = true;
  save(); rerender();
};
const toggleIn = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };
A.cycSym = (el) => { toggleIn(cycleLog(ui.cycDay).symptoms, el.dataset.v); save(); rerender(); };
A.cycMood = (el) => { toggleIn(cycleLog(ui.cycDay).moods, el.dataset.v); save(); rerender(); };
C.cycNotes = (el) => { cycleLog(el.dataset.d).notes = el.value; save(); };
C.cycDayPeriod = (el) => { togglePeriodDay(el.dataset.d); rerender(); };
C.cycSet = (el) => {
  const v = Number(el.value); const k = el.dataset.k;
  const [min, max] = k === 'cycleLength' ? [18, 50] : [1, 10];
  if (!v || v < min || v > max) { toast(`Use um valor entre ${min} e ${max}`); return rerender(); }
  state.cycle[k] = v; save(); toast('Ajuste salvo'); rerender();
};

export const routes = { ciclo: { render: renderCycle, tab: 'hoje' } };

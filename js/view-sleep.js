// Sono: registro de dormir/acordar, qualidade, meta de horas e gráfico das últimas noites.
import { state, save } from './store.js';
import { esc, dateKey, addDays, fmtShort, fmtMinutes, parseKey, WD } from './utils.js';
import { A, C, ui, rerender, toast, ring, bar, opt, confirmSheet } from './ui.js';

const SL = () => (state.sleep ||= { goalHours: 8, bedtime: '21:00', wake: '05:00', log: {} });

export function sleepHours(l) {
  const [bh, bm] = String(l.bed).split(':').map(Number), [wh, wm] = String(l.wake).split(':').map(Number);
  let m = wh * 60 + wm - (bh * 60 + bm); if (m <= 0) m += 24 * 60;
  return m / 60;
}
/** noites de uma semana (chave = dia em que acordou) */
export function sleepWeek(ws) {
  const vals = [];
  for (let i = 0; i < 7; i++) { const l = SL().log[addDays(ws, i)]; if (l) vals.push(sleepHours(l)); }
  return { n: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0 };
}
export function sleepRange(s, e) {
  const vals = Object.entries(SL().log).filter(([d]) => d >= s && d <= e).map(([, l]) => sleepHours(l));
  return { n: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, ok: vals.filter((h) => sleepClass(h).k !== 'low').length };
}
const hm = (h) => fmtMinutes(Math.round(h * 60));

/** o app classifica a noite pela meta: dentro (±15 min), abaixo ou acima */
export function sleepClass(h, goal = SL().goalHours) {
  const diff = Math.round((h - goal) * 60);
  if (Math.abs(diff) <= 15) return { k: 'ok', label: 'Dentro da meta', txt: `dormiu ${hm(h)} · dentro da meta de ${String(goal).replace('.', ',')}h` };
  if (diff < 0) return { k: 'low', label: 'Abaixo da meta', txt: `dormiu ${hm(h)} · faltaram ${fmtMinutes(-diff)} para a meta` };
  return { k: 'high', label: 'Acima da meta', txt: `dormiu ${hm(h)} · ${fmtMinutes(diff)} a mais que a meta` };
}
const tag = (c) => `<span class="sl-tag sl-${c.k}">${c.label}</span>`;

function chart(days) {
  const goal = SL().goalHours; const max = Math.max(goal + 1, ...days.map((d) => d.h || 0));
  const W = 340, H = 140, gap = 3; const bw = (W - gap * (days.length - 1)) / days.length;
  const y = (h) => H - 16 - (h / max) * (H - 30);
  return `<svg class="rep-chart" viewBox="0 0 ${W} ${H + 6}" role="img" aria-label="Horas de sono por noite">
    <line x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" class="sl-goal"/><text x="${W}" y="${y(goal) - 4}" class="sl-goal-t">meta ${goal}h</text>
    ${days.map((d, i) => { const x = i * (bw + gap); if (!d.h) return `<rect x="${x}" y="${H - 18}" width="${bw}" height="2" rx="1" class="rep-none"/><text x="${x + bw / 2}" y="${H + 4}" class="rep-lab">${d.lab}</text>`;
      const top = y(d.h); return `<g class="rep-bar" data-act="repTip" data-tip="${esc(`${fmtShort(d.d)}: ${hm(d.h)} de sono`)}"><rect x="${x}" y="${top}" width="${bw}" height="${H - 16 - top}" rx="4" class="rep-fill ${sleepClass(d.h).k !== 'low' ? 'full' : ''}"><title>${hm(d.h)}</title></rect>
      <text x="${x + bw / 2}" y="${top - 3}" class="rep-val">${Math.round(d.h * 10) / 10}</text><text x="${x + bw / 2}" y="${H + 4}" class="rep-lab">${d.lab}</text></g>`; }).join('')}
  </svg>`;
}

function renderSleep() {
  const t = dateKey(); const s = SL();
  const today = s.log[t];
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)).map((d) => ({ d, h: s.log[d] ? sleepHours(s.log[d]) : 0, lab: WD[parseKey(d).getDay()][0] }));
  const wk = sleepRange(addDays(t, -6), t);
  const hist = Object.keys(s.log).sort().reverse().slice(0, 10);
  return `<header class="page-head top"><h1>Sono</h1></header>
  <form class="card form sleep-form" id="sleep-form">
    <h2>${today ? 'Noite registrada ✓' : 'Como você dormiu esta noite?'}</h2>
    <div class="row gap"><label class="field grow"><span>Dormi às</span><input type="time" name="bed" value="${today?.bed || s.bedtime}"></label>
      <label class="field grow"><span>Acordei às</span><input type="time" name="wake" value="${today?.wake || s.wake}"></label></div>
    <p class="sl-prev" id="sleep-prev">${today ? (() => { const c = sleepClass(sleepHours(today)); return `${tag(c)} ${c.txt}`; })() : ''}</p>
    <label class="field"><span>Anotação (opcional)</span><input name="note" value="${esc(today?.note || '')}" placeholder="Ex.: acordei de madrugada, café tarde…"></label>
    <button class="btn primary block">${today ? 'Atualizar' : 'Salvar noite'}</button>
  </form>
  <section class="card sl-sum">
    <div class="row between"><b>${wk.n ? `Média dos últimos 7 dias: ${hm(wk.avg)}` : 'Registre suas noites'}</b>${wk.n ? tag(sleepClass(wk.avg)) : ''}</div>
    ${bar(wk.n ? wk.avg / s.goalHours : 0)}
    <small>${wk.n ? `${wk.ok} de ${wk.n} noite${wk.n === 1 ? '' : 's'} na meta · ` : ''}Meta: ${String(s.goalHours).replace('.', ',')}h por noite</small>
    <small>Para acordar às ${s.wake} com ${String(s.goalHours).replace('.', ',')}h de sono, deite às <b>${(() => { const [h, m] = s.wake.split(':').map(Number); let x = h * 60 + m - s.goalHours * 60; x = (x + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; })()}</b></small></section>
  <section class="card"><div class="card-head"><h2>Últimas 2 semanas</h2><small>toque numa barra</small></div>${chart(days)}</section>
  <section class="card"><h2>Meta de sono</h2>
    <div class="row gap"><label class="field grow"><span>Horas por noite</span><select data-change="sleepSet" data-k="goalHours">${[6, 6.5, 7, 7.5, 8, 8.5, 9].map((h) => opt(h, `${String(h).replace('.', ',')}h`, s.goalHours)).join('')}</select></label>
      <label class="field grow"><span>Quero acordar às</span><input type="time" value="${s.wake}" data-change="sleepSet" data-k="wake"></label></div></section>
  ${hist.length ? `<section class="card"><h2>Histórico</h2><ul class="mini-list">${hist.map((d) => { const l = s.log[d]; const h = sleepHours(l); return `<li><div class="grow"><b>${fmtShort(d)} · ${hm(h)}</b>
    <small>${l.bed} → ${l.wake}${l.note ? ' · ' + esc(l.note) : ''}</small></div>${tag(sleepClass(h))}
    <button class="icon-btn sm" data-act="sleepDel" data-d="${d}" aria-label="Apagar">✕</button></li>`; }).join('')}</ul></section>` : ''}`;
}
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'sleep-form') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const l = { bed: fd.get('bed') || SL().bedtime, wake: fd.get('wake') || SL().wake, note: String(fd.get('note') || '').trim() };
  SL().log[dateKey()] = l; SL().bedtime = l.bed;
  save(); const h = sleepHours(l);
  const c = sleepClass(h);
  toast(c.k === 'ok' ? `${hm(h)} de sono — dentro da meta! 💜` : `${hm(h)} de sono — ${c.label.toLowerCase()}`); rerender();
});
// prévia enquanto digita os horários
document.addEventListener('input', (e) => {
  const f = e.target.closest?.('#sleep-form'); if (!f) return;
  const bed = f.querySelector('[name=bed]').value, wake = f.querySelector('[name=wake]').value;
  const out = f.querySelector('#sleep-prev'); if (!out || !bed || !wake) return;
  const c = sleepClass(sleepHours({ bed, wake })); out.innerHTML = `${tag(c)} ${c.txt}`;
});
C.sleepSet = (el) => { SL()[el.dataset.k] = el.dataset.k === 'goalHours' ? Number(el.value) : el.value; save(); toast('Meta de sono salva'); rerender(); };
A.sleepDel = (el) => confirmSheet('Apagar esta noite?', 'O registro de sono deste dia será apagado.', 'Apagar', () => { delete SL().log[el.dataset.d]; save(); });

/** tile para a tela inicial */
export function sleepTile() {
  const l = SL().log[dateKey()];
  if (!l) return `<a class="tile t-sky" href="#/sono"><span class="tile-ico">🌙</span><div><b>Registrar sono</b><small>como foi a noite?</small></div></a>`;
  const h = sleepHours(l);
  return `<a class="tile t-sky" href="#/sono"><span class="tile-ico">🌙</span><div><b>${hm(h)} de sono</b><small>${sleepClass(h).label}</small>${bar(h / SL().goalHours)}</div></a>`;
}

export const routes = { sono: { render: renderSleep, tab: 'sono' } };

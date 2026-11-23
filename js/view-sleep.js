// Sono: registro de dormir/acordar, qualidade, meta de horas e gráfico das últimas noites.
import { state, save } from './store.js';
import { esc, dateKey, addDays, fmtShort, fmtMinutes, parseKey, WD } from './utils.js';
import { A, C, ui, rerender, toast, ring, bar, opt, confirmSheet } from './ui.js';

const SL = () => (state.sleep ||= { goalHours: 8, bedtime: '21:00', wake: '05:00', log: {} });
const QUAL = { 1: 'Péssimo', 2: 'Ruim', 3: 'Ok', 4: 'Bom', 5: 'Ótimo' };
const QIC = { 1: '😢', 2: '😰', 3: '😌', 4: '😊', 5: '⚡' };

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
  return { n: vals.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, ok: vals.filter((h) => h >= SL().goalHours - 0.25).length };
}
const hm = (h) => fmtMinutes(Math.round(h * 60));

function chart(days) {
  const goal = SL().goalHours; const max = Math.max(goal + 1, ...days.map((d) => d.h || 0));
  const W = 340, H = 140, gap = 3; const bw = (W - gap * (days.length - 1)) / days.length;
  const y = (h) => H - 16 - (h / max) * (H - 30);
  return `<svg class="rep-chart" viewBox="0 0 ${W} ${H + 6}" role="img" aria-label="Horas de sono por noite">
    <line x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" class="sl-goal"/><text x="${W}" y="${y(goal) - 4}" class="sl-goal-t">meta ${goal}h</text>
    ${days.map((d, i) => { const x = i * (bw + gap); if (!d.h) return `<rect x="${x}" y="${H - 18}" width="${bw}" height="2" rx="1" class="rep-none"/><text x="${x + bw / 2}" y="${H + 4}" class="rep-lab">${d.lab}</text>`;
      const top = y(d.h); return `<g class="rep-bar" data-act="repTip" data-tip="${esc(`${fmtShort(d.d)}: ${hm(d.h)} de sono`)}"><rect x="${x}" y="${top}" width="${bw}" height="${H - 16 - top}" rx="4" class="rep-fill ${d.h >= goal - 0.25 ? 'full' : ''}"><title>${hm(d.h)}</title></rect>
      <text x="${x + bw / 2}" y="${top - 3}" class="rep-val">${Math.round(d.h * 10) / 10}</text><text x="${x + bw / 2}" y="${H + 4}" class="rep-lab">${d.lab}</text></g>`; }).join('')}
  </svg>`;
}

function renderSleep() {
  const t = dateKey(); const s = SL();
  const today = s.log[t];
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i - 13)).map((d) => ({ d, h: s.log[d] ? sleepHours(s.log[d]) : 0, lab: WD[parseKey(d).getDay()][0] }));
  const wk = sleepRange(addDays(t, -6), t);
  const hist = Object.keys(s.log).sort().reverse().slice(0, 10);
  const avgBed = (() => { const ks = Object.keys(s.log).sort().slice(-7); if (!ks.length) return ''; let m = 0; for (const k of ks) { const [h, mi] = s.log[k].bed.split(':').map(Number); m += (h < 12 ? h + 24 : h) * 60 + mi; } m = Math.round(m / ks.length) % (24 * 60); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; })();
  return `<header class="page-head top"><h1>Sono</h1></header>
  <form class="card form sleep-form" id="sleep-form">
    <h2>${today ? 'Noite registrada ✓' : 'Como você dormiu esta noite?'}</h2>
    <div class="row gap"><label class="field grow"><span>Dormi às</span><input type="time" name="bed" value="${today?.bed || s.bedtime}"></label>
      <label class="field grow"><span>Acordei às</span><input type="time" name="wake" value="${today?.wake || s.wake}"></label></div>
    <div class="field"><span>Qualidade</span><div class="chips">${Object.entries(QUAL).map(([k, l]) => `<label class="chip"><input type="radio" name="q" value="${k}" ${Number(today?.q || 4) === Number(k) ? 'checked' : ''}><span>${QIC[k]} ${l}</span></label>`).join('')}</div></div>
    <label class="field"><span>Anotação (opcional)</span><input name="note" value="${esc(today?.note || '')}" placeholder="Ex.: acordei de madrugada, café tarde…"></label>
    <button class="btn primary block">${today ? 'Atualizar' : 'Salvar noite'}</button>
  </form>
  <section class="card rep-hero">${ring(wk.n ? Math.min(1, wk.avg / s.goalHours) : 0, { size: 92, stroke: 10, label: wk.n ? hm(wk.avg) : '–', sub: 'média 7 dias' })}
    <div class="grow"><b>${wk.n ? `${wk.ok} de ${wk.n} noites na meta` : 'Registre suas noites'}</b><small>Meta: ${s.goalHours}h por noite${avgBed ? ` · dormindo em média às ${avgBed}` : ''}</small>
    <small>Para acordar às ${s.wake} com ${s.goalHours}h de sono, deite às <b>${(() => { const [h, m] = s.wake.split(':').map(Number); let x = h * 60 + m - s.goalHours * 60; x = (x + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; })()}</b></small></div></section>
  <section class="card"><div class="card-head"><h2>Últimas 2 semanas</h2><small>toque numa barra</small></div>${chart(days)}</section>
  <section class="card"><h2>Meta de sono</h2>
    <div class="row gap"><label class="field grow"><span>Horas por noite</span><select data-change="sleepSet" data-k="goalHours">${[6, 6.5, 7, 7.5, 8, 8.5, 9].map((h) => opt(h, `${String(h).replace('.', ',')}h`, s.goalHours)).join('')}</select></label>
      <label class="field grow"><span>Quero acordar às</span><input type="time" value="${s.wake}" data-change="sleepSet" data-k="wake"></label></div></section>
  ${hist.length ? `<section class="card"><h2>Histórico</h2><ul class="mini-list">${hist.map((d) => { const l = s.log[d]; const h = sleepHours(l); return `<li><div class="grow"><b>${fmtShort(d)} · ${hm(h)}</b>
    <small>${l.bed} → ${l.wake} · ${QIC[l.q] || ''} ${QUAL[l.q] || ''}${l.note ? ' · ' + esc(l.note) : ''}</small></div>
    <button class="icon-btn sm" data-act="sleepDel" data-d="${d}" aria-label="Apagar">✕</button></li>`; }).join('')}</ul></section>` : ''}`;
}
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'sleep-form') return;
  e.preventDefault();
  const fd = new FormData(e.target);
  const l = { bed: fd.get('bed') || SL().bedtime, wake: fd.get('wake') || SL().wake, q: Number(fd.get('q') || 3), note: String(fd.get('note') || '').trim() };
  SL().log[dateKey()] = l; SL().bedtime = l.bed;
  save(); const h = sleepHours(l);
  toast(h >= SL().goalHours - 0.25 ? `${hm(h)} de sono — meta batida! 😴💜` : `${hm(h)} de sono registradas`); rerender();
});
C.sleepSet = (el) => { SL()[el.dataset.k] = el.dataset.k === 'goalHours' ? Number(el.value) : el.value; save(); toast('Meta de sono salva'); rerender(); };
A.sleepDel = (el) => confirmSheet('Apagar esta noite?', 'O registro de sono deste dia será apagado.', 'Apagar', () => { delete SL().log[el.dataset.d]; save(); });

/** tile para a tela inicial */
export function sleepTile() {
  const l = SL().log[dateKey()];
  if (!l) return `<a class="tile t-sky" href="#/sono"><span class="tile-ico">🌙</span><div><b>Registrar sono</b><small>como foi a noite?</small></div></a>`;
  const h = sleepHours(l);
  return `<a class="tile t-sky" href="#/sono"><span class="tile-ico">🌙</span><div><b>${hm(h)} de sono</b><small>meta ${SL().goalHours}h · ${QUAL[l.q] || ''}</small>${bar(h / SL().goalHours)}</div></a>`;
}

export const routes = { sono: { render: renderSleep, tab: 'sono' } };

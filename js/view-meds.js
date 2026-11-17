// Remédios e suplementos: horários, várias doses no dia, registro e informações.
import { state, save } from './store.js';
import { esc, dateKey, addDays, fmtShort, fmtLong, uid, pad } from './utils.js';
import { A, C, ui, sheet, rerender, toast, empty, pageHead, opt, ring, confirmSheet, go, bar } from './ui.js';
import { medPerDay, medTakes, medTaken, addMedTake, removeMedTake } from './logic.js';

const UNITS = ['cápsula', 'comprimido', 'gota', 'ml', 'sachê', 'dose'];
const plural = (n, u) => (n === 1 ? u : u === 'ml' ? 'ml' : u.endsWith('ão') ? u.slice(0, -2) + 'ões' : u + 's');
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function medCard(m, k) {
  const total = medPerDay(m), taken = medTaken(k, m.id);
  const takes = medTakes(k, m.id);
  let cum = 0;
  const slots = m.schedule.map((s) => { cum += Number(s.qty) || 0; return `<span class="slot ${taken >= cum ? 'on' : ''}">${s.time} · ${s.qty}</span>`; }).join('');
  const dots = Array.from({ length: Math.max(total, taken) }, (_, i) => `<i class="${i < taken ? 'on' : ''}"></i>`).join('');
  return `<section class="card med">
    <div class="med-top"><span class="t-icon bg-soft-${m.color || 'violet'}">💊</span>
      <div class="grow"><b>${esc(m.name)}</b><small>${taken}/${total} ${plural(total, m.unit)} hoje</small></div>
      <a class="icon-btn sm" href="#/remedio?id=${m.id}" aria-label="Informações">i</a></div>
    <div class="med-dots">${dots}</div>
    <div class="slots">${slots}</div>
    ${takes.length ? `<ul class="takes">${takes.map((t, i) => `<li><span>Tomei ${t.q} ${plural(t.q, m.unit)} às <b>${t.t}</b></span>
      <button class="icon-btn sm" data-act="medUndo" data-id="${m.id}" data-i="${i}" data-d="${k}" aria-label="Remover">✕</button></li>`).join('')}</ul>` : ''}
    <div class="row gap mt"><button class="btn primary grow" data-act="medTake" data-id="${m.id}" data-d="${k}">+1 ${m.unit} agora</button>
      <button class="btn ghost" data-act="medTakeMore" data-id="${m.id}" data-d="${k}">Outra qtd.</button></div>
  </section>`;
}

function renderMeds() {
  const k = dateKey();
  const act = state.meds.filter((m) => m.active);
  const total = act.reduce((a, m) => a + medPerDay(m), 0);
  const taken = act.reduce((a, m) => a + Math.min(medTaken(k, m.id), medPerDay(m)), 0);
  const inactive = state.meds.filter((m) => !m.active);
  return `<header class="page-head top"><h1>Remédios</h1><div class="ph-right"><button class="link" data-act="medNew">+ Remédio</button></div></header>
  <p class="sub">${fmtLong(k)}</p>
  ${act.length ? `<section class="card row gap">
    ${ring(total ? taken / total : 0, { size: 92, stroke: 10, label: `${taken}/${total}`, sub: 'doses' })}
    <div class="grow"><b>${taken >= total ? 'Tudo tomado hoje 💜' : `Falta${total - taken > 1 ? 'm' : ''} ${total - taken} dose${total - taken > 1 ? 's' : ''}`}</b>
    <small>Os horários também aparecem na rotina do dia.</small></div></section>` : ''}
  ${act.length ? act.map((m) => medCard(m, k)).join('') : empty('💊', 'Nenhum remédio', 'Cadastre remédios e suplementos com horário e quantidade.', '<button class="btn primary" data-act="medNew">+ Adicionar</button>')}
  ${inactive.length ? `<section class="card"><h2>Pausados</h2><ul class="mini-list">${inactive.map((m) => `<li data-act="medEdit" data-id="${m.id}"><div class="grow"><b>${esc(m.name)}</b><small>toque para editar ou reativar</small></div></li>`).join('')}</ul></section>` : ''}`;
}

function renderMed(p) {
  const m = state.meds.find((x) => x.id === p.get('id'));
  if (!m) return `${pageHead('Remédio', '#/remedios')}${empty('💊', 'Não encontrado', '')}`;
  const tab = ui.medTab || 'info';
  const k = dateKey();
  let body;
  if (tab === 'info') {
    body = `<section class="card info">
      <div><small>Para que serve</small><p>${esc(m.info?.purpose) || '<span class="muted">—</span>'}</p></div>
      <div><small>Dose / como tomar</small><p>${esc(m.info?.dose) || '<span class="muted">—</span>'}</p></div>
      <div><small>Quantidade por dia</small><p>${medPerDay(m)} ${plural(medPerDay(m), m.unit)}</p></div>
      <div><small>Horários</small><p>${m.schedule.map((s) => `${s.time} (${s.qty})`).join(' · ')}</p></div>
      <div><small>Observações</small><p>${esc(m.info?.notes || '').replace(/\n/g, '<br>') || '<span class="muted">—</span>'}</p></div>
    </section>`;
  } else {
    const days = Array.from({ length: 14 }, (_, i) => addDays(k, -i));
    body = `<section class="card"><ul class="mini-list">${days.map((d) => {
      const t = medTaken(d, m.id), tot = medPerDay(m);
      return `<li><div class="grow"><b>${fmtShort(d)}</b><small>${medTakes(d, m.id).map((x) => `${x.t} (${x.q})`).join(' · ') || 'nada registrado'}</small>${bar(tot ? t / tot : 0)}</div><span class="badge bg-soft-${t >= tot ? 'violet' : 'rose'}">${t}/${tot}</span></li>`;
    }).join('')}</ul></section>`;
  }
  return `${pageHead(m.name, '#/remedios', `<button class="link" data-act="medEdit" data-id="${m.id}">Editar</button>`)}
  <div class="seg"><button class="${tab === 'info' ? 'on' : ''}" data-act="medTab" data-t="info">Informações</button>
    <button class="${tab === 'hist' ? 'on' : ''}" data-act="medTab" data-t="hist">Histórico</button></div>${body}`;
}

function slotRow(s = { time: '', qty: 1 }) {
  return `<div class="slot-edit"><input type="time" name="stime" value="${esc(s.time)}" required>
    <input type="number" inputmode="numeric" name="sqty" min="1" value="${s.qty}" aria-label="Quantidade">
    <button type="button" class="icon-btn sm" data-rm aria-label="Remover horário">✕</button></div>`;
}

function medSheet(m) {
  const isNew = !m;
  const x = m || { name: '', unit: 'cápsula', color: 'violet', active: true, schedule: [{ time: '08:00', qty: 1 }], info: { purpose: '', dose: '', notes: '' } };
  sheet(isNew ? 'Novo remédio' : 'Editar remédio', `<form class="form">
    <label class="field"><span>Nome</span><input name="name" required value="${esc(x.name)}" placeholder="Ex.: Ômega 3, Vitamina D"></label>
    <label class="field"><span>Unidade</span><select name="unit">${UNITS.map((u) => opt(u, u, x.unit)).join('')}</select></label>
    <div class="field"><span>Horários e quantidade em cada um</span><div id="slots">${x.schedule.map(slotRow).join('')}</div>
      <button type="button" class="btn small ghost mt" id="add-slot">+ Horário</button></div>
    <label class="field"><span>Para que serve</span><input name="purpose" value="${esc(x.info?.purpose || '')}"></label>
    <label class="field"><span>Dose / como tomar</span><input name="dose" value="${esc(x.info?.dose || '')}" placeholder="Ex.: após as refeições"></label>
    <label class="field"><span>Observações</span><textarea name="notes" rows="2" placeholder="Médico, estoque, cuidados...">${esc(x.info?.notes || '')}</textarea></label>
    <div class="field"><span>Cor</span><div class="color-row">${['rose', 'violet', 'sky'].map((c) => `<label><input type="radio" name="color" value="${c}" ${c === x.color ? 'checked' : ''}><span class="dot bg-${c}"></span></label>`).join('')}</div></div>
    <label class="toggle-line"><input type="checkbox" name="active" ${x.active ? 'checked' : ''}><span>Em uso (aparece na rotina do dia)</span></label>
    <button class="btn primary block mt">${isNew ? 'Adicionar' : 'Salvar'}</button>
    ${isNew ? '' : '<button type="button" class="btn danger-ghost block" id="del-med">Excluir remédio</button>'}</form>`, {
    onMount: (root) => {
      const box = root.querySelector('#slots');
      root.querySelector('#add-slot').addEventListener('click', () => box.insertAdjacentHTML('beforeend', slotRow({ time: '', qty: 1 })));
      box.addEventListener('click', (e) => { if (e.target.closest('[data-rm]') && box.children.length > 1) e.target.closest('.slot-edit').remove(); });
      root.querySelector('#del-med')?.addEventListener('click', () => confirmSheet('Excluir remédio?', `"${x.name}" e o histórico serão apagados.`, 'Excluir', () => {
        state.meds = state.meds.filter((q) => q !== m);
        for (const d of Object.values(state.medLog)) delete d[m.id];
        save(); go('#/remedios');
      }));
    },
    onSubmit: (fd) => {
      const times = fd.getAll('stime'), qtys = fd.getAll('sqty');
      const schedule = times.map((t, i) => ({ time: t, qty: Math.max(1, Number(qtys[i]) || 1) })).filter((s) => s.time).sort((a, b) => a.time.localeCompare(b.time));
      if (!schedule.length) { toast('Coloque pelo menos um horário'); return false; }
      const data = { name: fd.get('name').trim(), unit: fd.get('unit'), color: fd.get('color') || 'violet', active: !!fd.get('active'), schedule,
        info: { purpose: fd.get('purpose').trim(), dose: fd.get('dose').trim(), notes: fd.get('notes').trim() } };
      if (isNew) state.meds.push({ id: uid(), ...data }); else Object.assign(m, data);
      save(); toast('Remédio salvo');
    },
  });
}

A.medNew = () => medSheet();
A.medEdit = (el) => medSheet(state.meds.find((x) => x.id === el.dataset.id));
A.medTab = (el) => { ui.medTab = el.dataset.t; rerender(); };
A.medTake = (el) => { addMedTake(el.dataset.d, el.dataset.id, 1); toast('Registrado 💊'); rerender(); };
A.medUndo = (el) => { removeMedTake(el.dataset.d, el.dataset.id, Number(el.dataset.i)); rerender(); };
A.medTakeMore = (el) => {
  const m = state.meds.find((x) => x.id === el.dataset.id);
  sheet(`Tomei ${m.name}`, `<form class="form">
    <div class="row gap"><label class="field grow"><span>Quantidade (${m.unit})</span><input type="number" inputmode="numeric" name="q" min="1" value="1"></label>
    <label class="field grow"><span>Horário</span><input type="time" name="t" value="${nowHM()}"></label></div>
    <button class="btn primary block">Registrar</button></form>`, {
    onSubmit: (fd) => { addMedTake(el.dataset.d, m.id, Number(fd.get('q')) || 1, fd.get('t') || nowHM()); toast('Registrado 💊'); },
  });
};

export const routes = {
  remedios: { render: renderMeds, tab: 'remedios' },
  remedio: { render: renderMed, tab: 'remedios' },
};

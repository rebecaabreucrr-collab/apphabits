// Tela de Finanças: resumo do mês, lançamentos, contas a pagar, orçamento (limites) e lançamento com IA.
import { state, save } from './store.js';
import { esc, dateKey, addDays, uid, fmtShort, parseKey } from './utils.js';
import { A, C, ui, sheet, rerender, toast, empty, opt, bar, confirmSheet, closeSheet } from './ui.js';
import { F, money, parseMoney, cat, cats, entryMonth, isLate, ensureBills, monthSummary, monthLabel, shiftMonth, thisMonth, addEntries, ym } from './finance.js';
import { COLORS } from './defaults.js';
import { emojiGrid } from './forms.js';
import { iconize } from './icons.js';

const TABS = { resumo: 'Resumo', lanc: 'Lançamentos', contas: 'Contas', orc: 'Orçamento' };
const wp = () => window.MR_WP || null;

/* ---------------- IA ---------------- */
function aiCard() {
  const W = wp();
  if (!W) return `<section class="card ai-card off"><div class="ai-head"><span class="t-icon">✨</span><div><b>Lançar com IA</b>
    <small>A IA funciona na versão do app instalada pelo plugin do WordPress (com a chave configurada no painel). Aqui você pode lançar manualmente.</small></div></div></section>`;
  if (!W.ia) return `<section class="card ai-card off"><div class="ai-head"><span class="t-icon">✨</span><div><b>Lançar com IA</b>
    <small>Falta configurar a chave da IA no WordPress: painel → Minha Rotina → Inteligência artificial.</small></div></div></section>`;
  const files = ui.aiFiles || [];
  return `<section class="card ai-card"><div class="ai-head"><span class="t-icon">✨</span><div><b>Lançar com IA</b>
    <small>Escreva do seu jeito, mande foto do cupom, nota ou boleto, ou um arquivo (PDF, extrato CSV/OFX). A IA monta os lançamentos e você confere antes de salvar.</small></div></div>
    <textarea id="ai-text" rows="3" placeholder="Ex.: gastei 45,90 no mercado hoje; recebi 3.500 de salário dia 5; conta de luz de 182 vence dia 20">${esc(ui.aiText || '')}</textarea>
    ${files.length ? `<div class="ai-files">${files.map((f, i) => `<span class="pchip">${f.kind === 'image' ? '📷' : '📎'} ${esc(f.name)}<button data-act="aiRm" data-i="${i}" aria-label="Remover">✕</button></span>`).join('')}</div>` : ''}
    <div class="row gap wrap ai-actions">
      <label class="btn small ghost">📷 Foto<input type="file" accept="image/*" multiple hidden data-change="aiFile"></label>
      <label class="btn small ghost">📎 Arquivo<input type="file" accept="image/*,application/pdf,.pdf,.csv,.txt,.ofx,text/plain,text/csv" multiple hidden data-change="aiFile"></label>
      <button class="btn small primary grow" data-act="aiSend" ${ui.aiBusy ? 'disabled' : ''}>${ui.aiBusy ? 'Lendo… ✨' : 'Enviar para a IA'}</button>
    </div></section>`;
}
function readAs(file, how) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r[how](file); });
}
/** fotos ficam menores (até 1600px) para ir mais rápido */
async function shrinkImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1];
  } finally { URL.revokeObjectURL(url); }
}
C.aiFile = async (el) => {
  ui.aiText = document.getElementById('ai-text')?.value || ui.aiText;
  const list = (ui.aiFiles ||= []);
  for (const f of el.files || []) {
    try {
      if (f.type.startsWith('image/')) list.push({ name: f.name || 'foto.jpg', kind: 'image', media_type: 'image/jpeg', data: await shrinkImage(f) });
      else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        if (f.size > 15 * 1024 * 1024) { toast('PDF muito grande (máx. 15 MB)'); continue; }
        list.push({ name: f.name, kind: 'pdf', media_type: 'application/pdf', data: (await readAs(f, 'readAsDataURL')).split(',')[1] });
      } else {
        const text = await readAs(f, 'readAsText');
        list.push({ name: f.name, kind: 'text', text: String(text).slice(0, 200000) });
      }
    } catch { toast(`Não consegui ler ${f.name}`); }
  }
  el.value = ''; rerender();
};
A.aiRm = (el) => { ui.aiText = document.getElementById('ai-text')?.value || ''; ui.aiFiles.splice(Number(el.dataset.i), 1); rerender(); };
A.aiSend = async () => {
  const W = wp(); if (!W?.ia || ui.aiBusy) return;
  const text = document.getElementById('ai-text')?.value.trim() || '';
  const files = ui.aiFiles || [];
  if (!text && !files.length) return toast('Escreva algo ou anexe uma foto/arquivo');
  ui.aiText = text; ui.aiBusy = true; rerender();
  try {
    const res = await fetch(W.rest + 'financas-ia', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': W.nonce },
      body: JSON.stringify({ text, files, today: dateKey(), categories: F().categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind })) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
    ui.aiBusy = false;
    if (!data.entries?.length) { rerender(); return toast(data.message || 'A IA não encontrou lançamentos'); }
    rerender(); reviewSheet(data.entries, data.message);
  } catch (e) {
    ui.aiBusy = false; rerender(); toast(e.message || 'Não foi possível falar com a IA');
  }
};

const catOptions = (sel, kind) => ['despesa', 'receita'].filter((k) => !kind || k === kind).map((k) =>
  `<optgroup label="${k === 'despesa' ? 'Despesas' : 'Receitas'}">${cats(k).map((c) => opt(c.id, c.name, sel)).join('')}</optgroup>`).join('');

function reviewSheet(list, message) {
  sheet(`A IA encontrou ${list.length} lançamento${list.length > 1 ? 's' : ''}`, `<form class="form">
    ${message ? `<p class="ai-msg">✨ ${esc(message)}</p>` : ''}
    ${list.map((x, i) => `<fieldset class="rev ${x.kind === 'receita' ? 'in' : ''}">
      <label class="toggle-line"><input type="checkbox" name="inc" value="${i}" checked><span><b>Lançar este</b></span></label>
      <div class="row gap"><label class="field grow"><span>Tipo</span><select name="kind_${i}">${opt('despesa', 'Despesa', x.kind)}${opt('receita', 'Receita', x.kind)}</select></label>
        <label class="field grow"><span>Valor (R$)</span><input name="amount_${i}" inputmode="decimal" value="${esc(String(x.amount).replace('.', ','))}"></label></div>
      <label class="field"><span>Descrição</span><input name="desc_${i}" value="${esc(x.desc || '')}"></label>
      <div class="row gap"><label class="field grow"><span>Data</span><input type="date" name="date_${i}" value="${esc(x.date || dateKey())}"></label>
        <label class="field grow"><span>Categoria</span><select name="cat_${i}">${catOptions(x.cat)}</select></label></div>
      <div class="row gap"><label class="field grow"><span>Situação</span><select name="status_${i}">${opt('pago', x.kind === 'receita' ? 'Recebido' : 'Pago', x.status)}${opt('pendente', x.kind === 'receita' ? 'A receber' : 'A pagar', x.status)}</select></label>
        <label class="field grow"><span>Vencimento</span><input type="date" name="due_${i}" value="${esc(x.due || '')}"></label></div>
      ${x.note ? `<small class="muted">${esc(x.note)}</small><input type="hidden" name="note_${i}" value="${esc(x.note)}">` : ''}
    </fieldset>`).join('')}
    <button class="btn primary block">Salvar lançamentos</button></form>`, {
    onSubmit: (fd) => {
      const inc = fd.getAll('inc').map(Number);
      const out = inc.map((i) => ({ kind: fd.get(`kind_${i}`), amount: fd.get(`amount_${i}`), desc: fd.get(`desc_${i}`), date: fd.get(`date_${i}`),
        cat: fd.get(`cat_${i}`), status: fd.get(`status_${i}`), due: fd.get(`due_${i}`), note: fd.get(`note_${i}`) || '' }));
      const saved = addEntries(out, 'ia');
      ui.aiText = ''; ui.aiFiles = [];
      toast(`${saved.length} lançamento(s) salvo(s) 💜`);
      checkLimits(saved);
    },
  });
}

/* ---------------- limites ---------------- */
function checkLimits(changed) {
  const months = [...new Set(changed.filter((e) => e.kind === 'despesa').map(entryMonth))];
  for (const m of months) {
    const s = monthSummary(m);
    const tl = Number(F().totalLimit) || 0;
    if (tl && s.despesas > tl) return setTimeout(() => toast(`⚠️ Você passou do limite total do mês (${money(tl)})`), 900);
    for (const c of cats('despesa')) if (c.limit && (s.byCat[c.id] || 0) > c.limit && changed.some((e) => e.cat === c.id))
      return setTimeout(() => toast(`⚠️ Passou do limite de ${c.name} (${money(c.limit)})`), 900);
  }
}

/* ---------------- lançamento manual ---------------- */
function entrySheet(e, kind = 'despesa') {
  const isNew = !e || e._new;
  const x = e || { kind, amount: '', desc: '', date: dateKey(), cat: cats(kind)[0]?.id, status: 'pago', due: '', note: '' };
  sheet(isNew ? 'Novo lançamento' : 'Editar lançamento', `<form class="form">
    <div class="seg">${['despesa', 'receita'].map((k) => `<label><input type="radio" name="kind" value="${k}" ${x.kind === k ? 'checked' : ''}><span>${k === 'despesa' ? '➖ Despesa' : '➕ Receita'}</span></label>`).join('')}</div>
    <label class="field"><span>Valor (R$)</span><input name="amount" inputmode="decimal" required value="${x.amount ? esc(String(x.amount).replace('.', ',')) : ''}" placeholder="0,00"></label>
    <label class="field"><span>Descrição</span><input name="desc" value="${esc(x.desc)}" placeholder="Ex.: Mercado do mês"></label>
    <div class="row gap"><label class="field grow"><span>Data</span><input type="date" name="date" value="${x.date}"></label>
      <label class="field grow"><span>Categoria</span><select name="cat">${catOptions(x.cat)}</select></label></div>
    <div class="row gap"><label class="field grow"><span>Situação</span><select name="status">${opt('pago', 'Pago / recebido', x.status)}${opt('pendente', 'A pagar / a receber', x.status)}</select></label>
      <label class="field grow"><span>Vencimento</span><input type="date" name="due" value="${x.due || ''}"></label></div>
    <label class="field"><span>Observação</span><input name="note" value="${esc(x.note || '')}"></label>
    <button class="btn primary block">${isNew ? 'Lançar' : 'Salvar'}</button>
    ${isNew ? '' : '<button type="button" class="btn danger-ghost block" id="del-fin">Excluir lançamento</button>'}</form>`, {
    onMount: (root) => root.querySelector('#del-fin')?.addEventListener('click', () => confirmSheet('Excluir lançamento?', `"${x.desc}" será apagado.`, 'Excluir', () => {
      F().entries = F().entries.filter((q) => q !== e); save();
    })),
    onSubmit: (fd) => {
      const amount = parseMoney(fd.get('amount'));
      if (!amount) { toast('Coloque o valor'); return false; }
      const k = fd.get('kind');
      let c = fd.get('cat'); if (cat(c)?.kind !== k) c = cats(k).slice(-1)[0]?.id;
      const status = fd.get('status');
      const data = { kind: k, amount, desc: fd.get('desc').trim() || cat(c).name, date: fd.get('date') || dateKey(), cat: c, status,
        due: status === 'pendente' ? fd.get('due') || fd.get('date') : '', note: fd.get('note').trim() };
      if (isNew) { const [n] = addEntries([data]); checkLimits([n]); } else { Object.assign(e, data); save(); checkLimits([e]); }
      toast(isNew ? 'Lançado 💜' : 'Salvo');
    },
  });
}
A.finNew = (el) => entrySheet(undefined, el.dataset.k || 'despesa');
A.finEdit = (el) => entrySheet(F().entries.find((e) => e.id === el.dataset.id));
A.finPay = (el) => {
  const e = F().entries.find((q) => q.id === el.dataset.id); if (!e) return;
  e.status = 'pago'; e.date = dateKey() < (e.due || dateKey()) ? dateKey() : e.date; save();
  toast(e.kind === 'receita' ? 'Marcado como recebido ✓' : 'Conta paga ✓'); rerender();
};

/* ---------------- linhas ---------------- */
function row(e, { pay = false } = {}) {
  const c = cat(e.cat); const late = isLate(e);
  return `<li class="fin-row" data-act="finEdit" data-id="${e.id}"><span class="t-icon bg-soft-${c.color || 'violet'}">${c.icon || '📦'}</span>
    <div class="grow"><b>${esc(e.desc)}</b><small>${esc(c.name)}${e.status === 'pendente' ? ` · <span class="${late ? 'late-txt' : ''}">${late ? 'venceu' : 'vence'} ${fmtShort(e.due)}</span>` : ''}${e.src === 'ia' ? ' · ✨' : ''}</small></div>
    <div class="fin-amt"><b class="${e.kind === 'receita' ? 'in' : ''}">${e.kind === 'receita' ? '+' : '−'} ${money(e.amount)}</b>
    ${pay && e.status === 'pendente' ? `<button class="btn small ghost pay-btn" data-act="finPay" data-id="${e.id}">✓ ${e.kind === 'receita' ? 'Recebi' : 'Paguei'}</button>` : ''}</div></li>`;
}

/* ---------------- abas ---------------- */
function tabResumo(m) {
  const s = monthSummary(m);
  const tl = Number(F().totalLimit) || 0;
  const catsSpent = cats('despesa').map((c) => ({ c, v: s.byCat[c.id] || 0 })).filter((x) => x.v || x.c.limit).sort((a, b) => b.v - a.v);
  const max = Math.max(1, ...catsSpent.map((x) => Math.max(x.v, x.c.limit || 0)));
  const pend = F().entries.filter((e) => e.status === 'pendente').sort((a, b) => (a.due || '').localeCompare(b.due || '')).slice(0, 4);
  const year = m.slice(0, 4);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`).map((mm) => ({ mm, ...monthSummary(mm) })).filter((x) => x.entries.length);
  return `${aiCard()}
  <div class="stats three fin-stats">
    <div class="stat"><span>➕</span><b>${money(s.receitas)}</b><small>receitas</small></div>
    <div class="stat"><span>➖</span><b>${money(s.despesas)}</b><small>despesas</small></div>
    <div class="stat ${s.saldo < 0 ? 'neg' : ''}"><span>👛</span><b>${money(s.saldo)}</b><small>saldo</small></div>
  </div>
  ${s.aPagar || s.aReceber ? `<p class="small muted center">${s.aPagar ? `A pagar no mês: <b>${money(s.aPagar)}</b>` : ''}${s.aPagar && s.aReceber ? ' · ' : ''}${s.aReceber ? `A receber: <b>${money(s.aReceber)}</b>` : ''}</p>` : ''}
  ${tl ? `<section class="card"><div class="card-head"><h2>Limite do mês</h2><small>${money(s.despesas)} de ${money(tl)}</small></div>
    ${bar(s.despesas / tl, s.despesas > tl ? 'over' : '')}<small class="${s.despesas > tl ? 'late-txt' : 'muted'}">${s.despesas > tl ? `⚠️ Passou ${money(s.despesas - tl)} do limite` : `Ainda pode gastar ${money(tl - s.despesas)}`}</small></section>` : ''}
  <section class="card"><div class="card-head"><h2>Gastos por categoria</h2><button class="link" data-act="finTab" data-t="orc">Limites</button></div>
    ${catsSpent.length ? `<ul class="cat-bars">${catsSpent.map(({ c, v }) => `<li><span class="cb-ico bg-soft-${c.color}">${c.icon}</span>
      <div class="grow"><div class="row between"><b>${esc(c.name)}</b><small>${money(v)}${c.limit ? ` / ${money(c.limit)}` : ''}</small></div>
      <div class="cb-track"><i style="width:${(v / max) * 100}%" class="${c.limit && v > c.limit ? 'over' : ''}"></i>${c.limit ? `<em style="left:${(c.limit / max) * 100}%" title="limite"></em>` : ''}</div></div></li>`).join('')}</ul>`
      : '<p class="muted small">Nenhuma despesa neste mês ainda.</p>'}
  </section>
  <section class="card"><div class="card-head"><h2>Próximas contas</h2><button class="link" data-act="finTab" data-t="contas">Ver todas</button></div>
    ${pend.length ? `<ul class="fin-list">${pend.map((e) => row(e, { pay: true })).join('')}</ul>` : '<p class="muted small">Nada pendente 🎉</p>'}</section>
  ${months.length ? `<section class="card"><h2>${year} mês a mês</h2><table class="fin-table"><thead><tr><th>Mês</th><th>Receitas</th><th>Despesas</th><th>Saldo</th></tr></thead>
    <tbody>${months.map((x) => `<tr class="${x.mm === m ? 'cur' : ''}"><td>${monthLabel(x.mm).split(' ')[0].slice(0, 3)}</td><td>${money(x.receitas)}</td><td>${money(x.despesas)}</td><td class="${x.saldo < 0 ? 'late-txt' : ''}">${money(x.saldo)}</td></tr>`).join('')}</tbody></table></section>` : ''}`;
}

function tabLanc(m) {
  const f = ui.finFilter || 'todos';
  const q = (ui.finSearch || '').toLowerCase();
  const cf = ui.finCat || '';
  let es = F().entries.filter((e) => entryMonth(e) === m);
  if (f !== 'todos') es = es.filter((e) => e.kind === f);
  if (cf) es = es.filter((e) => e.cat === cf);
  if (q) es = es.filter((e) => `${e.desc} ${cat(e.cat).name} ${e.note || ''}`.toLowerCase().includes(q));
  const byDay = {};
  for (const e of es.sort((a, b) => (b.status === 'pendente' ? b.due : b.date).localeCompare(a.status === 'pendente' ? a.due : a.date))) (byDay[e.status === 'pendente' ? e.due : e.date] ||= []).push(e);
  return `${aiCard()}
  <div class="row gap"><button class="btn small primary grow" data-act="finNew" data-k="despesa">➖ Despesa</button><button class="btn small ghost grow" data-act="finNew" data-k="receita">➕ Receita</button></div>
  <div class="seg mt">${[['todos', 'Todos'], ['despesa', 'Despesas'], ['receita', 'Receitas']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="finFilter" data-f="${k}">${l}</button>`).join('')}</div>
  <div class="row gap fin-filters"><input class="grow search" placeholder="Buscar…" value="${esc(ui.finSearch || '')}" data-change="finSearch">
    <select class="mini-select" data-change="finCat">${opt('', 'Todas as categorias', cf)}${catOptions(cf)}</select></div>
  ${Object.keys(byDay).length ? Object.entries(byDay).map(([d, list]) => `<section class="card fin-day"><div class="card-head"><h2>${fmtShort(d)}</h2>
    <small>${money(list.reduce((a, e) => a + (e.kind === 'receita' ? 1 : -1) * e.amount, 0))}</small></div><ul class="fin-list">${list.map((e) => row(e, { pay: true })).join('')}</ul></section>`).join('')
    : empty('👛', 'Nenhum lançamento', 'Use a IA ou os botões acima para lançar.')}`;
}

function tabContas() {
  const today = dateKey(); const week = addDays(today, 7);
  const pend = F().entries.filter((e) => e.status === 'pendente').sort((a, b) => (a.due || '').localeCompare(b.due || ''));
  const groups = [['⚠️ Vencidas', pend.filter((e) => e.due < today)], ['Próximos 7 dias', pend.filter((e) => e.due >= today && e.due <= week)],
    ['Depois', pend.filter((e) => e.due > week)]];
  return `<div class="row gap"><button class="btn small primary grow" data-act="finNewBill">+ Conta fixa (todo mês)</button><button class="btn small ghost grow" data-act="finNewPending">+ Conta com vencimento</button></div>
  ${pend.length ? groups.filter(([, l]) => l.length).map(([t, l]) => `<section class="card"><div class="card-head"><h2>${t}</h2><small>${money(l.reduce((a, e) => a + e.amount, 0))}</small></div>
    <ul class="fin-list">${l.map((e) => row(e, { pay: true })).join('')}</ul></section>`).join('') : `<section class="card"><p class="muted center">Nenhuma conta pendente 🎉</p></section>`}
  <section class="card"><div class="card-head"><h2>Contas fixas</h2><small>entram sozinhas todo mês</small></div>
    ${F().bills.length ? `<ul class="fin-list">${F().bills.map((b) => { const c = cat(b.cat); return `<li class="fin-row ${b.active ? '' : 'is-paused'}" data-act="finBill" data-id="${b.id}"><span class="t-icon bg-soft-${c.color}">${c.icon}</span>
      <div class="grow"><b>${esc(b.desc)}</b><small>todo dia ${b.day} · ${esc(c.name)}${b.active ? '' : ' · pausada'}</small></div><div class="fin-amt"><b>${money(b.amount)}</b></div></li>`; }).join('')}</ul>`
      : '<p class="muted small">Cadastre aluguel, internet, luz, assinaturas… e o app cria a conta a pagar de cada mês.</p>'}</section>`;
}

function tabOrc(m) {
  const s = monthSummary(m);
  const tl = Number(F().totalLimit) || 0;
  return `<section class="card"><h2>Limite total do mês</h2>
    <div class="row gap"><label class="money-in grow"><span>R$</span><input inputmode="decimal" value="${tl ? String(tl).replace('.', ',') : ''}" placeholder="sem limite" data-change="finTotalLimit"></label></div>
    ${tl ? `${bar(s.despesas / tl, s.despesas > tl ? 'over' : '')}<small class="${s.despesas > tl ? 'late-txt' : 'muted'}">${money(s.despesas)} de ${money(tl)} em ${monthLabel(m)}</small>` : ''}</section>
  <section class="card"><div class="card-head"><h2>Limite por categoria</h2><button class="link" data-act="finCat" data-id="">+ Categoria</button></div>
    <p class="small muted">Deixe em branco para não ter limite. Toque no nome para editar a categoria.</p>
    <ul class="lim-list">${cats('despesa').map((c) => { const v = s.byCat[c.id] || 0; return `<li><span class="t-icon bg-soft-${c.color}" data-act="finCat" data-id="${c.id}">${c.icon}</span>
      <div class="grow"><b data-act="finCat" data-id="${c.id}">${esc(c.name)}</b><small>${money(v)} no mês</small>${c.limit ? bar(v / c.limit, v > c.limit ? 'over' : '') : ''}</div>
      <label class="money-in sm"><span>R$</span><input inputmode="decimal" value="${c.limit ? String(c.limit).replace('.', ',') : ''}" placeholder="—" data-change="finCatLimit" data-id="${c.id}"></label></li>`; }).join('')}</ul></section>
  <section class="card"><div class="card-head"><h2>Categorias de receita</h2><button class="link" data-act="finCat" data-id="" data-k="receita">+ Categoria</button></div>
    <ul class="mini-list">${cats('receita').map((c) => `<li data-act="finCat" data-id="${c.id}"><span class="t-icon bg-soft-${c.color}">${c.icon}</span><div class="grow"><b>${esc(c.name)}</b></div><span class="t-go">›</span></li>`).join('')}</ul></section>`;
}

function renderFinance() {
  const m = ui.finMonth || thisMonth();
  ensureBills(m); ensureBills(thisMonth()); ensureBills(shiftMonth(thisMonth(), 1));
  const tab = ui.finTab || 'resumo';
  const body = tab === 'lanc' ? tabLanc(m) : tab === 'contas' ? tabContas() : tab === 'orc' ? tabOrc(m) : tabResumo(m);
  return `<header class="page-head top"><h1>Finanças</h1><div class="ph-right"><button class="link" data-act="finNew" data-k="despesa">+ Lançar</button></div></header>
  <div class="seg fin-tabs">${Object.entries(TABS).map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="finTab" data-t="${k}">${l}</button>`).join('')}</div>
  ${tab !== 'contas' ? `<div class="rep-nav"><button class="icon-btn" data-act="finMonth" data-n="-1" aria-label="Mês anterior">‹</button><b>${monthLabel(m)}</b>
    <button class="icon-btn" data-act="finMonth" data-n="1" aria-label="Próximo mês">›</button></div>` : ''}
  ${body}`;
}

A.finTab = (el) => { ui.finTab = el.dataset.t; rerender(); window.scrollTo(0, 0); };
A.finMonth = (el) => { ui.finMonth = shiftMonth(ui.finMonth || thisMonth(), Number(el.dataset.n)); rerender(); };
A.finFilter = (el) => { ui.finFilter = el.dataset.f; rerender(); };
C.finSearch = (el) => { ui.finSearch = el.value; rerender(); };
C.finCat = (el) => { ui.finCat = el.value; rerender(); };
C.finTotalLimit = (el) => { F().totalLimit = parseMoney(el.value); save(); toast(F().totalLimit ? `Limite do mês: ${money(F().totalLimit)}` : 'Sem limite total'); rerender(); };
C.finCatLimit = (el) => { const c = cat(el.dataset.id); c.limit = parseMoney(el.value); save(); toast(c.limit ? `Limite de ${c.name}: ${money(c.limit)}` : `${c.name} sem limite`); rerender(); };

/* ---------------- categorias e contas fixas ---------------- */
A.finCat = (el) => {
  const c = F().categories.find((x) => x.id === el.dataset.id);
  const isNew = !c;
  const x = c || { name: '', icon: '📦', color: 'violet', kind: el.dataset.k || 'despesa', limit: 0 };
  sheet(isNew ? 'Nova categoria' : 'Editar categoria', `<form class="form">
    <div class="seg">${['despesa', 'receita'].map((k) => `<label><input type="radio" name="kind" value="${k}" ${x.kind === k ? 'checked' : ''}><span>${k === 'despesa' ? 'Despesa' : 'Receita'}</span></label>`).join('')}</div>
    <label class="field"><span>Nome</span><input name="name" required value="${esc(x.name)}" placeholder="Ex.: Farmácia"></label>
    <label class="field"><span>Limite por mês (opcional)</span><input name="limit" inputmode="decimal" value="${x.limit ? String(x.limit).replace('.', ',') : ''}" placeholder="R$"></label>
    <div class="field"><span>Ícone</span>${emojiGrid(x.icon)}</div>
    <div class="field"><span>Cor</span><div class="color-row">${COLORS.map((co) => `<label><input type="radio" name="color" value="${co}" ${co === x.color ? 'checked' : ''}><span class="dot bg-${co}"></span></label>`).join('')}</div></div>
    <button class="btn primary block">Salvar</button>
    ${isNew ? '' : '<button type="button" class="btn danger-ghost block" id="del-cat">Excluir categoria</button>'}</form>`, {
    onMount: (root) => root.querySelector('#del-cat')?.addEventListener('click', () => {
      const others = cats(c.kind).filter((q) => q !== c);
      if (!others.length) return toast('Precisa ter pelo menos uma categoria');
      const dest = others.find((q) => /outr/i.test(q.name)) || others[others.length - 1];
      confirmSheet('Excluir categoria?', `Os lançamentos de "${c.name}" vão para "${dest.name}".`, 'Excluir', () => {
        for (const e of F().entries) if (e.cat === c.id) e.cat = dest.id;
        for (const b of F().bills) if (b.cat === c.id) b.cat = dest.id;
        F().categories = F().categories.filter((q) => q !== c); save();
      });
    }),
    onSubmit: (fd) => {
      const data = { name: fd.get('name').trim(), kind: fd.get('kind'), icon: fd.get('icon') || x.icon, color: fd.get('color') || x.color, limit: parseMoney(fd.get('limit')) };
      if (!data.name) return false;
      if (isNew) F().categories.push({ id: uid(), ...data }); else Object.assign(c, data);
      save(); toast('Categoria salva');
    },
  });
};

function billSheet(b) {
  const isNew = !b;
  const x = b || { desc: '', amount: '', cat: 'fc-contas', day: 10, active: true, kind: 'despesa' };
  sheet(isNew ? 'Nova conta fixa' : 'Editar conta fixa', `<form class="form">
    <label class="field"><span>Conta</span><input name="desc" required value="${esc(x.desc)}" placeholder="Ex.: Internet, Aluguel, Academia"></label>
    <div class="row gap"><label class="field grow"><span>Valor (R$)</span><input name="amount" inputmode="decimal" required value="${x.amount ? String(x.amount).replace('.', ',') : ''}"></label>
      <label class="field grow"><span>Vence todo dia</span><input type="number" name="day" min="1" max="31" value="${x.day}"></label></div>
    <label class="field"><span>Categoria</span><select name="cat">${catOptions(x.cat, 'despesa')}</select></label>
    <label class="toggle-line"><input type="checkbox" name="active" ${x.active ? 'checked' : ''}><span>Ativa (cria a conta a pagar todo mês)</span></label>
    <button class="btn primary block">Salvar</button>
    ${isNew ? '' : '<button type="button" class="btn danger-ghost block" id="del-bill">Excluir conta fixa</button>'}</form>`, {
    onMount: (root) => root.querySelector('#del-bill')?.addEventListener('click', () => confirmSheet('Excluir conta fixa?', 'As contas já lançadas continuam no histórico.', 'Excluir', () => {
      F().bills = F().bills.filter((q) => q !== b); save();
    })),
    onSubmit: (fd) => {
      const amount = parseMoney(fd.get('amount'));
      if (!amount) { toast('Coloque o valor'); return false; }
      const data = { desc: fd.get('desc').trim(), amount, day: Math.min(31, Math.max(1, Number(fd.get('day')) || 1)), cat: fd.get('cat'), active: !!fd.get('active'), kind: 'despesa' };
      if (isNew) F().bills.push({ id: uid(), start: thisMonth(), ...data });
      else {
        Object.assign(b, data);
        for (const e of F().entries) if (e.billId === b.id && e.status === 'pendente') { e.amount = data.amount; e.desc = data.desc; e.cat = data.cat; }
      }
      save(); ensureBills(thisMonth()); toast('Conta fixa salva');
    },
  });
}
A.finNewBill = () => billSheet();
A.finBill = (el) => billSheet(F().bills.find((b) => b.id === el.dataset.id));
A.finNewPending = () => entrySheet({ kind: 'despesa', amount: '', desc: '', date: dateKey(), cat: 'fc-contas', status: 'pendente', due: addDays(dateKey(), 7), note: '', _new: true });

export const routes = { financas: { render: renderFinance, tab: 'financas' } };

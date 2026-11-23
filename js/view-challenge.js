// Desafio de 20 dias (editável, com histórico).
import { state, save } from './store.js';
import { esc, dateKey, addDays, fmtShort, fmtLong, uid, diffDays } from './utils.js';
import { A, sheet, rerender, toast, empty, ring, check, opt, confirmSheet, closeSheet } from './ui.js';
import { activeChallenge, challengeEnd, challengeDay, goalDone, dayScore, challengeStats, findTask, isDone, setDone } from './logic.js';

const level = (s) => (s >= 1 ? 3 : s >= 0.5 ? 2 : s > 0 ? 1 : 0);

function grid(c, today) {
  let cells = '';
  for (let i = 0; i < c.days; i++) {
    const d = addDays(c.startDate, i);
    const future = d > today;
    const s = future ? 0 : dayScore(c, d);
    cells += `<button class="cell l${level(s)} ${future ? 'future' : ''} ${d === today ? 'today' : ''}" data-act="chalDay" data-d="${d}" aria-label="Dia ${i + 1}">
      <b>${i + 1}</b>${!future && s >= 1 ? '<i>★</i>' : ''}</button>`;
  }
  return `<div class="chal-grid">${cells}</div>
  <div class="legend"><span><i class="cell-dot l0"></i>nada</span><span><i class="cell-dot l1"></i>começou</span><span><i class="cell-dot l2"></i>metade+</span><span><i class="cell-dot l3"></i>completo</span></div>`;
}

function goalsList(c, k) {
  return `<ul class="goals">${c.goals.map((g) => {
    const on = goalDone(c, g, k);
    const auto = g.link && !c.checks[k]?.[g.id] && on;
    const t = g.link === '__agua' ? { title: 'meta de água' } : g.link ? findTask(g.link) : null;
    return `<li class="${on ? 'done' : ''}">${check(on, 'goalToggle', `data-c="${c.id}" data-g="${g.id}" data-d="${k}"`, g.text)}
      <span>${esc(g.text)}${t ? ` <small class="muted">· ${auto ? 'marcado automaticamente' : 'ligado a "' + esc(t.title) + '"'}</small>` : ''}</span></li>`;
  }).join('')}</ul>`;
}

function renderChallenge() {
  const today = dateKey();
  const c = activeChallenge();
  const hist = state.challenges.filter((x) => x.archived).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const histHtml = hist.length ? `<section class="card"><h2>Desafios anteriores</h2><ul class="mini-list">${hist.map((x) => {
    const st = challengeStats(x, challengeEnd(x) < today ? challengeEnd(x) : today);
    return `<li data-act="chalHist" data-id="${x.id}"><div class="grow"><b>${esc(x.name)}</b><small>${fmtShort(x.startDate)} – ${fmtShort(challengeEnd(x))} · ${x.days} dias · ${st.perfect} dias perfeitos</small></div>
      <span class="badge bg-soft-violet">${Math.round(st.overall * 100)}%</span></li>`;
  }).join('')}</ul></section>` : '';
  if (!c) return `<header class="page-head top"><h1>Desafio</h1></header>
    ${empty('🎯', 'Nenhum desafio ativo', 'Crie um desafio de 20 dias com as metas que você quer cumprir todos os dias.', '<button class="btn primary" data-act="chalNew">+ Criar desafio</button>')}${histHtml}`;
  const st = challengeStats(c, today);
  const d = challengeDay(c, today);
  const notStarted = d < 1;
  const status = st.finished ? 'Concluído 🎉' : notStarted ? `Começa ${fmtShort(c.startDate)}` : `Dia ${d} de ${c.days}`;
  return `<header class="page-head"><a class="back" href="#/metas" aria-label="Voltar">‹</a><h1>Desafio</h1><div class="ph-right"><button class="link" data-act="chalEdit">Editar</button></div></header>
  <section class="card hero-chal-card bg-grad-violet">
    <div class="grow"><small>${fmtShort(c.startDate)} – ${fmtShort(challengeEnd(c))}</small><h2>${esc(c.name)}</h2><span class="pill glass">${status}</span></div>
    ${ring(st.finished ? st.overall : (notStarted ? 0 : (d - 1 + dayScore(c, today)) / c.days), { size: 96, stroke: 10, label: `${Math.round((st.finished ? st.overall : st.elapsed / c.days) * 100)}%`, sub: st.finished ? 'aproveit.' : 'do tempo', cls: 'light' })}
  </section>
  ${st.finished ? `<section class="card done-card"><h2>Você chegou ao fim! 🏆</h2>
    <p>Aproveitamento de <b>${Math.round(st.overall * 100)}%</b> e <b>${st.perfect}</b> dia(s) perfeito(s) de ${c.days}.</p>
    <div class="row gap"><button class="btn primary grow" data-act="chalNew">+ Novo desafio</button><button class="btn ghost grow" data-act="chalEdit">Editar / estender</button></div></section>` : ''}
  <div class="stats three">
    <div class="stat"><span>★</span><b>${st.perfect}</b><small>dias perfeitos</small></div>
    <div class="stat"><span>🔥</span><b>${st.streak}</b><small>sequência</small></div>
    <div class="stat"><span>📈</span><b>${Math.round(st.avg * 100)}%</b><small>média diária</small></div>
  </div>
  <section class="card"><div class="card-head"><h2>Calendário do desafio</h2></div>${grid(c, today)}</section>
  ${!st.finished && !notStarted ? `<section class="card"><div class="card-head"><h2>Metas de hoje</h2><span class="small muted">${Math.round(dayScore(c, today) * 100)}%</span></div>${goalsList(c, today)}</section>` : ''}
  ${!st.finished ? '<button class="btn ghost block" data-act="chalNew">Começar outro desafio</button>' : ''}
  ${histHtml}`;
}

A.chalDay = (el) => {
  const c = activeChallenge(); const k = el.dataset.d;
  if (k > dateKey()) return toast('Esse dia ainda não chegou 😉');
  sheet(`Dia ${challengeDay(c, k)} · ${fmtLong(k)}`, `${goalsList(c, k).replace(/data-act="goalToggle"/g, 'data-act="goalToggleSheet"')}`);
};
A.goalToggleSheet = (el) => {
  const c = state.challenges.find((x) => x.id === el.dataset.c); const g = c.goals.find((x) => x.id === el.dataset.g); const k = el.dataset.d;
  const day = (c.checks[k] ||= {});
  if (goalDone(c, g, k)) { delete day[g.id]; if (g.link) { const t = findTask(g.link); if (t && isDone(t, k)) setDone(t, k, false); } }
  else day[g.id] = true;
  save(); rerender(); A.chalDay({ dataset: { d: k } });
};

function goalRow(g = { id: '', text: '', link: '' }) {
  return `<div class="goal-edit"><input type="hidden" name="gid" value="${esc(g.id)}">
    <input name="gtext" value="${esc(g.text)}" placeholder="Ex.: Beber 2L de água">
    <select name="glink" aria-label="Ligar à rotina">${opt('', 'Marcar manualmente', g.link || '')}${opt('__agua', 'Auto: meta de água', g.link || '')}${state.routine.map((r) => opt(r.id, `Auto: ${r.icon} ${r.title}`, g.link || '')).join('')}</select>
    <button type="button" class="icon-btn sm" data-rm aria-label="Remover meta">✕</button></div>`;
}

function chalSheet(c, { copyFrom } = {}) {
  const isNew = !c;
  const base = c || { name: 'Desafio 20 dias', startDate: dateKey(), days: 20, goals: copyFrom ? copyFrom.goals.map((g) => ({ ...g, id: '' })) : [] };
  sheet(isNew ? 'Novo desafio' : 'Editar desafio', `<form class="form">
    <label class="field"><span>Nome do desafio</span><input name="name" required value="${esc(base.name)}"></label>
    <div class="row gap"><label class="field grow"><span>Começa em</span><input type="date" name="start" required value="${base.startDate}"></label>
    <label class="field grow"><span>Duração (dias)</span><input type="number" name="days" min="1" max="365" required value="${base.days}"></label></div>
    <div class="field"><span>Metas diárias <small class="muted">(ligue a uma tarefa da rotina para marcar sozinha)</small></span>
      <div id="goals">${(base.goals.length ? base.goals : [undefined]).map((g) => goalRow(g)).join('')}</div>
      <button type="button" class="btn small ghost mt" id="add-goal">+ Meta</button></div>
    <button class="btn primary block mt">${isNew ? 'Começar desafio 🚀' : 'Salvar'}</button>
    ${isNew ? '' : '<button type="button" class="btn danger-ghost block" id="del-chal">Excluir desafio</button>'}</form>`, {
    onMount: (root) => {
      const box = root.querySelector('#goals');
      root.querySelector('#add-goal').addEventListener('click', () => { box.insertAdjacentHTML('beforeend', goalRow()); box.lastElementChild.querySelector('[name=gtext]').focus(); });
      box.addEventListener('click', (e) => { if (e.target.closest('[data-rm]')) e.target.closest('.goal-edit').remove(); });
      root.querySelector('#del-chal')?.addEventListener('click', () => confirmSheet('Excluir desafio?', 'Todo o progresso deste desafio será apagado.', 'Excluir', () => {
        state.challenges = state.challenges.filter((x) => x !== c);
        if (state.activeChallengeId === c.id) state.activeChallengeId = null;
        save();
      }));
    },
    onSubmit: (fd) => {
      const ids = fd.getAll('gid'), texts = fd.getAll('gtext'), links = fd.getAll('glink');
      const goals = texts.map((t, i) => ({ id: ids[i] || uid(), text: t.trim(), link: links[i] || null })).filter((g) => g.text);
      if (!goals.length) { toast('Adicione pelo menos uma meta'); return false; }
      const data = { name: fd.get('name').trim(), startDate: fd.get('start'), days: Math.max(1, Number(fd.get('days')) || 20), goals };
      if (isNew) {
        const cur = activeChallenge(); if (cur) cur.archived = true;
        const nc = { id: uid(), ...data, checks: {}, archived: false };
        state.challenges.push(nc); state.activeChallengeId = nc.id;
        toast('Desafio criado! Bora! 🚀');
      } else { Object.assign(c, data); toast('Desafio atualizado'); }
      save();
    },
  });
}
A.chalEdit = () => chalSheet(activeChallenge());
A.chalNew = () => {
  const cur = activeChallenge() || state.challenges.filter((x) => x.archived).slice(-1)[0];
  if (!cur) return chalSheet(undefined);
  sheet('Novo desafio', `<p class="muted">${activeChallenge() ? 'O desafio atual vai para o histórico. ' : ''}Quer reaproveitar as metas de "${esc(cur.name)}"?</p>
    <button class="btn primary block" data-act="chalNewCopy">Sim, copiar as metas</button>
    <button class="btn ghost block" data-act="chalNewBlank">Não, começar do zero</button>`);
};
A.chalNewCopy = () => chalSheet(undefined, { copyFrom: activeChallenge() || state.challenges.filter((x) => x.archived).slice(-1)[0] });
A.chalNewBlank = () => chalSheet(undefined);
A.chalHist = (el) => {
  const c = state.challenges.find((x) => x.id === el.dataset.id);
  const end = challengeEnd(c);
  const st = challengeStats(c, end < dateKey() ? end : dateKey());
  sheet(c.name, `<p class="muted">${fmtShort(c.startDate)} – ${fmtShort(end)} · ${Math.round(st.overall * 100)}% de aproveitamento · ${st.perfect} dias perfeitos</p>
    ${grid(c, end < dateKey() ? end : dateKey()).replace(/data-act="chalDay"/g, 'data-act="noop"')}
    <p class="small muted mt">Metas: ${c.goals.map((g) => esc(g.text)).join(' · ')}</p>
    <button class="btn ghost block" data-act="chalReactivate" data-id="${c.id}">Reativar este desafio</button>
    <button class="btn danger-ghost block" data-act="chalDelHist" data-id="${c.id}">Excluir do histórico</button>`);
};
A.chalReactivate = (el) => {
  const cur = activeChallenge(); if (cur) cur.archived = true;
  const c = state.challenges.find((x) => x.id === el.dataset.id); c.archived = false; state.activeChallengeId = c.id;
  save(); closeSheet(); rerender(); toast('Desafio reativado — você pode editar as datas');
};
A.chalDelHist = (el) => { state.challenges = state.challenges.filter((x) => x.id !== el.dataset.id); save(); closeSheet(); rerender(); };

export const routes = { desafio: { render: renderChallenge, tab: 'metas' } };

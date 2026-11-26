// Metas de longo prazo (com o Desafio de 20 dias dentro).
import { state, save } from './store.js';
import { esc, dateKey, addDays, diffDays, weekStart, fmtShort, fmtLong, fmtMinutes, uid, parseKey } from './utils.js';
import { A, C, ui, sheet, rerender, toast, empty, opt, bar, ring, confirmSheet, go } from './ui.js';
import { activeChallenge, challengeDay, challengeEnd, challengeStats, dayScore, isTaskIdDone, waterTotal, findTask } from './logic.js';
import { emojiGrid } from './forms.js';
import { COLORS } from './defaults.js';
import { money } from './finance.js';

/* ================= METAS ================= */
export const GOAL_KINDS = {
  manual: { label: 'Do meu jeito (eu anoto o progresso)', unit: '' },
  economia: { label: 'Guardar dinheiro (R$)', unit: 'R$' },
  livros: { label: 'Livros lidos (automático)', unit: 'livros' },
  estudo: { label: 'Horas de estudo (automático)', unit: 'h' },
  ingles: { label: 'Horas de inglês (automático)', unit: 'h' },
  tarefa: { label: 'Dias cumprindo uma tarefa (automático)', unit: 'dias' },
  agua: { label: 'Dias batendo a meta de água (automático)', unit: 'dias' },
};
const G = () => (state.goals ||= []);
const fmtVal = (g, v) => (g.kind === 'economia' ? money(v) : `${Math.round(v * 10) / 10} ${g.kind === 'manual' ? g.unit || '' : GOAL_KINDS[g.kind].unit}`.trim());

export function goalProgress(g) {
  const start = g.start || dateKey(); const end = dateKey() < (g.deadline || '9999') ? dateKey() : g.deadline;
  const inRange = (d) => d >= start && d <= end;
  const secs = (arr) => (arr || []).filter((x) => inRange(x.date)).reduce((a, x) => a + (x.seconds || 0), 0) / 3600;
  let cur = 0;
  if (g.kind === 'manual' || g.kind === 'economia') cur = (g.log || []).reduce((a, x) => a + (Number(x.v) || 0), 0);
  else if (g.kind === 'livros') cur = state.books.filter((b) => b.finished && inRange(b.finished)).length;
  else if (g.kind === 'estudo') cur = secs(state.study?.sessions);
  else if (g.kind === 'ingles') cur = secs(state.english?.sessions);
  else if (g.kind === 'tarefa' || g.kind === 'agua') {
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (g.kind === 'agua' ? waterTotal(d) >= state.water.goal : isTaskIdDone(g.taskId, d)) cur++;
    }
  }
  const target = Number(g.target) || 1;
  const pct = Math.max(0, Math.min(1, cur / target));
  let pace = '';
  if (g.deadline && pct < 1) {
    const daysLeft = diffDays(dateKey(), g.deadline);
    if (daysLeft < 0) pace = 'prazo encerrado';
    else {
      const per = (target - cur) / Math.max(1, daysLeft / 7);
      pace = `faltam ${daysLeft} dia${daysLeft === 1 ? '' : 's'} · ~${fmtVal(g, Math.ceil(per * 10) / 10)} por semana`;
    }
  }
  return { cur, target, pct, pace };
}

function goalCard(g) {
  const p = goalProgress(g);
  return `<article class="card goal ${g.done || p.pct >= 1 ? 'done' : ''}" data-act="goalOpen" data-id="${g.id}">
    <div class="goal-top"><span class="t-icon bg-soft-${g.color || 'violet'}">${g.icon || '🎯'}</span>
      <div class="grow"><b>${esc(g.title)}</b><small>${fmtVal(g, p.cur)} de ${fmtVal(g, p.target)}${g.deadline ? ` · até ${fmtShort(g.deadline)}` : ''}</small></div>
      <b class="goal-pct">${Math.round(p.pct * 100)}%</b></div>
    ${bar(p.pct)}${p.pct >= 1 ? '<small class="goal-ok">🏆 Meta alcançada!</small>' : p.pace ? `<small>${p.pace}</small>` : ''}
  </article>`;
}

function challengeBlock() {
  const c = activeChallenge();
  if (!c) return `<section class="card chal-mini"><div class="goal-top"><span class="t-icon bg-soft-pink">🔥</span><div class="grow"><b>Desafio</b>
    <small>Nenhum desafio ativo. Crie um desafio de 20 dias para criar constância.</small></div></div>
    <button class="btn small primary block" data-act="chalNew">+ Criar desafio</button></section>`;
  const st = challengeStats(c); const d = challengeDay(c);
  return `<a class="card chal-mini" href="#/desafio"><div class="goal-top"><span class="t-icon bg-soft-pink">🔥</span>
    <div class="grow"><b>${esc(c.name)}</b><small>${st.finished ? 'Concluído 🎉' : d < 1 ? `começa ${fmtShort(c.startDate)}` : `dia ${d} de ${c.days} · hoje ${Math.round(dayScore(c, dateKey()) * 100)}%`}</small></div><span class="t-go">›</span></div>
    ${bar(st.finished ? st.overall : Math.max(0, d - 1) / c.days)}<small>${st.perfect} dia(s) perfeito(s) · sequência ${st.streak}</small></a>`;
}

function renderGoals() {
  const list = G();
  const open = list.filter((g) => !g.done && goalProgress(g).pct < 1);
  const done = list.filter((g) => g.done || goalProgress(g).pct >= 1);
  return `<header class="page-head top"><h1>Metas</h1><div class="ph-right"><button class="link" data-act="goalNew">+ Meta</button></div></header>
  <p class="sub">Objetivos maiores do mês ou do ano, e o seu desafio de constância.</p>
  <h3 class="sec-title">Desafio</h3>${challengeBlock()}
  <h3 class="sec-title">Metas em andamento</h3>
  ${open.length ? open.map(goalCard).join('') : empty('🎯', 'Nenhuma meta ainda', 'Ex.: ler 12 livros no ano, guardar R$ 5.000, 100 horas de inglês, treinar 150 dias.', '<button class="btn primary" data-act="goalNew">+ Criar meta</button>')}
  ${done.length ? `<h3 class="sec-title">Alcançadas 🏆</h3>${done.map(goalCard).join('')}` : ''}
`;
}

function goalSheet(g) {
  const isNew = !g;
  const x = g || { title: '', icon: '🎯', color: 'violet', kind: 'manual', target: '', unit: '', start: dateKey(), deadline: `${dateKey().slice(0, 4)}-12-31`, taskId: '', notes: '' };
  sheet(isNew ? 'Nova meta' : 'Editar meta', `<form class="form">
    <label class="field"><span>Meta</span><input name="title" required value="${esc(x.title)}" placeholder="Ex.: Ler 12 livros em 2026"></label>
    <label class="field"><span>Como medir</span><select name="kind" id="g-kind">${Object.entries(GOAL_KINDS).map(([k, v]) => opt(k, v.label, x.kind)).join('')}</select></label>
    <label class="field" id="g-task"><span>Qual tarefa</span><select name="taskId">${state.routine.map((r) => opt(r.id, r.title, x.taskId)).join('')}</select></label>
    <div class="row gap"><label class="field grow"><span>Alvo</span><input name="target" inputmode="decimal" required value="${esc(String(x.target || ''))}" placeholder="Ex.: 12"></label>
      <label class="field grow" id="g-unit"><span>Unidade</span><input name="unit" value="${esc(x.unit || '')}" placeholder="Ex.: kg, vezes, km"></label></div>
    <div class="row gap"><label class="field grow"><span>Começa em</span><input type="date" name="start" value="${x.start}"></label>
      <label class="field grow"><span>Prazo</span><input type="date" name="deadline" value="${x.deadline || ''}"></label></div>
    <label class="field"><span>Por que essa meta importa? (opcional)</span><textarea name="notes" rows="2">${esc(x.notes || '')}</textarea></label>
    <div class="field"><span>Ícone</span>${emojiGrid(x.icon)}</div>
    <div class="field"><span>Cor</span><div class="color-row">${COLORS.map((c) => `<label><input type="radio" name="color" value="${c}" ${c === x.color ? 'checked' : ''}><span class="dot bg-${c}"></span></label>`).join('')}</div></div>
    <button class="btn primary block">Salvar meta</button>
    ${isNew ? '' : '<button type="button" class="btn danger-ghost block" id="del-goal">Excluir meta</button>'}</form>`, {
    onMount: (root) => {
      const sync = () => { const k = root.querySelector('#g-kind').value; root.querySelector('#g-task').hidden = k !== 'tarefa'; root.querySelector('#g-unit').hidden = k !== 'manual'; };
      root.querySelector('#g-kind').addEventListener('change', sync); sync();
      root.querySelector('#del-goal')?.addEventListener('click', () => confirmSheet('Excluir meta?', `"${x.title}" e o histórico dela serão apagados.`, 'Excluir', () => { state.goals = G().filter((q) => q !== g); save(); }));
    },
    onSubmit: (fd) => {
      const target = Number(String(fd.get('target')).replace(/\./g, '').replace(',', '.'));
      if (!fd.get('title').trim() || !target) { toast('Coloque o nome e o alvo'); return false; }
      const data = { title: fd.get('title').trim(), kind: fd.get('kind'), target, unit: fd.get('unit').trim(), start: fd.get('start') || dateKey(),
        deadline: fd.get('deadline') || '', taskId: fd.get('taskId') || '', notes: fd.get('notes').trim(), icon: fd.get('icon') || x.icon, color: fd.get('color') || x.color };
      if (isNew) G().push({ id: uid(), ...data, log: [], done: false }); else Object.assign(g, data);
      save(); toast('Meta salva 🎯');
    },
  });
}

function goalDetail(g) {
  const p = goalProgress(g); const manual = g.kind === 'manual' || g.kind === 'economia';
  sheet(g.title, `<div class="goal-detail">
    <div class="row gap center">${ring(p.pct, { size: 96, stroke: 10, label: `${Math.round(p.pct * 100)}%`, sub: 'da meta' })}
      <div class="grow"><b>${fmtVal(g, p.cur)}</b><small>de ${fmtVal(g, p.target)}</small>${p.pace ? `<small>${p.pace}</small>` : ''}${g.notes ? `<p class="note">${esc(g.notes)}</p>` : ''}</div></div>
    ${manual ? `<form class="form goal-add"><div class="row gap"><label class="field grow"><span>${g.kind === 'economia' ? 'Guardei (R$)' : `Adicionar (${esc(g.unit || 'quantidade')})`}</span>
      <input name="v" inputmode="decimal" required placeholder="Ex.: ${g.kind === 'economia' ? '200,00' : '1'}"></label>
      <label class="field grow"><span>Anotação</span><input name="note" placeholder="opcional"></label></div><button class="btn primary block">+ Adicionar progresso</button></form>
      ${(g.log || []).length ? `<ul class="mini-list">${[...g.log].reverse().slice(0, 12).map((l, i) => `<li><div class="grow"><b>${fmtVal(g, l.v)}</b><small>${fmtShort(l.date)}${l.note ? ' · ' + esc(l.note) : ''}</small></div>
        <button class="icon-btn sm" data-act="goalLogDel" data-id="${g.id}" data-i="${g.log.length - 1 - i}" aria-label="Apagar">✕</button></li>`).join('')}</ul>` : ''}`
      : '<p class="small muted">Esta meta é calculada sozinha a partir do que você registra no app.</p>'}
    <div class="row gap mt"><button class="btn ghost grow" data-act="goalEdit" data-id="${g.id}">✎ Editar</button>
      <button class="btn ghost grow" data-act="goalDone" data-id="${g.id}">${g.done ? 'Reabrir' : '🏆 Concluir'}</button></div></div>`, {
    onSubmit: (fd) => {
      const v = Number(String(fd.get('v')).replace(/\./g, '').replace(',', '.'));
      if (!v) return false;
      (g.log ||= []).push({ date: dateKey(), v, note: fd.get('note').trim() });
      save();
      const np = goalProgress(g); toast(np.pct >= 1 ? '🏆 Meta alcançada! Parabéns!' : `+${fmtVal(g, v)} 💜`);
    },
  });
}
const goalById = (id) => G().find((g) => g.id === id);
A.goalNew = () => goalSheet();
A.goalOpen = (el) => goalDetail(goalById(el.dataset.id));
A.goalEdit = (el) => goalSheet(goalById(el.dataset.id));
A.goalDone = (el) => { const g = goalById(el.dataset.id); g.done = !g.done; save(); A.closeSheet(); rerender(); toast(g.done ? '🏆 Meta concluída!' : 'Meta reaberta'); };
A.goalLogDel = (el) => { const g = goalById(el.dataset.id); g.log.splice(Number(el.dataset.i), 1); save(); goalDetail(g); rerender(); };

/** tile das metas para a tela inicial */
export function goalsTile() {
  const open = G().filter((g) => !g.done).map((g) => ({ g, p: goalProgress(g) })).filter((x) => x.p.pct < 1).sort((a, b) => (a.g.deadline || '9').localeCompare(b.g.deadline || '9'))[0];
  if (!open) return `<a class="tile t-violet" href="#/metas"><span class="tile-ico">🎯</span><div><b>Metas</b><small>${G().length ? 'todas alcançadas 🏆' : 'crie sua primeira meta'}</small></div></a>`;
  return `<a class="tile t-violet" href="#/metas"><span class="tile-ico ic-${open.g.color || 'violet'}">${open.g.icon || '🎯'}</span><div><b>${esc(open.g.title)}</b>
    <small>${fmtVal(open.g, open.p.cur)} de ${fmtVal(open.g, open.p.target)}</small>${bar(open.p.pct)}</div></a>`;
}

export const routes = {
  metas: { render: renderGoals, tab: 'metas' },
  // a revisão semanal saiu: links antigos abrem as Metas
  revisao: { render: () => { setTimeout(() => location.replace('#/metas'), 0); return ''; }, tab: 'metas' },
};

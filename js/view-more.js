// Aba "Mais": rotina fixa, treinos, perfil, backup e instalação.
import { state, save, replaceState, resetState } from './store.js';
import { esc, WD, WD_FULL, dateKey, uid } from './utils.js';
import { A, C, ui, sheet, rerender, toast, pageHead, opt, confirmSheet, go } from './ui.js';
import { taskSheet } from './forms.js';
import { COLORS, TASK_TYPES } from './defaults.js';
import { toMin } from './utils.js';

const item = (href, icon, title, sub, color = 'rose') => `<a class="menu-item" href="${href}"><span class="t-icon bg-soft-${color}">${icon}</span>
  <div class="grow"><b>${title}</b><small>${sub}</small></div><span class="t-go">›</span></a>`;

function renderMore() {
  return `<header class="page-head top"><h1>Mais</h1></header>
  <section class="card menu">
    ${item('#/rotina', '🗓️', 'Rotina fixa', 'Horários, dias da semana e tarefas da casa', 'violet')}
    ${item('#/treinos', '🏋️‍♀️', 'Treinos', 'Plano da semana e exercícios', 'rose')}
    ${item('#/produtos', '🛍️', 'Meus produtos', 'Skincare, cabelo e o que mais você usa', 'pink')}
    ${item('#/cabelo-edit', '💇‍♀️', 'Cronograma capilar', 'Frequência, ciclo de máscaras e passos', 'sky')}
    ${item('#/skincare-edit', '🧴', 'Passos do skincare', 'Manhã e noite', 'emerald')}
  </section>
  <section class="card menu">
    ${item('#/config', '⚙️', 'Perfil e backup', 'Seu nome, salvar e restaurar dados', 'slate')}
    ${item('#/instalar', '📲', 'Instalar no iPhone', 'Coloque o app na tela de início', 'amber')}
  </section>
  <p class="center small muted">Minha Rotina · seus dados ficam salvos só neste aparelho</p>`;
}

/* ---------- Rotina fixa ---------- */
function renderRoutine() {
  const sorted = [...state.routine].sort((a, b) => toMin(a.time) - toMin(b.time));
  const dayFilter = ui.routineFilter ?? -1;
  const list = dayFilter < 0 ? sorted : sorted.filter((r) => r.days.includes(dayFilter));
  return `${pageHead('Rotina fixa', '#/mais', '<button class="link" data-act="routineNew">+ Tarefa</button>')}
  <p class="sub">Essas tarefas aparecem automaticamente nos dias escolhidos. Toque para editar.</p>
  <div class="chips scroll">${[[-1, 'Todos'], ...[1, 2, 3, 4, 5, 6, 0].map((d) => [d, WD[d]])].map(([d, l]) =>
    `<button class="chip ${d === dayFilter ? 'on' : ''}" data-act="routineFilter" data-d="${d}">${l}</button>`).join('')}</div>
  <ul class="list routine">${list.map((r) => `<li data-act="routineEdit" data-id="${r.id}">
    <span class="t-time">${esc(r.time || '—')}</span><span class="t-icon bg-soft-${r.color || 'rose'}">${r.icon}</span>
    <div class="grow"><b>${esc(r.title)}</b><small>${r.days.length === 7 ? 'Todos os dias' : r.days.map((d) => WD[d]).join(r.flexWeekly ? ' ou ' : ', ')}${r.end ? ` · até ${r.end}` : ''}${r.type !== 'normal' ? ' · ' + TASK_TYPES[r.type].split(' (')[0] : ''}</small></div>
    <span class="t-go">›</span></li>`).join('')}</ul>
  <button class="btn primary block" data-act="routineNew">+ Nova tarefa fixa</button>`;
}
A.routineFilter = (el) => { ui.routineFilter = Number(el.dataset.d); rerender(); };
A.routineEdit = (el) => taskSheet(state.routine.find((r) => r.id === el.dataset.id));
A.routineNew = () => taskSheet(undefined, { defaultRepeat: 'routine' });

/* ---------- Treinos ---------- */
function renderWorkouts() {
  const W = state.workouts;
  return `${pageHead('Treinos', '#/mais', '<button class="link" data-act="workoutNew">+ Treino</button>')}
  <section class="card"><h2>Plano da semana</h2><p class="small muted">Escolha o treino fixo de cada dia. No dia, ele aparece no "Hoje".</p>
    ${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="plan-row"><span>${WD_FULL[d]}</span><select data-change="planSet" data-d="${d}">
      ${opt('', 'Descanso 😴', W.plan[d] || '')}${W.list.map((w) => opt(w.id, w.name, W.plan[d] || '')).join('')}</select></label>`).join('')}
  </section>
  <section><div class="card-head pad"><h2>Meus treinos</h2></div>
  ${W.list.map((w) => `<a class="card care-card" href="#/treino-edit?id=${w.id}"><span class="t-icon bg-soft-${w.color}">🏋️‍♀️</span>
    <div class="grow"><b>${esc(w.name)}</b><small>${w.exercises.length} exercícios · ${Object.entries(W.plan).filter(([, v]) => v === w.id).map(([d]) => WD[d]).join(', ') || 'fora do plano'}</small></div><span class="t-go">›</span></a>`).join('')}
  </section>`;
}
C.planSet = (el) => { state.workouts.plan[el.dataset.d] = el.value || null; save(); toast('Plano atualizado'); rerender(); };
A.workoutNew = () => sheet('Novo treino', `<form class="form">
  <label class="field"><span>Nome</span><input name="name" required placeholder="Ex.: Quadríceps"></label>
  <button class="btn primary block">Criar</button></form>`, {
  onSubmit: (fd) => { const w = { id: uid(), name: fd.get('name').trim(), color: COLORS[state.workouts.list.length % COLORS.length], exercises: [] };
    state.workouts.list.push(w); save(); setTimeout(() => go(`#/treino-edit?id=${w.id}`)); },
});

function renderWorkoutEdit(p) {
  const w = state.workouts.list.find((x) => x.id === p.get('id'));
  if (!w) return `${pageHead('Treino', '#/treinos')}<p>Treino não encontrado.</p>`;
  return `${pageHead('Editar treino', '#/treinos')}
  <section class="card">
    <label class="field"><span>Nome do treino</span><input value="${esc(w.name)}" data-change="wName" data-w="${w.id}"></label>
    <div class="field"><span>Cor</span><div class="color-row">${COLORS.map((c) => `<button class="${c === w.color ? 'sel' : ''}" data-act="wColor" data-w="${w.id}" data-c="${c}" aria-label="${c}"><span class="dot bg-${c}"></span></button>`).join('')}</div></div>
  </section>
  <section class="card"><div class="card-head"><h2>Exercícios</h2><button class="link" data-act="exEdit" data-w="${w.id}">+ Exercício</button></div>
  <ol class="list steps">${w.exercises.map((e, i) => `<li><div class="grow" data-act="exEdit" data-w="${w.id}" data-e="${e.id}"><b>${esc(e.name)}</b>
    <small>${e.sets} × ${esc(e.reps)}${e.load ? ' · ' + esc(e.load) : ''}${e.notes ? ' · ' + esc(e.notes) : ''}</small></div>
    <div class="reorder"><button class="icon-btn sm" data-act="exMove" data-w="${w.id}" data-i="${i}" data-n="-1" aria-label="Subir">↑</button>
    <button class="icon-btn sm" data-act="exMove" data-w="${w.id}" data-i="${i}" data-n="1" aria-label="Descer">↓</button></div></li>`).join('') || '<p class="muted">Nenhum exercício ainda.</p>'}</ol></section>
  <button class="btn danger-ghost block" data-act="wDel" data-w="${w.id}">Excluir treino</button>`;
}
const W = (id) => state.workouts.list.find((x) => x.id === id);
C.wName = (el) => { W(el.dataset.w).name = el.value.trim() || 'Treino'; save(); toast('Nome salvo'); };
A.wColor = (el) => { W(el.dataset.w).color = el.dataset.c; save(); rerender(); };
A.exMove = (el) => { const l = W(el.dataset.w).exercises; const i = Number(el.dataset.i), j = i + Number(el.dataset.n); if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; save(); rerender(); };
A.wDel = (el) => confirmSheet('Excluir treino?', 'Ele também sai do plano da semana.', 'Excluir', () => {
  const id = el.dataset.w;
  state.workouts.list = state.workouts.list.filter((x) => x.id !== id);
  for (const d of Object.keys(state.workouts.plan)) if (state.workouts.plan[d] === id) state.workouts.plan[d] = null;
  save(); go('#/treinos');
});
A.exEdit = (el) => {
  const w = W(el.dataset.w); const e = w.exercises.find((x) => x.id === el.dataset.e);
  sheet(e ? 'Editar exercício' : 'Novo exercício', `<form class="form">
    <label class="field"><span>Exercício</span><input name="name" required value="${esc(e?.name || '')}" placeholder="Ex.: Cadeira extensora"></label>
    <div class="row gap"><label class="field grow"><span>Séries</span><input type="number" inputmode="numeric" name="sets" min="1" value="${e?.sets || 3}"></label>
    <label class="field grow"><span>Repetições</span><input name="reps" value="${esc(e?.reps || '12')}"></label>
    <label class="field grow"><span>Carga</span><input name="load" value="${esc(e?.load || '')}" placeholder="kg"></label></div>
    <label class="field"><span>Observações</span><input name="notes" value="${esc(e?.notes || '')}" placeholder="Ex.: descanso 60s, drop-set na última"></label>
    <button class="btn primary block mt">Salvar</button>
    ${e ? '<button type="button" class="btn danger-ghost block" id="del">Excluir exercício</button>' : ''}</form>`, {
    onMount: (root) => root.querySelector('#del')?.addEventListener('click', () => { w.exercises = w.exercises.filter((x) => x !== e); save(); A.closeSheet(); rerender(); }),
    onSubmit: (fd) => {
      const data = { name: fd.get('name').trim(), sets: Number(fd.get('sets')) || 1, reps: fd.get('reps').trim(), load: fd.get('load').trim(), notes: fd.get('notes').trim() };
      if (e) Object.assign(e, data); else w.exercises.push({ id: uid(), ...data });
      save();
    },
  });
};

/* ---------- Perfil e backup ---------- */
function renderConfig() {
  return `${pageHead('Perfil e backup', '#/mais')}
  <section class="card"><h2>Perfil</h2>
    <label class="field"><span>Como quer ser chamada?</span><input value="${esc(state.profile.name)}" data-change="profileName" placeholder="Seu nome"></label></section>
  <section class="card"><h2>Backup</h2>
    <p class="small muted">Os dados ficam salvos no seu iPhone. Faça um backup de vez em quando (ex.: salve no app Arquivos ou no iCloud) para não perder nada se trocar de celular.</p>
    <button class="btn primary block" data-act="exportData">⬇︎ Salvar backup</button>
    <label class="btn ghost block file-btn">⬆︎ Restaurar backup<input type="file" accept="application/json,.json" data-change="importData" hidden></label>
  </section>
  <section class="card"><h2>Zona de perigo</h2>
    <button class="btn danger-ghost block" data-act="resetAll">Apagar tudo e recomeçar</button></section>`;
}
C.profileName = (el) => { state.profile.name = el.value.trim(); save(); toast('Nome salvo'); };
A.exportData = async () => {
  const json = JSON.stringify(state, null, 2);
  const name = `minha-rotina-backup-${dateKey()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup Minha Rotina' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
C.importData = (el) => {
  const f = el.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      if (!obj || typeof obj !== 'object' || !Array.isArray(obj.routine)) throw new Error('inválido');
      confirmSheet('Restaurar backup?', 'Os dados atuais serão substituídos pelos do arquivo.', 'Restaurar', () => { replaceState(obj); toast('Backup restaurado ✅'); }, false);
    } catch { toast('Arquivo de backup inválido'); }
  };
  r.readAsText(f);
};
A.resetAll = () => confirmSheet('Apagar tudo?', 'Todas as tarefas, registros, livros e desafios serão apagados. Isso não pode ser desfeito.', 'Apagar tudo', () => { resetState(); toast('App reiniciado'); });

/* ---------- Instalar ---------- */
function renderInstall() {
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  return `${pageHead('Instalar no iPhone', '#/mais')}
  ${standalone ? '<section class="card done-card"><h2>✅ Já instalado!</h2><p>Você está usando o app pela tela de início.</p></section>' : ''}
  <section class="card"><ol class="install">
    <li><b>Abra este endereço no Safari</b><small>(precisa ser o Safari no iPhone)</small></li>
    <li><b>Toque em Compartilhar</b> <span class="kbd">⬆︎</span><small>o quadrado com a seta, na barra de baixo</small></li>
    <li><b>Escolha "Adicionar à Tela de Início"</b><small>role a lista se não aparecer de cara</small></li>
    <li><b>Toque em "Adicionar"</b><small>o ícone "Minha Rotina" aparece junto dos seus apps e abre em tela cheia, até sem internet</small></li>
  </ol></section>`;
}

export const routes = {
  mais: { render: renderMore, tab: 'mais' },
  rotina: { render: renderRoutine, tab: 'mais' },
  treinos: { render: renderWorkouts, tab: 'mais' },
  'treino-edit': { render: renderWorkoutEdit, tab: 'mais' },
  config: { render: renderConfig, tab: 'mais' },
  instalar: { render: renderInstall, tab: 'mais' },
};

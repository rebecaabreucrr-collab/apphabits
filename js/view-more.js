// Aba "Mais": rotina fixa, treinos, perfil, backup e instalação.
import { state, save, replaceState, resetState } from './store.js';
import { esc, WD, WD_FULL, dateKey, uid } from './utils.js';
import { A, C, ui, sheet, rerender, toast, pageHead, opt, confirmSheet, go } from './ui.js';
import { taskSheet, avatarHtml, photoToDataUrl } from './forms.js';
import { COLORS, TASK_TYPES, LAYOUTS, TAB_DEFS, DASH_NAMES, CARD_NAMES, SQUARE_NAMES, defaultHome, defaultState, PHRASES } from './defaults.js';
import { svg } from './icons.js';
import { authEnabled, isLoggedIn, currentUser, changePassword } from './auth.js';
import { APP_VERSION } from './config.js';
import { syncInfo, syncNow } from './sync.js';
import { toMin } from './utils.js';
import { trainDays } from './logic.js';

const item = (href, icon, title, sub, color = 'rose') => `<a class="menu-item" href="${href}"><span class="t-icon bg-soft-${color}">${icon}</span>
  <div class="grow"><b>${title}</b><small>${sub}</small></div><span class="t-go">›</span></a>`;

function renderMore() {
  const L = LAYOUTS[state.settings.layout] || LAYOUTS.rosa;
  const goal = state.water.goal;
  return `<header class="page-head top"><h1>Mais</h1></header>
  <section class="card profile-card">
    <div class="photo-wrap">
      <label class="photo-pick" aria-label="Escolher foto">${avatarHtml('big')}<span class="photo-badge">📷</span>
        <input type="file" accept="image/*" data-change="profilePhoto" hidden></label>
      ${state.profile.photo ? '<button class="link small" data-act="photoRemove">Remover foto</button>' : '<small>Toque para pôr sua foto</small>'}
    </div>
    <label class="field grow"><span>Seu nome (aparece no "Bom dia")</span><input value="${esc(state.profile.name)}" data-change="profileName" placeholder="Seu nome"></label>
  </section>
  ${authEnabled() && isLoggedIn() ? `<section class="card menu account">
    <div class="menu-item"><span class="t-icon bg-soft-violet">👤</span><div class="grow"><b>Minha conta</b><small>${esc(currentUser()?.email || '')}</small></div></div>
    <div class="row gap"><button class="btn ghost grow" data-act="pwChange">Trocar senha</button><button class="btn danger-ghost grow" data-act="logoutAsk">Sair</button></div>
  </section>` : ''}
  ${syncCard()}
  <h3 class="sec-title">Personalizar</h3>
  <section class="card menu">
    ${item('#/aparencia', '🎨', 'Layout e cores', `${L.name} · ${{ auto: 'tema automático', light: 'tema claro', dark: 'tema escuro' }[state.settings.theme]}`, 'violet')}
    ${item('#/abas', '📱', 'Abas do menu', state.settings.tabs.map((t) => t.label).join(', ') || 'só Hoje e Mais', 'rose')}
    ${item('#/inicio-config', '🧩', 'Tela inicial', 'Blocos, quadrado, cards, frase e rotina', 'sky')}
    <div class="menu-item"><span class="t-icon bg-soft-sky">💧</span><div class="grow"><b>Meta de água</b><small>por dia</small></div>
      <select class="mini-select" data-change="waterGoal">${[1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000].map((v) => opt(v, `${v} ml`, goal)).join('')}</select></div>
  </section>
  <h3 class="sec-title">Organizar</h3>
  <section class="card menu">
    ${item('#/metas', '🎯', 'Metas e desafio', 'Objetivos do mês e do ano, desafio de 20 dias', 'violet')}
    ${item('#/sono', '🌙', 'Sono', 'Horários, qualidade e meta de horas', 'sky')}
    ${item('#/financas', '👛', 'Finanças', 'Receitas, despesas, contas, limites e leitura de fotos', 'violet')}
    ${item('#/relatorio', '📊', 'Relatório', 'Semana, mês e ano, sequências e dias de pausa', 'pink')}
    ${item('#/ciclo', '🌸', 'Meu ciclo', 'Menstruação, período fértil e ovulação', 'pink')}
    ${item('#/estudo', '📚', 'Estudo', 'Cronômetro, matérias, onde parei e histórico', 'sky')}
    ${item('#/ingles', '💬', 'Inglês', 'Cronômetro, habilidades, onde parei e histórico', 'violet')}
    ${item('#/remedios', '💊', 'Remédios', 'Horários, doses e informações', 'violet')}
    ${item('#/rotina', '🗓️', 'Rotina fixa', 'Horários, dias da semana e tarefas da casa', 'violet')}
    ${item('#/treinos', '🏋️‍♀️', 'Treinos', 'Plano da semana e exercícios', 'rose')}
    ${item('#/produtos', '🛍️', 'Meus produtos', 'Skincare, cabelo e o que mais você usa', 'pink')}
    ${item('#/cabelo-edit', '💇‍♀️', 'Cronograma capilar', 'Frequência, ciclo de máscaras e passos', 'sky')}
    ${item('#/skincare-edit', '🧴', 'Passos do skincare', 'Manhã e noite', 'sky')}
  </section>
  <h3 class="sec-title">App</h3>
  <section class="card menu">
    ${item('#/config', '⚙️', 'Backup', 'Salvar e restaurar seus dados', 'slate')}
    ${item('#/instalar', '📲', 'Instalar no iPhone', 'Coloque o app na tela de início', 'violet')}
  </section>
  <section class="card update-card"><div class="grow"><b>Versão ${APP_VERSION}</b><small>Se uma mudança não apareceu, toque em atualizar.</small></div>
    <button class="btn small ghost" data-act="forceUpdate">🔄 Atualizar o app agora</button></section>
  <p class="center small muted">Minha Rotina · seus dados ficam salvos só neste aparelho</p>`;
}
C.profilePhoto = async (el) => {
  const f = el.files?.[0]; if (!f) return;
  try { state.profile.photo = await photoToDataUrl(f); save(); toast('Foto salva 💜'); rerender(); }
  catch (e) { toast(e.message); }
};
A.photoRemove = () => confirmSheet('Remover foto?', 'Volta a aparecer a inicial do seu nome.', 'Remover', () => { delete state.profile.photo; save(); });
A.logoutAsk = () => confirmSheet('Sair da conta?', 'Seus dados continuam salvos neste aparelho. Para ver de novo, é só entrar com o mesmo e-mail.', 'Sair', () => A.logout());
A.pwChange = () => sheet('Trocar senha', `<form class="form">
  <label class="field"><span>Nova senha</span><input type="password" name="pw" minlength="6" required autocomplete="new-password" placeholder="mínimo 6 caracteres"></label>
  <button class="btn primary block">Salvar</button></form>`, {
  onSubmit: (fd) => {
    const pw = String(fd.get('pw') || '');
    if (pw.length < 6) { toast('A senha precisa ter pelo menos 6 caracteres'); return false; }
    changePassword(pw).then(() => toast('Senha alterada 💜')).catch((e) => toast(e.message));
  },
});
A.forceUpdate = async () => {
  toast('Atualizando… seus dados continuam salvos');
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = (await caches?.keys?.()) || [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { /* segue */ }
  const q = new URLSearchParams(location.search); q.set('v', Date.now());
  setTimeout(() => location.replace(location.pathname + '?' + q.toString() + '#/mais'), 600);
};
function syncCard() {
  const si = syncInfo();
  if (!si.enabled) return `<section class="card sync-card"><div class="menu-item"><span class="t-icon bg-soft-sky">🔄</span><div class="grow"><b>Sincronizar celular e PC</b>
    <small>Abra o app pelo seu WordPress (seusite.com/minha-rotina/) e instale de lá no iPhone. Assim tudo fica igual nos dois aparelhos.</small></div></div></section>`;
  const t = si.last ? new Date(si.last).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  return `<section class="card sync-card"><div class="menu-item"><span class="t-icon bg-soft-sky">🔄</span><div class="grow"><b>Sincronização ${si.error ? 'com erro' : 'ativa'}</b>
    <small>${si.error ? esc(si.error) : t ? `Tudo salvo no WordPress · última às ${t}` : 'Conectando…'}</small></div>
    <button class="btn small ghost" data-act="syncNow">Sincronizar</button></div></section>`;
}
A.syncNow = async () => { toast('Sincronizando…'); await syncNow(); rerender(); const si = syncInfo(); toast(si.error ? si.error : 'Sincronizado ✓'); };
C.waterGoal = (el) => { state.water.goal = Number(el.value); save(); toast('Meta de água atualizada'); rerender(); };

/* ---------- Aparência ---------- */
function renderLook() {
  const st = state.settings;
  return `${pageHead('Layout e cores', '#/mais')}
  <p class="sub">Escolha o visual do app. Muda na hora.</p>
  <div class="layouts">${Object.entries(LAYOUTS).map(([k, l]) => `<button class="layout-opt lo-${k} ${st.layout === k ? 'on' : ''}" data-act="setLayout" data-l="${k}">
    <span class="lo-prev"><i></i><i></i><i></i></span><b>${l.name}</b><small>${l.desc}</small></button>`).join('')}</div>
  <section class="card"><h2>Tema</h2>
    <div class="seg">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, l]) => `<button class="${st.theme === k ? 'on' : ''}" data-act="setTheme" data-t="${k}">${l}</button>`).join('')}</div>
    <p class="small muted">Automático segue o modo claro/escuro do iPhone.</p></section>`;
}
A.setLayout = (el) => { state.settings.layout = el.dataset.l; save(); rerender(); };
A.setTheme = (el) => { state.settings.theme = el.dataset.t; save(); rerender(); };

/* ---------- Abas ---------- */
const OPTIONAL_TABS = ['metas', 'desafio', 'estudo', 'ingles', 'financas', 'relatorio', 'sono', 'leitura', 'cuidados', 'ciclo', 'remedios', 'treinos', 'rotina'];
function renderTabs() {
  const on = state.settings.tabs;
  const off = OPTIONAL_TABS.filter((id) => !on.some((t) => t.id === id));
  return `${pageHead('Abas do menu', '#/mais')}
  <p class="sub">Escolha até 5 abas para a barra de baixo, mude a ordem e o nome. "Hoje" e "Mais" ficam sempre.</p>
  <section class="card"><h2>Na barra</h2><ul class="mini-list tabs-edit">
    <li class="fixed"><span class="t-icon bg-soft-rose">${svg(TAB_DEFS.hoje.icon)}</span><div class="grow"><b>Hoje</b><small>fixa</small></div></li>
    ${on.map((t, i) => `<li><span class="t-icon bg-soft-violet">${svg(TAB_DEFS[t.id].icon)}</span>
      <input class="tab-name grow" value="${esc(t.label)}" data-change="tabLabel" data-i="${i}" aria-label="Nome da aba">
      <button class="icon-btn sm" data-act="tabMove" data-i="${i}" data-n="-1" aria-label="Subir">↑</button>
      <button class="icon-btn sm" data-act="tabMove" data-i="${i}" data-n="1" aria-label="Descer">↓</button>
      <button class="icon-btn sm" data-act="tabOff" data-i="${i}" aria-label="Tirar da barra">✕</button></li>`).join('')}
    <li class="fixed"><span class="t-icon bg-soft-rose">${svg(TAB_DEFS.mais.icon)}</span><div class="grow"><b>Mais</b><small>fixa</small></div></li>
  </ul></section>
  ${off.length ? `<section class="card"><h2>Disponíveis</h2><ul class="mini-list">${off.map((id) => `<li><span class="t-icon bg-soft-sky">${svg(TAB_DEFS[id].icon)}</span>
    <div class="grow"><b>${TAB_DEFS[id].label}</b></div><button class="btn small ghost" data-act="tabOn" data-id="${id}">+ Adicionar</button></li>`).join('')}</ul></section>` : ''}
  <button class="btn ghost block" data-act="tabsReset">Voltar ao padrão</button>`;
}
A.tabOn = (el) => {
  if (state.settings.tabs.length >= 5) return toast('Máximo de 5 abas — tire uma antes');
  state.settings.tabs.push({ id: el.dataset.id, label: TAB_DEFS[el.dataset.id].label }); save(); rerender();
};
A.tabOff = (el) => { state.settings.tabs.splice(Number(el.dataset.i), 1); save(); rerender(); };
A.tabMove = (el) => { const l = state.settings.tabs; const i = Number(el.dataset.i), j = i + Number(el.dataset.n); if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; save(); rerender(); };
C.tabLabel = (el) => { const t = state.settings.tabs[Number(el.dataset.i)]; t.label = el.value.trim().slice(0, 12) || TAB_DEFS[t.id].label; save(); rerender(); };
A.tabsReset = () => { state.settings.tabs = ['desafio', 'leitura', 'cuidados'].map((id) => ({ id, label: TAB_DEFS[id].label })); save(); rerender(); };

/* ---------- Tela inicial ---------- */
const sw = (key, label, sub = '') => `<label class="toggle-row"><span><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>
  <input type="checkbox" class="switch" data-change="homeFlag" data-k="${key}" ${state.settings.home[key] ? 'checked' : ''}></label>`;
function renderHomeCfg() {
  const d = state.settings.dash;
  const H = state.settings.home;
  return `${pageHead('Tela inicial', '#/mais')}
  <p class="sub">Deixe a tela "Hoje" do seu jeito. Tudo muda na hora.</p>

  <h3 class="sec-title">Blocos e ordem</h3>
  <ul class="list">${d.map((x, i) => `<li><label class="toggle-line grow"><input type="checkbox" data-change="dashToggle" data-i="${i}" ${x.on ? 'checked' : ''}><span><b>${DASH_NAMES[x.id]}</b></span></label>
    <div class="reorder"><button class="icon-btn sm" data-act="dashMove" data-i="${i}" data-n="-1" aria-label="Subir">↑</button>
    <button class="icon-btn sm" data-act="dashMove" data-i="${i}" data-n="1" aria-label="Descer">↓</button></div></li>`).join('')}</ul>

  <h3 class="sec-title">Quadrado ao lado de Hábitos</h3>
  <section class="card"><p class="small muted">Em "Nenhum", o quadrado de Hábitos vira um retângulo ocupando a largura toda.</p><div class="chips">${Object.entries(SQUARE_NAMES).map(([k, l]) =>
    `<button class="chip ${H.square2 === k ? 'on' : ''}" data-act="homeSquare" data-k="${k}">${l}</button>`).join('')}</div></section>

  <h3 class="sec-title">Frase do dia</h3>
  <section class="card">
    ${d.find((x) => x.id === 'frase')?.on ? '' : '<p class="small muted">Ative "Frase do dia" em Blocos para ela aparecer.</p>'}
    <p class="small muted">O app já vem com ${PHRASES.length} frases motivacionais prontas e mostra uma diferente por dia.</p>
    <label class="field"><span>Quer usar as suas? Escreva uma por linha (em branco = frases prontas).</span>
      <textarea rows="4" data-change="homePhrase" placeholder="Ex.: Eu sou capaz! 💜">${esc(H.phrase)}</textarea></label>
  </section>

  <h3 class="sec-title">Cards de resumo</h3>
  <section class="card">
    <div class="seg">${[['grid', 'Grade (2 colunas)'], ['lista', 'Lista']].map(([k, l]) => `<button class="${H.cardsLayout === k ? 'on' : ''}" data-act="homeLayout" data-k="${k}">${l}</button>`).join('')}</div>
    <ul class="mini-list">${H.cards.map((c, i) => `<li class="row-li"><label class="toggle-line grow"><input type="checkbox" data-change="cardToggle" data-i="${i}" ${c.on ? 'checked' : ''}><span>${CARD_NAMES[c.id]}</span></label>
      <button class="icon-btn sm" data-act="cardMove" data-i="${i}" data-n="-1" aria-label="Subir">↑</button>
      <button class="icon-btn sm" data-act="cardMove" data-i="${i}" data-n="1" aria-label="Descer">↓</button></li>`).join('')}</ul>
  </section>

  <h3 class="sec-title">Rotina do dia</h3>
  <section class="card">
    ${sw('groupRoutine', 'Separar por manhã, tarde e noite')}
    ${sw('hideDone', 'Esconder tarefas já feitas', 'a lista fica só com o que falta')}
    ${sw('showFilters', 'Mostrar botões Todas / Feitas / Pendentes / Atrasadas')}
    ${sw('showWeekCycle', 'Mostrar fases do ciclo na semana', 'bolinhas de menstruação e período fértil')}
  </section>
  <button class="btn ghost block" data-act="homeReset">Voltar ao padrão</button>`;
}
C.dashToggle = (el) => { state.settings.dash[Number(el.dataset.i)].on = el.checked; save(); };
A.dashMove = (el) => { const l = state.settings.dash; const i = Number(el.dataset.i), j = i + Number(el.dataset.n); if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; save(); rerender(); };
C.homeFlag = (el) => { state.settings.home[el.dataset.k] = el.checked; save(); };
A.homeSquare = (el) => { state.settings.home.square2 = el.dataset.k; save(); rerender(); toast(el.dataset.k === 'nenhum' ? 'Hábitos agora ocupa a largura toda' : `Quadrado: ${SQUARE_NAMES[el.dataset.k]}`); };
C.homePhrase = (el) => { state.settings.home.phrase = el.value; save(); toast('Frases salvas'); };
A.homeLayout = (el) => { state.settings.home.cardsLayout = el.dataset.k; save(); rerender(); };
C.cardToggle = (el) => { state.settings.home.cards[Number(el.dataset.i)].on = el.checked; save(); };
A.cardMove = (el) => { const l = state.settings.home.cards; const i = Number(el.dataset.i), j = i + Number(el.dataset.n); if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; save(); rerender(); };
A.homeReset = () => confirmSheet('Voltar ao padrão?', 'A tela inicial volta a ter os blocos e cards originais.', 'Voltar ao padrão', () => {
  state.settings.home = defaultHome();
  state.settings.dash = defaultState().settings.dash;
  save();
}, false);

/* ---------- Rotina fixa ---------- */
function renderRoutine(p) {
  const sorted = [...state.routine].sort((a, b) => toMin(a.time) - toMin(b.time));
  const dayFilter = ui.routineFilter ?? -1;
  const list = dayFilter < 0 ? sorted : sorted.filter((r) => r.days.includes(dayFilter));
  return `${pageHead('Rotina fixa', p?.get?.('de') === 'hoje' ? '#/hoje' : '#/mais', '<button class="link" data-act="routineNew">+ Tarefa</button>')}
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
  const W = state.workouts; const td = trainDays();
  return `${pageHead('Treinos', '#/mais', '<button class="link" data-act="workoutNew">+ Treino</button>')}
  <section class="card"><h2>Dias que vou treinar</h2><p class="small muted">Marque os dias de academia. Nos outros dias, a Academia não aparece no "Hoje".</p>
    <div class="chips mt">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="chip"><input type="checkbox" data-change="trainDay" data-d="${d}" ${td.includes(d) ? 'checked' : ''}><span>${WD[d]}</span></label>`).join('')}</div>
    <small class="muted">${td.length} dia${td.length === 1 ? '' : 's'} por semana</small>
  </section>
  <section class="card"><h2>Plano da semana</h2><p class="small muted">Escolha o treino fixo de cada dia de academia. Para trocar só um dia, use "Trocar treino" no treino do dia.</p>
    ${[1, 2, 3, 4, 5, 6, 0].map((d) => td.includes(d) ? `<label class="plan-row"><span>${WD_FULL[d]}</span><select data-change="planSet" data-d="${d}">
      ${opt('', 'Descanso 😴', W.plan[d] || '')}${W.list.map((w) => opt(w.id, w.name, W.plan[d] || '')).join('')}</select></label>`
      : `<div class="plan-row off"><span>${WD_FULL[d]}</span><small>sem academia</small></div>`).join('')}
  </section>
  <section><div class="card-head pad"><h2>Meus treinos</h2></div>
  ${W.list.map((w) => `<a class="card care-card" href="#/treino-edit?id=${w.id}"><span class="t-icon bg-soft-${w.color}">🏋️‍♀️</span>
    <div class="grow"><b>${esc(w.name)}</b><small>${w.exercises.length} exercícios · ${Object.entries(W.plan).filter(([, v]) => v === w.id).map(([d]) => WD[d]).join(', ') || 'fora do plano'}</small></div><span class="t-go">›</span></a>`).join('')}
  </section>`;
}
C.trainDay = (el) => {
  const d = Number(el.dataset.d);
  let ts = state.routine.filter((r) => r.type === 'treino');
  if (!ts.length) { const t = { id: uid(), time: '06:10', title: 'Academia', icon: '🏋️‍♀️', color: 'rose', days: [0, 1, 2, 3, 4, 5, 6], type: 'treino' }; state.routine.push(t); ts = [t]; }
  for (const t of ts) t.days = el.checked ? [...new Set([...t.days, d])].sort() : t.days.filter((x) => x !== d);
  save(); toast(el.checked ? `${WD_FULL[d]}: dia de treino` : `${WD_FULL[d]}: sem academia`); rerender();
};
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
  return `${pageHead('Backup', '#/mais')}
  <section class="card"><h2>Backup</h2>
    <p class="small muted">Os dados ficam salvos no seu iPhone. Faça um backup de vez em quando (ex.: salve no app Arquivos ou no iCloud) para não perder nada se trocar de celular.</p>
    <button class="btn primary block" data-act="exportData">⬇︎ Salvar backup</button>
    <label class="btn ghost block file-btn">⬆︎ Restaurar backup<input type="file" accept="application/json,.json" data-change="importData" hidden></label>
  </section>
  <section class="card"><h2>Zona de perigo</h2>
    <button class="btn danger-ghost block" data-act="resetAll">Apagar tudo e recomeçar</button></section>`;
}
C.profileName = (el) => { state.profile.name = el.value.trim(); save(); toast('Nome salvo'); rerender(); };
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
  rotina: { render: renderRoutine, tab: 'rotina' },
  treinos: { render: renderWorkouts, tab: 'treinos' },
  'treino-edit': { render: renderWorkoutEdit, tab: 'treinos' },
  aparencia: { render: renderLook, tab: 'mais' },
  abas: { render: renderTabs, tab: 'mais' },
  'inicio-config': { render: renderHomeCfg, tab: 'mais' },
  config: { render: renderConfig, tab: 'mais' },
  instalar: { render: renderInstall, tab: 'mais' },
};

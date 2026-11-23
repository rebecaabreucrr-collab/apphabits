// Treino do dia, Skincare, Cronograma capilar e Produtos.
import { state, save } from './store.js';
import { esc, dateKey, fmtLong, fmtRel, fmtShort, WD_FULL, weekday, uid, diffDays, addDays } from './utils.js';
import { A, C, ui, check, sheet, go, rerender, toast, empty, pageHead, bar, opt, confirmSheet } from './ui.js';
import { workoutFor, workoutLog, markTypeDone, hairDay, ensureHairLog, washOn, postponeWash, nextWashes, hairStepsFor, setHairStart, nextScheduled, asList, skinActive,
  reconstructionsInMonth, skinLog, peekSkin, productUsage, product, productName, tasksFor, isDone } from './logic.js';
import { MASKS, CATEGORIES, SKIN_EMOJIS, guessSkinIcon } from './defaults.js';
import { productSheet, productOptions, emojiGrid } from './forms.js';

const q = (p, k, d) => p.get(k) || d;

/* ================= TREINO DO DIA ================= */
function renderWorkoutDay(p) {
  const k = q(p, 'd', dateKey());
  const w = workoutFor(k);
  const log = state.workoutLog[k] || { ex: {}, loads: {} };
  const select = `<label class="field"><span>Treino deste dia</span><select data-change="swapWorkout" data-d="${k}">
    ${opt('__plan', 'Usar o plano da semana', log.wid === undefined ? '__plan' : '')}
    ${opt('', 'Descanso', log.wid === null ? '' : '__x')}
    ${state.workouts.list.map((x) => opt(x.id, x.name, log.wid === x.id ? x.id : '__x')).join('')}</select></label>`;
  if (!w) return `${pageHead('Treino', '#/hoje')}<p class="sub">${fmtLong(k)}</p>
    ${empty('😴', 'Dia de descanso', 'Não há treino no plano para este dia. Você pode escolher um treino abaixo.')}
    <div class="card">${select}</div>`;
  const done = w.exercises.filter((e) => log.ex[e.id]).length;
  const allDone = tasksFor(k).filter((t) => t.type === 'treino').some((t) => isDone(t, k));
  return `${pageHead('Treino', '#/hoje', `<a class="link" href="#/treino-edit?id=${w.id}">Editar</a>`)}
  <p class="sub">${fmtLong(k)}</p>
  <section class="card hero-mini bg-grad-${w.color || 'rose'}">
    <small>Treino de hoje</small><h2>${esc(w.name)}</h2>
    <span>${done}/${w.exercises.length} exercícios</span>${bar(done / (w.exercises.length || 1), 'light')}
  </section>
  <ul class="list">${w.exercises.map((e, i) => `<li class="ex ${log.ex[e.id] ? 'done' : ''}">
      ${check(!!log.ex[e.id], 'exToggle', `data-d="${k}" data-e="${e.id}"`, e.name)}
      <div class="grow"><b>${i + 1}. ${esc(e.name)}</b><small>${e.sets} × ${esc(e.reps)}${e.notes ? ' · ' + esc(e.notes) : ''}</small></div>
      <label class="load"><span>carga</span><input inputmode="decimal" placeholder="kg" value="${esc(log.loads[e.id] ?? e.load ?? '')}" data-change="exLoad" data-d="${k}" data-w="${w.id}" data-e="${e.id}"></label>
    </li>`).join('')}</ul>
  <button class="btn ${allDone ? 'ghost' : 'success'} block" data-act="finishWorkout" data-d="${k}">${allDone ? '✓ Treino concluído (desfazer)' : '🏁 Concluir treino'}</button>
  <div class="card">${select}</div>`;
}
A.exToggle = (el) => {
  const l = workoutLog(el.dataset.d); l.ex[el.dataset.e] = !l.ex[el.dataset.e];
  const w = workoutFor(el.dataset.d);
  if (w && w.exercises.every((e) => l.ex[e.id])) { markTypeDone(el.dataset.d, 'treino', true); toast('Treino completo! 💪'); }
  save(); rerender();
};
C.exLoad = (el) => {
  const l = workoutLog(el.dataset.d); l.loads[el.dataset.e] = el.value.trim();
  const w = state.workouts.list.find((x) => x.id === el.dataset.w);
  const e = w?.exercises.find((x) => x.id === el.dataset.e);
  if (e) e.load = el.value.trim(); // a última carga vira o padrão
  save(); toast('Carga salva');
};
C.swapWorkout = (el) => {
  const l = workoutLog(el.dataset.d);
  if (el.value === '__plan') delete l.wid; else l.wid = el.value || null;
  save(); rerender();
};
A.finishWorkout = (el) => {
  const k = el.dataset.d;
  const done = tasksFor(k).filter((t) => t.type === 'treino').some((t) => isDone(t, k));
  markTypeDone(k, 'treino', !done);
  if (!done) toast('Treino concluído! 💪');
  rerender();
};

/* ================= SKINCARE ================= */
function renderSkincare(p) {
  const k = q(p, 'd', dateKey());
  const key = q(p, 'r', 'am');
  const r = state.skincare[key];
  const log = peekSkin(k, key) || { steps: {}, how: {}, extras: [], notes: '' };
  const n = r.steps.filter((s) => log.steps[s.id]).length;
  return `${pageHead('Skincare', '#/hoje', `<a class="link" href="#/skincare-edit">Editar passos</a>`)}
  <p class="sub">${fmtLong(k)}</p>
  <div class="seg">${['am', 'pm'].map((x) => `<a class="${x === key ? 'on' : ''}" href="#/skincare?r=${x}&d=${k}">${x === 'am' ? '☀️ Manhã' : '🌙 Noite'}${skinActive(x) ? '' : ' (pausada)'}</a>`).join('')}</div>
  ${skinSwitch(key)}
  ${!skinActive(key) ? `<section class="card paused-card"><b>⏸ Rotina da ${r.name.toLowerCase()} pausada</b>
    <p class="small muted">Ela não aparece na rotina do dia nem nos cards. Quando tiver os produtos, é só ligar de novo aqui em cima.</p></section>` : ''}
  <section class="card hero-mini bg-grad-emerald ${skinActive(key) ? '' : 'is-paused'}"><small>Rotina da ${r.name.toLowerCase()}</small><h2>${n}/${r.steps.length} passos</h2>${bar(n / (r.steps.length || 1), 'light')}</section>
  ${r.steps.length ? `<ol class="list steps">${r.steps.map((s, i) => `<li class="${log.steps[s.id] ? 'done' : ''}">
      ${check(!!log.steps[s.id], 'skinToggle', `data-d="${k}" data-r="${key}" data-s="${s.id}"`, productName(s.productId))}
      <span class="t-icon skin-ic">${s.icon || '✨'}</span>
      <div class="grow"><small class="step-n">Passo ${i + 1}</small><b>${esc(productName(s.productId))}</b>
        <label class="inline-edit"><span>Aplicado:</span><input value="${esc(log.how?.[s.id] ?? s.how)}" data-change="skinHow" data-d="${k}" data-r="${key}" data-s="${s.id}" placeholder="Onde / quanto aplicou"></label>
      </div></li>`).join('')}</ol>` : empty('🧴', 'Sem passos', 'Cadastre os passos da sua rotina.', '<a class="btn primary" href="#/skincare-edit">Cadastrar</a>')}
  <section class="card">
    <div class="card-head"><h2>Extras de hoje</h2><button class="link" data-act="skinExtra" data-d="${k}" data-r="${key}">+ Produto extra</button></div>
    ${log.extras?.length ? `<ul class="mini-list">${log.extras.map((e, i) => `<li><b>${esc(productName(e.productId))}</b><small>${esc(e.how)}</small>
      <button class="icon-btn sm" data-act="skinExtraDel" data-d="${k}" data-r="${key}" data-i="${i}" aria-label="Remover">✕</button></li>`).join('')}</ul>` : '<p class="muted small">Usou máscara, esfoliante ou outro produto hoje? Registre aqui.</p>'}
    <label class="field mt"><span>Como está a pele hoje? (anotações)</span><textarea rows="2" data-change="skinNotes" data-d="${k}" data-r="${key}" placeholder="Ex.: pele mais oleosa, espinha no queixo...">${esc(log.notes || '')}</textarea></label>
  </section>
  ${skinHistory()}`;
}
function skinSwitch(key) {
  const r = state.skincare[key];
  return `<label class="toggle-row card skin-switch"><span><b>Estou fazendo a rotina da ${r.name.toLowerCase()}</b><small>${skinActive(key) ? 'aparece na rotina do dia' : 'pausada — desligue quando faltar produto'}</small></span>
    <input type="checkbox" class="switch" data-change="skinActive" data-r="${key}" ${skinActive(key) ? 'checked' : ''}></label>`;
}
C.skinActive = (el) => {
  const r = state.skincare[el.dataset.r];
  r.active = el.checked;
  save(); toast(el.checked ? `Rotina da ${r.name.toLowerCase()} ativada ✨` : `Rotina da ${r.name.toLowerCase()} pausada`); rerender();
};
function skinHistory() {
  const days = Object.keys(state.skinLog).sort().reverse().slice(0, 7);
  if (!days.length) return '';
  return `<section class="card"><h2>Histórico recente</h2>${days.map((k) => {
    const items = [];
    for (const [key, l] of Object.entries(state.skinLog[k])) {
      Object.values(l.steps || {}).forEach((v) => v && items.push(`${key === 'am' ? '☀️' : '🌙'} ${esc(productName(v.p))}${v.how ? ` <small class="muted">(${esc(v.how)})</small>` : ''}`));
      (l.extras || []).forEach((e) => items.push(`✨ ${esc(productName(e.productId))} <small class="muted">(${esc(e.how)})</small>`));
    }
    return items.length ? `<details class="hist"><summary><b>${fmtShort(k)}</b> · ${items.length} produto(s)</summary><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></details>` : '';
  }).join('')}</section>`;
}
A.skinToggle = (el) => {
  const { d, r, s } = el.dataset;
  const l = skinLog(d, r);
  const step = state.skincare[r].steps.find((x) => x.id === s);
  if (l.steps[s]) delete l.steps[s]; else l.steps[s] = { p: step.productId, how: l.how[s] ?? step.how };
  const all = state.skincare[r].steps.every((x) => l.steps[x.id]);
  markTypeDone(d, 'skincare', all, (t) => (t.routineKey || 'am') === r);
  if (all) toast('Skincare completo! ✨');
  save(); rerender();
};
C.skinHow = (el) => {
  const { d, r, s } = el.dataset; const l = skinLog(d, r);
  l.how[s] = el.value.trim(); if (l.steps[s]) l.steps[s].how = l.how[s];
  save();
};
C.skinNotes = (el) => { skinLog(el.dataset.d, el.dataset.r).notes = el.value; save(); };
A.skinExtra = (el) => {
  const { d, r } = el.dataset;
  sheet('Produto extra', `<form class="form">
    <label class="field"><span>Produto</span><select name="p" required>${productOptions('', { cat: 'skincare' })}</select></label>
    <button type="button" class="link" data-act="newProductInline">+ cadastrar produto novo</button>
    <label class="field"><span>O que / onde aplicou</span><input name="how" placeholder="Ex.: máscara de argila na zona T, 10 min"></label>
    <button class="btn primary block mt">Adicionar</button></form>`, {
    onSubmit: (fd) => { if (!fd.get('p')) { toast('Escolha um produto'); return false; }
      skinLog(d, r).extras.push({ productId: fd.get('p'), how: fd.get('how').trim() }); save(); },
  });
};
A.skinExtraDel = (el) => { skinLog(el.dataset.d, el.dataset.r).extras.splice(Number(el.dataset.i), 1); save(); rerender(); };
A.newProductInline = () => productSheet(undefined, { onSaved: () => toast('Produto cadastrado! Abra novamente para escolher.') });

/* ---- editar passos de skincare ---- */
function renderSkincareEdit() {
  const block = (key) => {
    const r = state.skincare[key];
    return `<section class="card ${skinActive(key) ? '' : 'is-paused'}"><div class="card-head"><h2>${key === 'am' ? '☀️' : '🌙'} ${esc(r.name)}${skinActive(key) ? '' : ' <small class="muted">· pausada</small>'}</h2>
      <button class="link" data-act="skinStep" data-r="${key}">+ Passo</button></div>
      <label class="toggle-row"><span><b>Fazendo esta rotina</b><small>desligue quando não tiver como fazer</small></span>
        <input type="checkbox" class="switch" data-change="skinActive" data-r="${key}" ${skinActive(key) ? 'checked' : ''}></label>
      ${r.steps.length ? `<ol class="list steps">${r.steps.map((s, i) => `<li>
        <span class="t-icon skin-ic" data-act="skinStep" data-r="${key}" data-s="${s.id}">${s.icon || '✨'}</span>
        <div class="grow" data-act="skinStep" data-r="${key}" data-s="${s.id}"><small class="step-n">Passo ${i + 1}</small><b>${esc(productName(s.productId))}</b><small>${esc(s.how)}</small></div>
        <div class="reorder"><button class="icon-btn sm" data-act="skinMove" data-r="${key}" data-i="${i}" data-n="-1" aria-label="Subir">↑</button>
        <button class="icon-btn sm" data-act="skinMove" data-r="${key}" data-i="${i}" data-n="1" aria-label="Descer">↓</button></div>
      </li>`).join('')}</ol>` : '<p class="muted">Nenhum passo ainda.</p>'}</section>`;
  };
  return `${pageHead('Passos do skincare', '#/cuidados')}
    <p class="sub">Defina os produtos e a forma de aplicar. Toque num passo para editar.</p>${block('am')}${block('pm')}`;
}
A.skinStep = (el) => {
  const r = el.dataset.r; const steps = state.skincare[r].steps;
  const s = steps.find((x) => x.id === el.dataset.s);
  sheet(s ? 'Editar passo' : 'Novo passo', `<form class="form">
    <label class="field"><span>Produto</span><select name="p" required>${productOptions(s?.productId || '', { cat: 'skincare' })}</select></label>
    <button type="button" class="link" data-act="newProductInline">+ cadastrar produto novo</button>
    <label class="field"><span>Como / onde aplicar</span><input name="how" value="${esc(s?.how || '')}" placeholder="Ex.: 3 gotas no rosto e pescoço"></label>
    <div class="field"><span>Ícone do passo</span>${emojiGrid(s?.icon || '', SKIN_EMOJIS)}</div>
    <button class="btn primary block mt">Salvar</button>
    ${s ? '<button type="button" class="btn danger-ghost block" id="del">Excluir passo</button>' : ''}</form>`, {
    onMount: (root) => root.querySelector('#del')?.addEventListener('click', () => {
      state.skincare[r].steps = steps.filter((x) => x !== s); save(); A.closeSheet(); rerender();
    }),
    onSubmit: (fd) => {
      if (!fd.get('p')) { toast('Escolha um produto'); return false; }
      const icon = fd.get('icon') || guessSkinIcon(productName(fd.get('p')));
      if (s) { s.productId = fd.get('p'); s.how = fd.get('how').trim(); s.icon = icon; } else steps.push({ id: uid(), productId: fd.get('p'), how: fd.get('how').trim(), icon });
      save();
    },
  });
};
A.skinMove = (el) => {
  const steps = state.skincare[el.dataset.r].steps; const i = Number(el.dataset.i); const j = i + Number(el.dataset.n);
  if (j < 0 || j >= steps.length) return;
  [steps[i], steps[j]] = [steps[j], steps[i]]; save(); rerender();
};

/* ================= CABELO ================= */
function hairBody(k, { embedded = false } = {}) {
  const h = hairDay(k);
  const M = MASKS[h.mask] || MASKS.hidratacao;
  const upcoming = nextWashes(k, 7);
  const rec = reconstructionsInMonth(k);
  let main;
  if (h.isWash) {
    const steps = hairStepsFor(h.mask, k);
    const log = h.log || { steps: {} };
    const n = steps.filter((s) => log.steps[s.id]).length;
    main = `<section class="card hero-mini bg-grad-${M.color}">
      <small>Dia de lavar 🚿 ${k === dateKey() ? 'hoje' : fmtShort(k)}</small><h2>${M.icon} ${M.label}</h2>
      <span>${h.mask === 'reconstrucao' ? 'Reconstrução + acidificante · ' : ''}tônico sempre · ${n}/${steps.length}</span>${bar(n / (steps.length || 1), 'light')}
    </section>
    ${embedded ? `<a class="btn primary block" href="#/cabelo?d=${k}">Abrir passo a passo</a>
      ${!Object.keys(h.log?.steps || {}).length ? `<button class="btn ghost block" data-act="hairStart" data-d="${addDays(k, 1)}">📅 Não vou lavar hoje — mudar data</button>` : ''}` : `
    <div class="field"><span>Máscara usada neste dia</span><div class="seg">${Object.entries(MASKS).map(([key, m]) =>
      `<button class="${key === h.mask ? 'on' : ''}" data-act="hairMask" data-d="${k}" data-m="${key}">${m.icon} ${m.label}</button>`).join('')}</div></div>
    <ol class="list steps">${steps.map((s) => `<li class="${log.steps[s.id] ? 'done' : ''}">
      ${check(!!log.steps[s.id], 'hairStep', `data-d="${k}" data-s="${s.id}"`, s.label)}
      <div class="grow"><b>${esc(s.label)}</b><small class="${s.options.length ? '' : 'warn-txt'}">${s.options.length ? esc(productName(s.productId)) : 'Nenhum produto escolhido · configure'}</small>
        ${s.options.length > 1 ? `<small class="alt-info">Alterna com: ${s.options.filter((x) => x !== s.productId).map((x) => esc(product(x)?.name || '')).join(', ')}</small>`
          : `<button class="link alt-add" data-act="prodNew" data-kind="${s.when === 'mask' ? 'mask' : 'step'}" data-key="${s.when === 'mask' ? h.mask : s.id}">+ adicionar outro${s.options.length ? ' para alternar' : ''}</button>`}</div>
      ${s.options.length > 1 ? `<button class="btn small ghost swap" data-act="hairSwap" data-d="${k}" data-s="${s.id}" aria-label="Trocar produto">🔄 Trocar</button>` : ''}</li>`).join('')}</ol>
    <label class="field"><span>Anotações do cabelo</span><textarea rows="2" data-change="hairNotes" data-d="${k}" placeholder="Ex.: fios mais macios, frizz...">${esc(h.log?.notes || '')}</textarea></label>
    ${!Object.keys(h.log?.steps || {}).length && k >= dateKey() ? `<button class="btn ghost block" data-act="hairStart" data-d="${addDays(k, 1)}">📅 Não vou lavar ${k === dateKey() ? 'hoje' : 'neste dia'} — mudar data</button>` : ''}`}`;
  } else {
    const nx = upcoming[0];
    main = `<section class="card hero-mini bg-grad-slate"><small>${k === dateKey() ? 'Hoje' : fmtShort(k)} não é dia de lavar</small>
      <h2>Próxima: ${nx ? fmtRel(nx.date, k) : '—'}</h2><span>${nx ? `${MASKS[nx.mask].icon} ${MASKS[nx.mask].label}` : ''}</span></section>
      ${k <= dateKey() ? `<button class="btn ghost block" data-act="hairWashNow" data-d="${k}">🚿 Lavei neste dia mesmo assim</button>` : ''}
      <button class="btn ${k > dateKey() ? 'primary' : 'ghost'} block" data-act="hairStart" data-d="${k > dateKey() ? k : nextScheduled(dateKey())}">📅 ${k > dateKey() ? 'Lavar neste dia' : 'Mudar data da próxima lavagem'}</button>`;
  }
  return `${main}
  <section class="card"><div class="card-head"><h2>Próximas lavagens</h2>${embedded ? '<a class="link" href="#/cabelo-edit">Configurar</a>' : ''}</div>
    <div class="wash-list">${upcoming.map((x) => `<a href="#/cabelo?d=${x.date}" class="wash bg-soft-${MASKS[x.mask].color} ${x.date === k ? 'sel' : ''}">
      <small>${WD_FULL[weekday(x.date)].slice(0, 3)}</small><b>${fmtShort(x.date)}</b><span>${MASKS[x.mask].icon}</span><small>${MASKS[x.mask].label}</small>${washMaskName(x)}</a>`).join('')}</div>
    <p class="small muted mt">Reconstruções neste mês: <b>${rec}</b>${rec > 2 ? ' ⚠️ acima de 2 — considere trocar por hidratação' : ' (ideal: até 2)'} · Lava a cada ${state.hair.interval} dias</p>
  </section>
  ${hairHistory()}`;
}
function washMaskName(x) {
  const st = hairStepsFor(x.mask, x.date).find((q) => q.when === 'mask');
  return st?.productId ? `<small class="wash-prod">${esc(product(st.productId)?.name || '')}</small>` : '';
}
function hairHistory() {
  const logs = Object.entries(state.hair.log).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 8);
  if (!logs.length) return '';
  return `<section class="card"><h2>Histórico do cabelo</h2><ul class="mini-list">${logs.map(([k, l]) =>
    `<li><b>${fmtShort(k)} · ${MASKS[l.mask]?.icon} ${MASKS[l.mask]?.label}</b><small>${Object.values(l.steps || {}).map((v) => esc(productName(v.p))).join(', ') || 'sem passos marcados'}${l.notes ? ' — ' + esc(l.notes) : ''}</small>
      <button class="icon-btn sm" data-act="hairLogDel" data-d="${k}" aria-label="Apagar registro">✕</button></li>`).join('')}</ul></section>`;
}
function renderHair(p) {
  const k = q(p, 'd', dateKey());
  return `${pageHead('Cronograma capilar', '#/hoje', '<a class="link" href="#/cabelo-edit">Configurar</a>')}<p class="sub">${fmtLong(k)}</p>${hairBody(k)}`;
}
A.hairStep = (el) => {
  const { d, s } = el.dataset; const l = ensureHairLog(d);
  const step = hairStepsFor(l.mask, d).find((x) => x.id === s);
  if (l.steps[s]) delete l.steps[s]; else l.steps[s] = { p: step?.productId || null };
  const all = hairStepsFor(l.mask, d).every((x) => l.steps[x.id]);
  markTypeDone(d, 'cabelo', all);
  if (all) toast('Cabelo finalizado! 💇‍♀️');
  save(); rerender();
};
A.hairSwap = (el) => {
  const { d, s } = el.dataset;
  const before = hairDay(d).mask;
  const step = hairStepsFor(before, d).find((x) => x.id === s);
  if (!step || step.options.length < 2) return;
  const next = step.options[(step.options.indexOf(step.productId) + 1) % step.options.length];
  const l = ensureHairLog(d);
  (l.pick ||= {})[s] = next;
  if (l.steps[s]) l.steps[s].p = next;
  save(); toast(`Hoje: ${product(next)?.name || ''}`); rerender();
};
A.hairMask = (el) => { const l = ensureHairLog(el.dataset.d); l.mask = el.dataset.m; save(); rerender(); };
C.hairNotes = (el) => { ensureHairLog(el.dataset.d).notes = el.value; save(); };
A.hairWashNow = (el) => { washOn(el.dataset.d); toast('Lavagem registrada — cronograma recalculado'); rerender(); };
A.hairPostpone = (el) => { postponeWash(el.dataset.d); toast('Lavagem adiada para amanhã'); rerender(); };

function renderHairEdit() {
  const h = state.hair;
  const L = h.cycle.length;
  const perMonth = L ? (30 / h.interval) * (h.cycle.filter((x) => x === 'reconstrucao').length / L) : 0;
  const nxs = nextScheduled(dateKey());
  const whenLabel = { always: 'Toda lavagem', mask: 'Máscara do dia (troca sozinha)', reconstrucao: 'Só na reconstrução', hidratacao: 'Só na hidratação', nutricao: 'Só na nutrição' };
  return `${pageHead('Configurar cabelo', '#/cuidados')}
  <section class="card"><h2>Frequência</h2>
    <label class="field"><span>Lavar a cada quantos dias?</span><select data-change="hairInterval">
      ${[1, 2, 3, 4, 5].map((n) => opt(n, n === 1 ? 'Todo dia' : n === 3 ? '3 dias (1 dia sim, 2 não)' : `${n} dias`, h.interval)).join('')}</select></label>
    <div class="hair-start"><div><small>Próxima lavagem</small><b>${fmtRel(nxs, dateKey())} · ${MASKS[hairDay(nxs).mask].icon} ${MASKS[hairDay(nxs).mask].label}</b></div>
      <button class="btn primary block" data-act="hairStart" data-d="${nxs}">📅 Mudar data / começar cronograma</button></div>
  </section>
  <section class="card"><div class="card-head"><h2>Ciclo de máscaras</h2><span class="small muted">≈ ${perMonth.toFixed(1)} reconstruções/mês</span></div>
    <p class="small muted">A cada lavagem o app usa a próxima máscara desta lista e depois recomeça.</p>
    <ol class="list cycle">${h.cycle.map((m, i) => `<li><span class="badge bg-soft-${MASKS[m].color}">${MASKS[m].icon} ${MASKS[m].label}</span><span class="grow"></span>
      <button class="icon-btn sm" data-act="cycleMove" data-i="${i}" data-n="-1" aria-label="Subir">↑</button>
      <button class="icon-btn sm" data-act="cycleMove" data-i="${i}" data-n="1" aria-label="Descer">↓</button>
      <button class="icon-btn sm" data-act="cycleDel" data-i="${i}" aria-label="Remover">✕</button></li>`).join('')}</ol>
    <div class="row gap wrap">${Object.entries(MASKS).map(([k, m]) => `<button class="btn small ghost" data-act="cycleAdd" data-m="${k}">+ ${m.icon} ${m.label}</button>`).join('')}</div>
  </section>
  <section class="card"><h2>Produtos de cada passo</h2>
    <p class="small muted">Coloque quantos quiser em cada um (ex.: dois shampoos, duas máscaras de hidratação). Com mais de um, o app alterna a cada lavagem.</p>
    ${h.steps.filter((st) => st.when !== 'mask').map((st) => prodGroup(`🧴 ${esc(st.label)}${st.when !== 'always' ? ` <small class="muted">(${whenLabel[st.when].toLowerCase()})</small>` : ''}`, asList(st.productIds), 'step', st.id)).join('')}
    ${Object.entries(MASKS).map(([k, m]) => prodGroup(`${m.icon} Máscara de ${m.label.toLowerCase()}`, asList(h.maskProducts[k]), 'mask', k)).join('')}
  </section>
  <section class="card"><div class="card-head"><h2>Passos da lavagem</h2><button class="link" data-act="hairStepEdit">+ Passo</button></div>
    <ol class="list steps">${h.steps.map((s, i) => `<li><div class="grow" data-act="hairStepEdit" data-s="${s.id}"><b>${esc(s.label)}</b>
      <small>${s.when === 'mask' ? 'produto conforme a máscara do dia' : asList(s.productIds).map((x) => esc(productName(x))).join(' / ') || 'nenhum produto'} · ${whenLabel[s.when]}</small></div>
      <div class="reorder"><button class="icon-btn sm" data-act="hairStepMove" data-i="${i}" data-n="-1" aria-label="Subir">↑</button>
      <button class="icon-btn sm" data-act="hairStepMove" data-i="${i}" data-n="1" aria-label="Descer">↓</button></div></li>`).join('')}</ol>
  </section>`;
}
C.hairInterval = (el) => { state.hair.interval = Number(el.value); save(); rerender(); };
/* lista de produtos de um passo ou de um tipo de máscara */
function prodGroup(title, list, kind, key) {
  const others = state.products.filter((p) => !list.includes(p.id))
    .sort((a, b) => (a.category === 'cabelo' ? -1 : 1) - (b.category === 'cabelo' ? -1 : 1) || a.name.localeCompare(b.name));
  return `<div class="mask-group"><b>${title}</b>
    <div class="prod-chips">${list.map((pid, i) => `<span class="pchip">${list.length > 1 ? `${i + 1}. ` : ''}${esc(productName(pid))}<button data-act="prodRemove" data-kind="${kind}" data-key="${key}" data-p="${pid}" aria-label="Remover">✕</button></span>`).join('') || '<small class="warn-txt">nenhum escolhido</small>'}</div>
    <div class="row gap wrap">
      <button class="btn small primary" data-act="prodNew" data-kind="${kind}" data-key="${key}">+ Novo produto</button>
      ${others.length ? `<select class="mini-select add-sel" data-change="prodAdd" data-kind="${kind}" data-key="${key}">${opt('', '+ Escolher da lista', '')}${others.map((p) => opt(p.id, p.name + (p.brand ? ' · ' + p.brand : ''), '')).join('')}</select>` : ''}
    </div></div>`;
}
const listOf = (kind, key) => {
  const h = state.hair;
  if (kind === 'mask') return (h.maskProducts[key] = asList(h.maskProducts[key]));
  const st = h.steps.find((x) => x.id === key);
  return (st.productIds = asList(st.productIds));
};
const setList = (kind, key, l) => {
  if (kind === 'mask') state.hair.maskProducts[key] = l; else state.hair.steps.find((x) => x.id === key).productIds = l;
};
C.prodAdd = (el) => {
  if (!el.value) return;
  const l = listOf(el.dataset.kind, el.dataset.key);
  if (!l.includes(el.value)) l.push(el.value);
  save(); toast('Adicionado 💜 — o app vai alternando'); rerender();
};
A.prodRemove = (el) => { setList(el.dataset.kind, el.dataset.key, listOf(el.dataset.kind, el.dataset.key).filter((x) => x !== el.dataset.p)); save(); rerender(); };
A.prodNew = (el) => {
  const { kind, key } = el.dataset;
  const label = kind === 'mask' ? `máscara de ${MASKS[key].label.toLowerCase()}` : (state.hair.steps.find((x) => x.id === key)?.label || 'produto').toLowerCase();
  sheet(`Novo: ${label}`, `<form class="form">
    <label class="field"><span>Nome do produto</span><input name="name" required placeholder="Ex.: ${kind === 'mask' ? 'Máscara Hidra Intensa' : 'Shampoo Antiqueda'}"></label>
    <label class="field"><span>Marca (opcional)</span><input name="brand" placeholder="Ex.: Lola, Salon Line..."></label>
    <button class="btn primary block">Adicionar</button></form>`, {
    onSubmit: (fd) => {
      const name = String(fd.get('name') || '').trim(); if (!name) return false;
      const prod = { id: uid(), name, brand: String(fd.get('brand') || '').trim(), category: 'cabelo', notes: '', low: false };
      state.products.push(prod);
      listOf(kind, key).push(prod.id);
      save(); toast(`${name} adicionado 💜`);
    },
  });
};
A.newHairProduct = () => productSheet(undefined, { category: 'cabelo' });
A.cycleAdd = (el) => { state.hair.cycle.push(el.dataset.m); save(); rerender(); };
A.cycleDel = (el) => { if (state.hair.cycle.length <= 1) return toast('O ciclo precisa de ao menos 1 máscara'); state.hair.cycle.splice(Number(el.dataset.i), 1); save(); rerender(); };
A.cycleMove = (el) => { const c = state.hair.cycle; const i = Number(el.dataset.i), j = i + Number(el.dataset.n); if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; save(); rerender(); };
A.hairStepMove = (el) => { const c = state.hair.steps; const i = Number(el.dataset.i), j = i + Number(el.dataset.n); if (j < 0 || j >= c.length) return; [c[i], c[j]] = [c[j], c[i]]; save(); rerender(); };
A.hairStepEdit = (el) => {
  const steps = state.hair.steps; const s = steps.find((x) => x.id === el.dataset.s);
  sheet(s ? 'Editar passo' : 'Novo passo', `<form class="form">
    <label class="field"><span>Nome do passo</span><input name="label" required value="${esc(s?.label || '')}" placeholder="Ex.: Finalizador"></label>
    <label class="field"><span>Quando usar</span><select name="when">${opt('always', 'Toda lavagem', s?.when)}${opt('mask', 'Máscara do dia (troca sozinha)', s?.when)}
      ${opt('reconstrucao', 'Só na reconstrução', s?.when)}${opt('hidratacao', 'Só na hidratação', s?.when)}${opt('nutricao', 'Só na nutrição', s?.when)}</select></label>
    <div class="field" id="prod-field"><span>Produtos (marque um ou mais — com mais de um, o app alterna a cada lavagem)</span>
      <div class="check-list">${[...state.products].sort((a, b) => (a.category === 'cabelo' ? -1 : 1) - (b.category === 'cabelo' ? -1 : 1) || a.name.localeCompare(b.name)).map((p) =>
        `<label class="toggle-line"><input type="checkbox" name="p" value="${p.id}" ${asList(s?.productIds).includes(p.id) ? 'checked' : ''}><span>${esc(p.name)}${p.brand ? ` <small class="muted">· ${esc(p.brand)}</small>` : ''}</span></label>`).join('')}</div>
      <button type="button" class="link" data-act="newHairProduct">+ cadastrar produto de cabelo</button></div>
    <button class="btn primary block mt">Salvar</button>
    ${s ? '<button type="button" class="btn danger-ghost block" id="del">Excluir passo</button>' : ''}</form>`, {
    onMount: (root) => {
      root.querySelector('#del')?.addEventListener('click', () => { state.hair.steps = steps.filter((x) => x !== s); save(); A.closeSheet(); rerender(); });
      const sync = () => { root.querySelector('#prod-field').hidden = root.querySelector('[name=when]').value === 'mask'; };
      root.querySelector('[name=when]').addEventListener('change', sync); sync();
    },
    onSubmit: (fd) => {
      const data = { label: fd.get('label').trim(), when: fd.get('when'), productIds: fd.getAll('p') };
      if (s) Object.assign(s, data); else steps.push({ id: uid(), ...data });
      save();
    },
  });
};
function hairStartSheet(defDate) {
  const h = state.hair; const L = h.cycle.length;
  const info = hairDay(defDate);
  const cur = ((info.idx % L) + L) % L;
  sheet('Próxima lavagem', `<form class="form">
    <p class="muted small">Escolha o dia da próxima lavagem e com qual máscara começa. A partir dela o app conta ${h.interval === 1 ? 'todo dia' : `a cada ${h.interval} dias`} e segue o ciclo.</p>
    <label class="field"><span>Dia da próxima lavagem</span><input type="date" name="date" required min="${dateKey()}" value="${defDate}"></label>
    <div class="field"><span>Começa com qual máscara?</span><div class="pick-list">${h.cycle.map((m, i) => `<label class="pick"><input type="radio" name="idx" value="${i}" ${i === cur ? 'checked' : ''}>
      <span>${MASKS[m].icon} <b>${MASKS[m].label}</b><small>${i + 1}º do ciclo</small></span></label>`).join('')}</div></div>
    <button class="btn primary block">Salvar</button></form>`, {
    onSubmit: (fd) => {
      const d = fd.get('date') || dateKey();
      const idx = Number(fd.get('idx') || 0);
      setHairStart(d, idx);
      toast(`Próxima lavagem: ${fmtRel(d, dateKey())} · ${MASKS[h.cycle[idx]].label}`);
    },
  });
}
A.hairStart = (el) => hairStartSheet(el.dataset.d || nextScheduled(dateKey()));
A.hairLogDel = (el) => confirmSheet('Apagar este registro?', 'Use se marcou uma lavagem por engano.', 'Apagar', () => {
  const k = el.dataset.d;
  delete state.hair.log[k];
  if (state.done[k]) for (const r of state.routine) if (r.type === 'cabelo') delete state.done[k][r.id];
  save();
});


/* ================= PRODUTOS ================= */
function productsBody() {
  const use = productUsage();
  const top = [...state.products].filter((p) => use[p.id]).sort((a, b) => use[b.id].count - use[a.id].count).slice(0, 5);
  const low = state.products.filter((p) => p.low);
  const groups = Object.entries(CATEGORIES).map(([cat, label]) => {
    const list = state.products.filter((p) => p.category === cat);
    if (!list.length) return '';
    return `<section class="card"><h2>${label}</h2><ul class="mini-list prod">${list.map((p) => {
      const u = use[p.id];
      return `<li data-act="editProduct" data-id="${p.id}"><div class="grow"><b>${esc(p.name)}${p.low ? ' <span class="pill warn">acabando</span>' : ''}</b>
        <small>${p.brand ? esc(p.brand) + ' · ' : ''}${u ? `usado ${u.count}× · último ${fmtRel(u.last)}` : 'ainda não usado'}</small></div><span class="t-go">›</span></li>`;
    }).join('')}</ul></section>`;
  }).join('');
  return `
    ${top.length ? `<section class="card"><h2>⭐ Mais usados</h2><div class="row gap wrap">${top.map((p) => `<span class="badge bg-soft-rose">${esc(p.name)} · ${use[p.id].count}×</span>`).join('')}</div></section>` : ''}
    ${low.length ? `<section class="card warn-card"><h2>🛒 Lista de compras</h2><p class="small">${low.map((p) => esc(p.name)).join(', ')}</p></section>` : ''}
    ${groups}
    <button class="btn primary block" data-act="newProduct">+ Adicionar produto</button>`;
}
A.editProduct = (el) => productSheet(state.products.find((p) => p.id === el.dataset.id));
A.newProduct = () => productSheet(undefined, { category: ui.careTab === 'cabelo' ? 'cabelo' : 'skincare' });

/* ================= ABA CUIDADOS ================= */
function renderCare() {
  const k = dateKey(); const tab = ui.careTab;
  const skinCard = (key) => {
    const r = state.skincare[key]; const l = peekSkin(k, key);
    const n = l ? r.steps.filter((s) => l.steps[s.id]).length : 0;
    return `<a class="card care-card" href="#/skincare?r=${key}&d=${k}"><span class="t-icon bg-soft-${key === 'am' ? 'amber' : 'violet'}">${key === 'am' ? '☀️' : '🌙'}</span>
      <div class="grow"><b>Skincare da ${r.name.toLowerCase()}</b><small>${skinActive(key) ? `${n}/${r.steps.length} passos hoje` : '⏸ pausada'}</small>${skinActive(key) ? bar(n / (r.steps.length || 1)) : ''}</div><span class="t-go">›</span></a>`;
  };
  let body = '';
  if (tab === 'skincare') body = `${skinCard('am')}${skinCard('pm')}<a class="btn ghost block" href="#/skincare-edit">✎ Editar passos e produtos</a>${skinHistory()}`;
  else if (tab === 'cabelo') body = hairBody(k, { embedded: true });
  else body = productsBody();
  return `<header class="page-head top"><h1>Cuidados</h1></header>
  <div class="seg">${[['skincare', '🧴 Skincare'], ['cabelo', '💇‍♀️ Cabelo'], ['produtos', '🛍️ Produtos']].map(([key, l]) =>
    `<button class="${key === tab ? 'on' : ''}" data-act="careTab" data-t="${key}">${l}</button>`).join('')}</div>${body}`;
}
A.careTab = (el) => { ui.careTab = el.dataset.t; rerender(); };

export const routes = {
  treino: { render: renderWorkoutDay, tab: 'hoje' },
  skincare: { render: renderSkincare, tab: 'cuidados' },
  'skincare-edit': { render: renderSkincareEdit, tab: 'cuidados' },
  cabelo: { render: renderHair, tab: 'cuidados' },
  'cabelo-edit': { render: renderHairEdit, tab: 'cuidados' },
  cuidados: { render: renderCare, tab: 'cuidados' },
  produtos: { render: () => `${pageHead('Produtos', '#/mais')}<p class="sub">Tudo o que você usa. O app conta quantas vezes e quando usou cada um.</p>${productsBody()}`, tab: 'mais' },
};

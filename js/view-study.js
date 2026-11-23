// Estudo e Inglês: cronômetro, tema/assunto/fonte, onde parei, horários (manhã/noite) e histórico.
// As duas abas usam o mesmo modelo (makeTrack), cada uma com seus próprios dados.
import { state, save } from './store.js';
import { esc, dateKey, fmtTimer, fmtMinutes, fmtShort, fmtLong, uid, pad, toMin, WD } from './utils.js';
import { durationField, readDuration, timeRangeFields, rangeFromNow, bindTimeRange, fmtRange } from './forms.js';
import { A, C, ui, sheet, rerender, toast, empty, confirmSheet } from './ui.js';
import { setDone, isDone, tasksFor } from './logic.js';

const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export const TRACKS = {
  estudo: {
    p: 'study', key: 'study', type: 'estudo', route: 'estudo', title: 'Estudo', icon: '📚', grad: 'sky',
    verb: 'estudar', doing: 'Estudando…', unit: 'de estudo', field: 'Matéria', fieldPh: 'Ex.: Direito Administrativo',
    topic: 'Assunto', topicPh: 'Ex.: Licitações – modalidades', sources: ['IA', 'Pós-graduação', 'Curso', 'Outras fontes'], defSource: 'Curso',
    slotTitles: { manha: 'Estudar (manhã)', noite: 'Estudar (noite)' }, done: 'Estudo salvo 📚', empty: 'Nenhum estudo registrado',
  },
  ingles: {
    p: 'eng', key: 'english', type: 'ingles', route: 'ingles', title: 'Inglês', icon: '💬', grad: 'violet',
    verb: 'praticar', doing: 'Praticando inglês…', unit: 'de inglês', field: 'Habilidade', fieldPh: 'Ex.: Listening, Speaking, Vocabulário',
    topic: 'Conteúdo', topicPh: 'Ex.: Lição 12 – Past Simple', sources: ['Aplicativo', 'Curso', 'Aula particular', 'Série / filme', 'Música', 'IA', 'Outras fontes'],
    defSource: 'Aplicativo', slotTitles: { manha: 'Inglês (manhã)', noite: 'Inglês (noite)' }, done: 'Inglês salvo 💬', empty: 'Nenhuma prática registrada',
    chips: ['Listening', 'Speaking', 'Reading', 'Writing', 'Vocabulário', 'Gramática', 'Pronúncia'],
  },
};
export const SOURCES = TRACKS.estudo.sources;

/* ---------------- pomodoro (foco e pausa) ---------------- */
const POMO = (cfg) => (state[cfg.key].pomo ||= { on: false, phase: 'foco', endsAt: null, left: null, cycles: 0 });
const focusMin = (k) => Number(state.focus?.[k]) || (k === 'foco' ? 25 : 5);
function pomoStop(cfg) { Object.assign(POMO(cfg), { phase: 'foco', endsAt: null, left: null, cycles: 0 }); }
const pomoRemaining = (p) => (p.endsAt ? Math.max(0, (p.endsAt - Date.now()) / 1000) : p.left != null ? p.left / 1000 : focusMin('foco') * 60);
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d + 0.2);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.22); });
  } catch { /* sem som */ }
  navigator.vibrate?.([200, 100, 200]);
}
function pomoCard(cfg, P, pre) {
  const p = POMO(cfg); const t = state[cfg.key].timer;
  const active = !!p.endsAt; const paused = p.left != null; const fresh = !active && !paused;
  const btns = fresh ? `<button class="btn white grow big" data-act="${P}PomoStart">▶︎ Começar foco de ${focusMin('foco')} min</button>`
    : `${active ? `<button class="btn glass grow" data-act="${P}PomoPause">⏸ Pausar</button>` : `<button class="btn glass grow" data-act="${P}PomoResume">▶︎ Continuar</button>`}
       ${p.phase === 'pausa' ? `<button class="btn glass grow" data-act="${P}PomoSkip">⏭ Pular pausa</button>` : ''}
       <button class="btn white grow" data-act="${P}Finish">⏹ Finalizar</button>`;
  return `<section class="card timer-card pomo bg-grad-${p.phase === 'pausa' ? 'sky' : cfg.grad} ${active ? 'running' : ''}">
    <small>${p.phase === 'pausa' ? `☕ Pausa · ${focusMin('pausa')} min` : `🎯 Foco · ciclo ${p.cycles + 1}`}${paused ? ' (pausado)' : ''}</small>
    <div class="timer" data-pomo="${cfg.key}">${fmtTimer(pomoRemaining(p))}</div>
    <small>Tempo focado: <b data-track-timer="${cfg.key}">${fmtTimer(t.acc + (t.running && t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0))}</b> · ${p.cycles} ciclo(s) completo(s)</small>
    ${pre ? `<small class="st-pre">Retomando: <b>${esc(pre.materia)}${pre.assunto ? ' · ' + esc(pre.assunto) : ''}</b></small>` : ''}
    <div class="row gap mt">${btns}</div>
    <div class="pomo-set"><label>Foco <select data-change="focusSet" data-k="foco">${[15, 20, 25, 30, 40, 45, 50, 60].map((m) => `<option value="${m}" ${m === focusMin('foco') ? 'selected' : ''}>${m} min</option>`).join('')}</select></label>
      <label>Pausa <select data-change="focusSet" data-k="pausa">${[3, 5, 10, 15, 20].map((m) => `<option value="${m}" ${m === focusMin('pausa') ? 'selected' : ''}>${m} min</option>`).join('')}</select></label></div>
  </section>`;
}
C.focusSet = (el) => { (state.focus ||= {})[el.dataset.k] = Number(el.value); save(); toast(`${el.dataset.k === 'foco' ? 'Foco' : 'Pausa'}: ${el.value} min`); rerender(); };

/** chamado a cada segundo: troca foco ↔ pausa na hora certa (mesmo se o app ficou em segundo plano) */
export function tickPomodoros() {
  const now = Date.now();
  for (const cfg of Object.values(TRACKS)) {
    const p = state[cfg.key]?.pomo; if (!p?.on) continue;
    document.querySelectorAll(`[data-pomo="${cfg.key}"]`).forEach((el) => { el.textContent = fmtTimer(pomoRemaining(p)); });
    if (!p.endsAt || now < p.endsAt) continue;
    const t = state[cfg.key].timer; let msg = '';
    while (p.endsAt && p.endsAt <= now) {
      if (p.phase === 'foco') {
        if (t.running && t.startedAt) { t.acc += Math.max(0, (p.endsAt - t.startedAt) / 1000); t.running = false; t.startedAt = null; }
        p.cycles++; p.phase = 'pausa'; p.endsAt += focusMin('pausa') * 60000; msg = `Foco concluído! 🎉 Pausa de ${focusMin('pausa')} min`;
      } else {
        t.running = true; t.startedAt = p.endsAt; p.phase = 'foco'; p.endsAt += focusMin('foco') * 60000; msg = `Fim da pausa — bora ${cfg.verb}! 🎯`;
      }
    }
    save(); beep(); toast(msg); rerender();
  }
}

const elapsedOf = (cfg) => { const t = state[cfg.key].timer; return t.acc + (t.running && t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0); };
const dayOf = (cfg, k) => state[cfg.key].sessions.filter((x) => x.date === k).reduce((a, x) => a + (x.seconds || 0), 0);
export const studyElapsed = () => elapsedOf(TRACKS.estudo);
export const studyDay = (k) => dayOf(TRACKS.estudo, k);
export const englishElapsed = () => elapsedOf(TRACKS.ingles);
export const englishDay = (k) => dayOf(TRACKS.ingles, k);
export const lastSession = (cfg) => [...state[cfg.key].sessions].sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')))[0];

function makeTrack(cfg) {
  const P = cfg.p;
  const S = () => state[cfg.key];
  const T = () => state[cfg.key].timer;
  const elapsed = () => elapsedOf(cfg);
  const srcLabel = (x) => (x.fonte === 'Outras fontes' && x.fonteOutra ? x.fonteOutra : x.fonte) || '';
  const SLOTS = {
    manha: { label: '☀️ Manhã', time: '08:00', end: '10:00' },
    noite: { label: '🌙 Noite', time: '19:00', end: '21:00' },
  };
  const slotOf = (r) => r.slot || (toMin(r.time) < 15 * 60 ? 'manha' : 'noite');
  const slotItem = (key) => state.routine.find((r) => r.type === cfg.type && slotOf(r) === key);

  function slotBlock(key) {
    const d = SLOTS[key]; const r = slotItem(key);
    const on = !!(r && r.days.length);
    return `<div class="st-slot2 ${on ? 'on' : ''}">
      <label class="toggle-row"><span><b>${d.label}</b><small>${on ? r.days.length === 7 ? 'todos os dias' : `${r.days.length} dia${r.days.length > 1 ? 's' : ''} por semana` : 'desligado'}</small></span>
        <input type="checkbox" class="switch" data-change="${P}SlotOn" data-slot="${key}" ${on ? 'checked' : ''}></label>
      ${on ? `<div class="st-times"><input type="time" value="${r.time}" data-change="${P}Slot" data-id="${r.id}" data-f="time"><span>até</span>
        <input type="time" value="${r.end || ''}" data-change="${P}Slot" data-id="${r.id}" data-f="end"></div>
        <div class="chips st-days">${[1, 2, 3, 4, 5, 6, 0].map((wd) => `<button class="chip ${r.days.includes(wd) ? 'on' : ''}" data-act="${P}SlotDay" data-slot="${key}" data-d="${wd}">${WD[wd]}</button>`).join('')}</div>` : ''}
    </div>`;
  }
  function weekOverview() {
    const m = slotItem('manha'), n = slotItem('noite');
    return `<div class="st-week">${[1, 2, 3, 4, 5, 6, 0].map((wd) => {
      const a = m?.days.includes(wd), b = n?.days.includes(wd);
      return `<div class="${a || b ? 'has' : ''}"><small>${WD[wd]}</small><span>${a ? '☀️' : ''}${b ? '🌙' : ''}${!a && !b ? '–' : ''}</span></div>`;
    }).join('')}</div>`;
  }

  function sessionCard(x) {
    return `<article class="st-item">
      <div class="row between"><b>${esc(x.materia || `Sem ${cfg.field.toLowerCase()}`)}</b><span class="badge bg-soft-${cfg.grad}">${esc(srcLabel(x))}</span></div>
      ${x.assunto ? `<p class="st-topic">${esc(x.assunto)}</p>` : ''}
      <small>${fmtRange(x) ? fmtRange(x) + ' · ' : ''}${fmtMinutes((x.seconds || 0) / 60)} ${cfg.unit}</small>
      ${x.obs ? `<p class="note"><b>Onde parei:</b> ${esc(x.obs).replace(/\n/g, '<br>')}</p>` : ''}
      <div class="row gap st-actions"><button class="btn small primary" data-act="${P}Resume" data-id="${x.id}">▶︎ Retomar</button>
        <button class="btn small ghost" data-act="${P}Edit" data-id="${x.id}">Editar</button></div>
    </article>`;
  }

  function render() {
    const k = dateKey();
    const t = T(); const el = elapsed();
    const all = [...S().sessions].sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')));
    const last = all[0];
    const groups = [...new Set(all.map((x) => x.materia).filter(Boolean))];
    const f = ui[P + 'Filter'] || '';
    const list = f ? all.filter((x) => x.materia === f) : all;
    const byDay = {};
    list.forEach((x) => (byDay[x.date] ||= []).push(x));
    const pre = ui[P + 'Prefill'];
    const btns = t.running
      ? `<button class="btn glass grow" data-act="${P}Pause">⏸ Pausar</button><button class="btn white grow" data-act="${P}Finish">⏹ Finalizar</button>`
      : el > 0
        ? `<button class="btn glass grow" data-act="${P}Start">▶︎ Continuar</button><button class="btn white grow" data-act="${P}Finish">⏹ Finalizar</button><button class="btn glass" data-act="${P}Reset" aria-label="Zerar">↺</button>`
        : `<button class="btn white grow big" data-act="${P}Start">▶︎ Começar a ${cfg.verb}</button>`;
    const pomo = POMO(cfg);
    return `<header class="page-head top"><h1>${cfg.title}</h1><div class="ph-right"><button class="link" data-act="${P}New">+ Registrar</button></div></header>
    <div class="seg mode-seg">${[['crono', '⏱️ Cronômetro'], ['pomo', '⏰ Pomodoro']].map(([k, l]) => `<button class="${(pomo.on ? 'pomo' : 'crono') === k ? 'on' : ''}" data-act="${P}Mode" data-m="${k}">${l}</button>`).join('')}</div>
    ${pomo.on ? pomoCard(cfg, P, pre) : `<section class="card timer-card bg-grad-${cfg.grad} ${t.running ? 'running' : ''}">
      <small>${t.running ? cfg.doing : el > 0 ? 'Pausado' : `Cronômetro ${cfg.unit}`}</small>
      <div class="timer" data-track-timer="${cfg.key}">${fmtTimer(el)}</div>
      ${pre ? `<small class="st-pre">Retomando: <b>${esc(pre.materia)}${pre.assunto ? ' · ' + esc(pre.assunto) : ''}</b></small>` : ''}
      <div class="row gap mt">${btns}</div>
    </section>`}
    <div class="stats two">
      <div class="stat"><span>⏱️</span><b>${fmtMinutes(dayOf(cfg, k) / 60)}</b><small>hoje</small></div>
      <div class="stat"><span>${cfg.icon}</span><b>${new Set(S().sessions.map((x) => x.date)).size}</b><small>dias praticados</small></div>
    </div>
    ${last ? `<section class="card resume-card"><div class="card-head"><h2>📌 Continuar de onde parei</h2><small>${fmtShort(last.date)}</small></div>${sessionCard(last)}</section>` : ''}
    <section class="card"><div class="card-head"><h2>⏰ Horários ${cfg.key === 'study' ? 'de estudo' : 'de inglês'}</h2></div>
      <p class="small muted">Ligue manhã, noite ou os dois e marque os dias de cada um. Eles aparecem na rotina do dia.</p>
      ${Object.keys(SLOTS).map(slotBlock).join('')}
      ${weekOverview()}
    </section>
    <section><div class="card-head pad"><h2>📖 Histórico</h2></div>
      ${groups.length > 1 ? `<div class="chips scroll">${['', ...groups].map((m) => `<button class="chip ${f === m ? 'on' : ''}" data-act="${P}Filter" data-m="${esc(m)}">${m ? esc(m) : 'Todas'}</button>`).join('')}</div>` : ''}
      ${Object.keys(byDay).length ? Object.entries(byDay).map(([d, xs]) => `<section class="card st-day">
        <div class="card-head"><h2>${fmtLong(d)}</h2><small>${fmtMinutes(xs.reduce((a, x) => a + (x.seconds || 0), 0) / 60)}</small></div>
        ${xs.map(sessionCard).join('')}</section>`).join('')
        : empty(cfg.icon, cfg.empty, 'Use o cronômetro ou toque em "+ Registrar" para guardar o que fez e onde parou.')}
    </section>`;
  }

  function entrySheet(x, { seconds = 0, fromTimer = false, prefill } = {}) {
    const isNew = !x;
    const base = x || { date: dateKey(), start: '', materia: prefill?.materia || '', assunto: prefill?.assunto || '', fonte: prefill?.fonte || cfg.defSource,
      fonteOutra: prefill?.fonteOutra || '', obs: '', seconds };
    const all = S().sessions;
    const dl = (name, vals) => `<datalist id="${name}">${[...new Set(vals.filter(Boolean))].map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
    const mins = Math.max(fromTimer ? 1 : 0, Math.round((base.seconds || 0) / 60));
    const rng = rangeFromNow(fromTimer ? seconds : 0);
    sheet(fromTimer ? `${cfg.title}: ${fmtTimer(seconds)} ✨` : isNew ? `Registrar ${cfg.title.toLowerCase()}` : `Editar ${cfg.title.toLowerCase()}`, `<form class="form">
      <label class="field"><span>${cfg.field}</span><input name="materia" list="dl-${P}-mat" required value="${esc(base.materia)}" placeholder="${cfg.fieldPh}">${dl(`dl-${P}-mat`, [...(cfg.chips || []), ...all.map((s) => s.materia)])}</label>
      ${cfg.chips ? `<div class="chips quick-chips">${cfg.chips.map((c) => `<button type="button" class="chip" data-fill="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
      <label class="field"><span>${cfg.topic}</span><input name="assunto" list="dl-${P}-ass" value="${esc(base.assunto)}" placeholder="${cfg.topicPh}">${dl(`dl-${P}-ass`, all.map((s) => s.assunto))}</label>
      <div class="field"><span>Fonte</span><div class="chips">${cfg.sources.map((src) => `<label class="chip"><input type="radio" name="fonte" value="${src}" ${base.fonte === src ? 'checked' : ''}><span>${src}</span></label>`).join('')}</div></div>
      <label class="field" id="src-other"><span>Qual fonte?</span><input name="fonteOutra" value="${esc(base.fonteOutra || '')}" placeholder="Ex.: livro, YouTube, apostila"></label>
      <div class="row gap"><label class="field grow"><span>Data</span><input type="date" name="date" value="${base.date}"></label></div>
      ${timeRangeFields(base.start || (fromTimer ? rng.start : isNew ? nowHM() : ''), base.end || (fromTimer ? rng.end : ''))}
      ${durationField(mins, `Tempo ${cfg.unit}`)}
      <label class="field"><span>Observação / onde parei</span><textarea name="obs" rows="4" placeholder="Ex.: parei na aula 5, página 120, revisar...">${esc(base.obs || '')}</textarea></label>
      <button class="btn primary block">Salvar</button>
      ${isNew ? '' : '<button type="button" class="btn danger-ghost block" id="del-st">Excluir registro</button>'}</form>`, {
      onMount: (root) => {
        bindTimeRange(root);
        const sync = () => { root.querySelector('#src-other').hidden = root.querySelector('[name=fonte]:checked')?.value !== 'Outras fontes'; };
        root.addEventListener('change', sync); sync();
        root.querySelectorAll('[data-fill]').forEach((b) => b.addEventListener('click', () => { root.querySelector('[name=materia]').value = b.dataset.fill; }));
        root.querySelector('#del-st')?.addEventListener('click', () => confirmSheet('Excluir registro?', 'Este registro sai do histórico.', 'Excluir', () => {
          S().sessions = S().sessions.filter((q) => q !== x); save();
        }));
      },
      onSubmit: (fd) => {
        const m = readDuration(fd);
        const data = { materia: fd.get('materia').trim(), assunto: fd.get('assunto').trim(), fonte: fd.get('fonte') || 'Outras fontes',
          fonteOutra: fd.get('fonteOutra').trim(), date: fd.get('date') || dateKey(), start: fd.get('start') || '', end: fd.get('end') || '', obs: fd.get('obs').trim(),
          seconds: fromTimer && m === mins ? Math.round(seconds) : Math.round(m * 60) };
        if (!data.materia) return false;
        if (isNew) { S().sessions.push({ id: uid(), ...data }); markDone(data.date, data.start); } else Object.assign(x, data);
        if (fromTimer) Object.assign(T(), { running: false, startedAt: null, acc: 0 });
        ui[P + 'Prefill'] = null;
        save(); toast(cfg.done);
      },
    });
  }

  /** marca na rotina o horário mais próximo de quando praticou */
  function markDone(k, start) {
    const ts = tasksFor(k).filter((t) => t.type === cfg.type && !isDone(t, k));
    if (!ts.length) return;
    const m = start ? toMin(start) : toMin(nowHM());
    ts.sort((a, b) => Math.abs(toMin(a.time) - m) - Math.abs(toMin(b.time) - m));
    setDone(ts[0], k, true);
  }

  A[P + 'Start'] = () => { const t = T(); if (t.running) return; t.running = true; t.startedAt = Date.now(); save(); rerender(); };
  A[P + 'Pause'] = () => { const t = T(); if (!t.running) return; t.acc = elapsed(); t.running = false; t.startedAt = null; save(); rerender(); };
  A[P + 'Reset'] = () => confirmSheet('Zerar cronômetro?', 'O tempo atual será descartado.', 'Zerar', () => { Object.assign(T(), { running: false, startedAt: null, acc: 0 }); ui[P + 'Prefill'] = null; save(); });
  A[P + 'Finish'] = () => { A[P + 'Pause'](); pomoStop(cfg); entrySheet(undefined, { seconds: elapsed(), fromTimer: true, prefill: ui[P + 'Prefill'] }); };
  // pomodoro
  A[P + 'Mode'] = (el) => { const p = POMO(cfg); const on = el.dataset.m === 'pomo'; if (p.on === on) return; if (!on) pomoStop(cfg); p.on = on; save(); rerender(); };
  A[P + 'PomoStart'] = () => { const p = POMO(cfg); p.phase = 'foco'; p.endsAt = Date.now() + focusMin('foco') * 60000; p.left = null; A[P + 'Start'](); };
  A[P + 'PomoPause'] = () => { const p = POMO(cfg); if (!p.endsAt) return; p.left = p.endsAt - Date.now(); p.endsAt = null; if (p.phase === 'foco') A[P + 'Pause'](); else { save(); rerender(); } };
  A[P + 'PomoResume'] = () => { const p = POMO(cfg); if (p.left == null) return; p.endsAt = Date.now() + p.left; p.left = null; if (p.phase === 'foco') A[P + 'Start'](); else { save(); rerender(); } };
  A[P + 'PomoSkip'] = () => { const p = POMO(cfg); p.phase = 'foco'; p.endsAt = Date.now() + focusMin('foco') * 60000; p.left = null; A[P + 'Start'](); };
  A[P + 'New'] = () => entrySheet(undefined, { prefill: ui[P + 'Prefill'] });
  A[P + 'Edit'] = (el) => entrySheet(S().sessions.find((x) => x.id === el.dataset.id));
  A[P + 'Resume'] = (el) => {
    const x = S().sessions.find((q) => q.id === el.dataset.id);
    ui[P + 'Prefill'] = { materia: x.materia, assunto: x.assunto, fonte: x.fonte, fonteOutra: x.fonteOutra };
    if (!T().running) A[P + 'Start'](); else rerender();
    toast(x.obs ? `Você parou em: ${x.obs.slice(0, 60)}` : `Bora ${cfg.verb}! ${cfg.icon}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  A[P + 'Filter'] = (el) => { ui[P + 'Filter'] = el.dataset.m; rerender(); };
  C[P + 'Slot'] = (el) => { const r = state.routine.find((x) => x.id === el.dataset.id); if (!r) return; r[el.dataset.f] = el.value; save(); toast('Horário salvo'); rerender(); };
  C[P + 'SlotOn'] = (el) => {
    const key = el.dataset.slot; const d = SLOTS[key];
    let r = slotItem(key);
    if (el.checked) {
      if (!r) { r = { id: uid(), slot: key, time: d.time, end: d.end, title: cfg.slotTitles[key], icon: cfg.icon, color: cfg.grad, days: [], type: cfg.type }; state.routine.push(r); }
      r.slot = key;
      r.days = r.lastDays?.length ? [...r.lastDays] : [1, 2, 3, 4, 5];
      toast(`${d.label.split(' ')[1]} ligada`);
    } else if (r) {
      if (r.days.length) r.lastDays = [...r.days];
      r.days = [];
      toast(`${d.label.split(' ')[1]} desligada`);
    }
    save(); rerender();
  };
  A[P + 'SlotDay'] = (el) => {
    const r = slotItem(el.dataset.slot); if (!r) return;
    const wd = Number(el.dataset.d);
    r.slot = el.dataset.slot;
    r.days = r.days.includes(wd) ? r.days.filter((x) => x !== wd) : [...r.days, wd];
    if (r.days.length) r.lastDays = [...r.days];
    save(); rerender();
  };
  return { [cfg.route]: { render, tab: cfg.route } };
}

export const routes = { ...makeTrack(TRACKS.estudo), ...makeTrack(TRACKS.ingles) };

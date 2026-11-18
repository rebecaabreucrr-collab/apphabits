// Estudo: cronômetro, matéria/assunto/fonte, onde parei, horários e histórico.
import { state, save } from './store.js';
import { esc, dateKey, addDays, fmtTimer, fmtMinutes, fmtShort, fmtLong, uid, pad, toMin, weekStart, WD } from './utils.js';
import { durationField, readDuration, timeRangeFields, rangeFromNow, bindTimeRange, fmtRange } from './forms.js';
import { A, C, ui, sheet, rerender, toast, empty, opt, confirmSheet } from './ui.js';
import { setDone, isDone, tasksFor } from './logic.js';

export const SOURCES = ['IA', 'Pós-graduação', 'Curso', 'Outras fontes'];
const S = () => state.study;
const T = () => state.study.timer;
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const studyElapsed = () => { const t = T(); return t.acc + (t.running && t.startedAt ? (Date.now() - t.startedAt) / 1000 : 0); };
export const studyDay = (k) => S().sessions.filter((x) => x.date === k).reduce((a, x) => a + (x.seconds || 0), 0);
const srcLabel = (x) => (x.fonte === 'Outras fontes' && x.fonteOutra ? x.fonteOutra : x.fonte) || '';
const SLOTS = {
  manha: { label: '☀️ Manhã', time: '08:00', end: '10:00', title: 'Estudar (manhã)' },
  noite: { label: '🌙 Noite', time: '19:00', end: '21:00', title: 'Estudar (noite)' },
};
const slotOf = (r) => r.slot || (toMin(r.time) < 15 * 60 ? 'manha' : 'noite');
const slotItem = (key) => state.routine.find((r) => r.type === 'estudo' && slotOf(r) === key);

function slotBlock(key) {
  const d = SLOTS[key]; const r = slotItem(key);
  const on = !!(r && r.days.length);
  return `<div class="st-slot2 ${on ? 'on' : ''}">
    <label class="toggle-row"><span><b>${d.label}</b><small>${on ? r.days.length === 7 ? 'todos os dias' : `${r.days.length} dia${r.days.length > 1 ? 's' : ''} por semana` : 'desligado'}</small></span>
      <input type="checkbox" class="switch" data-change="studySlotOn" data-slot="${key}" ${on ? 'checked' : ''}></label>
    ${on ? `<div class="st-times"><input type="time" value="${r.time}" data-change="studySlot" data-id="${r.id}" data-f="time"><span>até</span>
      <input type="time" value="${r.end || ''}" data-change="studySlot" data-id="${r.id}" data-f="end"></div>
      <div class="chips st-days">${[1, 2, 3, 4, 5, 6, 0].map((wd) => `<button class="chip ${r.days.includes(wd) ? 'on' : ''}" data-act="studySlotDay" data-slot="${key}" data-d="${wd}">${WD[wd]}</button>`).join('')}</div>` : ''}
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
    <div class="row between"><b>${esc(x.materia || 'Sem matéria')}</b><span class="badge bg-soft-sky">${esc(srcLabel(x))}</span></div>
    ${x.assunto ? `<p class="st-topic">${esc(x.assunto)}</p>` : ''}
    <small>${fmtRange(x) ? fmtRange(x) + ' · ' : ''}${fmtMinutes((x.seconds || 0) / 60)} de estudo</small>
    ${x.obs ? `<p class="note"><b>Onde parei:</b> ${esc(x.obs).replace(/\n/g, '<br>')}</p>` : ''}
    <div class="row gap st-actions"><button class="btn small primary" data-act="studyResume" data-id="${x.id}">▶︎ Retomar</button>
      <button class="btn small ghost" data-act="studyEdit" data-id="${x.id}">Editar</button></div>
  </article>`;
}

function renderStudy() {
  const k = dateKey();
  const t = T(); const el = studyElapsed();
  const all = [...S().sessions].sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')));
  const last = all[0];
  const ws = weekStart(k);
  const week = S().sessions.filter((x) => x.date >= ws).reduce((a, x) => a + (x.seconds || 0), 0);
  const materias = [...new Set(all.map((x) => x.materia).filter(Boolean))];
  const f = ui.studyFilter || '';
  const list = f ? all.filter((x) => x.materia === f) : all;
  const byDay = {};
  list.forEach((x) => (byDay[x.date] ||= []).push(x));
  const pre = ui.studyPrefill;
  const btns = t.running
    ? `<button class="btn glass grow" data-act="studyPause">⏸ Pausar</button><button class="btn white grow" data-act="studyFinish">⏹ Finalizar</button>`
    : el > 0
      ? `<button class="btn glass grow" data-act="studyStart">▶︎ Continuar</button><button class="btn white grow" data-act="studyFinish">⏹ Finalizar</button><button class="btn glass" data-act="studyReset" aria-label="Zerar">↺</button>`
      : `<button class="btn white grow big" data-act="studyStart">▶︎ Começar a estudar</button>`;
  return `<header class="page-head top"><h1>Estudo</h1><div class="ph-right"><button class="link" data-act="studyNew">+ Registrar</button></div></header>
  <section class="card timer-card bg-grad-sky ${t.running ? 'running' : ''}">
    <small>${t.running ? 'Estudando…' : el > 0 ? 'Pausado' : 'Cronômetro de estudo'}</small>
    <div class="timer" data-study-timer>${fmtTimer(el)}</div>
    ${pre ? `<small class="st-pre">Retomando: <b>${esc(pre.materia)}${pre.assunto ? ' · ' + esc(pre.assunto) : ''}</b></small>` : ''}
    <div class="row gap mt">${btns}</div>
  </section>
  <div class="stats three">
    <div class="stat"><span>⏱️</span><b>${fmtMinutes(studyDay(k) / 60)}</b><small>hoje</small></div>
    <div class="stat"><span>🗓️</span><b>${fmtMinutes(week / 60)}</b><small>esta semana</small></div>
    <div class="stat"><span>📚</span><b>${new Set(S().sessions.map((x) => x.date)).size}</b><small>dias estudados</small></div>
  </div>
  ${last ? `<section class="card resume-card"><div class="card-head"><h2>📌 Continuar de onde parei</h2><small>${fmtShort(last.date)}</small></div>${sessionCard(last)}</section>` : ''}
  <section class="card"><div class="card-head"><h2>⏰ Horários de estudo</h2></div>
    <p class="small muted">Ligue manhã, noite ou os dois e marque os dias de cada um. Eles aparecem na rotina do dia.</p>
    ${Object.keys(SLOTS).map(slotBlock).join('')}
    ${weekOverview()}
  </section>
  <section><div class="card-head pad"><h2>📖 Histórico de estudo</h2></div>
    ${materias.length > 1 ? `<div class="chips scroll">${['', ...materias].map((m) => `<button class="chip ${f === m ? 'on' : ''}" data-act="studyFilter" data-m="${esc(m)}">${m ? esc(m) : 'Todas'}</button>`).join('')}</div>` : ''}
    ${Object.keys(byDay).length ? Object.entries(byDay).map(([d, xs]) => `<section class="card st-day">
      <div class="card-head"><h2>${fmtLong(d)}</h2><small>${fmtMinutes(xs.reduce((a, x) => a + (x.seconds || 0), 0) / 60)}</small></div>
      ${xs.map(sessionCard).join('')}</section>`).join('')
      : empty('📚', 'Nenhum estudo registrado', 'Use o cronômetro ou toque em "+ Registrar" para guardar o que estudou.')}
  </section>`;
}

function studySheet(x, { seconds = 0, fromTimer = false, prefill } = {}) {
  const isNew = !x;
  const base = x || { date: dateKey(), start: '', materia: prefill?.materia || '', assunto: prefill?.assunto || '', fonte: prefill?.fonte || 'Curso',
    fonteOutra: prefill?.fonteOutra || '', obs: '', seconds };
  const all = S().sessions;
  const dl = (name, vals) => `<datalist id="${name}">${[...new Set(vals.filter(Boolean))].map((v) => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  const mins = Math.max(fromTimer ? 1 : 0, Math.round((base.seconds || 0) / 60));
  const rng = rangeFromNow(fromTimer ? seconds : 0);
  sheet(fromTimer ? `Estudo de ${fmtTimer(seconds)} ✨` : isNew ? 'Registrar estudo' : 'Editar estudo', `<form class="form">
    <label class="field"><span>Matéria</span><input name="materia" list="dl-mat" required value="${esc(base.materia)}" placeholder="Ex.: Direito Administrativo">${dl('dl-mat', all.map((s) => s.materia))}</label>
    <label class="field"><span>Assunto</span><input name="assunto" list="dl-ass" value="${esc(base.assunto)}" placeholder="Ex.: Licitações – modalidades">${dl('dl-ass', all.map((s) => s.assunto))}</label>
    <div class="field"><span>Fonte</span><div class="chips">${SOURCES.map((src) => `<label class="chip"><input type="radio" name="fonte" value="${src}" ${base.fonte === src ? 'checked' : ''}><span>${src}</span></label>`).join('')}</div></div>
    <label class="field" id="src-other"><span>Qual fonte?</span><input name="fonteOutra" value="${esc(base.fonteOutra || '')}" placeholder="Ex.: livro, YouTube, apostila"></label>
    <div class="row gap"><label class="field grow"><span>Data</span><input type="date" name="date" value="${base.date}"></label>
    </div>
    ${timeRangeFields(base.start || (fromTimer ? rng.start : isNew ? nowHM() : ''), base.end || (fromTimer ? rng.end : ''))}
    ${durationField(mins, 'Tempo de estudo')}
    <label class="field"><span>Observação / onde parei</span><textarea name="obs" rows="4" placeholder="Ex.: parei na aula 5, página 120, revisar o art. 37...">${esc(base.obs || '')}</textarea></label>
    <button class="btn primary block">Salvar estudo</button>
    ${isNew ? '' : '<button type="button" class="btn danger-ghost block" id="del-st">Excluir registro</button>'}</form>`, {
    onMount: (root) => {
      bindTimeRange(root);
      const sync = () => { root.querySelector('#src-other').hidden = root.querySelector('[name=fonte]:checked')?.value !== 'Outras fontes'; };
      root.addEventListener('change', sync); sync();
      root.querySelector('#del-st')?.addEventListener('click', () => confirmSheet('Excluir registro?', 'Este estudo sai do histórico.', 'Excluir', () => {
        S().sessions = S().sessions.filter((q) => q !== x); save();
      }));
    },
    onSubmit: (fd) => {
      const m = readDuration(fd);
      const data = { materia: fd.get('materia').trim(), assunto: fd.get('assunto').trim(), fonte: fd.get('fonte') || 'Outras fontes',
        fonteOutra: fd.get('fonteOutra').trim(), date: fd.get('date') || dateKey(), start: fd.get('start') || '', end: fd.get('end') || '', obs: fd.get('obs').trim(),
        seconds: fromTimer && m === mins ? Math.round(seconds) : Math.round(m * 60) };
      if (!data.materia) return false;
      if (isNew) {
        S().sessions.push({ id: uid(), ...data });
        markStudyDone(data.date, data.start);
      } else Object.assign(x, data);
      if (fromTimer) Object.assign(T(), { running: false, startedAt: null, acc: 0 });
      ui.studyPrefill = null;
      save(); toast('Estudo salvo 📚');
    },
  });
}

/** marca na rotina o horário de estudo mais próximo de quando estudou */
function markStudyDone(k, start) {
  const ts = tasksFor(k).filter((t) => t.type === 'estudo' && !isDone(t, k));
  if (!ts.length) return;
  const m = start ? toMin(start) : toMin(nowHM());
  ts.sort((a, b) => Math.abs(toMin(a.time) - m) - Math.abs(toMin(b.time) - m));
  setDone(ts[0], k, true);
}

A.studyStart = () => { const t = T(); if (t.running) return; t.running = true; t.startedAt = Date.now(); save(); rerender(); };
A.studyPause = () => { const t = T(); if (!t.running) return; t.acc = studyElapsed(); t.running = false; t.startedAt = null; save(); rerender(); };
A.studyReset = () => confirmSheet('Zerar cronômetro?', 'O tempo atual será descartado.', 'Zerar', () => { Object.assign(T(), { running: false, startedAt: null, acc: 0 }); ui.studyPrefill = null; save(); });
A.studyFinish = () => { A.studyPause(); studySheet(undefined, { seconds: studyElapsed(), fromTimer: true, prefill: ui.studyPrefill }); };
A.studyNew = () => studySheet(undefined, { prefill: ui.studyPrefill });
A.studyEdit = (el) => studySheet(S().sessions.find((x) => x.id === el.dataset.id));
A.studyResume = (el) => {
  const x = S().sessions.find((q) => q.id === el.dataset.id);
  ui.studyPrefill = { materia: x.materia, assunto: x.assunto, fonte: x.fonte, fonteOutra: x.fonteOutra };
  if (!T().running) A.studyStart(); else rerender();
  toast(x.obs ? `Você parou em: ${x.obs.slice(0, 60)}` : 'Bons estudos! 📚');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
A.studyFilter = (el) => { ui.studyFilter = el.dataset.m; rerender(); };
C.studySlot = (el) => { const r = state.routine.find((x) => x.id === el.dataset.id); if (!r) return; r[el.dataset.f] = el.value; save(); toast('Horário salvo'); rerender(); };
C.studySlotOn = (el) => {
  const key = el.dataset.slot; const d = SLOTS[key];
  let r = slotItem(key);
  if (el.checked) {
    if (!r) { r = { id: uid(), slot: key, time: d.time, end: d.end, title: d.title, icon: '📚', color: 'sky', days: [], type: 'estudo' }; state.routine.push(r); }
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
A.studySlotDay = (el) => {
  const r = slotItem(el.dataset.slot); if (!r) return;
  const wd = Number(el.dataset.d);
  r.slot = el.dataset.slot;
  r.days = r.days.includes(wd) ? r.days.filter((x) => x !== wd) : [...r.days, wd];
  if (r.days.length) r.lastDays = [...r.days];
  save(); rerender();
};

export const routes = { estudo: { render: renderStudy, tab: 'estudo' } };

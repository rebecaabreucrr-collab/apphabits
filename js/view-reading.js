// Leitura: cronômetro, livros, páginas e anotações.
import { state, save } from './store.js';
import { esc, dateKey, fmtTimer, fmtMinutes, fmtShort, uid } from './utils.js';
import { A, C, ui, sheet, rerender, toast, empty, pageHead, bar, opt, ring, go, confirmSheet } from './ui.js';
import { timerElapsed, readingDay, bookStats, markTypeDone } from './logic.js';
import { iconize } from './icons.js';
import { durationField, readDuration, timeRangeFields, rangeFromNow, bindTimeRange, fmtRange } from './forms.js';

const T = () => state.reading.timer;
export const bookStart = (b) => b.started || state.reading.sessions.filter((x) => x.bookId === b.id).map((x) => x.date).sort()[0] || b.created || null;
function bookCardFn(x) {
  const s = bookStats(x);
  const st = bookStart(x);
  const dates = x.finished ? `${st ? fmtShort(st) + ' → ' : ''}concluído ${fmtShort(x.finished)}` : st ? `começou em ${fmtShort(st)}` : '';
  return `<a class="card book" href="#/livro?id=${x.id}">
    <div class="book-cover bg-grad-${x.color || 'orange'}">${esc((x.title || '?').slice(0, 1))}</div>
    <div class="grow"><b>${esc(x.title)}</b><small>${x.author ? esc(x.author) + ' · ' : ''}pág. ${x.current || 0} de ${x.pages || '?'}</small>
      ${bar(s.pct)}<small>${Math.round(s.pct * 100)}%${s.etaMin && !x.finished ? ` · faltam ~${fmtMinutes(s.etaMin)}` : ''}${x.id === state.reading.activeBookId && !x.finished ? ' · <b>lendo agora</b>' : ''}</small>
      ${dates ? `<small class="book-dates">🗓️ ${dates}</small>` : ''}</div></a>`;
}
const activeBook = () => state.books.find((b) => b.id === state.reading.activeBookId) || null;

function renderReading() {
  const k = dateKey();
  const t = T(); const el = timerElapsed();
  const b = activeBook();
  const day = readingDay(k);
  const pace = day.sec ? day.pages / (day.sec / 60) : 0;
  const btns = t.running
    ? `<button class="btn glass grow" data-act="timerPause">⏸ Pausar</button><button class="btn white grow" data-act="timerFinish">⏹ Finalizar</button>`
    : el > 0
      ? `<button class="btn glass grow" data-act="timerStart">▶︎ Continuar</button><button class="btn white grow" data-act="timerFinish">⏹ Finalizar</button><button class="btn glass" data-act="timerReset" aria-label="Zerar">↺</button>`
      : `<button class="btn white grow big" data-act="timerStart">▶︎ Iniciar leitura</button>`;
  const books = state.books.filter((x) => !x.finished);
  const finished = state.books.filter((x) => x.finished);
  const bookCard = bookCardFn;
  return `<header class="page-head top"><h1>Leitura</h1><div class="ph-right"><button class="link" data-act="bookNew">+ Livro</button></div></header>
  <section class="card timer-card bg-grad-orange ${t.running ? 'running' : ''}">
    <small>${t.running ? 'Lendo agora…' : el > 0 ? 'Pausado' : 'Cronômetro de leitura'}</small>
    <div class="timer" data-timer>${fmtTimer(el)}</div>
    ${state.books.length ? `<select class="glass-select" data-change="readBook">${opt('', 'Escolha o livro', '')}${state.books.filter((x) => !x.finished || x.id === state.reading.activeBookId).map((x) => opt(x.id, x.title, state.reading.activeBookId)).join('')}</select>`
      : '<button class="btn glass block" data-act="bookNew">+ Cadastrar o livro que está lendo</button>'}
    <div class="row gap mt">${btns}</div>
  </section>
  <div class="stats three">
    <div class="stat"><span>⏱️</span><b>${fmtMinutes(day.sec / 60)}</b><small>hoje</small></div>
    <div class="stat"><span>📄</span><b>${day.pages}</b><small>páginas hoje</small></div>
    <div class="stat"><span>⚡</span><b>${pace ? pace.toFixed(1) : '–'}</b><small>pág/min</small></div>
  </div>
  <a class="card done-books" href="#/livros"><span class="t-icon bg-soft-violet">🏆</span>
    <div class="grow"><b>${finished.length} livro${finished.length === 1 ? '' : 's'} concluído${finished.length === 1 ? '' : 's'}</b><small>Ver todos os livros e anotações</small></div><span class="t-go">›</span></a>
  ${day.sessions.length ? `<section class="card"><h2>📝 Leituras de hoje</h2>${day.sessions.map(sessionItem).join('')}</section>` : ''}
  <section><div class="card-head pad"><h2>Lendo</h2><button class="link" data-act="manualSession">+ Registrar sem cronômetro</button></div>
  ${books.length ? books.map(bookCard).join('') : empty('📚', 'Nenhum livro ainda', 'Cadastre o livro com o total de páginas para acompanhar o progresso.', '<button class="btn primary" data-act="bookNew">+ Adicionar livro</button>')}</section>
`;
}

function sessionItem(s) {
  const b = state.books.find((x) => x.id === s.bookId);
  const pages = Math.max(0, (s.to || 0) - (s.from || 0));
  const min = (s.seconds || 0) / 60;
  return `<div class="session"><div class="row between"><b>${fmtShort(s.date)}${fmtRange(s) ? ' · ' + fmtRange(s) : ''} · ${esc(b?.title || 'Livro')}</b>
      <button class="icon-btn sm" data-act="sessionDel" data-id="${s.id}" aria-label="Excluir">✕</button></div>
    <small class="muted">pág. ${s.from} → ${s.to} · <b>${pages} páginas em ${fmtMinutes(min)}</b>${min ? ` · ${(pages / min).toFixed(1)} pág/min` : ''}</small>
    ${s.notes ? `<p class="note">${esc(s.notes).replace(/\n/g, '<br>')}</p>` : ''}</div>`;
}

function sessionSheet({ seconds = 0, fromTimer = false } = {}) {
  if (!state.books.length) { toast('Cadastre um livro primeiro'); return A.bookNew(); }
  const b = activeBook() || state.books[0];
  const mins = Math.max(1, Math.round(seconds / 60));
  const rng = rangeFromNow(seconds);
  sheet(fromTimer ? `Leitura de ${fmtTimer(seconds)} ✨` : 'Registrar leitura', `<form class="form">
    <label class="field"><span>Livro</span><select name="book" id="sb">${state.books.map((x) => opt(x.id, x.title, b.id)).join('')}</select></label>
    <div class="row gap">
      <label class="field grow"><span>Comecei na pág.</span><input type="number" inputmode="numeric" name="from" id="sf" value="${b.current || 0}" min="0"></label>
      <label class="field grow"><span>Parei na pág.</span><input type="number" inputmode="numeric" name="to" id="st" value="" min="0" placeholder="${b.current || 0}" autofocus></label>
    </div>
    ${timeRangeFields(rng.start, rng.end)}
    ${durationField(seconds ? mins : 0, 'Tempo de leitura')}
    <p class="preview" id="sp"></p>
    <label class="field"><span>Anotações do que li hoje</span><textarea name="notes" rows="5" placeholder="Ideias, frases marcantes, resumo do capítulo..."></textarea></label>
    <button class="btn primary block">Salvar leitura</button></form>`, {
    onMount: (root) => {
      const $ = (id) => root.querySelector(id);
      const upd = () => {
        const p = Math.max(0, Number($('#st').value || 0) - Number($('#sf').value || 0));
        const m = readDuration(root);
        $('#sp').textContent = $('#st').value ? `📖 ${p} páginas em ${fmtMinutes(m)}${m ? ` · ${(p / m).toFixed(1)} pág/min` : ''}` : '';
        iconize($('#sp'));
      };
      $('#sb').addEventListener('change', () => { const x = state.books.find((y) => y.id === $('#sb').value); $('#sf').value = x?.current || 0; upd(); });
      root.addEventListener('input', upd);
      bindTimeRange(root, upd);
    },
    onSubmit: (fd) => {
      const book = state.books.find((x) => x.id === fd.get('book'));
      const from = Number(fd.get('from') || 0); const to = Number(fd.get('to') || from);
      const m = readDuration(fd);
      if (!m) { toast('Coloque quanto tempo você leu'); return false; }
      const secs = fromTimer && m === mins ? Math.round(seconds) : Math.round(m * 60);
      if (to < from) { toast('A página final deve ser maior que a inicial'); return false; }
      state.reading.sessions.push({ id: uid(), date: dateKey(), bookId: book.id, seconds: secs, from, to, notes: fd.get('notes').trim(),
        start: fd.get('start') || '', end: fd.get('end') || '' });
      book.current = Math.max(book.current || 0, to);
      if (book.pages && book.current >= book.pages && !book.finished) { book.finished = dateKey(); toast(`Livro concluído! 🎉 ${book.title}`); }
      else toast('Leitura salva 📖');
      state.reading.activeBookId = book.id;
      if (fromTimer) Object.assign(state.reading.timer, { running: false, startedAt: null, acc: 0 });
      markTypeDone(dateKey(), 'leitura', true);
      save();
    },
  });
}

A.timerStart = () => {
  const t = T(); if (t.running) return;
  t.running = true; t.startedAt = Date.now(); save(); rerender();
};
A.timerPause = () => {
  const t = T(); if (!t.running) return;
  t.acc = timerElapsed(); t.running = false; t.startedAt = null; save(); rerender();
};
A.timerReset = () => confirmSheet('Zerar cronômetro?', 'O tempo atual será descartado.', 'Zerar', () => {
  Object.assign(T(), { running: false, startedAt: null, acc: 0 }); save();
});
A.timerFinish = () => { A.timerPause(); sessionSheet({ seconds: timerElapsed(), fromTimer: true }); };
A.manualSession = () => sessionSheet();
A.sessionDel = (el) => confirmSheet('Excluir registro?', 'Esta sessão de leitura e as anotações serão apagadas.', 'Excluir', () => {
  state.reading.sessions = state.reading.sessions.filter((s) => s.id !== el.dataset.id); save();
});
C.readBook = (el) => { state.reading.activeBookId = el.value || null; save(); rerender(); };

function bookSheet(b) {
  const isNew = !b;
  sheet(isNew ? 'Novo livro' : 'Editar livro', `<form class="form">
    <label class="field"><span>Título</span><input name="title" required value="${esc(b?.title || '')}"></label>
    <label class="field"><span>Autor(a)</span><input name="author" value="${esc(b?.author || '')}"></label>
    <div class="row gap"><label class="field grow"><span>Total de páginas</span><input type="number" inputmode="numeric" name="pages" required min="1" value="${b?.pages || ''}"></label>
    <label class="field grow"><span>Estou na página</span><input type="number" inputmode="numeric" name="current" min="0" value="${b?.current || 0}"></label></div>
    <div class="row gap"><label class="field grow"><span>Comecei a ler em</span><input type="date" name="started" value="${b ? bookStart(b) || '' : dateKey()}"></label>
    <label class="field grow"><span>Terminei em</span><input type="date" name="finished" value="${b?.finished || ''}"></label></div>
    <button class="btn primary block mt">${isNew ? 'Adicionar livro' : 'Salvar'}</button></form>`, {
    onSubmit: (fd) => {
      const data = { title: fd.get('title').trim(), author: fd.get('author').trim(), pages: Number(fd.get('pages')), current: Number(fd.get('current') || 0),
        started: fd.get('started') || null };
      const fin = fd.get('finished') || null;
      if (isNew) {
        const colors = ['orange', 'rose', 'violet', 'sky', 'emerald', 'amber'];
        const nb = { id: uid(), ...data, color: colors[state.books.length % colors.length], finished: fin, created: dateKey(), notes: [] };
        state.books.push(nb);
        if (!activeBook()) state.reading.activeBookId = nb.id;
      } else {
        Object.assign(b, data);
        b.finished = fin || (b.pages && b.current >= b.pages ? (b.finished || dateKey()) : null);
        if (fin && b.pages && b.current < b.pages) b.current = b.pages;
      }
      save(); toast('Livro salvo');
    },
  });
}
A.bookNew = () => bookSheet();

function renderBook(p) {
  const b = state.books.find((x) => x.id === p.get('id'));
  if (!b) return `${pageHead('Livro', '#/leitura')}${empty('📕', 'Livro não encontrado', '')}`;
  const s = bookStats(b);
  return `${pageHead(b.title, '#/leitura', `<button class="link" data-act="bookEdit" data-id="${b.id}">Editar</button>`)}
  <p class="sub">${b.author ? esc(b.author) + ' · ' : ''}${b.pages} páginas</p>
  <div class="book-when"><span>🗓️ Comecei: <b>${bookStart(b) ? fmtShort(bookStart(b)) : '—'}</b></span><span>🏁 Terminei: <b>${b.finished ? fmtShort(b.finished) : 'lendo'}</b></span></div>
  <section class="card row gap center">
    ${ring(s.pct, { size: 110, stroke: 11, label: `${Math.round(s.pct * 100)}%`, sub: `pág. ${b.current || 0}` })}
    <div class="grow kv">
      <div><small>Páginas lidas</small><b>${Math.max(s.pages, b.current || 0)}</b></div>
      <div><small>Tempo total</small><b>${fmtMinutes(s.sec / 60)}</b></div>
      <div><small>Ritmo médio</small><b>${s.pace ? s.pace.toFixed(1) + ' pág/min' : '–'}</b></div>
      <div><small>Para terminar</small><b>${s.remaining} pág.${s.etaMin ? ` · ~${fmtMinutes(s.etaMin)}` : ''}</b></div>
    </div>
  </section>
  ${b.id !== state.reading.activeBookId ? `<button class="btn ghost block" data-act="bookActive" data-id="${b.id}">📌 Definir como leitura atual</button>` : ''}
  ${notebook(b)}
  <details class="card"><summary><b>⏱️ Sessões de leitura (${s.sessions.length})</b></summary>
    ${s.sessions.length ? [...s.sessions].reverse().map(sessionItem).join('') : '<p class="muted">Nenhuma leitura registrada ainda. Use o cronômetro na aba Leitura.</p>'}</details>
  <button class="btn danger-ghost block" data-act="bookDel" data-id="${b.id}">Excluir livro</button>`;
}
function notebook(b) {
  const items = [
    ...state.reading.sessions.filter((x) => x.bookId === b.id && x.notes).map((x) => ({ date: x.date, page: x.to ? `pág. ${x.from}–${x.to}` : '', text: x.notes, sid: x.id })),
    ...(b.notes || []).map((n) => ({ date: n.date, page: n.page ? `pág. ${n.page}` : '', text: n.text, nid: n.id })),
  ].sort((x, y) => x.date.localeCompare(y.date));
  return `<section class="notebook">
    <div class="nb-head"><h2>📝 Caderno de anotações</h2><button class="link" data-act="noteNew" data-id="${b.id}">+ Anotação</button></div>
    ${items.length ? items.map((n) => `<article class="nb-note" ${n.nid ? `data-act="noteEdit" data-id="${b.id}" data-n="${n.nid}"` : ''}>
      <small>${fmtShort(n.date)}${n.page ? ' · ' + n.page : ''}</small><p>${esc(n.text).replace(/\n/g, '<br>')}</p></article>`).join('')
      : '<p class="nb-empty">Suas anotações deste livro aparecem aqui, como num caderno. Escreva ao finalizar o cronômetro ou toque em "+ Anotação".</p>'}
  </section>`;
}
function noteSheet(b, n) {
  sheet(n ? 'Editar anotação' : 'Nova anotação', `<form class="form">
    <div class="row gap"><label class="field grow"><span>Data</span><input type="date" name="date" value="${n?.date || dateKey()}"></label>
    <label class="field grow"><span>Página</span><input type="number" inputmode="numeric" name="page" min="0" value="${n?.page || b.current || ''}"></label></div>
    <label class="field"><span>Anotação</span><textarea name="text" rows="6" required placeholder="Ideias, frases marcantes, resumo...">${esc(n?.text || '')}</textarea></label>
    <button class="btn primary block">Salvar</button>
    ${n ? '<button type="button" class="btn danger-ghost block" id="del-note">Excluir anotação</button>' : ''}</form>`, {
    onMount: (root) => root.querySelector('#del-note')?.addEventListener('click', () => { b.notes = b.notes.filter((x) => x !== n); save(); A.closeSheet(); rerender(); }),
    onSubmit: (fd) => {
      const data = { date: fd.get('date') || dateKey(), page: fd.get('page') || '', text: fd.get('text').trim() };
      if (!data.text) return false;
      if (n) Object.assign(n, data); else (b.notes ||= []).push({ id: uid(), ...data });
      save(); toast('Anotação salva');
    },
  });
}
A.noteNew = (el) => noteSheet(state.books.find((x) => x.id === el.dataset.id));
A.noteEdit = (el) => { const b = state.books.find((x) => x.id === el.dataset.id); noteSheet(b, b.notes.find((x) => x.id === el.dataset.n)); };

function renderLibrary() {
  const f = ui.libFilter || 'todos';
  const list = state.books.filter((b) => f === 'todos' || (f === 'concluidos' ? b.finished : !b.finished))
    .sort((a, b) => (b.finished || b.created || '').localeCompare(a.finished || a.created || ''));
  const done = state.books.filter((b) => b.finished).length;
  return `${pageHead('Meus livros', '#/leitura', '<button class="link" data-act="bookNew">+ Livro</button>')}
  <div class="stats three">
    <div class="stat"><span>🏆</span><b>${done}</b><small>concluídos</small></div>
    <div class="stat"><span>📖</span><b>${state.books.length - done}</b><small>lendo</small></div>
    <div class="stat"><span>📄</span><b>${state.books.filter((b) => b.finished).reduce((a, b) => a + (b.pages || 0), 0)}</b><small>páginas lidas</small></div>
  </div>
  <div class="seg">${[['todos', 'Todos'], ['concluidos', 'Concluídos'], ['lendo', 'Lendo']].map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="libFilter" data-f="${k}">${l}</button>`).join('')}</div>
  ${list.length ? list.map(bookCardFn).join('') : empty('📚', 'Nenhum livro aqui', 'Os livros aparecem aqui conforme você cadastra e termina.')}`;
}
A.libFilter = (el) => { ui.libFilter = el.dataset.f; rerender(); };

A.bookEdit = (el) => bookSheet(state.books.find((x) => x.id === el.dataset.id));
A.bookActive = (el) => { state.reading.activeBookId = el.dataset.id; save(); toast('Livro definido como atual'); rerender(); };
A.bookDel = (el) => confirmSheet('Excluir livro?', 'O livro e todo o diário de leitura dele serão apagados.', 'Excluir', () => {
  state.books = state.books.filter((x) => x.id !== el.dataset.id);
  state.reading.sessions = state.reading.sessions.filter((s) => s.bookId !== el.dataset.id);
  if (state.reading.activeBookId === el.dataset.id) state.reading.activeBookId = null;
  save(); go('#/leitura');
});

export const routes = {
  leitura: { render: renderReading, tab: 'leitura' },
  livro: { render: renderBook, tab: 'leitura' },
  livros: { render: renderLibrary, tab: 'leitura' },
};

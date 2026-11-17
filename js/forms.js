// Formulários compartilhados: tarefa (rotina/avulsa) e produto.
import { state, save } from './store.js';
import { esc, uid, WD, dateKey, fmtShort } from './utils.js';
import { EMOJIS, TASK_TYPES, CATEGORIES, COLORS } from './defaults.js';
import { sheet, closeSheet, rerender, toast, opt, A, confirmSheet } from './ui.js';

const dayChips = (days) => `<div class="chips days">${[1, 2, 3, 4, 5, 6, 0].map((d) =>
  `<label class="chip"><input type="checkbox" name="days" value="${d}" ${days.includes(d) ? 'checked' : ''}><span>${WD[d]}</span></label>`).join('')}</div>`;

const emojiGrid = (sel) => `<div class="emoji-grid">${EMOJIS.map((e) =>
  `<label><input type="radio" name="icon" value="${e}" ${e === sel ? 'checked' : ''}><span>${e}</span></label>`).join('')}</div>`;

const colorRow = (sel) => `<div class="color-row">${COLORS.map((c) =>
  `<label><input type="radio" name="color" value="${c}" ${c === sel ? 'checked' : ''}><span class="dot bg-${c}"></span></label>`).join('')}</div>`;

/** task: item existente (rotina ou avulso) ou undefined para criar */
export function taskSheet(task, { date = dateKey(), defaultRepeat = 'once' } = {}) {
  const isNew = !task;
  const kind = task ? (state.routine.includes(task) ? 'routine' : 'once') : null;
  const t = task || { title: '', time: '', end: '', icon: '✅', color: 'rose', days: [], type: 'normal', link: '' };
  const repeat = kind || defaultRepeat;
  sheet(isNew ? 'Nova tarefa' : 'Editar tarefa', `
    <form class="form">
      <label class="field"><span>O que fazer?</span><input name="title" required value="${esc(t.title)}" placeholder="Ex.: Tomar vitamina"></label>
      <div class="row gap">
        <label class="field grow"><span>Horário</span><input type="time" name="time" value="${esc(t.time)}"></label>
        <label class="field grow"><span>Até (opcional)</span><input type="time" name="end" value="${esc(t.end || '')}"></label>
      </div>
      ${isNew ? `<div class="seg" role="radiogroup">
          <label><input type="radio" name="repeat" value="once" ${repeat === 'once' ? 'checked' : ''}><span>Só em ${fmtShort(date)}</span></label>
          <label><input type="radio" name="repeat" value="routine" ${repeat === 'routine' ? 'checked' : ''}><span>Repetir na semana</span></label>
        </div>` : `<input type="hidden" name="repeat" value="${kind}">`}
      ${kind === 'once' ? `<label class="field"><span>Data</span><input type="date" name="date" value="${esc(t.date)}"></label>` : ''}
      <div class="field repeat-only"><span>Dias da semana</span>${dayChips(t.days.length ? t.days : [1, 2, 3, 4, 5, 6, 0])}</div>
      <label class="toggle-line repeat-only"><input type="checkbox" name="flexWeekly" ${t.flexWeekly ? 'checked' : ''}>
        <span>Fazer só <b>uma vez</b> entre os dias marcados (ex.: quinta <i>ou</i> sexta)</span></label>
      <div class="field"><span>Ícone</span>${emojiGrid(t.icon)}</div>
      <div class="field"><span>Cor</span>${colorRow(t.color || 'rose')}</div>
      <details class="adv"><summary>Opções avançadas</summary>
        <label class="field"><span>Tipo</span><select name="type">${Object.entries(TASK_TYPES).map(([k, v]) => opt(k, v, t.type)).join('')}</select></label>
        <label class="field"><span>Rotina de skincare (se for skincare)</span><select name="routineKey">${opt('am', 'Manhã', t.routineKey)}${opt('pm', 'Noite', t.routineKey)}</select></label>
        <label class="field"><span>Link (opcional)</span><input type="url" name="link" value="${esc(t.link || '')}" placeholder="https://..."></label>
      </details>
      <button class="btn primary block mt" type="submit">${isNew ? 'Adicionar' : 'Salvar'}</button>
      ${isNew ? '' : `<button class="btn danger-ghost block" type="button" id="del-task">Excluir tarefa</button>`}
    </form>`, {
    onMount: (root) => {
      const form = root.querySelector('form');
      const sync = () => {
        const r = form.querySelector('[name=repeat]:checked, [name=repeat][type=hidden]')?.value;
        root.querySelectorAll('.repeat-only').forEach((el) => { el.hidden = r !== 'routine'; });
      };
      form.addEventListener('change', sync); sync();
      root.querySelector('#del-task')?.addEventListener('click', () => {
        confirmSheet('Excluir tarefa?', `"${t.title}" será removida${kind === 'routine' ? ' de todos os dias' : ''}.`, 'Excluir', () => {
          if (kind === 'routine') state.routine = state.routine.filter((x) => x !== task);
          else state.oneOff = state.oneOff.filter((x) => x !== task);
          save(); toast('Tarefa excluída');
        });
      });
    },
    onSubmit: (fd) => {
      const data = {
        title: fd.get('title').trim(), time: fd.get('time') || '', end: fd.get('end') || '',
        icon: fd.get('icon') || '✅', color: fd.get('color') || 'rose', type: fd.get('type') || 'normal',
        link: (fd.get('link') || '').trim(), routineKey: fd.get('routineKey') || 'am',
      };
      if (!data.title) return false;
      const rep = fd.get('repeat');
      if (rep === 'routine') {
        data.days = fd.getAll('days').map(Number);
        data.flexWeekly = !!fd.get('flexWeekly');
        if (!data.days.length) { toast('Escolha ao menos um dia'); return false; }
      }
      if (isNew) {
        if (rep === 'routine') state.routine.push({ id: uid(), ...data });
        else state.oneOff.push({ id: uid(), date, ...data });
      } else {
        Object.assign(task, data);
        if (kind === 'once' && fd.get('date')) task.date = fd.get('date');
      }
      save(); toast(isNew ? 'Tarefa adicionada ✨' : 'Tarefa salva');
    },
  });
}

/** produto: existente ou undefined. onSaved(produto) opcional */
export function productSheet(p, { category = 'skincare', onSaved } = {}) {
  const isNew = !p;
  const x = p || { name: '', brand: '', category, notes: '', low: false };
  sheet(isNew ? 'Novo produto' : 'Editar produto', `
    <form class="form">
      <label class="field"><span>Nome do produto</span><input name="name" required value="${esc(x.name)}" placeholder="Ex.: Máscara Hidra Intense"></label>
      <label class="field"><span>Marca</span><input name="brand" value="${esc(x.brand)}" placeholder="Ex.: Lola, La Roche-Posay..."></label>
      <label class="field"><span>Categoria</span><select name="category">${Object.entries(CATEGORIES).map(([k, v]) => opt(k, v, x.category)).join('')}</select></label>
      <label class="field"><span>Observações</span><textarea name="notes" rows="2" placeholder="Para que serve, como usar, onde comprar...">${esc(x.notes)}</textarea></label>
      <label class="toggle-line"><input type="checkbox" name="low" ${x.low ? 'checked' : ''}><span>Está acabando (lembrar de comprar)</span></label>
      <button class="btn primary block mt" type="submit">${isNew ? 'Adicionar produto' : 'Salvar'}</button>
      ${isNew ? '' : `<button class="btn danger-ghost block" type="button" id="del-prod">Excluir produto</button>`}
    </form>`, {
    onMount: (root) => root.querySelector('#del-prod')?.addEventListener('click', () => {
      confirmSheet('Excluir produto?', `"${x.name}" será removido da lista.`, 'Excluir', () => {
        state.products = state.products.filter((q) => q !== p); save();
      });
    }),
    onSubmit: (fd) => {
      const data = { name: fd.get('name').trim(), brand: fd.get('brand').trim(), category: fd.get('category'),
        notes: fd.get('notes').trim(), low: !!fd.get('low') };
      if (!data.name) return false;
      let prod = p;
      if (isNew) { prod = { id: uid(), ...data }; state.products.push(prod); } else Object.assign(p, data);
      save(); onSaved?.(prod); toast('Produto salvo');
    },
  });
}

export const productOptions = (sel, { allowNone = true, cat } = {}) => {
  const list = [...state.products].sort((a, b) => (a.category === cat ? -1 : 0) - (b.category === cat ? -1 : 0) || a.name.localeCompare(b.name));
  return (allowNone ? opt('', '— escolher —', sel) : '') + list.map((p) => opt(p.id, p.name + (p.brand ? ` · ${p.brand}` : ''), sel)).join('');
};

A.noop = () => {};
export { closeSheet, rerender };

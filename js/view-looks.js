// Looks: guarda-roupa digital (fotos das peças), montar looks, look do dia com sugestão,
// planejar a semana (vendo a agenda) e mala de viagem. Fotos em photos.js.
import { state, save } from './store.js';
import { esc, dateKey, addDays, parseKey, fmtLong, fmtShort, uid, WD } from './utils.js';
import { A, C, ui, sheet, rerender, toast, empty, opt, confirmSheet, closeSheet } from './ui.js';
import { svg } from './icons.js';
import { putPhoto, delPhoto, resizePhoto } from './photos.js';
import { eventsBetween } from './view-agenda.js';
import { money, parseMoney } from './finance.js';

const CL = () => (state.closet ||= { items: [], looks: [], worn: {}, plan: {}, trips: [] });

export const CATS = {
  blusa: { label: 'Blusas', one: 'Blusa', icon: 'shirt', part: 'top' },
  camisa: { label: 'Camisas', one: 'Camisa', icon: 'shirt', part: 'top' },
  calca: { label: 'Calças', one: 'Calça', icon: 'shirt', part: 'bottom' },
  saia: { label: 'Saias', one: 'Saia', icon: 'dress', part: 'bottom' },
  short: { label: 'Shorts', one: 'Short', icon: 'shirt', part: 'bottom' },
  vestido: { label: 'Vestidos', one: 'Vestido', icon: 'dress', part: 'one' },
  macacao: { label: 'Macacões', one: 'Macacão', icon: 'dress', part: 'one' },
  casaco: { label: 'Casacos', one: 'Casaco', icon: 'shirt', part: 'outer' },
  calcado: { label: 'Calçados', one: 'Calçado', icon: 'sparkles', part: 'shoes' },
  bolsa: { label: 'Bolsas', one: 'Bolsa', icon: 'bag', part: 'bag' },
  acessorio: { label: 'Acessórios', one: 'Acessório', icon: 'diamond', part: 'acc' },
  fitness: { label: 'Academia', one: 'Roupa de academia', icon: 'dumbbell', part: 'fit' },
};
export const COLORS = {
  preto: ['Preto', '#222'], branco: ['Branco', '#fff'], cinza: ['Cinza', '#9ca3af'], bege: ['Bege', '#d8c5a7'], nude: ['Nude', '#e9c7ad'],
  marrom: ['Marrom', '#8b5e3c'], jeans: ['Jeans', '#4a6fa5'], azul: ['Azul', '#3b82f6'], verde: ['Verde', '#22a06b'], amarelo: ['Amarelo', '#f5c518'],
  laranja: ['Laranja', '#f97316'], vermelho: ['Vermelho', '#e11d48'], rosa: ['Rosa', '#f472b6'], lilas: ['Lilás', '#a78bfa'], vinho: ['Vinho', '#7f1d3a'],
  dourado: ['Dourado', '#d4af37'], prata: ['Prata', '#c0c0c0'], estampado: ['Estampado', 'linear-gradient(135deg,#f472b6,#a78bfa,#60a5fa,#f5c518)'],
};
const NEUTRAL = new Set(['preto', 'branco', 'cinza', 'bege', 'nude', 'marrom', 'jeans', 'dourado', 'prata']);
export const OCCASIONS = ['Trabalho', 'Dia a dia', 'Academia', 'Igreja', 'Festa', 'Encontro', 'Viagem', 'Em casa'];

const item = (id) => CL().items.find((x) => x.id === id);
const look = (id) => CL().looks.find((x) => x.id === id);
const swatch = (c) => (COLORS[c] ? `<i class="sw" style="background:${COLORS[c][1]}" title="${COLORS[c][0]}"></i>` : '');
/** foto (ou ícone da categoria quando não tem foto) */
const pic = (it, cls = '') => `<span class="ph ${cls}">${it?.photo ? `<img data-photo="${it.id}" alt="">` : ''}<span class="ph-ic">${svg(CATS[it?.cat]?.icon || 'shirt')}</span></span>`;
/** colagem de um look (até 4 peças) */
function collage(ids, cls = '') {
  const its = ids.map(item).filter(Boolean);
  const show = its.slice(0, 4);
  return `<span class="collage n${show.length} ${cls}">${show.map((it) => pic(it)).join('') || pic(null)}${its.length > 4 ? `<b class="more">+${its.length - 4}</b>` : ''}</span>`;
}

/* ---------- uso das peças ---------- */
function usage() {
  const u = {};
  for (const [d, w] of Object.entries(CL().worn)) for (const id of w.items || []) { const x = (u[id] ||= { n: 0, last: '' }); x.n++; if (d > x.last) x.last = d; }
  return u;
}
const wornOn = (k) => CL().worn[k];
function setWorn(k, items, lookId = null) {
  CL().worn[k] = { items: [...new Set(items)], look: lookId };
  save();
}

/* ---------- sugestão de look ---------- */
function rnd(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10000) / 10000; }; }
export function suggest(occ, seed = 1) {
  const r = rnd(seed * 7919 + 13);
  const u = usage(); const t = dateKey();
  const recent = new Set(); for (let i = 1; i <= 3; i++) for (const id of wornOn(addDays(t, -i))?.items || []) recent.add(id);
  const pool = CL().items.filter((x) => !x.archived && (!occ || !x.occasions?.length || x.occasions.includes(occ)));
  const of = (part) => pool.filter((x) => CATS[x.cat]?.part === part);
  // prefere peças menos usadas e que não foram usadas nos últimos dias
  const pick = (list, avoidLoud = false) => {
    let l = list.filter((x) => !recent.has(x.id)); if (!l.length) l = list;
    if (avoidLoud) { const n = l.filter((x) => NEUTRAL.has(x.color) || !x.color); if (n.length) l = n; }
    if (!l.length) return null;
    const w = l.map((x) => 1 / (1 + (u[x.id]?.n || 0)));
    let v = r() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < l.length; i++) { v -= w[i]; if (v <= 0) return l[i]; }
    return l[l.length - 1];
  };
  const out = [];
  if (occ === 'Academia' && of('fit').length) { out.push(pick(of('fit'))); const s = pick(of('shoes')); if (s) out.push(s); return out.filter(Boolean); }
  const ones = of('one'); const tops = of('top'); const bottoms = of('bottom');
  if (ones.length && (!tops.length || !bottoms.length || r() < 0.35)) out.push(pick(ones));
  else if (tops.length && bottoms.length) {
    const top = pick(tops); out.push(top);
    out.push(pick(bottoms, top && top.color && !NEUTRAL.has(top.color))); // peça colorida em cima → neutra embaixo
  } else if (tops.length || bottoms.length) out.push(pick(tops.length ? tops : bottoms));
  for (const part of ['shoes', 'bag']) { const x = pick(of(part)); if (x) out.push(x); }
  if (of('outer').length && r() < 0.3) out.push(pick(of('outer'), true));
  return out.filter(Boolean);
}

/* ---------- telas ---------- */
const TABS = [['hoje', 'Hoje'], ['pecas', 'Peças'], ['looks', 'Looks'], ['planejar', 'Planejar'], ['mala', 'Mala']];
const subnav = (on) => `<div class="seg lk-seg">${TABS.map(([k, l]) => `<a class="${on === k ? 'on' : ''}" href="#/looks?t=${k}">${l}</a>`).join('')}</div>`;

function tabHoje() {
  const t = dateKey(); const w = wornOn(t); const planned = CL().plan[t] && look(CL().plan[t]);
  const evs = eventsBetween(t, t);
  const occ = ui.lkOcc || '';
  const sug = w || planned ? null : suggest(occ, ui.lkSeed || Number(t.replace(/-/g, '')));
  const lastDays = Array.from({ length: 7 }, (_, i) => addDays(t, -i - 1)).reverse();
  return `${evs.length ? `<p class="lk-agenda">📅 Hoje: ${evs.slice(0, 3).map((x) => `${esc(x.title)}${x.time ? ' ' + x.time : ''}`).join(' · ')}</p>` : ''}
  ${w ? `<section class="card lk-today"><div class="card-head"><h2>Look de hoje ✓</h2><button class="link" data-act="lkUnwear">Desfazer</button></div>
      ${collage(w.items, 'big')}<p class="small muted">${w.look && look(w.look) ? esc(look(w.look).name) + ' · ' : ''}${w.items.length} peça(s) registrada(s) como usadas hoje</p></section>`
    : planned ? `<section class="card lk-today"><div class="card-head"><h2>Planejado para hoje</h2><small>${esc(planned.name)}</small></div>
      ${collage(planned.items, 'big')}
      <div class="row gap mt"><button class="btn primary grow" data-act="lkWearLook" data-id="${planned.id}">✓ Vou usar este</button><button class="btn ghost" data-act="lkUnplan" data-d="${t}">Trocar</button></div></section>`
    : `<section class="card lk-today"><div class="card-head"><h2>Sugestão de look</h2><button class="link" data-act="lkAgain">🔄 Outra</button></div>
      <div class="chips scroll">${['', ...OCCASIONS].map((o) => `<button class="chip ${occ === o ? 'on' : ''}" data-act="lkOcc" data-o="${esc(o)}">${o || 'Qualquer'}</button>`).join('')}</div>
      ${CL().items.length < 3 ? `<p class="muted small mt">Cadastre algumas peças (blusas, calças, vestidos, calçados) para o app montar sugestões com o que você tem.</p><a class="btn primary block" href="#/looks?t=pecas">+ Cadastrar peças</a>`
        : sug.length ? `${collage(sug.map((x) => x.id), 'big')}<ul class="lk-names">${sug.map((x) => `<li>${swatch(x.color)}${esc(x.name || CATS[x.cat]?.one)}</li>`).join('')}</ul>
        <div class="row gap mt"><button class="btn primary grow" data-act="lkWearSug" data-ids="${sug.map((x) => x.id).join(',')}">✓ Vou usar este</button><button class="btn ghost" data-act="lkSaveSug" data-ids="${sug.map((x) => x.id).join(',')}">♡ Salvar look</button></div>`
        : '<p class="muted small mt">Não achei peças para essa ocasião. Marque as ocasiões nas peças ou escolha "Qualquer".</p>'}
      ${CL().looks.length ? '<button class="btn ghost block mt" data-act="lkPickToday">Escolher um dos meus looks</button>' : ''}</section>`}
  <section class="card"><h2>Últimos dias</h2><div class="lk-week">${lastDays.map((d) => { const x = wornOn(d); return `<div><small>${WD[parseKey(d).getDay()]}</small>${x ? collage(x.items, 'mini') : '<span class="collage mini empty"></span>'}</div>`; }).join('')}</div></section>`;
}

function insights() {
  const its = CL().items.filter((x) => !x.archived); if (!its.length) return '';
  const u = usage(); const t = dateKey();
  const total = its.reduce((a, x) => a + (Number(x.price) || 0), 0);
  const never = its.filter((x) => !u[x.id] && (x.created || '') <= addDays(t, -30));
  const top = [...its].filter((x) => u[x.id]).sort((a, b) => u[b.id].n - u[a.id].n)[0];
  return `<section class="card lk-ins"><div><b>${its.length}</b><small>peças</small></div>${total ? `<div><b>${money(total)}</b><small>no guarda-roupa</small></div>` : ''}
    <div><b>${never.length}</b><small>sem uso há 30+ dias</small></div>${top ? `<div><b>${u[top.id].n}×</b><small>${esc(top.name || CATS[top.cat].one)}</small></div>` : ''}</section>`;
}
function tabPecas() {
  const f = ui.lkCat || ''; const u = usage();
  const all = CL().items.filter((x) => !x.archived);
  const list = all.filter((x) => !f || x.cat === f).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  const counts = {}; all.forEach((x) => { counts[x.cat] = (counts[x.cat] || 0) + 1; });
  return `${insights()}
  <div class="row gap"><label class="btn primary grow">📷 Fotografar<input type="file" accept="image/*" capture="environment" hidden data-change="lkPhotoNew"></label>
    <label class="btn ghost grow">🖼️ Da galeria<input type="file" accept="image/*" hidden data-change="lkPhotoNew"></label></div>
  <button class="link block-link" data-act="lkItemNew">+ Cadastrar sem foto</button>
  ${all.length ? `<div class="chips scroll"><button class="chip ${!f ? 'on' : ''}" data-act="lkCat" data-c="">Todas (${all.length})</button>
    ${Object.entries(CATS).filter(([k]) => counts[k]).map(([k, c]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="lkCat" data-c="${k}">${c.label} (${counts[k]})</button>`).join('')}</div>` : ''}
  ${list.length ? `<div class="lk-grid">${list.map((x) => `<button class="lk-card" data-act="lkItem" data-id="${x.id}">${pic(x)}
      <span class="lk-cap">${swatch(x.color)}<b>${esc(x.name || CATS[x.cat]?.one || 'Peça')}</b><small>${u[x.id] ? `usada ${u[x.id].n}×` : 'ainda não usada'}</small></span></button>`).join('')}</div>`
    : empty('👗', 'Seu guarda-roupa está vazio', 'Fotografe suas peças (de preferência num fundo liso) para montar looks e receber sugestões.')}`;
}
function tabLooks() {
  const ls = [...CL().looks].sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || (b.created || '').localeCompare(a.created || ''));
  return `<button class="btn primary block" data-act="lkLookNew">+ Montar look</button>
  ${ls.length ? `<div class="lk-grid looks">${ls.map((l) => `<button class="lk-card" data-act="lkLook" data-id="${l.id}">${collage(l.items)}
      <span class="lk-cap"><b>${l.fav ? '♥ ' : ''}${esc(l.name)}</b><small>${l.occasion ? esc(l.occasion) + ' · ' : ''}${l.items.length} peças</small></span></button>`).join('')}</div>`
    : empty('✨', 'Nenhum look ainda', 'Junte peças do seu guarda-roupa num look, ou salve uma sugestão do dia.')}`;
}
function tabPlanejar() {
  const t = dateKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(t, i));
  return `<p class="small muted">Escolha o look de cada dia. Os compromissos da sua Agenda aparecem para ajudar.</p>
  <ul class="lk-plan">${days.map((d) => {
    const l = CL().plan[d] && look(CL().plan[d]); const evs = eventsBetween(d, d);
    return `<li><div class="lk-pd"><b>${d === t ? 'Hoje' : d === addDays(t, 1) ? 'Amanhã' : `${WD[parseKey(d).getDay()]} ${fmtShort(d)}`}</b>
      ${evs.length ? `<small>📅 ${evs.slice(0, 2).map((x) => esc(x.title)).join(', ')}${evs.length > 2 ? '…' : ''}</small>` : ''}</div>
      ${l ? `<button class="lk-pl" data-act="lkPlanPick" data-d="${d}">${collage(l.items, 'mini')}<small>${esc(l.name)}</small></button>`
        : `<button class="btn small ghost" data-act="lkPlanPick" data-d="${d}">+ Look</button>`}</li>`;
  }).join('')}</ul>`;
}
function tabMala() {
  const trips = [...CL().trips].sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const cur = trips.find((x) => x.id === ui.lkTrip) || trips.find((x) => (x.end || '') >= dateKey()) || trips[trips.length - 1];
  if (!cur) return `<button class="btn primary block" data-act="lkTripNew">+ Nova viagem</button>${empty('🧳', 'Nenhuma mala ainda', 'Crie uma viagem e escolha as peças. Na hora de arrumar, vá marcando o que já está na mala.')}`;
  const its = cur.items.map(item).filter(Boolean); const packed = its.filter((x) => cur.checked?.[x.id]).length;
  const nd = cur.start && cur.end ? Math.round((parseKey(cur.end) - parseKey(cur.start)) / 86400000) + 1 : 0;
  return `${trips.length > 1 ? `<div class="chips scroll">${trips.map((x) => `<button class="chip ${x.id === cur.id ? 'on' : ''}" data-act="lkTripSel" data-id="${x.id}">${esc(x.name)}</button>`).join('')}</div>` : ''}
  <section class="card"><div class="card-head"><h2>🧳 ${esc(cur.name)}</h2><button class="link" data-act="lkTripEdit" data-id="${cur.id}">Editar</button></div>
    <p class="small muted">${cur.start ? `${fmtShort(cur.start)} a ${fmtShort(cur.end || cur.start)} · ${nd} dia(s)` : 'sem datas'} · ${packed} de ${its.length} na mala</p>
    ${nd ? `<p class="small">Sugestão para ${nd} dia(s): ~${Math.min(nd + 1, 10)} blusas, ~${Math.max(1, Math.ceil(nd / 3))} calças/saias, ${nd > 4 ? 2 : 1} calçado(s) e roupa de dormir.</p>` : ''}
    <div class="row gap wrap"><button class="btn small" data-act="lkTripAdd" data-id="${cur.id}">+ Peças</button>
      ${cur.start ? `<button class="btn small ghost" data-act="lkTripPlan" data-id="${cur.id}">Trazer looks planejados</button>` : ''}</div>
    ${its.length ? `<ul class="lk-pack">${its.map((x) => `<li class="${cur.checked?.[x.id] ? 'on' : ''}"><button class="check ${cur.checked?.[x.id] ? 'on' : ''}" data-act="lkPack" data-t="${cur.id}" data-id="${x.id}" aria-label="Na mala"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7" /></svg></button>
      ${pic(x, 'sm')}<span class="grow">${esc(x.name || CATS[x.cat]?.one)}</span><button class="icon-btn sm" data-act="lkPackDel" data-t="${cur.id}" data-id="${x.id}" aria-label="Tirar">✕</button></li>`).join('')}</ul>` : '<p class="muted small mt">Nenhuma peça ainda.</p>'}
  </section>
  <button class="btn ghost block" data-act="lkTripNew">+ Nova viagem</button>`;
}

function renderLooks(p) {
  const t = TABS.some(([k]) => k === p?.get?.('t')) ? p.get('t') : 'hoje';
  const body = { hoje: tabHoje, pecas: tabPecas, looks: tabLooks, planejar: tabPlanejar, mala: tabMala }[t]();
  return `<header class="page-head top"><h1>Looks</h1></header>${subnav(t)}${body}`;
}

/* ---------- peças ---------- */
function itemSheet(x, photoData = null) {
  const it = x || { name: '', cat: 'blusa', color: '', occasions: [], brand: '', price: '', notes: '' };
  const hasPhoto = !!photoData || it.photo;
  sheet(x ? 'Editar peça' : 'Nova peça', `<form class="form">
    ${hasPhoto ? `<div class="lk-prev">${photoData ? `<img src="${photoData}" alt="">` : pic(it)}</div>` : ''}
    <label class="field"><span>Nome (opcional)</span><input name="name" value="${esc(it.name)}" placeholder="Ex.: Blusa branca de linho"></label>
    <label class="field"><span>Tipo</span><select name="cat">${Object.entries(CATS).map(([k, c]) => opt(k, c.one, it.cat)).join('')}</select></label>
    <div class="field"><span>Cor principal</span><div class="lk-colors">${Object.entries(COLORS).map(([k, [l, hex]]) => `<label title="${l}"><input type="radio" name="color" value="${k}" ${it.color === k ? 'checked' : ''}><i style="background:${hex}"></i><small>${l}</small></label>`).join('')}</div></div>
    <div class="field"><span>Para quais ocasiões</span><div class="chips">${OCCASIONS.map((o) => `<label class="chip"><input type="checkbox" name="occ" value="${o}" ${it.occasions?.includes(o) ? 'checked' : ''}><span>${o}</span></label>`).join('')}</div></div>
    <div class="row gap"><label class="field grow"><span>Marca (opcional)</span><input name="brand" value="${esc(it.brand || '')}"></label>
      <label class="field grow"><span>Quanto custou (opcional)</span><input name="price" inputmode="decimal" value="${it.price ? String(it.price).replace('.', ',') : ''}" placeholder="0,00"></label></div>
    ${x ? `<label class="btn small ghost">📷 Trocar foto<input type="file" accept="image/*" hidden id="lk-rephoto"></label>` : ''}
    <button class="btn primary block">Salvar</button>
    ${x ? '<button type="button" class="btn danger-ghost block" id="lk-del">Excluir peça</button>' : ''}</form>`, {
    onMount: (root) => {
      root.querySelector('#lk-del')?.addEventListener('click', () => confirmSheet('Excluir peça?', 'Ela sai do guarda-roupa e dos looks.', 'Excluir', () => {
        CL().items = CL().items.filter((y) => y !== x); for (const l of CL().looks) l.items = l.items.filter((i) => i !== x.id);
        if (x.photo) delPhoto(x.id); save(); toast('Peça excluída');
      }));
      root.querySelector('#lk-rephoto')?.addEventListener('change', async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { const d = await resizePhoto(f); await putPhoto(x.id, d); x.photo = true; save(); toast('Foto trocada'); const pv = root.querySelector('.lk-prev'); if (pv) pv.innerHTML = `<img src="${d}" alt="">`; } catch (err) { toast(err.message); }
      });
    },
    onSubmit: (fd) => {
      const data = { name: String(fd.get('name') || '').trim(), cat: fd.get('cat'), color: fd.get('color') || '', occasions: fd.getAll('occ'),
        brand: String(fd.get('brand') || '').trim(), price: parseMoney(fd.get('price')) || 0 };
      if (x) Object.assign(x, data);
      else {
        const n = { id: uid(), ...data, photo: !!photoData, created: dateKey() };
        CL().items.push(n); if (photoData) putPhoto(n.id, photoData);
        ui.lkCat = '';
      }
      save(); toast(x ? 'Peça atualizada' : 'Peça adicionada 👗');
    },
  });
}
C.lkPhotoNew = async (el) => {
  const f = el.files?.[0]; el.value = ''; if (!f) return;
  try { itemSheet(null, await resizePhoto(f)); } catch (e) { toast(e.message); }
};
A.lkItemNew = () => itemSheet(null);
A.lkCat = (el) => { ui.lkCat = el.dataset.c; rerender(); };
A.lkItem = (el) => {
  const x = item(el.dataset.id); if (!x) return; const u = usage()[x.id];
  const inLooks = CL().looks.filter((l) => l.items.includes(x.id));
  sheet(x.name || CATS[x.cat]?.one || 'Peça', `<div class="lk-prev">${pic(x)}</div>
    <p class="muted">${CATS[x.cat]?.one || ''}${x.color ? ` · ${COLORS[x.color]?.[0] || ''}` : ''}${x.brand ? ` · ${esc(x.brand)}` : ''}${x.occasions?.length ? ` · ${x.occasions.join(', ')}` : ''}</p>
    <div class="stats three"><div class="stat"><b>${u?.n || 0}×</b><small>usada</small></div><div class="stat"><b>${u?.last ? fmtShort(u.last) : '–'}</b><small>última vez</small></div>
      <div class="stat"><b>${x.price ? money(x.price / Math.max(1, u?.n || 0)) : '–'}</b><small>por uso</small></div></div>
    ${inLooks.length ? `<p class="small"><b>Nos looks:</b> ${inLooks.map((l) => esc(l.name)).join(', ')}</p>` : ''}
    <button class="btn primary block" data-act="lkWearItem" data-id="${x.id}">✓ Usei hoje</button>
    <button class="btn ghost block" data-act="lkItemEdit" data-id="${x.id}">✎ Editar</button>`);
};
A.lkItemEdit = (el) => itemSheet(item(el.dataset.id));
A.lkWearItem = (el) => { const t = dateKey(); const w = wornOn(t); setWorn(t, [...(w?.items || []), el.dataset.id], w?.look || null); closeSheet(); toast('Registrado como usado hoje'); rerender(); };

/* ---------- looks ---------- */
function pickerGrid(sel) {
  const by = {}; for (const x of CL().items.filter((y) => !y.archived)) (by[x.cat] ||= []).push(x);
  if (!Object.keys(by).length) return '<p class="muted small">Cadastre peças primeiro, na aba Peças.</p>';
  return Object.entries(CATS).filter(([k]) => by[k]).map(([k, c]) => `<h4 class="lk-h">${c.label}</h4><div class="lk-pick">${by[k].map((x) => `<label class="lk-pi">
    <input type="checkbox" name="it" value="${x.id}" ${sel.includes(x.id) ? 'checked' : ''}>${pic(x)}<small>${esc(x.name || c.one)}</small></label>`).join('')}</div>`).join('');
}
function lookSheet(l, preset = []) {
  const it = l || { name: '', occasion: '', items: preset };
  sheet(l ? 'Editar look' : 'Montar look', `<form class="form">
    <label class="field"><span>Nome do look</span><input name="name" required value="${esc(it.name)}" placeholder="Ex.: Trabalho de segunda"></label>
    <label class="field"><span>Ocasião</span><select name="occ">${opt('', 'Qualquer', it.occasion)}${OCCASIONS.map((o) => opt(o, o, it.occasion)).join('')}</select></label>
    <div class="field"><span>Escolha as peças</span>${pickerGrid(it.items)}</div>
    <button class="btn primary block">Salvar look</button>
    ${l ? '<button type="button" class="btn danger-ghost block" id="lk-ldel">Excluir look</button>' : ''}</form>`, {
    onMount: (root) => root.querySelector('#lk-ldel')?.addEventListener('click', () => confirmSheet('Excluir look?', 'As peças continuam no guarda-roupa.', 'Excluir', () => {
      CL().looks = CL().looks.filter((y) => y !== l); for (const d of Object.keys(CL().plan)) if (CL().plan[d] === l.id) delete CL().plan[d]; save(); toast('Look excluído');
    })),
    onSubmit: (fd) => {
      const items = fd.getAll('it'); if (!items.length) { toast('Escolha pelo menos uma peça'); return false; }
      const data = { name: String(fd.get('name')).trim(), occasion: fd.get('occ') || '', items };
      if (l) Object.assign(l, data); else CL().looks.push({ id: uid(), ...data, fav: false, created: dateKey() });
      save(); toast('Look salvo ✨');
    },
  });
}
A.lkLookNew = () => lookSheet(null);
A.lkLook = (el) => {
  const l = look(el.dataset.id); if (!l) return;
  sheet(l.name, `${collage(l.items, 'big')}
    <ul class="lk-names">${l.items.map(item).filter(Boolean).map((x) => `<li>${swatch(x.color)}${esc(x.name || CATS[x.cat]?.one)}</li>`).join('')}</ul>
    <button class="btn primary block" data-act="lkWearLook" data-id="${l.id}">✓ Usar hoje</button>
    <div class="row gap"><label class="field grow"><span>Planejar para</span><input type="date" id="lk-plan-d" value="${addDays(dateKey(), 1)}"></label><button class="btn ghost" data-act="lkPlanLook" data-id="${l.id}">Planejar</button></div>
    <div class="row gap"><button class="btn ghost grow" data-act="lkFav" data-id="${l.id}">${l.fav ? '♥ Favorito' : '♡ Favoritar'}</button><button class="btn ghost grow" data-act="lkLookEdit" data-id="${l.id}">✎ Editar</button></div>`);
};
A.lkLookEdit = (el) => lookSheet(look(el.dataset.id));
A.lkFav = (el) => { const l = look(el.dataset.id); l.fav = !l.fav; save(); closeSheet(); rerender(); };
A.lkWearLook = (el) => { const l = look(el.dataset.id); setWorn(dateKey(), l.items, l.id); closeSheet(); toast(`Look de hoje: ${l.name} ✨`); rerender(); };
A.lkPlanLook = (el) => { const d = document.getElementById('lk-plan-d')?.value; if (!d) return; CL().plan[d] = el.dataset.id; save(); closeSheet(); toast(`Planejado para ${fmtShort(d)}`); rerender(); };

/* ---------- hoje ---------- */
A.lkOcc = (el) => { ui.lkOcc = el.dataset.o; ui.lkSeed = Date.now() % 100000; rerender(); };
A.lkAgain = () => { ui.lkSeed = (ui.lkSeed || 1) + 97; rerender(); };
A.lkWearSug = (el) => { setWorn(dateKey(), el.dataset.ids.split(',')); toast('Look de hoje registrado ✨'); rerender(); };
A.lkSaveSug = (el) => lookSheet(null, el.dataset.ids.split(','));
A.lkUnwear = () => { delete CL().worn[dateKey()]; save(); rerender(); };
A.lkUnplan = (el) => { delete CL().plan[el.dataset.d]; save(); rerender(); };
function chooseLook(title, onPick, allowNone = false) {
  sheet(title, `${CL().looks.length ? `<div class="lk-grid looks">${CL().looks.map((l) => `<button class="lk-card" data-act="lkChoose" data-id="${l.id}">${collage(l.items)}<span class="lk-cap"><b>${esc(l.name)}</b></span></button>`).join('')}</div>`
    : '<p class="muted">Você ainda não tem looks salvos. Monte um na aba Looks.</p>'}
    ${allowNone ? '<button class="btn ghost block" data-act="lkChoose" data-id="">Sem look planejado</button>' : ''}
    <button class="btn ghost block" data-act="lkLookNewFrom">+ Montar um look novo</button>`);
  A.lkChoose = (b) => { onPick(b.dataset.id); closeSheet(); rerender(); };
}
A.lkLookNewFrom = () => lookSheet(null);
A.lkPickToday = () => chooseLook('Escolher look de hoje', (id) => { const l = look(id); if (l) { setWorn(dateKey(), l.items, l.id); toast(`Look de hoje: ${l.name} ✨`); } });
A.lkPlanPick = (el) => { const d = el.dataset.d; chooseLook(`Look de ${fmtLong(d)}`, (id) => { if (id) CL().plan[d] = id; else delete CL().plan[d]; save(); }, !!CL().plan[d]); };

/* ---------- mala ---------- */
function tripSheet(x) {
  const t = x || { name: '', start: dateKey(), end: addDays(dateKey(), 2) };
  sheet(x ? 'Editar viagem' : 'Nova viagem', `<form class="form">
    <label class="field"><span>Para onde / nome</span><input name="name" required value="${esc(t.name)}" placeholder="Ex.: Praia em janeiro"></label>
    <div class="row gap"><label class="field grow"><span>Ida</span><input type="date" name="start" value="${t.start || ''}"></label><label class="field grow"><span>Volta</span><input type="date" name="end" value="${t.end || ''}"></label></div>
    <button class="btn primary block">Salvar</button>${x ? '<button type="button" class="btn danger-ghost block" id="lk-tdel">Excluir viagem</button>' : ''}</form>`, {
    onMount: (root) => root.querySelector('#lk-tdel')?.addEventListener('click', () => { CL().trips = CL().trips.filter((y) => y !== x); save(); closeSheet(); rerender(); }),
    onSubmit: (fd) => {
      const data = { name: String(fd.get('name')).trim(), start: fd.get('start') || '', end: fd.get('end') || fd.get('start') || '' };
      if (x) Object.assign(x, data); else { const n = { id: uid(), ...data, items: [], checked: {} }; CL().trips.push(n); ui.lkTrip = n.id; }
      save();
    },
  });
}
const trip = (id) => CL().trips.find((x) => x.id === id);
A.lkTripNew = () => tripSheet(null);
A.lkTripEdit = (el) => tripSheet(trip(el.dataset.id));
A.lkTripSel = (el) => { ui.lkTrip = el.dataset.id; rerender(); };
A.lkTripAdd = (el) => {
  const tr = trip(el.dataset.id);
  sheet('Peças para a mala', `<form class="form">${pickerGrid(tr.items)}<button class="btn primary block">Pronto</button></form>`, {
    onSubmit: (fd) => { tr.items = fd.getAll('it'); save(); },
  });
};
A.lkTripPlan = (el) => {
  const tr = trip(el.dataset.id); let n = 0;
  for (let d = tr.start; d && d <= (tr.end || tr.start); d = addDays(d, 1)) { const l = look(CL().plan[d]); if (l) for (const i of l.items) if (!tr.items.includes(i)) { tr.items.push(i); n++; } }
  save(); toast(n ? `${n} peça(s) dos looks planejados entraram na mala` : 'Nenhum look planejado nesses dias'); rerender();
};
A.lkPack = (el) => { const tr = trip(el.dataset.t); (tr.checked ||= {})[el.dataset.id] = !tr.checked[el.dataset.id]; save(); rerender(); };
A.lkPackDel = (el) => { const tr = trip(el.dataset.t); tr.items = tr.items.filter((x) => x !== el.dataset.id); save(); rerender(); };

/** tile da tela inicial */
export function looksTile() {
  const t = dateKey(); const w = wornOn(t); const p = CL().plan[t] && look(CL().plan[t]);
  const ids = w?.items || p?.items || [];
  return `<a class="tile t-rose lk-tile" href="#/looks"><span class="tile-ico">👗</span><div><b>${w ? 'Look de hoje ✓' : p ? esc(p.name) : 'Look de hoje'}</b>
    <small>${w ? `${w.items.length} peça(s)` : p ? 'planejado para hoje' : CL().items.length ? 'ver sugestão' : 'monte seu guarda-roupa'}</small></div>${ids.length ? collage(ids, 'mini') : ''}</a>`;
}

export const routes = { looks: { render: renderLooks, tab: 'looks' } };

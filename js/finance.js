// Finanças: categorias, lançamentos (receitas e despesas), contas a pagar, contas fixas e limites.
import { state, save } from './store.js';
import { dateKey, uid, parseKey, pad } from './utils.js';

import { defaultFinance } from './defaults.js';
export { defaultFinance };

export const F = () => state.finance;
export const money = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
/** aceita "45,90", "1.234,56", "R$ 30" ou 45.9 */
export function parseMoney(v) {
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  let s = String(v || '').replace(/[^\d,.-]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(Math.abs(n) * 100) / 100 : 0;
}
export const cat = (id) => F().categories.find((c) => c.id === id) || F().categories.find((c) => c.id === 'fc-outros') || F().categories[0];
export const cats = (kind) => F().categories.filter((c) => !kind || c.kind === kind);
export const ym = (k) => k.slice(0, 7);
/** mês "contábil" do lançamento: pendente conta pelo vencimento */
export const entryMonth = (e) => ym(e.status === 'pendente' && e.due ? e.due : e.date);
export const isLate = (e, today = dateKey()) => e.status === 'pendente' && e.due && e.due < today;

/** cria os lançamentos das contas fixas do mês (uma vez por mês) */
export function ensureBills(month) {
  let changed = false;
  for (const b of F().bills) {
    if (!b.active || (b.start && month < b.start)) continue;
    if (F().entries.some((e) => e.billId === b.id && entryMonth(e) === month)) continue;
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    const due = `${month}-${pad(Math.min(Number(b.day) || 1, last))}`;
    F().entries.push({ id: uid(), kind: b.kind || 'despesa', amount: b.amount, date: due, due, desc: b.desc, cat: b.cat,
      status: 'pendente', note: 'Conta fixa', billId: b.id, src: 'fixa' });
    changed = true;
  }
  if (changed) save();
}

export function monthSummary(month) {
  const es = F().entries.filter((e) => entryMonth(e) === month);
  const sum = (arr) => arr.reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const rec = es.filter((e) => e.kind === 'receita'), des = es.filter((e) => e.kind === 'despesa');
  const byCat = {};
  for (const e of des) byCat[e.cat] = (byCat[e.cat] || 0) + (Number(e.amount) || 0);
  return {
    entries: es, receitas: sum(rec), despesas: sum(des), saldo: sum(rec) - sum(des),
    pago: sum(des.filter((e) => e.status !== 'pendente')), aPagar: sum(des.filter((e) => e.status === 'pendente')),
    aReceber: sum(rec.filter((e) => e.status === 'pendente')), byCat,
  };
}
export const monthLabel = (month) => {
  const d = parseKey(month + '-01');
  const m = d.toLocaleString('pt-BR', { month: 'long' });
  return `${m[0].toUpperCase() + m.slice(1)} de ${d.getFullYear()}`;
};
export const shiftMonth = (month, n) => { const d = parseKey(month + '-01'); const x = new Date(d.getFullYear(), d.getMonth() + n, 1); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}`; };
export const thisMonth = () => ym(dateKey());

/** adiciona lançamentos (ex.: vindos da IA), com validação básica */
export function addEntries(list, src = 'manual') {
  const ok = [];
  for (const x of list) {
    const amount = parseMoney(x.amount);
    if (!amount) continue;
    const kind = x.kind === 'receita' ? 'receita' : 'despesa';
    const c = F().categories.find((q) => q.id === x.cat && q.kind === kind) || cats(kind).slice(-1)[0];
    const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : dateKey();
    const status = x.status === 'pendente' ? 'pendente' : 'pago';
    const due = status === 'pendente' ? (/^\d{4}-\d{2}-\d{2}$/.test(x.due || '') ? x.due : date) : '';
    const e = { id: uid(), kind, amount, date, desc: String(x.desc || '').trim() || c.name, cat: c.id, status, due, note: String(x.note || '').trim(), src };
    F().entries.push(e); ok.push(e);
  }
  save();
  return ok;
}

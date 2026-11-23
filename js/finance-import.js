// Leitura de fotos e arquivos para lançamentos — grátis e no próprio aparelho (nada vai para servidores).
// Foto: Tesseract.js (reconhecimento de texto). PDF: PDF.js. Extrato: CSV e OFX.
import { state } from './store.js';
import { dateKey } from './utils.js';
import { cats } from './finance.js';

const LIB = new URL('../lib/', import.meta.url).href;
const loaded = {};
function loadScript(src) {
  return (loaded[src] ||= new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Não consegui carregar o leitor. Confira a internet na primeira vez.'));
    document.head.appendChild(s);
  }));
}

/* ---------------- reconhecimento de texto (foto) ---------------- */
let worker = null;
async function ocr(image, progress) {
  await loadScript(LIB + 'tesseract/tesseract.min.js');
  if (!worker) {
    progress?.('Preparando o leitor (só na primeira vez)…', 0.02);
    worker = await window.Tesseract.createWorker('por', 1, {
      workerPath: LIB + 'tesseract/worker.min.js', corePath: LIB + 'tesseract/core', langPath: LIB + 'tesseract/lang', gzip: true,
      logger: (m) => { if (m.status === 'recognizing text') progress?.('Lendo a foto…', 0.1 + m.progress * 0.9); },
    });
  }
  const { data } = await worker.recognize(image);
  return data.text || '';
}
/** reduz e deixa em tons de cinza: lê melhor e mais rápido */
async function prepImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Não consegui abrir a foto')); i.src = url; });
    const k = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    const g = c.getContext('2d'); g.filter = 'grayscale(1) contrast(1.25)'; g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

/* ---------------- PDF ---------------- */
async function pdfText(file, progress) {
  progress?.('Abrindo o PDF…', 0.05);
  const pdfjs = await import(LIB + 'pdfjs/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = LIB + 'pdfjs/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const n = Math.min(doc.numPages, 15);
  let out = '';
  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = [];
    for (const it of tc.items) {
      if (!it.str?.trim()) continue;
      const y = Math.round(it.transform[5]);
      let l = lines.find((q) => Math.abs(q.y - y) <= 3);
      if (!l) { l = { y, parts: [] }; lines.push(l); }
      l.parts.push({ x: it.transform[4], s: it.str });
    }
    lines.sort((a, b) => b.y - a.y);
    out += lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((q) => q.s).join(' ')).join('\n') + '\n';
    progress?.('Lendo o PDF…', 0.05 + (p / n) * 0.5);
  }
  if (out.replace(/\s/g, '').length > 30) return out;
  // PDF escaneado (sem texto): lê as primeiras páginas como foto
  let txt = '';
  for (let p = 1; p <= Math.min(doc.numPages, 3); p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    txt += await ocr(c, (m, v) => progress?.(`Lendo a página ${p}…`, v)) + '\n';
  }
  return txt;
}

/* ---------------- números, datas e categorias ---------------- */
const MONEY = /(?:R\$\s*)?(-?\d{1,3}(?:[.\s]\d{3})*,\d{2}|-?\d+,\d{2}|-?\d+\.\d{2}(?!\d))/g;
export function toNumber(s) {
  s = String(s).replace(/\s/g, '').replace(/R\$/i, '');
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s); return Number.isFinite(n) ? n : 0;
}
const moneysIn = (line) => [...line.matchAll(MONEY)].map((m) => toNumber(m[1])).filter((v) => v !== 0);
function toDate(d, m, y) {
  y = String(y || new Date().getFullYear()); if (y.length === 2) y = '20' + y;
  const dd = String(d).padStart(2, '0'), mm = String(m).padStart(2, '0');
  return Number(mm) >= 1 && Number(mm) <= 12 && Number(dd) >= 1 && Number(dd) <= 31 ? `${y}-${mm}-${dd}` : null;
}
const DATE = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g;
const datesIn = (line) => [...line.matchAll(DATE)].map((m) => toDate(m[1], m[2], m[3])).filter(Boolean);
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const KEYWORDS = [
  ['fc-mercado', /supermerc|mercado|atacad|hortifruti|sacolao|padaria|acougue|carrefour|assai|atacadao|extra |pao de acucar|dia %|big |bretas|sonda/],
  ['fc-alimentacao', /ifood|restaurante|lanchonete|pizzaria|hamburg|burger|mc ?donald|bk |subway|cafeteria|cafe |sorveteria|delivery|rappi|ze delivery|bar /],
  ['fc-transporte', /uber|99 ?(pop|app|taxi)|taxi|posto|combustiv|gasolina|etanol|shell|ipiranga|petrobras|estacionamento|pedagio|onibus|metro|bilhete unico|sem parar/],
  ['fc-saude', /farmacia|drogaria|droga|raia|pacheco|pague menos|panvel|hospital|clinica|laborat|medic|consulta|dentista|unimed|amil|hapvida|odonto|exame/],
  ['fc-contas', /energia|eletric|enel|cemig|copel|light|celesc|coelba|cpfl|agua|saneamento|sabesp|copasa|cedae|embasa|internet|telefon|celular|vivo|claro|tim |oi |net |gas |comgas|naturgy/],
  ['fc-moradia', /aluguel|condominio|iptu|imobiliaria|financiamento habit/],
  ['fc-assinaturas', /netflix|spotify|amazon prime|prime video|disney|hbo|max |globoplay|youtube|deezer|apple\.com|icloud|google one|assinatura|mensalidade app/],
  ['fc-beleza', /salao|cabeleire|manicure|estetica|cosmet|perfumar|boticario|natura|sephora|beleza na web|epoca cosmeticos|sobrancelha|depila/],
  ['fc-educacao', /curso|faculdade|universidade|escola|livraria|udemy|alura|hotmart|pos-graduacao|pos graduacao|material escolar|mensalidade/],
  ['fc-lazer', /cinema|ingresso|show|teatro|viagem|hotel|airbnb|passagem|parque|clube/],
  ['fc-roupas', /renner|riachuelo|c&a|cea|zara|shein|shopee|magalu|magazine|americanas|mercado livre|amazon|loja|calcad|roupa/],
  ['fr-salario', /salario|folha de pag|vencimentos|pro-labore|pro labore/],
];
/** sugere a categoria: primeiro pelo que você já lançou antes, depois por palavras-chave */
const GENERIC = new Set(['compra', 'compras', 'cartao', 'debito', 'credito', 'pagamento', 'pagto', 'recebido', 'recebida', 'enviado', 'transferencia',
  'boleto', 'fatura', 'ltda', 'eireli', 'mei', 'servicos', 'comercio', 'brasil', 'paulo', 'janeiro', 'horizonte', 'belo', 'santo', 'santa', 'distribuicao',
  'loja', 'lojas', 'online', 'parcela', 'conta', 'valor', 'total', 'mercadopago', 'pagseguro', 'stone', 'cielo', 'getnet', 'nubank', 'banco', 'para']);
const keyWords = (s) => norm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !GENERIC.has(w) && !/^\d+$/.test(w));
export function guessCat(desc, kind, text = '') {
  const d = norm(desc); const words = keyWords(desc);
  const counts = {};
  for (const e of state.finance.entries) {
    if (e.kind !== kind) continue;
    const ed = norm(e.desc);
    if (ed === d) { counts[e.cat] = (counts[e.cat] || 0) + 5; continue; }
    const ew = keyWords(e.desc);
    const shared = words.filter((w) => ew.includes(w)).length;
    // aprende com lançamentos parecidos de verdade (mesmo estabelecimento)
    if (shared >= 2 || (shared === 1 && words.length === 1 && ew.length === 1)) counts[e.cat] = (counts[e.cat] || 0) + shared;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best && cats(kind).some((c) => c.id === best[0])) return best[0];
  const hay = ` ${d} ${norm(text).slice(0, 2000)} `;
  for (const [id, re] of KEYWORDS) {
    const c = state.finance.categories.find((x) => x.id === id);
    if (c && c.kind === kind && re.test(hay)) return id;
  }
  // categorias que você criou: procura o nome delas no texto
  for (const c of cats(kind)) if (norm(c.name).length > 3 && hay.includes(norm(c.name))) return c.id;
  const others = cats(kind);
  return (others.find((c) => /outr/i.test(c.name)) || others[others.length - 1])?.id;
}

/* ---------------- interpretar textos (cupom, boleto, fatura, comprovante) ---------------- */
function firstName(lines) {
  for (const l of lines.slice(0, 8)) {
    const t = l.replace(/[^A-Za-zÀ-ú0-9&.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (t.length >= 4 && /[A-Za-zÀ-ú]{3}/.test(t) && !/cnpj|cpf|cupom|nota fiscal|documento|extrato|comprovante|danfe|nfc-?e|sat\b/i.test(t)) return t.slice(0, 40);
  }
  return '';
}
const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
function valueNear(lines, re) {
  for (let i = 0; i < lines.length; i++) if (re.test(norm(lines[i]))) {
    const v = moneysIn(lines[i]).concat(moneysIn(lines[i + 1] || ''));
    if (v.length) return Math.abs(v[v.length - 1] > 0 ? v[v.length - 1] : v[0]);
  }
  return 0;
}
function dateNear(lines, re) {
  for (let i = 0; i < lines.length; i++) if (re.test(norm(lines[i]))) {
    const d = datesIn(lines[i]).concat(datesIn(lines[i + 1] || ''));
    if (d.length) return d[0];
  }
  return '';
}
export function parseDocText(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const t = norm(text);
  const today = dateKey();
  const all = lines.flatMap(moneysIn).map(Math.abs).filter((v) => v > 0 && v < 1e6);
  const anyDate = lines.flatMap(datesIn).find((d) => d <= today) || today;
  // comprovante de Pix / transferência
  if (/pix|transferencia|comprovante de (pagamento|transfer)/.test(t) && !/boleto|vencimento/.test(t)) {
    const amount = valueNear(lines, /valor/) || all[0] || 0;
    const received = /recebid|credito em conta|voce recebeu|pix recebido/.test(t);
    const who = (() => {
      for (let i = 0; i < lines.length; i++) {
        const l = norm(lines[i]).replace(/[:\s]+$/, '');
        const lab = l.match(/^(para|destino|recebedor|favorecido|de|origem|pagador|enviado por|quem recebeu|quem pagou)(\s*:?\s*(.*))?$/);
        if (!lab) continue;
        const inline = lines[i].split(/:\s*/)[1];
        const cand = inline && /[a-z]{3}/i.test(inline) ? inline : lines[i + 1];
        if (cand && /[a-z]{3}/i.test(cand) && !moneysIn(cand).length && !/^(valor|data|instituic|banco|cpf|cnpj|chave)/.test(norm(cand))) return cand.slice(0, 40);
      }
      return '';
    })();
    const desc = (received ? 'Pix recebido' : 'Pix') + (who ? ` – ${titleCase(who)}` : '');
    return [{ kind: received ? 'receita' : 'despesa', amount, desc, date: anyDate, status: 'pago', due: '', note: 'comprovante' }];
  }
  // boleto ou fatura (a pagar)
  if (/vencimento|boleto|linha digitavel|beneficiario|cedente|fatura|total a pagar/.test(t)) {
    const due = dateNear(lines, /vencimento|vence em|pagar ate|data de venc/) || '';
    const amount = valueNear(lines, /valor (do documento|cobrado|a pagar|total)|total (a pagar|da fatura)|\(=\) ?valor|valor$/) || (all.length ? Math.max(...all) : 0);
    let who = '';
    for (let i = 0; i < lines.length; i++) if (/beneficiario|cedente/.test(norm(lines[i]))) { who = (lines[i].split(/:\s*/)[1] || lines[i + 1] || '').replace(/cnpj.*$/i, '').trim(); break; }
    const desc = titleCase((who || firstName(lines) || (/fatura/.test(t) ? 'Fatura' : 'Boleto')).slice(0, 40));
    const paid = /pagamento efetuado|comprovante de pagamento|autenticacao mecanica|pago em/.test(t);
    return [{ kind: 'despesa', amount, desc, date: paid ? anyDate : today, status: paid || !due ? 'pago' : 'pendente', due: paid ? '' : due, note: /fatura/.test(t) ? 'fatura' : 'boleto' }];
  }
  // cupom / nota fiscal: um lançamento com o total
  const amount = valueNear(lines, /valor (total|a pagar|pago)|total (r\$|a pagar|geral)|^total\b|total\s*$|valor\s*total/) || (all.length ? Math.max(...all) : 0);
  const desc = titleCase(firstName(lines) || 'Compra');
  return amount ? [{ kind: 'despesa', amount, desc, date: anyDate, status: 'pago', due: '', note: /cupom|nfc-?e|nota fiscal|sat\b/.test(t) ? 'cupom fiscal' : '' }] : [];
}

/* ---------------- extratos ---------------- */
export function parseOFX(text) {
  const out = [];
  for (const b of String(text).split(/<STMTTRN>/i).slice(1)) {
    const tag = (n) => (b.match(new RegExp(`<${n}>([^<\\r\\n]*)`, 'i')) || [])[1]?.trim() || '';
    const v = toNumber(tag('TRNAMT').replace(',', '.').includes('.') ? tag('TRNAMT').replace(',', '.') : tag('TRNAMT'));
    if (!v) continue;
    const d = tag('DTPOSTED'); const date = /^\d{8}/.test(d) ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : dateKey();
    const desc = titleCase((tag('MEMO') || tag('NAME') || 'Movimentação').slice(0, 40));
    out.push({ kind: v < 0 ? 'despesa' : 'receita', amount: Math.abs(v), desc, date, status: 'pago', due: '', note: 'extrato' });
  }
  return out;
}
export function parseCSV(text) {
  const rows = String(text).split(/\r?\n/).filter((l) => l.trim());
  if (rows.length < 2) return [];
  const sep = (rows[0].match(/;/g) || []).length >= (rows[0].match(/,/g) || []).length ? ';' : ',';
  const split = (l) => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
  let hi = rows.findIndex((r) => /data|date/i.test(r) && /valor|value|amount|debito|credito/i.test(r));
  if (hi < 0) hi = 0;
  const head = split(rows[hi]).map(norm);
  const col = (re) => head.findIndex((h) => re.test(h));
  const cD = col(/data|date/), cDesc = col(/descri|historico|lancamento|memo|estabelec|title|titulo/), cV = col(/^valor|value|amount|quantia/),
    cDeb = col(/debito|saida/), cCred = col(/credito|entrada/);
  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const c = split(r);
    let v = cV >= 0 ? toNumber(c[cV]) : 0;
    if (!v && cDeb >= 0 && toNumber(c[cDeb])) v = -Math.abs(toNumber(c[cDeb]));
    if (!v && cCred >= 0 && toNumber(c[cCred])) v = Math.abs(toNumber(c[cCred]));
    if (!v) continue;
    const dm = (c[cD] || '').match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/) || (c[cD] || '').match(/(\d{4})-(\d{2})-(\d{2})/);
    const date = dm ? (dm[1].length === 4 ? `${dm[1]}-${dm[2]}-${dm[3]}` : toDate(dm[1], dm[2], dm[3])) : dateKey();
    if (/saldo/i.test(c[cDesc] || '')) continue;
    out.push({ kind: v < 0 ? 'despesa' : 'receita', amount: Math.abs(v), desc: titleCase((c[cDesc] || 'Movimentação').slice(0, 40)), date: date || dateKey(), status: 'pago', due: '', note: 'extrato' });
  }
  return out;
}

/** lê uma foto ou arquivo e devolve { entries, text } com categoria sugerida */
export async function readFinanceFile(file, progress) {
  const name = (file.name || '').toLowerCase();
  let entries = [], text = '';
  if (file.type.startsWith('image/') || /\.(jpe?g|png|heic|webp)$/.test(name)) {
    progress?.('Preparando a foto…', 0.02);
    text = await ocr(await prepImage(file), progress);
    entries = parseDocText(text);
  } else if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    text = await pdfText(file, progress);
    entries = /<STMTTRN>/i.test(text) ? parseOFX(text) : parseDocText(text);
  } else {
    text = await file.text();
    entries = /<STMTTRN>/i.test(text) || name.endsWith('.ofx') ? parseOFX(text) : (name.endsWith('.csv') || /;|,/.test(text.split('\n')[0]) ? parseCSV(text) : parseDocText(text));
  }
  progress?.('Pronto!', 1);
  // em extrato (várias linhas) cada lançamento olha só a própria descrição
  return { text, entries: entries.map((e) => ({ ...e, cat: guessCat(e.desc, e.kind, entries.length === 1 ? text : '') })) };
}

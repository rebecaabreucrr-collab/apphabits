// Leitor de agenda no formato iCal (.ics), como o "endereço secreto" do Google Agenda.
// Entende eventos de dia inteiro, horários com fuso, repetições (RRULE), exceções (EXDATE) e ocorrências alteradas.

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return keyOf(d); };
const WDS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function unescape(v) { return String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim(); }

/** "20261126", "20261126T090000", "20261126T120000Z" → { date, time, allDay } no horário do aparelho */
function parseDT(value, params = {}) {
  const v = String(value || '').trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  if (!m[4] || params.VALUE === 'DATE') return { date: `${m[1]}-${m[2]}-${m[3]}`, time: '', allDay: true };
  let d;
  if (m[7]) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]));
  else d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); // com TZID: usa como hora local
  return { date: keyOf(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}`, allDay: false };
}

function parseRule(v) {
  const r = {};
  for (const part of String(v).split(';')) { const [k, val] = part.split('='); if (k) r[k.toUpperCase()] = val; }
  return {
    freq: r.FREQ, interval: Math.max(1, Number(r.INTERVAL) || 1), count: r.COUNT ? Number(r.COUNT) : 0,
    until: r.UNTIL ? parseDT(r.UNTIL)?.date : '', byday: r.BYDAY ? r.BYDAY.split(',') : [], bymonthday: r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : [],
  };
}

/** texto .ics → lista de eventos "mestres" */
export function parseICS(text) {
  const lines = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = []; let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur && cur.start && cur.status !== 'CANCELLED') events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const [name, ...ps] = line.slice(0, i).split(';');
    const params = Object.fromEntries(ps.map((p) => p.split('=')).map(([k, v]) => [k.toUpperCase(), v]));
    const val = line.slice(i + 1);
    switch (name.toUpperCase()) {
      case 'UID': cur.uid = val; break;
      case 'SUMMARY': cur.title = unescape(val); break;
      case 'LOCATION': cur.location = unescape(val); break;
      case 'DESCRIPTION': cur.notes = unescape(val).slice(0, 500); break;
      case 'STATUS': cur.status = val.toUpperCase(); break;
      case 'DTSTART': cur.start = parseDT(val, params); break;
      case 'DTEND': cur.end = parseDT(val, params); break;
      case 'RRULE': cur.rule = parseRule(val); break;
      case 'EXDATE': for (const x of val.split(',')) { const d = parseDT(x, params); if (d) cur.exdates.push(d.date); } break;
      case 'RECURRENCE-ID': cur.recurId = parseDT(val, params)?.date; break;
      default:
    }
  }
  return events.map((e) => {
    // duração em dias (dia inteiro: o fim é exclusivo)
    let days = 0;
    if (e.end) { days = Math.round((parseKey(e.end.date) - parseKey(e.start.date)) / 86400000); if (e.start.allDay) days = Math.max(0, days - 1); }
    return { uid: e.uid || `${e.title}-${e.start.date}`, title: e.title || '(sem título)', location: e.location || '', notes: e.notes || '',
      date: e.start.date, time: e.start.time, end: e.end && !e.start.allDay ? e.end.time : '', allDay: e.start.allDay, days,
      rule: e.rule || null, exdates: e.exdates, recurId: e.recurId || '' };
  });
}

/** datas em que um evento repetido acontece, entre s e e (chaves AAAA-MM-DD) */
function occurrences(ev, s, e) {
  const r = ev.rule; const out = [];
  if (!r) return ev.date <= e && addDays(ev.date, ev.days) >= s ? [ev.date] : [];
  const last = r.until && r.until < e ? r.until : e;
  let n = 0; let guard = 0;
  const push = (d) => { if (d < ev.date) return true; if (r.until && d > r.until) return false; n++; if (r.count && n > r.count) return false;
    if (d >= s && d <= last && !ev.exdates.includes(d)) out.push(d); return d <= last; };
  const start = parseKey(ev.date);
  if (r.freq === 'DAILY') {
    for (let d = ev.date; d <= last && guard++ < 5000; d = addDays(d, r.interval)) if (!push(d)) break;
  } else if (r.freq === 'WEEKLY') {
    const days = (r.byday.length ? r.byday : [WDS[start.getDay()]]).map((x) => WDS.indexOf(x.slice(-2))).filter((x) => x >= 0).sort();
    let ws = addDays(ev.date, -start.getDay()); // domingo da semana do início
    outer: for (; ws <= last && guard++ < 3000; ws = addDays(ws, 7 * r.interval)) for (const wd of days) if (!push(addDays(ws, wd))) break outer;
  } else if (r.freq === 'MONTHLY') {
    let y = start.getFullYear(), m = start.getMonth();
    outer: for (; guard++ < 1200; m += r.interval) {
      const first = new Date(y, m, 1); const key0 = keyOf(first); if (key0 > last) break;
      const dim = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      let ds = [];
      if (r.byday.length) {
        for (const b of r.byday) {
          const wd = WDS.indexOf(b.slice(-2)); const nth = Number(b.slice(0, -2)) || 0;
          const all = []; for (let d = 1; d <= dim; d++) if (new Date(first.getFullYear(), first.getMonth(), d).getDay() === wd) all.push(d);
          if (!nth) ds.push(...all); else ds.push(nth > 0 ? all[nth - 1] : all[all.length + nth]);
        }
      } else ds = (r.bymonthday.length ? r.bymonthday : [start.getDate()]).map((d) => (d < 0 ? dim + d + 1 : d));
      for (const d of ds.filter((x) => x >= 1 && x <= dim).sort((a, b) => a - b)) if (!push(keyOf(new Date(first.getFullYear(), first.getMonth(), d)))) break outer;
    }
  } else if (r.freq === 'YEARLY') {
    for (let y = start.getFullYear(); guard++ < 200; y += r.interval) {
      const d = new Date(y, start.getMonth(), start.getDate()); if (d.getMonth() !== start.getMonth()) continue;
      if (!push(keyOf(d))) break;
    }
  } else return ev.date >= s && ev.date <= e ? [ev.date] : [];
  return out;
}

/** eventos (de parseICS) que acontecem entre s e e, já com a data de cada ocorrência */
export function expandEvents(list, s, e) {
  const overrides = new Map(); // uid|data → ocorrência alterada
  for (const ev of list) if (ev.recurId) overrides.set(`${ev.uid}|${ev.recurId}`, ev);
  const out = [];
  for (const ev of list) {
    if (ev.recurId) { if (ev.date >= s && ev.date <= e) out.push({ ...ev, rule: null }); continue; }
    for (const d of occurrences(ev, addDays(s, -ev.days), e)) {
      if (overrides.has(`${ev.uid}|${d}`)) continue;
      // evento de vários dias aparece em cada dia
      for (let i = 0; i <= ev.days; i++) { const k = addDays(d, i); if (k >= s && k <= e) out.push({ ...ev, date: k, multi: ev.days ? `${i + 1}/${ev.days + 1}` : '' }); }
    }
  }
  return out.sort((a, b) => (a.date + (a.allDay ? '' : a.time || '99')).localeCompare(b.date + (b.allDay ? '' : b.time || '99')));
}

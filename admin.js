// CRM dello studio: agenda, pazienti, diario attività, richieste dal sito.
const $app = document.getElementById('app');

// ---------- helper ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { renderLogin(); throw new Error('Sessione scaduta'); }
  if (!r.ok) { const e = new Error(j.error || 'Errore'); e.status = r.status; throw e; }
  return j;
}
function toast(msg, err) {
  const t = h('div', { class: 'toast' + (err ? ' err' : '') }, msg);
  document.body.append(t); setTimeout(() => t.remove(), 3200);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { if (e.message !== 'Sessione scaduta') toast(e.message, true); } };
// Disabilita il pulsante e mostra un'etichetta mentre l'azione è in corso.
const busy = (label, fn) => async (e) => {
  const b = e?.currentTarget || e?.submitter; if (!b) return fn(e);
  const t = b.textContent; b.disabled = true; b.textContent = label;
  try { await fn(e); } finally { b.disabled = false; b.textContent = t; }
};
const dbDate = (s) => new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(' ', 'T') + 'Z'); // timestamp SQLite (UTC)
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (s) => s ? new Date(s.slice(0, 10) + 'T00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtDT = (s) => s ? `${fmtDate(s)} · ${s.slice(11, 16)}` : '';
const STATI = { programmato: 'Programmato', svolto: 'Svolto', annullato: 'Annullato', non_presentato: 'Non presentato' };
const pill = (s) => h('span', { class: 'pill ' + s }, STATI[s] || s);
const euro = (n) => Number(n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

// ---------- modale con form ----------
// fields: [{name,label,type,options,value,wide}]; onSave(values) -> promise
function modal(title, fields, onSave, extra) {
  const bg = h('div', { class: 'modal-bg' });
  const form = h('form', { class: 'modal' }, h('h2', {}, title));
  const inputs = {};
  let row = h('div', { class: 'row' });
  for (const f of fields) {
    let inp;
    if (f.type === 'select') inp = h('select', {}, f.options.map(([v, l]) => h('option', { value: v, selected: String(f.value) === String(v) }, l)));
    else if (f.type === 'textarea') inp = h('textarea', { rows: f.rows || 6 }, f.value || '');
    else if (f.type === 'checkbox') inp = h('input', { type: 'checkbox', checked: !!f.value, style: 'width:auto' });
    else inp = h('input', { type: f.type || 'text', value: f.value ?? '', step: f.step });
    if (f.required) inp.required = true;
    inputs[f.name] = inp;
    const field = h('div', { style: f.wide ? 'grid-column:1/-1' : '' }, h('label', {}, f.label), inp);
    row.append(field);
  }
  form.append(row);
  if (extra) form.append(extra);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', onKey); bg.remove(); };
  document.addEventListener('keydown', onKey);
  form.append(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Annulla'), h('button', { type: 'submit', class: 'btn' }, 'Salva')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const vals = {};
    for (const f of fields) vals[f.name] = f.type === 'checkbox' ? inputs[f.name].checked : inputs[f.name].value;
    const b = form.querySelector('button[type=submit]');
    guard(busy('Salvataggio…', async () => { await onSave(vals); close(); }))({ currentTarget: b });
  });
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) close(); });
  bg.append(form); document.body.append(bg);
  const first = form.querySelector('input,select,textarea'); if (first) first.focus();
}

// ---------- login ----------
function renderLogin() {
  const msg = h('p', { class: 'msg', role: 'alert' });
  const pw = h('input', { type: 'password', placeholder: 'Password', autocomplete: 'current-password', required: true });
  $app.replaceChildren(h('div', { class: 'login' },
    h('h1', {}, 'Area riservata'), h('p', { class: 'muted' }, 'Studio Dott.ssa Marta Borgese'),
    h('form', { class: 'card', onsubmit: async (e) => {
      e.preventDefault();
      const b = e.target.querySelector('button'); b.disabled = true; msg.textContent = '';
      try { await api('POST', '/api/login', { password: pw.value }); start(); } catch (err) { msg.textContent = err.message; pw.select(); } finally { b.disabled = false; }
    } }, h('label', {}, 'Password'), pw, h('div', { style: 'margin-top:12px' }, h('button', { class: 'btn', type: 'submit' }, 'Accedi')), msg),
    h('p', { style: 'margin-top:14px;text-align:center' }, h('a', { href: '../index.html', class: 'muted back' }, '‹ Torna al sito'))));
  pw.focus();
}

// ---------- layout ----------
let started = false;
async function start() {
  try { if (!(await api('GET', '/api/me')).auth) return renderLogin(); } catch { return renderLogin(); }
  if (!started) { started = true; window.addEventListener('hashchange', route); }
  route();
}
async function shell(active, content) {
  const st = await api('GET', '/api/stats');
  const link = (href, key, label, badge) => h('a', { href, class: active === key ? 'on' : '' }, label, badge ? h('span', { class: 'badge' }, badge) : null);
  $app.replaceChildren(h('div', { class: 'shell' },
    h('aside', {}, h('div', { class: 'logo' }, 'Studio Borgese', h('small', {}, 'Area riservata')),
      link('#/agenda', 'agenda', 'Agenda'), link('#/pazienti', 'pazienti', 'Pazienti'), link('#/richieste', 'richieste', 'Richieste dal sito', st.richieste), h('div', { class: 'sp' }),
      h('button', { onclick: guard(changePassword) }, 'Cambia password'),
      h('button', { onclick: guard(busy('Uscita…', async () => { await api('POST', '/api/logout'); location.href = '../index.html'; })) }, 'Esci')),
    h('main', {}, content)));
  return st;
}
function changePassword() {
  modal('Cambia password', [{ name: 'nuova', label: 'Nuova password (min. 10 caratteri)', type: 'password', required: true, wide: true }],
    async (v) => { await api('POST', '/api/password', v); toast('Password aggiornata'); });
}

// ---------- router ----------
function route() {
  const [, page, id] = (location.hash || '#/agenda').split('/');
  const go = { agenda: viewAgenda, pazienti: id ? () => viewPatient(id) : viewPatients, richieste: viewRequests }[page] || viewAgenda;
  guard(go)();
}

// ---------- appuntamenti ----------
async function patientOptions() {
  const cs = await api('GET', '/api/clients');
  return cs.filter((c) => c.stato === 'attivo').map((c) => [c.id, `${c.cognome} ${c.nome}`]);
}
async function appointmentForm(a = {}, refresh) {
  const opts = await patientOptions();
  if (!opts.length) return toast('Aggiungi prima un paziente', true);
  const isNew = !a.id;
  const pagato = a.pagato ? 1 : 0;
  modal(isNew ? 'Nuovo appuntamento' : 'Modifica appuntamento', [
    { name: 'client_id', label: 'Paziente', type: 'select', options: opts, value: a.client_id, wide: true },
    { name: 'start', label: 'Data e ora', type: 'datetime-local', value: a.start || '', required: true },
    { name: 'durata', label: 'Durata (minuti)', type: 'number', value: a.durata || 50 },
    { name: 'tipo', label: 'Tipo', value: a.tipo || 'Colloquio individuale' },
    { name: 'modalita', label: 'Modalità', type: 'select', options: [['studio', 'In studio'], ['online', 'Online']], value: a.modalita || 'studio' },
    { name: 'stato', label: 'Stato', type: 'select', options: Object.entries(STATI), value: a.stato || 'programmato' },
    { name: 'importo', label: 'Importo (€)', type: 'number', step: '0.01', value: a.importo ?? '' },
    { name: 'pagato', label: 'Pagato', type: 'checkbox', value: pagato },
    { name: 'promemoria', label: 'Promemoria interno', type: 'textarea', rows: 2, value: a.promemoria || '', wide: true },
  ], async (v) => {
    const body = { ...v, client_id: Number(v.client_id), pagato: v.pagato };
    const save = (force) => api(isNew ? 'POST' : 'PUT', isNew ? '/api/appointments' : `/api/appointments/${a.id}`, { ...body, force });
    try { await save(false); } catch (e) {
      if (e.status !== 409 || !confirm(e.message + '\nSalvare comunque?')) throw e;
      await save(true);
    }
    toast('Appuntamento salvato'); refresh();
  }, isNew ? null : h('div', { style: 'margin-top:10px' }, h('button', { type: 'button', class: 'btn danger sm', onclick: guard(busy('Eliminazione…', async (e) => {
    if (!confirm('Eliminare questo appuntamento?')) return;
    await api('DELETE', `/api/appointments/${a.id}`); e.target.closest('.modal-bg')?.remove(); toast('Eliminato'); refresh();
  })) }, 'Elimina appuntamento')));
}

let weekStart = null;
function mondayOf(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
async function viewAgenda() {
  weekStart ||= mondayOf(new Date());
  const st0 = await api('GET', '/api/stats');
  const end = new Date(weekStart); end.setDate(end.getDate() + 6);
  const apps = await api('GET', `/api/appointments?from=${isoDate(weekStart)}&to=${isoDate(end)}`);
  const todayIso = isoDate(new Date());
  const days = [...Array(7)].map((_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const reload = guard(viewAgenda);
  const shiftWeek = (n) => { weekStart.setDate(weekStart.getDate() + n * 7); reload(); };
  const nuovo = (day) => guard(appointmentForm)({ start: `${day}T09:00` }, reload);
  const week = h('div', { class: 'week' }, days.map((d) => {
    const iso = isoDate(d);
    return h('div', { class: 'day' + (iso === todayIso ? ' today' : '') },
      h('h4', {}, d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }), h('button', { title: 'Aggiungi', onclick: () => nuovo(iso) }, '+')),
      apps.filter((a) => a.start.startsWith(iso)).map((a) => h('div', { class: 'ev ' + a.stato, onclick: () => guard(appointmentForm)(a, reload) },
        h('b', {}, `${a.start.slice(11, 16)} · ${a.cognome} ${a.nome}`), `${a.tipo}${a.modalita === 'online' ? ' · online' : ''}`)));
  }));
  await shell('agenda', [
    h('div', { class: 'top' }, h('h1', {}, 'Agenda'), h('div', { class: 'toolbar' },
      h('button', { class: 'btn ghost', onclick: () => shiftWeek(-1) }, '‹'),
      h('span', {}, `${days[0].toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`),
      h('button', { class: 'btn ghost', onclick: () => shiftWeek(1) }, '›'),
      h('button', { class: 'btn ghost', onclick: () => { weekStart = mondayOf(new Date()); reload(); } }, 'Oggi'),
      h('button', { class: 'btn', onclick: () => nuovo(todayIso) }, '+ Appuntamento'))),
    h('div', { class: 'stats' },
      [['Oggi', st0.oggi], ['Prossimi 7 giorni', st0.prossimi7], ['Pazienti attivi', st0.pazienti], ['Da incassare', euro(st0.daIncassare)]].map(([l, v]) => h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, l)))),
    week]);
}

// ---------- pazienti ----------
async function viewPatients() {
  const q = history.state?.q || '';
  let seq = 0;
  const render = async (query) => {
    const n = ++seq;
    const cs = await api('GET', '/api/clients?q=' + encodeURIComponent(query));
    if (n !== seq) return;
    tbody.replaceChildren(...(cs.length ? cs.map((c) => h('tr', { class: 'click', onclick: () => (location.hash = '#/pazienti/' + c.id) },
      h('td', {}, h('b', {}, `${c.cognome} ${c.nome}`)), h('td', {}, c.telefono || c.email || '—'),
      h('td', {}, c.prossimo ? fmtDT(c.prossimo) : '—'), h('td', {}, c.sedute), h('td', {}, h('span', { class: 'pill ' + c.stato }, c.stato)))) : [h('tr', {}, h('td', { colspan: 5, class: 'empty' }, 'Nessun paziente trovato'))]));
  };
  const tbody = h('tbody');
  const search = h('input', { type: 'search', placeholder: 'Cerca per nome, email, telefono…', value: q, style: 'max-width:340px', oninput: () => guard(render)(search.value) });
  await shell('pazienti', [
    h('div', { class: 'top' }, h('h1', {}, 'Pazienti'), h('button', { class: 'btn', onclick: () => patientForm({}, (id) => (location.hash = '#/pazienti/' + id)) }, '+ Nuovo paziente')),
    h('div', { class: 'card' }, search, h('table', { style: 'margin-top:12px' }, h('thead', {}, h('tr', {}, ['Paziente', 'Contatto', 'Prossimo appuntamento', 'Sedute', 'Stato'].map((t) => h('th', {}, t)))), tbody))]);
  await render(q);
}
function patientForm(c, done) {
  modal(c.id ? 'Modifica anagrafica' : 'Nuovo paziente', [
    { name: 'nome', label: 'Nome', value: c.nome, required: true }, { name: 'cognome', label: 'Cognome', value: c.cognome, required: true },
    { name: 'email', label: 'Email', type: 'email', value: c.email }, { name: 'telefono', label: 'Telefono', type: 'tel', value: c.telefono },
    { name: 'data_nascita', label: 'Data di nascita', type: 'date', value: c.data_nascita },
    { name: 'stato', label: 'Stato', type: 'select', options: [['attivo', 'Attivo'], ['archiviato', 'Archiviato']], value: c.stato || 'attivo' },
    { name: 'anagrafica_note', label: 'Note amministrative (non cliniche)', type: 'textarea', rows: 3, value: c.anagrafica_note, wide: true },
  ], async (v) => {
    const r = await api(c.id ? 'PUT' : 'POST', c.id ? `/api/clients/${c.id}` : '/api/clients', v);
    toast('Salvato'); done(c.id || r.id);
  });
}

// Domande della scheda anamnesi: [chiave, etichetta, tipo] (tipo: t=testo breve, a=testo lungo, c=casella, d=data)
const ANAMNESI = [
  ['Motivo della richiesta', [
    ['motivo', 'Qual è il motivo per cui chiede un supporto psicologico?', 'a'],
    ['da_quando', 'Da quanto tempo è presente la difficoltà? Cosa l\'ha scatenata?', 'a'],
    ['aspettative', 'Cosa si aspetta dal percorso? Quali obiettivi desidera raggiungere?', 'a'],
    ['percorsi_precedenti', 'Ha già svolto percorsi psicologici o psichiatrici? Quando, con quale esito?', 'a'],
  ]],
  ['Anamnesi personale e sociale', [
    ['stato_civile', 'Stato civile / relazione affettiva', 't'],
    ['convivenza', 'Con chi vive?', 't'],
    ['figli', 'Figli (numero, età)', 't'],
    ['occupazione', 'Titolo di studio e occupazione attuale', 't'],
    ['soddisfazione_lavoro', 'Com\'è la situazione lavorativa/scolastica? Quali difficoltà?', 'a'],
    ['interessi', 'Interessi, hobby, attività nel tempo libero', 'a'],
    ['rete_supporto', 'Persone su cui può contare (famiglia, amici, partner)', 'a'],
  ]],
  ['Storia familiare', [
    ['famiglia_origine', 'Composizione della famiglia di origine e qualità dei rapporti', 'a'],
    ['storia_familiare_disturbi', 'Presenza in famiglia di difficoltà psicologiche, dipendenze o patologie rilevanti', 'a'],
  ]],
  ['Salute fisica e stile di vita', [
    ['patologie', 'Patologie, interventi o ricoveri rilevanti', 'a'],
    ['farmaci', 'Farmaci assunti attualmente (anche psicofarmaci)', 'a'],
    ['sonno', 'Qualità del sonno', 't'],
    ['alimentazione', 'Alimentazione e appetito', 't'],
    ['attivita_fisica', 'Attività fisica', 't'],
    ['sostanze', 'Fumo, alcol, altre sostanze (frequenza)', 't'],
  ]],
  ['Stato emotivo attuale', [
    ['umore', 'Come descrive il proprio umore nelle ultime settimane?', 'a'],
    ['ansia', 'Ansia, preoccupazioni, attacchi di panico: quando e in quali situazioni?', 'a'],
    ['pensieri_rischio', 'Pensieri di farsi del male o di non voler vivere (attuali o passati)', 'a'],
    ['eventi_significativi', 'Eventi significativi, lutti, traumi, cambiamenti importanti', 'a'],
  ]],
  ['Risorse e note della psicologa', [
    ['risorse', 'Punti di forza e risorse della persona', 'a'],
    ['impressioni', 'Impressioni cliniche e ipotesi iniziali', 'a'],
    ['piano', 'Piano di lavoro concordato (obiettivi, cadenza, durata)', 'a'],
  ]],
  ['Consensi', [
    ['consenso_informato', 'Consenso informato al trattamento firmato', 'c'],
    ['consenso_informato_data', 'Data consenso informato', 'd'],
    ['consenso_privacy', 'Informativa e consenso al trattamento dei dati firmati', 'c'],
    ['consenso_privacy_data', 'Data consenso privacy', 'd'],
  ]],
];
const ANAMNESI_KEYS = ANAMNESI.flatMap(([, qs]) => qs.map((q) => q[0]));

let lastPatient = null;
async function viewPatient(id) {
  const [c, an] = await Promise.all([api('GET', '/api/clients/' + id), api('GET', `/api/clients/${id}/anamnesi`)]);
  // paziente nuovo senza anamnesi: si parte da 'anamnesi'; altrimenti si ricorda l'ultimo tab (anche dopo i salvataggi)
  const saved = sessionStorage.getItem('tab');
  let tab = lastPatient === id && saved ? saved : (an.updated_at ? (saved || 'diario') : 'anamnesi');
  if (!['anamnesi', 'diario', 'sedute', 'anag'].includes(tab)) tab = 'diario';
  lastPatient = id;
  const reload = guard(() => viewPatient(id));
  const noteForm = (n = {}) => modal(n.id ? 'Modifica nota' : 'Nuova nota di attività', [
    { name: 'data', label: 'Data', type: 'date', value: n.data || isoDate(new Date()), required: true },
    { name: 'appointment_id', label: 'Collegata alla seduta', type: 'select', value: n.appointment_id || '', options: [['', '— nessuna —'], ...c.appuntamenti.map((a) => [a.id, fmtDT(a.start)])] },
    { name: 'titolo', label: 'Titolo / argomento', value: n.titolo, wide: true },
    { name: 'testo', label: 'Nota', type: 'textarea', rows: 12, value: n.testo, required: true, wide: true },
  ], async (v) => { await api(n.id ? 'PUT' : 'POST', n.id ? `/api/notes/${n.id}` : `/api/clients/${id}/notes`, v); toast('Nota salvata'); reload(); });

  const diario = [
    h('div', { class: 'privacy' }, '🔒 Le note di questa sezione sono cifrate nel database e visibili solo da qui, dopo l\'accesso.'),
    h('div', { class: 'top' }, h('h2', {}, `Diario attività (${c.note.length})`), h('button', { class: 'btn', onclick: () => noteForm() }, '+ Nuova nota')),
    c.note.length ? c.note.map((n) => h('div', { class: 'note' },
      h('header', {}, h('span', {}, fmtDate(n.data) + (n.updated_at ? ' · modificata' : '')), h('span', {},
        h('button', { class: 'btn ghost sm', onclick: () => noteForm(n) }, 'Modifica'), ' ',
        h('button', { class: 'btn danger sm', onclick: guard(busy('…', async () => { if (confirm('Eliminare la nota?')) { await api('DELETE', '/api/notes/' + n.id); await reload(); } })) }, 'Elimina'))),
      n.titolo ? h('h3', {}, n.titolo) : null, h('p', {}, n.testo))) : h('div', { class: 'empty card' }, 'Ancora nessuna nota per questo paziente.'),
  ];
  const sedute = [
    h('div', { class: 'top' }, h('h2', {}, `Appuntamenti (${c.appuntamenti.length})`), h('button', { class: 'btn', onclick: guard(() => appointmentForm({ client_id: c.id }, reload)) }, '+ Appuntamento')),
    h('div', { class: 'card tablewrap' }, c.appuntamenti.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Data', 'Tipo', 'Stato', 'Importo', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, c.appuntamenti.map((a) => h('tr', {}, h('td', {}, fmtDT(a.start)), h('td', {}, a.tipo + (a.modalita === 'online' ? ' (online)' : '')), h('td', {}, pill(a.stato)),
        h('td', {}, a.importo ? `${euro(a.importo)} ${a.pagato ? '✓' : '(da incassare)'}` : '—'), h('td', {}, h('button', { class: 'btn ghost sm', onclick: guard(() => appointmentForm(a, reload)) }, 'Modifica')))))) : h('div', { class: 'empty' }, 'Nessun appuntamento registrato per questo paziente. Usa «+ Appuntamento» per fissare il primo colloquio.')),
  ];
  const anag = [
    h('div', { class: 'card' }, h('div', { class: 'row' }, [['Email', c.email], ['Telefono', c.telefono], ['Data di nascita', c.data_nascita ? fmtDate(c.data_nascita) : ''], ['Paziente dal', fmtDate(c.created_at)]].map(([l, v]) => h('div', {}, h('label', {}, l), v || '—'))),
      c.anagrafica_note ? h('div', {}, h('label', {}, 'Note amministrative'), h('p', { style: 'white-space:pre-wrap;margin:0' }, c.anagrafica_note)) : null),
    h('button', { class: 'btn danger sm', onclick: guard(busy('Eliminazione…', async () => {
      if (!confirm(`Eliminare definitivamente ${c.nome} ${c.cognome}, con tutti gli appuntamenti e le note?\nL'operazione non è reversibile (in alternativa archivia il paziente).`)) return;
      await api('DELETE', '/api/clients/' + id); location.hash = '#/pazienti';
    })) }, 'Elimina paziente'),
  ];
  const campi = {};
  const save = async () => {
    const risposte = {};
    for (const k of ANAMNESI_KEYS) risposte[k] = campi[k].type === 'checkbox' ? campi[k].checked : campi[k].value;
    await api('PUT', `/api/clients/${id}/anamnesi`, { risposte }); toast('Anamnesi salvata'); await reload();
  };
  const anamnesi = [
    h('div', { class: 'privacy' }, '🔒 Le risposte sono cifrate nel database. ' + (an.updated_at ? 'Ultimo salvataggio: ' + dbDate(an.updated_at).toLocaleString('it-IT') : 'Scheda non ancora compilata.')),
    h('form', { onsubmit: (e) => { e.preventDefault(); guard(busy('Salvataggio…', save))({ currentTarget: e.target.querySelector('button[type=submit]') }); } },
      ANAMNESI.map(([titolo, qs]) => h('div', { class: 'card' }, h('h2', {}, titolo), qs.map(([k, label, tipo]) => {
        const v = an.risposte[k];
        campi[k] = tipo === 'a' ? h('textarea', { rows: 3 }, v || '') : tipo === 'c' ? h('input', { type: 'checkbox', checked: v === true, style: 'width:auto' }) : h('input', { type: tipo === 'd' ? 'date' : 'text', value: v || '' });
        return h('div', { style: 'margin-bottom:12px' }, h('label', {}, label), campi[k]);
      }))),
      h('button', { class: 'btn', type: 'submit' }, 'Salva anamnesi')),
  ];
  const tabs = { anamnesi, diario, sedute, anag };
  const body = h('div');
  const show = (t) => { tab = t; sessionStorage.setItem('tab', t); body.replaceChildren(...tabs[t]); tabBar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === t)); };
  const tabBar = h('div', { class: 'tabs' }, [['anamnesi', 'Anamnesi'], ['diario', 'Diario attività'], ['sedute', 'Appuntamenti'], ['anag', 'Anagrafica']].map(([k, l]) => h('button', { 'data-t': k, onclick: () => show(k) }, l)));
  await shell('pazienti', [
    h('p', {}, h('a', { href: '#/pazienti', class: 'back' }, '‹ Tutti i pazienti')),
    h('div', { class: 'top' }, h('h1', {}, `${c.nome} ${c.cognome} `, h('span', { class: 'pill ' + c.stato }, c.stato)), h('button', { class: 'btn ghost', onclick: () => patientForm(c, reload) }, 'Modifica anagrafica')),
    tabBar, body]);
  show(tab);
}

// ---------- richieste dal sito ----------
async function viewRequests() {
  const rs = await api('GET', '/api/requests');
  await shell('richieste', [
    h('div', { class: 'top' }, h('h1', {}, 'Richieste dal sito')),
    rs.length ? rs.map((r) => h('div', { class: 'card' },
      h('div', { class: 'top', style: 'margin:0' }, h('div', {}, h('b', {}, r.nome), r.stato === 'nuova' ? h('span', { class: 'badge', style: 'margin-left:8px' }, 'nuova') : null,
        h('div', { class: 'muted' }, [r.telefono, r.email].filter(Boolean).join(' · ') + ' · ' + dbDate(r.created_at).toLocaleString('it-IT'))),
        h('div', { style: 'display:flex;gap:6px' },
          h('button', { class: 'btn sm', onclick: guard(busy('Creazione…', async () => { const j = await api('POST', `/api/requests/${r.id}/convert`); location.hash = '#/pazienti/' + j.id; })) }, 'Crea paziente'),
          r.stato === 'nuova' ? h('button', { class: 'btn ghost sm', onclick: guard(busy('…', async () => { await api('PUT', '/api/requests/' + r.id, { stato: 'letta' }); await viewRequests(); })) }, 'Segna letta') : null,
          h('button', { class: 'btn ghost sm', onclick: guard(busy('…', async () => { await api('PUT', '/api/requests/' + r.id, { stato: 'archiviata' }); await viewRequests(); })) }, 'Archivia'))),
      r.messaggio ? h('p', { style: 'margin:10px 0 0;white-space:pre-wrap' }, r.messaggio) : null)) : h('div', { class: 'card empty' }, 'Nessuna richiesta in arrivo.')]);
}

start();

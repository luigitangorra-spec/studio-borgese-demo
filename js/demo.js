// Versione DIMOSTRATIVA: finto server nel browser (nessun dato reale, nessun backend).
// Intercetta le chiamate fetch('/api/...') e le gestisce con dati di esempio salvati in localStorage.
(() => {
  const KEY = 'marta_demo_db_v1', AUTH = 'marta_demo_auth', DEMO_PASSWORD = 'demo';
  const pad = (n) => String(n).padStart(2, '0');
  const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const nowUtc = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
  const nowLocalMin = () => { const d = new Date(); return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

  // ---------- dati di esempio (tutti inventati) ----------
  function seed() {
    const day = (off, hm) => { const d = new Date(); d.setDate(d.getDate() + off); return `${isoDate(d)}T${hm}`; };
    const ap = (id, client_id, start, o = {}) => ({ id, client_id, start, durata: 50, tipo: 'Colloquio individuale', modalita: 'studio', stato: 'programmato', importo: 70, pagato: 0, promemoria: '', ...o });
    const cl = (id, nome, cognome, o = {}) => ({ id, nome, cognome, email: '', telefono: '', data_nascita: '', anagrafica_note: '', stato: 'attivo', created_at: nowUtc(), ...o });
    return {
      nextId: { clients: 5, appointments: 11, notes: 5, requests: 3 },
      clients: [
        cl(1, 'Giulia', 'Rinaldi', { email: 'giulia.rinaldi@example.com', telefono: '333 000 0001', data_nascita: '1991-04-12', anagrafica_note: 'Paziente di esempio.' }),
        cl(2, 'Marco', 'Esposito', { email: 'marco.esposito@example.com', telefono: '333 000 0002', data_nascita: '1984-09-30' }),
        cl(3, 'Chiara', 'Lopez', { email: 'chiara.lopez@example.com', telefono: '333 000 0003', data_nascita: '1998-01-22' }),
        cl(4, 'Andrea', 'Ferri', { telefono: '333 000 0004', anagrafica_note: 'Primo contatto dal sito.' }),
      ],
      appointments: [
        ap(1, 1, day(-14, '10:00'), { stato: 'svolto', pagato: 1 }),
        ap(2, 1, day(-7, '10:00'), { stato: 'svolto', pagato: 1 }),
        ap(3, 1, day(1, '10:00')),
        ap(4, 2, day(-10, '17:00'), { stato: 'svolto' }),
        ap(5, 2, day(0, '17:30')),
        ap(6, 2, day(7, '17:30')),
        ap(7, 3, day(-3, '15:00'), { stato: 'svolto', pagato: 1, modalita: 'online' }),
        ap(8, 3, day(2, '15:00'), { modalita: 'online' }),
        ap(9, 4, day(3, '09:30'), { tipo: 'Colloquio conoscitivo', importo: 0 }),
        ap(10, 2, day(-17, '17:00'), { stato: 'annullato' }),
      ],
      notes: [
        { id: 1, client_id: 1, appointment_id: 1, data: day(-14, '10:00').slice(0, 10), titolo: 'Primo colloquio', testo: 'Esempio di nota. Presentazione del percorso, raccolta della richiesta e definizione degli obiettivi iniziali.', created_at: nowUtc(), updated_at: null },
        { id: 2, client_id: 1, appointment_id: 2, data: day(-7, '10:00').slice(0, 10), titolo: 'Gestione dello stress', testo: 'Esempio di nota. Lavoro sulle situazioni di tensione quotidiana; assegnato un breve esercizio di respirazione da svolgere tra le sedute.', created_at: nowUtc(), updated_at: null },
        { id: 3, client_id: 2, appointment_id: 4, data: day(-10, '17:00').slice(0, 10), titolo: 'Colloquio di conoscenza', testo: 'Esempio di nota. Raccolti i dati essenziali; concordata cadenza quindicinale.', created_at: nowUtc(), updated_at: null },
        { id: 4, client_id: 3, appointment_id: 7, data: day(-3, '15:00').slice(0, 10), titolo: 'Seduta online', testo: 'Esempio di nota. Seduta svolta in videochiamata, buon livello di partecipazione.', created_at: nowUtc(), updated_at: null },
      ],
      anamnesi: {
        1: { updated_at: new Date().toISOString(), risposte: {
          motivo: 'Periodo di forte stress lavorativo, difficoltà a staccare la sera.', da_quando: 'Circa sei mesi, dopo un cambio di mansioni.',
          aspettative: 'Imparare a gestire meglio la tensione e ritrovare un buon sonno.', percorsi_precedenti: 'Nessun percorso precedente.',
          stato_civile: 'Convivente', occupazione: 'Impiegata', sonno: 'Sonno spesso interrotto', consenso_informato: true, consenso_informato_data: day(-14, '10:00').slice(0, 10), consenso_privacy: true, consenso_privacy_data: day(-14, '10:00').slice(0, 10),
        } },
      },
      requests: [
        { id: 1, nome: 'Elena Marini', email: 'elena.marini@example.com', telefono: '', messaggio: 'Buongiorno, vorrei fissare un primo colloquio, preferibilmente il pomeriggio.', stato: 'nuova', created_at: nowUtc() },
        { id: 2, nome: 'Davide Conte', email: '', telefono: '333 000 0099', messaggio: '', stato: 'nuova', created_at: nowUtc() },
      ],
    };
  }

  let db = null, authMem = false;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db || !db.clients) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage non disponibile: i dati restano in memoria */ } };
  const getAuth = () => { try { return sessionStorage.getItem(AUTH) === '1'; } catch { return authMem; } };
  const setAuth = (v) => { authMem = v; try { v ? sessionStorage.setItem(AUTH, '1') : sessionStorage.removeItem(AUTH); } catch { /* ignora */ } };
  save();

  // ---------- helper ----------
  class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const need = (v, msg) => { if (!v) throw new HttpError(400, msg); return v; };
  const nextId = (t) => db.nextId[t]++;
  const pick = (o, fields) => Object.fromEntries(fields.filter((f) => o[f] !== undefined).map((f) => [f, typeof o[f] === 'string' ? o[f].trim().slice(0, 5000) : o[f]]));
  const CLIENT_F = ['nome', 'cognome', 'email', 'telefono', 'data_nascita', 'anagrafica_note', 'stato'];
  const APP_F = ['client_id', 'start', 'durata', 'tipo', 'modalita', 'stato', 'importo', 'pagato', 'promemoria'];
  const byId = (arr, id) => arr.find((x) => x.id === Number(id));

  function validApp(b) {
    const d = pick(b, APP_F);
    if (d.start !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(d.start)) throw new HttpError(400, 'Data/ora non valida');
    if (d.durata !== undefined) d.durata = Math.min(480, Math.max(10, Number(d.durata) || 50));
    if (d.importo !== undefined) d.importo = Number(d.importo) || 0;
    if (d.pagato !== undefined) d.pagato = d.pagato ? 1 : 0;
    if (d.client_id !== undefined) d.client_id = Number(d.client_id);
    return d;
  }
  function overlap(start, durata, ignoreId = 0) {
    const s = new Date(start).getTime(), e = s + durata * 60000;
    return db.appointments.find((a) => a.id !== ignoreId && a.stato !== 'annullato' && a.start.slice(0, 10) === start.slice(0, 10)
      && s < new Date(a.start).getTime() + a.durata * 60000 && new Date(a.start).getTime() < e);
  }
  const clashMsg = (a) => { const c = byId(db.clients, a.client_id); return `Si sovrappone a ${c.nome} ${c.cognome} (${a.start.slice(11)})`; };

  // ---------- rotte ----------
  const routes = [
    ['POST', /^richiesta$/, 'public', (m, b) => {
      if (b.sito) return {};
      const d = pick(b, ['nome', 'email', 'telefono', 'messaggio']);
      need(d.nome, 'Inserisci il tuo nome');
      if (!d.email && !d.telefono) throw new HttpError(400, 'Inserisci un’email o un numero di telefono');
      if (!b.consenso) throw new HttpError(400, 'È necessario accettare l’informativa privacy');
      db.requests.push({ id: nextId('requests'), email: '', telefono: '', messaggio: '', stato: 'nuova', created_at: nowUtc(), ...d });
      return [201, { ok: true }];
    }],
    ['POST', /^login$/, 'public', (m, b) => {
      if (String(b.password || '') !== DEMO_PASSWORD) throw new HttpError(401, `Password errata (nella demo è "${DEMO_PASSWORD}")`);
      setAuth(true); return { ok: true };
    }],
    ['GET', /^me$/, 'public', () => ({ auth: getAuth() })],
    ['POST', /^logout$/, 'auth', () => { setAuth(false); return { ok: true }; }],
    ['POST', /^password$/, 'auth', () => { throw new HttpError(400, 'Nella versione demo la password non si può cambiare'); }],
    ['GET', /^stats$/, 'auth', () => {
      const today = isoDate(new Date()), p7 = new Date(); p7.setDate(p7.getDate() + 7);
      const live = db.appointments.filter((a) => a.stato !== 'annullato');
      return {
        oggi: live.filter((a) => a.start.slice(0, 10) === today).length,
        prossimi7: live.filter((a) => a.start.slice(0, 10) > today && a.start.slice(0, 10) <= isoDate(p7)).length,
        pazienti: db.clients.filter((c) => c.stato === 'attivo').length,
        richieste: db.requests.filter((r) => r.stato === 'nuova').length,
        daIncassare: db.appointments.filter((a) => a.stato === 'svolto' && !a.pagato).reduce((s, a) => s + (a.importo || 0), 0),
      };
    }],

    ['GET', /^clients$/, 'auth', (m, b, q) => {
      const s = (q.get('q') || '').trim().toLowerCase(), now = nowLocalMin();
      return db.clients
        .filter((c) => !s || [`${c.nome} ${c.cognome}`, `${c.cognome} ${c.nome}`, c.email, c.telefono].some((x) => (x || '').toLowerCase().includes(s)))
        .map((c) => ({
          ...c,
          prossimo: db.appointments.filter((a) => a.client_id === c.id && a.stato === 'programmato' && a.start >= now).map((a) => a.start).sort()[0] || null,
          sedute: db.appointments.filter((a) => a.client_id === c.id && a.stato === 'svolto').length,
        }))
        .sort((a, b2) => a.stato.localeCompare(b2.stato) || a.cognome.localeCompare(b2.cognome) || a.nome.localeCompare(b2.nome));
    }],
    ['POST', /^clients$/, 'auth', (m, b) => {
      const d = pick(b, CLIENT_F); need(d.nome && d.cognome, 'Nome e cognome sono obbligatori');
      const c = { id: nextId('clients'), email: '', telefono: '', data_nascita: '', anagrafica_note: '', stato: 'attivo', created_at: nowUtc(), ...d };
      db.clients.push(c); return [201, { id: c.id }];
    }],
    ['GET', /^clients\/(\d+)$/, 'auth', (m) => {
      const c = byId(db.clients, m[1]); if (!c) throw new HttpError(404, 'Paziente non trovato');
      return {
        ...c,
        appuntamenti: db.appointments.filter((a) => a.client_id === c.id).sort((a, b) => b.start.localeCompare(a.start)),
        note: db.notes.filter((n) => n.client_id === c.id).sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id),
      };
    }],
    ['PUT', /^clients\/(\d+)$/, 'auth', (m, b) => {
      const c = byId(db.clients, m[1]); if (!c) throw new HttpError(404, 'Paziente non trovato');
      const d = pick(b, CLIENT_F);
      if (('nome' in d && !d.nome) || ('cognome' in d && !d.cognome)) throw new HttpError(400, 'Nome e cognome sono obbligatori');
      Object.assign(c, d); return { ok: true };
    }],
    ['DELETE', /^clients\/(\d+)$/, 'auth', (m) => {
      const id = Number(m[1]);
      db.clients = db.clients.filter((c) => c.id !== id); db.appointments = db.appointments.filter((a) => a.client_id !== id);
      db.notes = db.notes.filter((n) => n.client_id !== id); delete db.anamnesi[id]; return { ok: true };
    }],

    ['GET', /^appointments$/, 'auth', (m, b, q) => {
      const from = q.get('from') || '0000-01-01', to = q.get('to') || '9999-12-31';
      return db.appointments.filter((a) => a.start.slice(0, 10) >= from && a.start.slice(0, 10) <= to).sort((a, b2) => a.start.localeCompare(b2.start))
        .map((a) => { const c = byId(db.clients, a.client_id) || {}; return { ...a, nome: c.nome, cognome: c.cognome }; });
    }],
    ['POST', /^appointments$/, 'auth', (m, b) => {
      const d = validApp(b); need(d.client_id && d.start, 'Paziente e data sono obbligatori');
      const clash = overlap(d.start, d.durata || 50);
      if (clash && !b.force) return [409, { error: clashMsg(clash) }];
      const a = { id: nextId('appointments'), durata: 50, tipo: 'Colloquio individuale', modalita: 'studio', stato: 'programmato', importo: 0, pagato: 0, promemoria: '', ...d };
      db.appointments.push(a); return [201, { id: a.id }];
    }],
    ['PUT', /^appointments\/(\d+)$/, 'auth', (m, b) => {
      const a = byId(db.appointments, m[1]); if (!a) throw new HttpError(404, 'Appuntamento non trovato');
      const d = validApp(b);
      if ((d.start || d.durata) && !b.force) { const clash = overlap(d.start || a.start, d.durata || a.durata, a.id); if (clash) return [409, { error: clashMsg(clash) }]; }
      Object.assign(a, d); return { ok: true };
    }],
    ['DELETE', /^appointments\/(\d+)$/, 'auth', (m) => {
      const id = Number(m[1]); db.appointments = db.appointments.filter((a) => a.id !== id);
      db.notes.forEach((n) => { if (n.appointment_id === id) n.appointment_id = null; }); return { ok: true };
    }],

    ['POST', /^clients\/(\d+)\/notes$/, 'auth', (m, b) => {
      need(b.testo && String(b.testo).trim(), 'Scrivi il contenuto della nota');
      const n = { id: nextId('notes'), client_id: Number(m[1]), appointment_id: b.appointment_id ? Number(b.appointment_id) : null, data: String(b.data || isoDate(new Date())).slice(0, 10),
        titolo: String(b.titolo || '').slice(0, 200), testo: String(b.testo).slice(0, 50000), created_at: nowUtc(), updated_at: null };
      db.notes.push(n); return [201, { id: n.id }];
    }],
    ['PUT', /^notes\/(\d+)$/, 'auth', (m, b) => {
      const n = byId(db.notes, m[1]); if (!n) throw new HttpError(404, 'Nota non trovata');
      need(b.testo && String(b.testo).trim(), 'Scrivi il contenuto della nota');
      Object.assign(n, { data: String(b.data).slice(0, 10), appointment_id: b.appointment_id ? Number(b.appointment_id) : null, titolo: String(b.titolo || '').slice(0, 200), testo: String(b.testo).slice(0, 50000), updated_at: new Date().toISOString() });
      return { ok: true };
    }],
    ['DELETE', /^notes\/(\d+)$/, 'auth', (m) => { db.notes = db.notes.filter((n) => n.id !== Number(m[1])); return { ok: true }; }],

    ['GET', /^clients\/(\d+)\/anamnesi$/, 'auth', (m) => db.anamnesi[m[1]] || { risposte: {}, updated_at: null }],
    ['PUT', /^clients\/(\d+)\/anamnesi$/, 'auth', (m, b) => {
      if (!b.risposte || typeof b.risposte !== 'object') throw new HttpError(400, 'Risposte non valide');
      if (!byId(db.clients, m[1])) throw new HttpError(404, 'Paziente non trovato');
      db.anamnesi[m[1]] = { risposte: b.risposte, updated_at: new Date().toISOString() }; return { ok: true };
    }],

    ['GET', /^requests$/, 'auth', () => db.requests.filter((r) => r.stato !== 'archiviata').sort((a, b) => b.id - a.id)],
    ['POST', /^requests\/(\d+)\/convert$/, 'auth', (m) => {
      const r = byId(db.requests, m[1]); if (!r) throw new HttpError(404, 'Richiesta non trovata');
      const [nome, ...resto] = r.nome.split(/\s+/);
      const c = { id: nextId('clients'), nome, cognome: resto.join(' ') || '-', email: r.email, telefono: r.telefono, data_nascita: '', stato: 'attivo',
        anagrafica_note: r.messaggio ? `Richiesta dal sito: ${r.messaggio}` : '', created_at: nowUtc() };
      db.clients.push(c); r.stato = 'archiviata'; return [201, { id: c.id }];
    }],
    ['PUT', /^requests\/(\d+)$/, 'auth', (m, b) => {
      if (!['nuova', 'letta', 'archiviata'].includes(b.stato)) throw new HttpError(400, 'Stato non valido');
      const r = byId(db.requests, m[1]); if (r) r.stato = b.stato; return { ok: true };
    }],
  ];

  function handle(method, path, body, query) {
    for (const [rm, re, access, fn] of routes) {
      const m = path.match(re);
      if (!m || rm !== method) continue;
      if (access === 'auth' && !getAuth()) throw new HttpError(401, 'Accesso non autorizzato');
      return fn(m, body, query);
    }
    throw new HttpError(404, 'Endpoint non trovato');
  }
  const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const u = new URL(url, location.href), i = u.pathname.indexOf('/api/');
    if (i < 0) return realFetch(input, init);
    const method = (init.method || 'GET').toUpperCase();
    try {
      const body = init.body ? JSON.parse(init.body) : {};
      let out = handle(method, u.pathname.slice(i + 5), body, u.searchParams), status = 200;
      if (Array.isArray(out) && typeof out[0] === 'number') [status, out] = out;
      save();
      return reply(status, out);
    } catch (e) {
      if (e instanceof HttpError) return reply(e.status, { error: e.message });
      console.error(e); return reply(500, { error: 'Errore interno della demo' });
    }
  };
  window.__demoReset = () => { try { localStorage.removeItem(KEY); sessionStorage.removeItem(AUTH); } catch { /* ignora */ } location.reload(); };

  // ---------- fascia informativa ----------
  const addBanner = () => {
    if (typeof document === 'undefined' || !document.body) return;
    const inAdmin = location.pathname.includes('area-riservata');
    const bar = document.createElement('div');
    bar.setAttribute('role', 'note');
    bar.style.cssText = 'background:#1f2d27;color:#e9efe9;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;padding:8px 14px;text-align:center';
    bar.append(document.createTextNode(inAdmin
      ? 'Versione dimostrativa · dati di esempio inventati, salvati solo in questo browser · password: demo · '
      : 'Versione dimostrativa del sito · '));
    const a = document.createElement('a');
    a.style.cssText = 'color:#9fd3b3;cursor:pointer;text-decoration:underline';
    if (inAdmin) { a.textContent = 'ripristina i dati'; a.addEventListener('click', () => window.__demoReset()); }
    else { a.textContent = 'prova l’area riservata (password: demo)'; a.href = 'area-riservata/index.html'; }
    bar.append(a);
    document.body.prepend(bar);
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addBanner); else addBanner();
  }
})();

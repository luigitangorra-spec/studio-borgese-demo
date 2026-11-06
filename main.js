(() => {
  const S = window.SITE;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const page = document.body.dataset.page;
  const links = [['home', 'index.html', 'Home'], ['chi-sono', 'chi-sono.html', 'Chi sono'], ['servizi', 'servizi.html', 'Servizi'], ['contatti', 'contatti.html', 'Contatti']];

  document.querySelector('#site-header').outerHTML = `
  <header class="site"><div class="wrap">
    <a class="brand" href="index.html">${esc(S.nome)}<small>${esc(S.titolo)} · Adelfia</small></a>
    <button class="burger" aria-expanded="false" aria-controls="nav">Menu</button>
    <nav class="main" id="nav" aria-label="Principale">
      ${links.map(([k, h, t]) => `<a href="${h}"${k === page ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
      <a class="cta" href="contatti.html#richiesta">Prenota un colloquio</a>
    </nav>
  </div></header>`;

  const tel = S.telefono ? `<li>Tel. <a href="tel:${esc(S.telefono.replace(/\s/g, ''))}">${esc(S.telefono)}</a></li>` : '';
  const mail = S.email ? `<li><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>` : '';
  document.querySelector('#site-footer').outerHTML = `
  <footer class="site"><div class="wrap">
    <div class="cols">
      <div><h4>${esc(S.nome)}</h4><p>${esc(S.titolo)}. Uno spazio di ascolto, rispetto e riservatezza per affrontare con calma ciò che oggi pesa.</p>${S.albo ? `<p>${esc(S.albo)}</p>` : ''}</div>
      <div><h4>Studio</h4><ul><li>${esc(S.indirizzo)}</li><li>${esc(S.citta)}</li>${tel}${mail}<li>${esc(S.orari)}</li></ul></div>
      <div><h4>Navigazione</h4><ul>${links.map(([, h, t]) => `<li><a href="${h}">${t}</a></li>`).join('')}<li><a href="privacy.html">Privacy</a></li></ul></div>
    </div>
    <div class="legal"><span>© ${new Date().getFullYear()} ${esc(S.nome)}${S.partitaIva ? ' · ' + esc(S.partitaIva) : ''}</span><a href="area-riservata/index.html">Area riservata</a></div>
  </div></footer>`;

  const burger = document.querySelector('.burger'), nav = document.querySelector('#nav');
  burger.addEventListener('click', () => burger.setAttribute('aria-expanded', nav.classList.toggle('open')));

  // Dati di contatto dinamici (mostrati solo se compilati in config.js)
  document.querySelectorAll('[data-site]').forEach((el) => {
    const v = S[el.dataset.site];
    if (!v) { (el.closest('[data-hide-empty]') || el).hidden = true; return; }
    el.textContent = v;
    if (el.tagName === 'A') el.href = (el.dataset.site === 'email' ? 'mailto:' : 'tel:') + v.replace(/\s/g, '');
  });
  document.querySelectorAll('[data-wa]').forEach((el) => { if (S.whatsapp) el.href = 'https://wa.me/' + S.whatsapp; else el.hidden = true; });

  // Mappa caricata solo al click (nessun contenuto di terze parti senza consenso)
  const mapBtn = document.querySelector('#load-map');
  if (mapBtn) mapBtn.addEventListener('click', () => {
    const q = encodeURIComponent(`${S.indirizzo}, Adelfia`);
    mapBtn.closest('.map').innerHTML = `<iframe title="Mappa dello studio" loading="lazy" referrerpolicy="no-referrer" src="https://maps.google.com/maps?q=${q}&z=16&output=embed"></iframe>`;
  });

  // Form richiesta appuntamento
  const form = document.querySelector('#richiesta-form');
  if (form) form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('.form-msg'), btn = form.querySelector('button[type=submit]');
    const d = Object.fromEntries(new FormData(form));
    d.consenso = form.consenso.checked;
    btn.disabled = true; msg.className = 'form-msg';
    try {
      const r = await fetch('/api/richiesta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Errore');
      form.reset(); msg.textContent = 'Grazie, la richiesta è stata inviata. Sarà ricontattato/a il prima possibile.'; msg.className = 'form-msg ok';
    } catch (err) { msg.textContent = err.message; msg.className = 'form-msg err'; }
    btn.disabled = false;
  });
})();

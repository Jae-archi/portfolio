/* Portfolio viewer: shows the selected language one spread at a time (like a book) or as a scrolling column, and counts
   visits per office link with GoatCounter.
   Link format: https://<user>.github.io/<repo>/?o=<code>   (the code is mapped to an office in a private file, not here)
   Optional: add ?lang=fr for French, #5 for a page, or ?view=scroll for the scrolling view.
   Events sent to GoatCounter (all anonymous):
     /o/<code>            one page view when the page opens
     /o/<code>/p<N>       page N stayed on screen for at least 1.5 s
     /o/<code>/download   the Download PDF button was used
*/
(() => {
  'use strict';
  const GC_CODE = 'jaearchi';                       // -> https://jaearchi.goatcounter.com
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const DWELL_MS = 1500;
  const MAX_PX = 5600;                              // longest canvas side

  const q = new URLSearchParams(location.search);
  const lang = q.get('lang') === 'fr' ? 'fr' : 'en';
  const PDF_URL = (lang === 'fr' ? 'assets/portfolio_fr.pdf' : 'assets/portfolio.pdf') + '?v=20261004-4';
  const copy = lang === 'fr' ? {
    subtitle: 'Portfolio 2026 · LIMINA, Du seuil à la ville', scroll: 'Défilement', book: 'Livre',
    full: 'Plein écran', download: 'Télécharger PDF', zoom: 'Zoom', fit: 'Ajuster',
    loading: 'Chargement du portfolio…', viewerError: 'La visionneuse ne peut pas démarrer.',
    pdfError: 'Le portfolio ne peut pas être affiché.', direct: 'Ouvrir le PDF directement',
    footer: 'Utilisez ← → ou balayez pour tourner les pages. Les visites sont comptées anonymement (pages vues uniquement, sans cookies ni données personnelles).'
  } : {
    subtitle: 'Portfolio 2026 · LIMINA, From Threshold to City', scroll: 'Scroll', book: 'Book',
    full: 'Full screen', download: 'Download PDF', zoom: 'Zoom', fit: 'Fit',
    loading: 'Loading portfolio…', viewerError: 'The viewer could not load.',
    pdfError: 'The portfolio could not be displayed.', direct: 'Open the PDF directly',
    footer: 'Use ← → or swipe to turn pages. This page counts visits anonymously (page views only, no cookies, no personal data).'
  };
  let office = (q.get('o') || 'direct').toLowerCase();
  if (!/^[a-z0-9_-]{1,24}$/.test(office)) office = 'direct';
  const base = '/o/' + office + (lang === 'fr' ? '/fr' : '');
  const $ = id => document.getElementById(id);

  function languageUrl(target) {
    const url = new URL(location.href);
    if (target === 'fr') url.searchParams.set('lang', 'fr');
    else url.searchParams.delete('lang');
    return url.pathname + url.search + url.hash;
  }
  function refreshLanguageLinks() {
    $('langEn').href = languageUrl('en');
    $('langFr').href = languageUrl('fr');
  }
  document.documentElement.lang = lang;
  document.querySelector('.language').setAttribute('aria-label', lang === 'fr' ? 'Langue du portfolio' : 'Portfolio language');
  $('langEn').setAttribute('aria-current', lang === 'en' ? 'page' : 'false');
  $('langFr').setAttribute('aria-current', lang === 'fr' ? 'page' : 'false');
  refreshLanguageLinks();
  $('subtitle').textContent = copy.subtitle;
  document.querySelector('.view-mode').setAttribute('aria-label', lang === 'fr' ? 'Mode de lecture' : 'Portfolio view');
  $('bookMode').textContent = copy.book;
  $('scrollMode').textContent = copy.scroll;
  $('fs').textContent = copy.full;
  $('fs').title = copy.full + ' (F)';
  $('dl').textContent = copy.download;
  $('dl').href = PDF_URL;
  $('dl').download = 'LEE_Jaegyu_Portfolio_2027_' + lang.toUpperCase() + '.pdf';
  $('direct').href = PDF_URL;
  $('direct').textContent = copy.direct;
  $('footerCopy').textContent = copy.footer;
  $('status').textContent = copy.loading;
  $('viewport').title = lang === 'fr' ? 'Cliquer pour agrandir' : 'Click to zoom';
  $('bookMode').title = lang === 'fr' ? 'Afficher le portfolio en mode livre' : 'Show the portfolio as a book';
  $('scrollMode').title = lang === 'fr' ? 'Afficher toutes les pages en défilement' : 'Show all pages in a scroll';

  /* ---------- analytics (GoatCounter, skipped if not configured or Do Not Track is on) ---------- */
  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const analyticsOn = GC_CODE !== 'YOUR-GOATCOUNTER-CODE' && !dnt;
  const queue = [];
  let gcReady = false;
  const seen = new Set();
  function track(path, title, isEvent) {
    if (!analyticsOn) return;
    const hit = { path, title: title || path, event: !!isEvent };
    if (gcReady) window.goatcounter.count(hit); else queue.push(hit);
  }
  if (analyticsOn) {
    const s = document.createElement('script');
    s.async = true;
    s.dataset.goatcounter = 'https://' + GC_CODE + '.goatcounter.com/count';
    s.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
    s.src = 'https://gc.zgo.at/count.js';
    s.onload = () => { gcReady = true; queue.splice(0).forEach(h => window.goatcounter.count(h)); };
    document.head.appendChild(s);
  }
  track(base, 'Portfolio view (' + office + ', ' + lang + ')', false);
  $('dl').addEventListener('click', () => track(base + '/download', copy.download, true));
  // count a page only while the tab is actually visible (background tabs do not count as reading)
  const countPage = n => { if (document.visibilityState === 'visible' && !seen.has(n)) { seen.add(n); track(base + '/p' + n, 'Page ' + n, true); } };

  /* ---------- elements ---------- */
  const bookEl = $('book'), ctrlEl = $('ctrl'), pagesEl = $('pages');
  const viewport = $('viewport'), canvas = $('canvas'), statusEl = $('status');
  const slider = $('slider'), countEl = $('count');
  const prevBtn = $('prev'), nextBtn = $('next');
  const fail = msg => { statusEl.innerHTML = msg + ' <a href="' + PDF_URL + '" style="pointer-events:auto">' + copy.direct + '</a>.'; statusEl.style.pointerEvents = 'auto'; };
  if (!window.pdfjsLib) { fail(copy.viewerError); return; }
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  let pdf = null, total = 0, cur = 1, zoom = 1, mode = 'book';
  let renderTask = null, renderToken = 0, dwellTimer = null, zoomFocus = null;
  const pageCache = new Map();
  const getPage = n => { if (!pageCache.has(n)) pageCache.set(n, pdf.getPage(n)); return pageCache.get(n); };

  /* ---------- book view ---------- */
  async function renderBook() {
    const token = ++renderToken;
    const page = await getPage(cur);
    if (token !== renderToken) return;
    const vp1 = page.getViewport({ scale: 1 });
    const cs = getComputedStyle(viewport);
    const availW = viewport.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = viewport.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const fit = Math.max(0.05, Math.min(availW / vp1.width, availH / vp1.height));
    const cssScale = fit * zoom;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const renderScale = Math.min(cssScale * dpr, MAX_PX / Math.max(vp1.width, vp1.height));
    const vp = page.getViewport({ scale: renderScale });
    // draw into an offscreen canvas first so the old page stays visible until the new one is ready
    const off = document.createElement('canvas');
    off.width = Math.floor(vp.width); off.height = Math.floor(vp.height);
    if (renderTask) { try { renderTask.cancel(); } catch (e) {} }
    renderTask = page.render({ canvasContext: off.getContext('2d'), viewport: vp });
    try { await renderTask.promise; } catch (e) { return; }          // cancelled by a newer render
    if (token !== renderToken) return;
    canvas.width = off.width; canvas.height = off.height;
    canvas.getContext('2d').drawImage(off, 0, 0);
    canvas.style.width = Math.round(vp1.width * cssScale) + 'px';
    canvas.style.height = Math.round(vp1.height * cssScale) + 'px';
    statusEl.style.display = 'none';
    if (zoom > 1) {                                                   // zoom towards the clicked point (centre if none)
      const f = zoomFocus || { x: 0.5, y: 0.5 };
      viewport.scrollLeft = f.x * viewport.scrollWidth - viewport.clientWidth / 2;
      viewport.scrollTop = f.y * viewport.scrollHeight - viewport.clientHeight / 2;
    }
  }

  function updateUi() {
    countEl.textContent = cur + ' / ' + total;
    slider.value = cur;
    prevBtn.disabled = cur <= 1; nextBtn.disabled = cur >= total;
    viewport.classList.toggle('zoomed', zoom > 1);
    $('zoom').textContent = zoom > 1 ? copy.fit : copy.zoom;
  }

  function go(n, opts) {
    n = Math.max(1, Math.min(total, n));
    if (n === cur && !(opts && opts.force)) return;
    cur = n; zoom = 1; viewport.scrollLeft = 0; viewport.scrollTop = 0;
    updateUi();
    renderBook();
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + cur);
    refreshLanguageLinks();
    clearTimeout(dwellTimer);
    const shown = cur;
    dwellTimer = setTimeout(() => countPage(shown), DWELL_MS);
    if (cur < total) getPage(cur + 1);                                // warm up the next page
    if (cur > 1) getPage(cur - 1);
  }

  function toggleZoom(ev) {
    zoomFocus = null;
    if (zoom === 1 && ev && ev.clientX !== undefined && ev.target === canvas) {
      const r = canvas.getBoundingClientRect();
      zoomFocus = { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height };
    }
    zoom = zoom > 1 ? 1 : 2.2;
    viewport.scrollLeft = 0; viewport.scrollTop = 0;
    updateUi(); renderBook();
  }

  prevBtn.addEventListener('click', () => go(cur - 1));
  nextBtn.addEventListener('click', () => go(cur + 1));
  $('zoom').addEventListener('click', () => toggleZoom());
  canvas.addEventListener('click', toggleZoom);
  slider.addEventListener('input', () => go(Number(slider.value)));
  document.addEventListener('keydown', e => {
    if (mode !== 'book' || e.target === slider || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || (k === ' ' && !e.shiftKey)) { e.preventDefault(); go(cur + 1); }
    else if (k === 'ArrowLeft' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { e.preventDefault(); go(cur - 1); }
    else if (k === 'Home') { e.preventDefault(); go(1); }
    else if (k === 'End') { e.preventDefault(); go(total); }
    else if (k === 'z' || k === 'Z') toggleZoom();
    else if (k === 'f' || k === 'F') toggleFs();
    else if (k === 'Escape' && zoom > 1) toggleZoom();
  });
  // swipe to turn pages (only when not zoomed)
  let tx = null, ty = null;
  viewport.addEventListener('touchstart', e => { if (e.touches.length === 1 && zoom === 1) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; } else tx = null; }, { passive: true });
  viewport.addEventListener('touchend', e => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? cur + 1 : cur - 1);
    tx = null;
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && mode === 'book' && pdf) { clearTimeout(dwellTimer); const shown = cur; dwellTimer = setTimeout(() => countPage(shown), DWELL_MS); renderBook(); }
  });

  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (mode === 'book' && pdf) renderBook(); else if (mode === 'scroll') resetScroll(); }, 200); });

  /* ---------- full screen ---------- */
  function toggleFs() {
    const el = document.documentElement;
    if (!document.fullscreenElement) { (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el); }
    else { (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document); }
  }
  $('fs').addEventListener('click', toggleFs);
  if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) $('fs').style.display = 'none';
  document.addEventListener('fullscreenchange', () => setTimeout(() => { if (mode === 'book' && pdf) renderBook(); }, 150));

  /* ---------- scroll view ---------- */
  const sections = [];
  let renderObserver = null, viewObserver = null, scrollBuilt = false;
  const timers = new Map();

  async function renderSection(sec) {
    if (sec.rendering) return;
    sec.rendering = true;
    try {
      const vp1 = sec.pdfPage.getViewport({ scale: 1 });
      const cssW = sec.el.clientWidth || vp1.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = sec.pdfPage.getViewport({ scale: (cssW / vp1.width) * dpr });
      sec.canvas.width = Math.floor(vp.width); sec.canvas.height = Math.floor(vp.height);
      await sec.pdfPage.render({ canvasContext: sec.canvas.getContext('2d'), viewport: vp }).promise;
      sec.rendered = true;
    } catch (e) { /* retried on resize */ }
    sec.rendering = false;
  }
  function resetScroll() { sections.forEach(s => { s.rendered = false; renderObserver.unobserve(s.el); renderObserver.observe(s.el); }); }

  async function buildScroll() {
    if (scrollBuilt) return;
    scrollBuilt = true;
    renderObserver = new IntersectionObserver(entries => entries.forEach(en => {
      const sec = sections[en.target.dataset.i];
      if (en.isIntersecting && !sec.rendered) renderSection(sec);
    }), { rootMargin: '700px 0px' });
    viewObserver = new IntersectionObserver(entries => entries.forEach(en => {
      const n = Number(en.target.dataset.n);
      if (en.isIntersecting && mode === 'scroll') {
        cur = n;
        if (history.replaceState) history.replaceState(null, '', location.pathname + location.search + '#' + cur);
        refreshLanguageLinks();
      }
      if (en.isIntersecting && !seen.has(n)) timers.set(n, setTimeout(() => countPage(n), DWELL_MS));
      else if (!en.isIntersecting && timers.has(n)) { clearTimeout(timers.get(n)); timers.delete(n); }
    }), { threshold: 0.5 });
    for (let n = 1; n <= total; n++) {
      const page = await getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const el = document.createElement('section');
      el.className = 'page' + (vp.width < vp.height ? ' cover' : '');
      el.style.aspectRatio = vp.width + ' / ' + vp.height;
      el.dataset.i = sections.length; el.dataset.n = n;
      const c = document.createElement('canvas');
      el.appendChild(c); pagesEl.appendChild(el);
      sections.push({ el, canvas: c, num: n, pdfPage: page, rendered: false, rendering: false });
      renderObserver.observe(el); viewObserver.observe(el);
    }
  }

  function setMode(m) {
    mode = m;
    const book = m === 'book';
    document.body.classList.toggle('book-mode', book);
    bookEl.hidden = !book; ctrlEl.hidden = !book; pagesEl.hidden = book;
    $('bookMode').setAttribute('aria-pressed', String(book));
    $('scrollMode').setAttribute('aria-pressed', String(!book));
    $('fs').style.visibility = book ? '' : 'hidden';
    const url = new URL(location.href);
    if (book) url.searchParams.delete('view'); else url.searchParams.set('view', 'scroll');
    if (history.replaceState) history.replaceState(null, '', url.pathname + url.search + url.hash);
    refreshLanguageLinks();
    if (book) { clearTimeout(dwellTimer); renderBook(); go(cur, { force: true }); }
    else {
      clearTimeout(dwellTimer);
      const targetPage = cur;
      buildScroll().then(() => {
        if (targetPage > 1 && sections[targetPage - 1]) sections[targetPage - 1].el.scrollIntoView();
      });
    }
  }
  $('bookMode').addEventListener('click', () => { if (mode !== 'book') setMode('book'); });
  $('scrollMode').addEventListener('click', () => { if (mode !== 'scroll') setMode('scroll'); });

  /* ---------- load ---------- */
  const task = pdfjsLib.getDocument(PDF_URL);
  task.onProgress = p => { if (p.total) statusEl.textContent = copy.loading + ' ' + Math.round(p.loaded / p.total * 100) + '%'; };
  task.promise.then(doc => {
    pdf = doc; total = doc.numPages;
    slider.max = total;
    const fromHash = parseInt((location.hash || '').replace('#', ''), 10);
    cur = Number.isFinite(fromHash) ? Math.max(1, Math.min(total, fromHash)) : 1;
    if (q.get('view') === 'scroll') { setMode('scroll'); return; }
    updateUi(); renderBook();
    clearTimeout(dwellTimer); dwellTimer = setTimeout(() => countPage(cur), DWELL_MS);
    if (cur < total) getPage(cur + 1);
    window.addEventListener('hashchange', () => { const n = parseInt(location.hash.replace('#', ''), 10); if (Number.isFinite(n) && mode === 'book') go(n); });
  }).catch(() => fail(copy.pdfError));
})();

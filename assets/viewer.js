/* Portfolio viewer: renders portfolio.pdf with PDF.js and counts visits per office link with GoatCounter.
   Link format: https://<user>.github.io/<repo>/?o=<code>   (the code is mapped to an office in a private file, not here)
   Events sent to GoatCounter (all anonymous):
     /o/<code>            one page view when the page opens
     /o/<code>/p<N>       page N stayed in view for at least 1.5 s
     /o/<code>/download   the Download PDF button was used
*/
(() => {
  'use strict';
  const GC_CODE = 'jaearchi';                       // -> https://jaearchi.goatcounter.com
  const PDF_URL = 'assets/portfolio.pdf';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const DWELL_MS = 1500;

  const q = new URLSearchParams(location.search);
  let office = (q.get('o') || 'direct').toLowerCase();
  if (!/^[a-z0-9_-]{1,24}$/.test(office)) office = 'direct';
  const base = '/o/' + office;

  /* ---------- analytics (GoatCounter, skipped if not configured or Do Not Track is on) ---------- */
  const dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  const analyticsOn = GC_CODE !== 'YOUR-GOATCOUNTER-CODE' && !dnt;
  const queue = [];
  let gcReady = false;
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
  track(base, 'Portfolio view (' + office + ')', false);
  document.getElementById('dl').addEventListener('click', () => track(base + '/download', 'Download PDF', true));

  /* ---------- PDF rendering ---------- */
  const pagesEl = document.getElementById('pages');
  const statusEl = document.getElementById('status');
  const fail = msg => { statusEl.innerHTML = msg + ' <a href="' + PDF_URL + '">Open the PDF directly</a>.'; };
  if (!window.pdfjsLib) { fail('The viewer could not load.'); return; }
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const sections = [];           // {el, canvas, num, pdfPage, rendered}
  const seen = new Set();
  const timers = new Map();

  async function renderSection(sec) {
    if (sec.rendering) return;
    sec.rendering = true;
    try {
      const vp1 = sec.pdfPage.getViewport({ scale: 1 });
      const cssW = sec.el.clientWidth || vp1.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (cssW / vp1.width) * dpr;
      const vp = sec.pdfPage.getViewport({ scale });
      sec.canvas.width = Math.floor(vp.width);
      sec.canvas.height = Math.floor(vp.height);
      await sec.pdfPage.render({ canvasContext: sec.canvas.getContext('2d'), viewport: vp }).promise;
      sec.rendered = true;
    } catch (e) { /* ignore a failed render, it retries on resize */ }
    sec.rendering = false;
  }

  const renderObserver = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const sec = sections[en.target.dataset.i];
      if (en.isIntersecting && !sec.rendered) renderSection(sec);
    });
  }, { rootMargin: '700px 0px' });

  const viewObserver = new IntersectionObserver(entries => {
    entries.forEach(en => {
      const n = Number(en.target.dataset.n);
      if (en.isIntersecting && !seen.has(n)) {
        timers.set(n, setTimeout(() => { seen.add(n); track(base + '/p' + n, 'Page ' + n, true); }, DWELL_MS));
      } else if (!en.isIntersecting && timers.has(n)) {
        clearTimeout(timers.get(n)); timers.delete(n);
      }
    });
  }, { threshold: 0.5 });

  pdfjsLib.getDocument(PDF_URL).promise.then(async pdf => {
    statusEl.remove();
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const el = document.createElement('section');
      el.className = 'page' + (vp.width < vp.height ? ' cover' : '');
      el.style.aspectRatio = vp.width + ' / ' + vp.height;
      el.dataset.i = sections.length; el.dataset.n = n;
      const canvas = document.createElement('canvas');
      el.appendChild(canvas); pagesEl.appendChild(el);
      sections.push({ el, canvas, num: n, pdfPage: page, rendered: false, rendering: false });
      renderObserver.observe(el); viewObserver.observe(el);
    }
  }).catch(() => fail('The portfolio could not be displayed.'));

  let rz;
  window.addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => sections.forEach(s => { s.rendered = false; renderObserver.unobserve(s.el); renderObserver.observe(s.el); }), 250);
  });
})();

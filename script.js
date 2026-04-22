// ── STATE ─────────────────────────────────────────────────────────────────
const state = {
  files:    [],   // [{name, size, text}]
  results:  [],   // [{email, domain, formatOk, mxOk, status, reason}]
  filtered: [],
  filter:   'all',
  search:   '',
  page:     1,
};
const PER_PAGE = 50;
const mxCache  = new Map();
let   activeTab = 'upload';

// ── TAB SWITCH ────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  document.getElementById('uploadPanel').style.display = tab === 'upload' ? '' : 'none';
  document.getElementById('pastePanel').style.display  = tab === 'paste'  ? '' : 'none';
  document.querySelectorAll('#inputTabs .tab').forEach((t, i) =>
    t.classList.toggle('active', i === (tab === 'upload' ? 0 : 1)));
}

// ── DRAG & DROP ───────────────────────────────────────────────────────────
function onDragOver(e)  { e.preventDefault(); document.getElementById('dropZone').classList.add('dragover'); }
function onDragLeave()  { document.getElementById('dropZone').classList.remove('dragover'); }
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('dragover');
  [...e.dataTransfer.files].forEach(loadFile);
}
function handleFileSelect(inp) { [...inp.files].forEach(loadFile); inp.value = ''; }

async function loadFile(file) {
  if (state.files.find(f => f.name === file.name && f.size === file.size)) return;
  const ext = file.name.split('.').pop().toLowerCase();
  let text = '';
  try {
    if (ext === 'xlsx' || ext === 'xls') {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { type: 'array' });
      wb.SheetNames.forEach(n => { text += XLSX.utils.sheet_to_csv(wb.Sheets[n]) + '\n'; });
    } else {
      text = await file.text();
    }
    state.files.push({ name: file.name, size: file.size, text });
    renderFileChips();
    hideAlert();
  } catch (err) {
    showAlert('Could not read file: ' + file.name);
  }
}

function removeFile(idx) {
  state.files.splice(idx, 1);
  renderFileChips();
}

function renderFileChips() {
  const wrap = document.getElementById('fileChips');
  wrap.innerHTML = state.files.map((f, i) => `
    <div class="file-chip">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      ${escHtml(f.name)}
      <span class="chip-size">(${(f.size / 1024).toFixed(1)} KB)</span>
      <button class="chip-remove" onclick="removeFile(${i})" title="Remove">✕</button>
    </div>
  `).join('');
}

// ── PASTE ─────────────────────────────────────────────────────────────────
document.getElementById('pasteArea').addEventListener('input', function () {
  document.getElementById('pasteCount').textContent =
    this.value.length.toLocaleString() + ' characters';
});
function clearPaste() {
  document.getElementById('pasteArea').value = '';
  document.getElementById('pasteCount').textContent = '0 characters';
}

// ── EMAIL EXTRACTION ──────────────────────────────────────────────────────
function extractEmails(text) {
  const raw = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(raw.map(e => e.toLowerCase()))];
}

// ── FORMAT VALIDATION (with specific reasons) ─────────────────────────────
function validateFormat(email) {
  if (email.length > 254)      return { ok: false, reason: 'Email too long' };
  const at = email.lastIndexOf('@');
  if (at < 1)                  return { ok: false, reason: 'Missing @ symbol' };
  const local  = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64)       return { ok: false, reason: 'Local part too long' };
  if (local.startsWith('.'))   return { ok: false, reason: 'Starts with a dot' };
  if (local.endsWith('.'))     return { ok: false, reason: 'Ends with a dot' };
  if (local.includes('..'))    return { ok: false, reason: 'Double dot in address' };
  if (!domain.includes('.'))   return { ok: false, reason: 'Invalid domain' };
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  if (!re.test(email))         return { ok: false, reason: 'Invalid format' };
  return { ok: true, reason: '' };
}

// ── DNS / MX CHECK ────────────────────────────────────────────────────────
async function checkMX(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res   = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const data = await res.json();
    const ok   = data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
    mxCache.set(domain, ok);
    return ok;
  } catch {
    mxCache.set(domain, null);
    return null;
  }
}

async function batchCheck(domains, onProg) {
  const BATCH = 8;
  const arr   = [...domains];
  const map   = new Map();
  for (let i = 0; i < arr.length; i += BATCH) {
    const slice = arr.slice(i, i + BATCH);
    // Show first domain in batch as "currently checking"
    onProg(i, arr.length, slice[0]);
    await raf();
    const res = await Promise.all(slice.map(checkMX));
    slice.forEach((d, j) => map.set(d, res[j]));
    onProg(Math.min(i + BATCH, arr.length), arr.length, slice[slice.length - 1]);
    await raf();
  }
  return map;
}

// ── MAIN VALIDATION FLOW ──────────────────────────────────────────────────
async function startValidation() {
  let raw = '';
  if (activeTab === 'upload') {
    if (!state.files.length) { showAlert('No files loaded. Upload at least one file first.'); return; }
    raw = state.files.map(f => f.text).join('\n');
  } else {
    raw = document.getElementById('pasteArea').value;
  }
  if (!raw.trim()) { showAlert('Input is empty.'); return; }

  hideAlert();
  setBtn(true);
  showProgress();
  setStep(1);
  setPct(5, 'Scanning text for email addresses…');
  await raf();

  // ── Step 1: Extract
  const emails = extractEmails(raw);
  if (!emails.length) {
    hideProgress(); setBtn(false);
    showAlert('No email addresses found in the input.');
    return;
  }
  setMini(emails.length, 0, 0);
  setPct(18, `Found ${emails.length.toLocaleString()} email${emails.length > 1 ? 's' : ''}. Checking format…`);
  setStep(2);
  await raf();

  // ── Step 2: Format validation
  const fmt = [];
  for (let i = 0; i < emails.length; i++) {
    const e   = emails[i];
    const res = validateFormat(e);
    fmt.push({ email: e, domain: e.split('@')[1], formatOk: res.ok, fmtReason: res.reason });
    if (i % 50 === 0 || i === emails.length - 1) {
      const pct = 18 + Math.round((i / emails.length) * 12);
      setPct(pct, `Format check: ${(i + 1).toLocaleString()} / ${emails.length.toLocaleString()}`);
      await raf();
    }
  }

  const formatInvalid = fmt.filter(r => !r.formatOk).length;
  setMini(emails.length, 0, formatInvalid);
  await raf();

  // ── Step 3: DNS / MX check
  const domains = new Set(fmt.filter(r => r.formatOk).map(r => r.domain));
  setStep(3);
  setLive('Starting DNS lookup…');
  setPct(30, `Checking MX records for ${domains.size} domain${domains.size !== 1 ? 's' : ''}…`);
  await raf();

  const mxMap = await batchCheck(domains, (done, total, domain) => {
    const pct = 30 + Math.round((done / total) * 62);
    setPct(pct, `DNS / MX check: ${done} / ${total} domains`);
    setLive(`Checking: ${domain}`);

    // Running valid/invalid count using cache so far
    let v = 0, inv = formatInvalid;
    for (const [d, ok] of mxCache) {
      const count = fmt.filter(r => r.domain === d).length;
      if (ok === true)  v   += count;
      if (ok === false) inv += count;
    }
    setMini(emails.length, v, inv);
  });

  setLive(null);
  setPct(96, 'Building results…');
  setStep(4);
  await raf();

  // ── Build results with reasons
  state.results = fmt.map(r => {
    const mxOk = r.formatOk ? (mxMap.get(r.domain) ?? null) : null;
    let status, reason;

    if (!r.formatOk) {
      status = 'invalid';
      reason = r.fmtReason;
    } else if (mxOk === true) {
      status = 'valid';
      reason = 'Mail server verified';
    } else if (mxOk === false) {
      status = 'invalid';
      reason = 'No mail server found';
    } else {
      status = 'pending';
      reason = 'DNS check timed out';
    }
    return { email: r.email, domain: r.domain, formatOk: r.formatOk, mxOk, status, reason };
  });

  setPct(100, 'Done!');
  await raf();

  setTimeout(() => {
    hideProgress();
    setBtn(false);

    const vc = state.results.filter(r => r.status === 'valid').length;
    document.getElementById('dlCsv').disabled = vc === 0;
    document.getElementById('dlTxt').disabled = vc === 0;

    state.filter = 'all';
    state.search = '';
    state.page   = 1;
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('#filterTabs .tab').forEach((t, i) => t.classList.toggle('active', i === 0));

    document.getElementById('resultsCard').style.display = '';
    applyFilter();
    updateStats();
    document.getElementById('resultsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 600);
}

// ── FILTER / SEARCH ───────────────────────────────────────────────────────
function setFilter(f) {
  state.filter = f;
  state.page   = 1;
  const keys   = ['all', 'valid', 'invalid', 'pending'];
  document.querySelectorAll('#filterTabs .tab').forEach((t, i) =>
    t.classList.toggle('active', keys[i] === f));
  applyFilter();
}
function onSearch() {
  state.search = document.getElementById('searchInput').value.toLowerCase();
  state.page   = 1;
  applyFilter();
}
function applyFilter() {
  state.filtered = state.results.filter(r => {
    if (state.filter !== 'all' && r.status !== state.filter) return false;
    if (state.search && !r.email.includes(state.search) && !r.domain.includes(state.search)) return false;
    return true;
  });
  renderTable();
}

// ── TABLE RENDER ──────────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('tableBody');
  const start = (state.page - 1) * PER_PAGE;
  const slice = state.filtered.slice(start, start + PER_PAGE);
  const empty = state.filtered.length === 0;

  document.getElementById('mainTable').style.display  = empty ? 'none' : '';
  document.getElementById('emptyState').style.display = empty ? '' : 'none';
  document.getElementById('resultCount').textContent  =
    state.filtered.length.toLocaleString() + ' email' + (state.filtered.length !== 1 ? 's' : '');

  tbody.innerHTML = slice.map((r, i) => {
    const n    = start + i + 1;
    const fmt  = r.formatOk ? '<span class="chk">✓</span>' : '<span class="crs">✗</span>';
    const mx   = r.mxOk === true  ? '<span class="chk">✓</span>'
               : r.mxOk === false ? '<span class="crs">✗</span>'
               : r.formatOk       ? '<span class="dsh" title="DNS timeout">?</span>'
               :                    '<span class="dsh">—</span>';
    const badge = r.status === 'valid'
      ? `<span class="badge badge-valid"><span class="badge-dot"></span>Valid</span>`
      : r.status === 'invalid'
      ? `<span class="badge badge-invalid"><span class="badge-dot"></span>Invalid</span>`
      : `<span class="badge badge-pending"><span class="badge-dot"></span>Unverified</span>`;
    const reasonClass = `reason-${r.status}`;

    return `<tr>
      <td style="color:#CBD5E1;font-size:12px">${n}</td>
      <td><div class="email-cell">${escHtml(r.email)}
        <button class="copy-btn" title="Copy email" onclick="copyText('${escAttr(r.email)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
      </div></td>
      <td class="domain-cell">${escHtml(r.domain)}</td>
      <td>${fmt}</td>
      <td>${mx}</td>
      <td>${badge}</td>
      <td class="reason-cell ${reasonClass}">${escHtml(r.reason)}</td>
      <td></td>
    </tr>`;
  }).join('');

  renderPagination();
}

function renderPagination() {
  const total = state.filtered.length;
  const pages = Math.ceil(total / PER_PAGE);
  const s     = (state.page - 1) * PER_PAGE + 1;
  const e     = Math.min(state.page * PER_PAGE, total);
  document.getElementById('pageInfo').textContent = total > 0 ? `${s}–${e} of ${total.toLocaleString()}` : '';
  const btns = document.getElementById('pageBtns');
  if (pages <= 1) { btns.innerHTML = ''; return; }
  const lo = Math.max(1, state.page - 2);
  const hi = Math.min(pages, state.page + 2);
  let html = `<button class="page-btn" ${state.page === 1 ? 'disabled' : ''} onclick="goPage(${state.page - 1})">‹</button>`;
  for (let p = lo; p <= hi; p++)
    html += `<button class="page-btn${p === state.page ? ' active' : ''}" onclick="goPage(${p})">${p}</button>`;
  html += `<button class="page-btn" ${state.page === pages ? 'disabled' : ''} onclick="goPage(${state.page + 1})">›</button>`;
  btns.innerHTML = html;
}
function goPage(p) { state.page = p; renderTable(); }

// ── STATS + DONUT ─────────────────────────────────────────────────────────
function updateStats() {
  const total   = state.results.length;
  const valid   = state.results.filter(r => r.status === 'valid').length;
  const invalid = state.results.filter(r => r.status === 'invalid').length;
  const pending = state.results.filter(r => r.status === 'pending').length;

  document.getElementById('sTotal').textContent    = total.toLocaleString();
  document.getElementById('sValid').textContent    = valid.toLocaleString();
  document.getElementById('sInvalid').textContent  = invalid.toLocaleString();
  document.getElementById('sPending').textContent  = pending.toLocaleString();
  document.getElementById('lgValid').textContent   = valid.toLocaleString();
  document.getElementById('lgInvalid').textContent = invalid.toLocaleString();
  document.getElementById('lgPending').textContent = pending.toLocaleString();

  const pct = total > 0 ? Math.round(valid / total * 100) : 0;
  document.getElementById('donutPct').textContent = total > 0 ? pct + '%' : '—';
  document.getElementById('donutSection').style.display = total > 0 ? 'flex' : 'none';

  if (total > 0) {
    const C    = 2 * Math.PI * 56;
    const vLen = (valid   / total) * C;
    const iLen = (invalid / total) * C;
    const pLen = (pending / total) * C;
    const av = document.getElementById('arcValid');
    const ai = document.getElementById('arcInvalid');
    const ap = document.getElementById('arcPending');
    av.setAttribute('stroke-dasharray',  `${vLen} ${C - vLen}`);
    av.setAttribute('stroke-dashoffset', '0');
    ai.setAttribute('stroke-dasharray',  `${iLen} ${C - iLen}`);
    ai.setAttribute('stroke-dashoffset', `${C - vLen}`);
    ap.setAttribute('stroke-dasharray',  `${pLen} ${C - pLen}`);
    ap.setAttribute('stroke-dashoffset', `${Math.max(0, C - vLen - iLen)}`);
  }
}

// ── DOWNLOAD ──────────────────────────────────────────────────────────────
function downloadCSV() {
  const valid = state.results.filter(r => r.status === 'valid');
  dl('valid_emails.csv', 'Email,Domain\n' + valid.map(r => `${r.email},${r.domain}`).join('\n'), 'text/csv');
}
function downloadTXT() {
  const valid = state.results.filter(r => r.status === 'valid');
  dl('valid_emails.txt', valid.map(r => r.email).join('\n'), 'text/plain');
}
function dl(name, content, mime) {
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([content], { type: mime })), download: name,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

// ── PROGRESS HELPERS ──────────────────────────────────────────────────────
function showProgress() {
  document.getElementById('progressWrap').style.display = '';
  document.getElementById('miniCounts').style.display   = 'none';
  document.getElementById('liveCheck').style.display    = 'none';
  setPct(0, '');
  setStep(0);
}
function hideProgress() {
  document.getElementById('progressWrap').style.display = 'none';
}
function setStep(n) {
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('ps' + i);
    if (!el) continue;
    el.className = 'pstep' + (i < n ? ' done' : i === n ? ' active' : '');
  }
  for (let i = 1; i <= 3; i++) {
    const ln = document.getElementById('pl' + i);
    if (ln) ln.className = 'pstep-line' + (i < n ? ' done' : '');
  }
}
function setPct(pct, text) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';
  if (text) document.getElementById('progressText').textContent = text;
}
function setLive(text) {
  const el = document.getElementById('liveCheck');
  if (text) { el.style.display = 'flex'; document.getElementById('liveText').textContent = text; }
  else      { el.style.display = 'none'; }
}
function setMini(found, valid, invalid) {
  document.getElementById('miniCounts').style.display = 'flex';
  document.getElementById('mcFound').innerHTML   = `<span class="mc-dot gray-dot"></span><span>${found.toLocaleString()} found</span>`;
  document.getElementById('mcValid').innerHTML   = `<span class="mc-dot green-dot"></span><span>${valid.toLocaleString()} valid</span>`;
  document.getElementById('mcInvalid').innerHTML = `<span class="mc-dot red-dot"></span><span>${invalid.toLocaleString()} invalid</span>`;
}

// ── UTILS ─────────────────────────────────────────────────────────────────
async function copyText(t) { try { await navigator.clipboard.writeText(t); } catch {} }
function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s) { return s.replace(/'/g,'&#39;').replace(/"/g,'&quot;'); }
function raf()      { return new Promise(resolve => requestAnimationFrame(resolve)); }
function setBtn(d)  { document.getElementById('validateBtn').disabled = d; }
function showAlert(msg) {
  document.getElementById('alertText').textContent = msg;
  document.getElementById('alertEl').style.display = 'flex';
}
function hideAlert() { document.getElementById('alertEl').style.display = 'none'; }

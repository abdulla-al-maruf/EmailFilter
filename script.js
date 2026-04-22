/* ══════════════════════════════════════════════════════════════════════════
   EmailFilter — Dashboard Script
   ══════════════════════════════════════════════════════════════════════════ */

/* ── STATE ─────────────────────────────────────────────────────────────── */
const state = {
  files:   [],     // [{name, size, text}]
  emails:  [],     // [{email, domain, formatOk, formatReason, mxOk, mxReason, status}]
  filter:  'all',
  search:  '',
  page:    1,
  running: false,
  tab:     'upload',
};

const PER_PAGE = 50;
const BATCH    = 8;
const MX_TO    = 5000;
const C        = 326.73;   // 2π × r=52

const mxCache  = new Map(); // domain → {ok, reason}

/* ── SIDEBAR / NAV ─────────────────────────────────────────────────────── */
function toggleSidebar() {
  const app      = document.querySelector('.app');
  const isMobile = window.innerWidth <= 960;
  if (isMobile) {
    app.classList.toggle('sb-open');
  } else {
    app.classList.toggle('sb-collapsed');
  }
}

function navClick(section) {
  document.querySelectorAll('.sb-item[id^="nav-"]').forEach(function(el) {
    el.classList.remove('active');
  });
  var btn = document.getElementById('nav-' + section);
  if (btn) btn.classList.add('active');

  var target = document.getElementById('section-' + section);
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (window.innerWidth <= 960) {
    document.querySelector('.app').classList.remove('sb-open');
  }
}

/* close mobile sidebar overlay when clicking outside */
document.addEventListener('click', function(e) {
  if (window.innerWidth > 960) return;
  var app = document.querySelector('.app');
  if (!app.classList.contains('sb-open')) return;
  var sidebar = document.getElementById('sidebar');
  if (!sidebar.contains(e.target) && !e.target.closest('.sb-toggle')) {
    app.classList.remove('sb-open');
  }
});

/* ── INPUT TABS ────────────────────────────────────────────────────────── */
function switchTab(tab) {
  state.tab = tab;
  var tabs = document.querySelectorAll('#inputTabs .tab');
  tabs[0].classList.toggle('active', tab === 'upload');
  tabs[1].classList.toggle('active', tab === 'paste');
  document.getElementById('uploadPanel').style.display = tab === 'upload' ? '' : 'none';
  document.getElementById('pastePanel').style.display  = tab === 'paste'  ? '' : 'none';
}

function clearPaste() {
  document.getElementById('pasteArea').value = '';
  document.getElementById('pasteCount').textContent = '0 characters';
}

document.getElementById('pasteArea').addEventListener('input', function() {
  var n = this.value.length;
  document.getElementById('pasteCount').textContent =
    n.toLocaleString() + ' character' + (n === 1 ? '' : 's');
});

/* ── FILE LOADING ──────────────────────────────────────────────────────── */
function onDragOver(e)  { e.preventDefault(); document.getElementById('dropZone').classList.add('dragover'); }
function onDragLeave()  { document.getElementById('dropZone').classList.remove('dragover'); }
function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('dragover');
  Array.prototype.forEach.call(e.dataTransfer.files, loadFile);
}

function handleFileSelect(input) {
  Array.prototype.forEach.call(input.files, loadFile);
  input.value = '';
}

function loadFile(file) {
  var ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var wb   = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        var text = '';
        wb.SheetNames.forEach(function(name) {
          text += XLSX.utils.sheet_to_csv(wb.Sheets[name]) + '\n';
        });
        addFile(file.name, file.size, text);
      } catch(err) {
        showToast('\u274c Failed to read ' + file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    var reader2 = new FileReader();
    reader2.onload = function(e) { addFile(file.name, file.size, e.target.result); };
    reader2.readAsText(file);
  }
}

function addFile(name, size, text) {
  if (state.files.some(function(f) { return f.name === name; })) {
    showToast('\u26a0\ufe0f ' + name + ' already added');
    return;
  }
  state.files.push({ name: name, size: size, text: text });
  renderChips();
}

function removeFile(idx) {
  state.files.splice(idx, 1);
  renderChips();
}

function renderChips() {
  var wrap = document.getElementById('fileChips');
  wrap.innerHTML = '';
  state.files.forEach(function(f, i) {
    var kb   = (f.size / 1024).toFixed(1);
    var chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
        '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>' +
        '<polyline points="14 2 14 8 20 8"/></svg>' +
      '<span>' + escHtml(f.name) + '</span>' +
      '<span class="chip-size">' + kb + '\u00a0KB</span>' +
      '<button class="chip-remove" onclick="removeFile(' + i + ')" title="Remove">\u2715</button>';
    wrap.appendChild(chip);
  });
}

/* ── ALERT ─────────────────────────────────────────────────────────────── */
function showAlert(msg) {
  document.getElementById('alertText').textContent = msg;
  document.getElementById('alertEl').style.display = 'flex';
}
function hideAlert() {
  document.getElementById('alertEl').style.display = 'none';
}

/* ── PROGRESS HELPERS ──────────────────────────────────────────────────── */
function raf() {
  return new Promise(function(resolve) {
    requestAnimationFrame(function() { requestAnimationFrame(resolve); });
  });
}

function setStep(n) {
  for (var i = 1; i <= 4; i++) {
    var ps = document.getElementById('ps' + i);
    if (!ps) continue;
    ps.classList.remove('active', 'done');
    if (i < n)       ps.classList.add('done');
    else if (i === n) ps.classList.add('active');
  }
  for (var j = 1; j <= 3; j++) {
    var pl = document.getElementById('pl' + j);
    if (pl) pl.classList.toggle('done', j < n);
  }
}

function setPct(pct, text) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent  = pct + '%';
  if (text !== undefined) document.getElementById('progressText').textContent = text;
}

function setLive(domain) {
  var lc = document.getElementById('liveCheck');
  if (domain) {
    lc.style.display = 'flex';
    document.getElementById('liveText').textContent = 'Checking ' + domain + '\u2026';
  } else {
    lc.style.display = 'none';
  }
}

function setMini(found, valid, invalid) {
  document.getElementById('miniCounts').style.display = 'flex';
  document.getElementById('mcFound').querySelector('span:last-child').textContent   = found   + ' found';
  document.getElementById('mcValid').querySelector('span:last-child').textContent   = valid   + ' valid';
  document.getElementById('mcInvalid').querySelector('span:last-child').textContent = invalid + ' invalid';
}

/* ── EMAIL EXTRACTION ──────────────────────────────────────────────────── */
function extractEmails(text) {
  var re   = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  var raw  = text.match(re) || [];
  var seen = {};
  var out  = [];
  raw.forEach(function(e) {
    var lc = e.toLowerCase();
    if (!seen[lc]) { seen[lc] = true; out.push(lc); }
  });
  return out;
}

/* ── FORMAT VALIDATION ─────────────────────────────────────────────────── */
function validateFormat(email) {
  if (!email.includes('@'))                          return { ok: false, reason: 'Missing @ symbol' };
  var parts = email.split('@');
  if (parts.length !== 2)                            return { ok: false, reason: 'Multiple @ symbols' };
  var local  = parts[0];
  var domain = parts[1];
  if (!local)                                        return { ok: false, reason: 'Empty local part' };
  if (local.length > 64)                             return { ok: false, reason: 'Local part too long' };
  if (email.length > 254)                            return { ok: false, reason: 'Email too long' };
  if (local.charAt(0) === '.' || local.slice(-1) === '.') return { ok: false, reason: 'Leading/trailing dot' };
  if (local.indexOf('..') !== -1)                    return { ok: false, reason: 'Double dot in address' };
  if (!/^[a-zA-Z0-9._%+\-]+$/.test(local))          return { ok: false, reason: 'Invalid local characters' };
  if (!domain)                                       return { ok: false, reason: 'Empty domain' };
  if (!/^[a-zA-Z0-9.\-]+$/.test(domain))            return { ok: false, reason: 'Invalid domain characters' };
  var domParts = domain.split('.');
  if (domParts.length < 2)                           return { ok: false, reason: 'Missing TLD' };
  var tld = domParts[domParts.length - 1];
  if (tld.length < 2)                                return { ok: false, reason: 'TLD too short' };
  return { ok: true, reason: 'Valid format' };
}

/* ── MX CHECK ──────────────────────────────────────────────────────────── */
async function checkMX(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  try {
    var ctrl = new AbortController();
    var tid  = setTimeout(function() { ctrl.abort(); }, MX_TO);
    var res  = await fetch(
      'https://dns.google/resolve?name=' + encodeURIComponent(domain) + '&type=MX',
      { signal: ctrl.signal }
    );
    clearTimeout(tid);
    var data  = await res.json();
    var hasMX = data.Status === 0 && Array.isArray(data.Answer) && data.Answer.length > 0;
    var result = hasMX
      ? { ok: true,  reason: 'Mail server found' }
      : { ok: false, reason: 'No mail server found' };
    mxCache.set(domain, result);
    return result;
  } catch(err) {
    var result2 = {
      ok: null,
      reason: (err.name === 'AbortError') ? 'DNS check timed out' : 'DNS lookup failed'
    };
    mxCache.set(domain, result2);
    return result2;
  }
}

/* ── BATCH MX CHECK ────────────────────────────────────────────────────── */
async function batchCheck(domains, onDone) {
  var unique = domains.filter(function(d, i, a) {
    return a.indexOf(d) === i && !mxCache.has(d);
  });
  for (var i = 0; i < unique.length; i += BATCH) {
    var slice = unique.slice(i, i + BATCH);
    await Promise.all(slice.map(async function(d) {
      await checkMX(d);
      if (onDone) onDone(d);
    }));
    await raf();
  }
}

/* ── RUNNING UI ────────────────────────────────────────────────────────── */
function setRunningUI(on) {
  var btn1 = document.getElementById('validateBtn');
  var btn2 = document.getElementById('validateBtnTop');
  btn1.disabled = on;
  btn2.disabled = on;
  var svgCheck17 =
    '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
    '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  var svgCheck15 =
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
    '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';
  if (on) {
    btn1.textContent = 'Validating\u2026';
    btn2.textContent = 'Validating\u2026';
  } else {
    btn1.innerHTML = svgCheck17 + ' Validate Emails';
    btn2.innerHTML = svgCheck15 + ' Validate';
  }
}

/* ── MAIN VALIDATION ───────────────────────────────────────────────────── */
async function startValidation() {
  if (state.running) return;

  hideAlert();

  var text = '';
  if (state.tab === 'upload') {
    if (state.files.length === 0) { showAlert('Please upload at least one file.'); return; }
    text = state.files.map(function(f) { return f.text; }).join('\n');
  } else {
    text = document.getElementById('pasteArea').value.trim();
    if (!text) { showAlert('Please paste some text first.'); return; }
  }

  state.running = true;
  setRunningUI(true);
  mxCache.clear();
  state.emails = [];
  state.page   = 1;

  var prog = document.getElementById('progressWrap');
  prog.style.display = 'block';
  document.getElementById('liveCheck').style.display  = 'none';
  document.getElementById('miniCounts').style.display = 'none';
  document.getElementById('section-results').style.display = 'none';

  try {
    /* ── STEP 1: Extract ── */
    setStep(1);
    setPct(5, 'Extracting emails\u2026');
    await raf();

    var raw = extractEmails(text);
    if (raw.length === 0) {
      showAlert('No email addresses found in the input.');
      state.running = false;
      setRunningUI(false);
      prog.style.display = 'none';
      return;
    }

    setPct(15, 'Found ' + raw.length + ' unique email' + (raw.length !== 1 ? 's' : '') + '. Checking format\u2026');
    await raf();

    /* ── STEP 2: Format ── */
    setStep(2);
    var formatted = raw.map(function(email) {
      var domain = email.split('@')[1] || '';
      var fmt    = validateFormat(email);
      return {
        email:        email,
        domain:       domain,
        formatOk:     fmt.ok,
        formatReason: fmt.reason,
        mxOk:         null,
        mxReason:     '',
        status:       'pending'
      };
    });

    var fmtBad = formatted.filter(function(e) { return !e.formatOk; }).length;
    setMini(raw.length, 0, fmtBad);
    setPct(30, 'Format check done. Starting DNS/MX verification\u2026');
    await raf();

    /* ── STEP 3: DNS/MX ── */
    setStep(3);
    var validDomains = formatted
      .filter(function(e) { return e.formatOk; })
      .map(function(e) { return e.domain; })
      .filter(function(d, i, a) { return a.indexOf(d) === i; });

    var dnsChecked = 0;
    var totalDns   = validDomains.length;

    await batchCheck(validDomains, function(domain) {
      dnsChecked++;
      setLive(domain);
      var validSoFar   = cacheCount(true);
      var invalidSoFar = cacheCount(false);
      setMini(raw.length, validSoFar, fmtBad + invalidSoFar);
      var pct = 30 + Math.floor((dnsChecked / Math.max(totalDns, 1)) * 60);
      setPct(Math.min(pct, 89), 'DNS/MX checking\u2026 ' + dnsChecked + '/' + totalDns + ' domains');
    });

    setLive(null);

    /* assign final status */
    formatted.forEach(function(e) {
      if (!e.formatOk) {
        e.status   = 'invalid';
        e.mxOk     = false;
        e.mxReason = '';
      } else {
        var mx = mxCache.get(e.domain);
        if (mx) {
          e.mxOk     = mx.ok;
          e.mxReason = mx.reason;
          if      (mx.ok === true)  e.status = 'valid';
          else if (mx.ok === false) e.status = 'invalid';
          else                      e.status = 'pending';
        } else {
          e.mxOk     = null;
          e.mxReason = 'DNS check skipped';
          e.status   = 'pending';
        }
      }
    });

    state.emails = formatted;

    /* ── STEP 4: Done ── */
    setStep(4);
    var nValid   = formatted.filter(function(e) { return e.status === 'valid';   }).length;
    var nInvalid = formatted.filter(function(e) { return e.status === 'invalid'; }).length;
    var nPending = formatted.filter(function(e) { return e.status === 'pending'; }).length;

    setMini(raw.length, nValid, nInvalid);
    setPct(100, 'Done! ' + nValid + ' valid \u00b7 ' + nInvalid + ' invalid \u00b7 ' + nPending + ' unverified');
    await raf();

    updateStats();
    renderTable();

    document.getElementById('section-results').style.display = '';
    setTimeout(function() { navClick('results'); }, 120);

    saveHistory({
      total: raw.length, valid: nValid, invalid: nInvalid,
      pending: nPending, date: new Date().toISOString()
    });
    renderHistory();

    showToast('\u2705 Done \u2014 ' + nValid + ' valid email' + (nValid !== 1 ? 's' : '') + ' found');

    document.getElementById('dlCsv').disabled = (nValid === 0);
    document.getElementById('dlTxt').disabled = (nValid === 0);

  } catch(err) {
    console.error(err);
    showAlert('Unexpected error: ' + err.message);
  }

  state.running = false;
  setRunningUI(false);
}

function cacheCount(okVal) {
  var n = 0;
  mxCache.forEach(function(v) { if (v.ok === okVal) n++; });
  return n;
}

/* ── STATS + DONUT ─────────────────────────────────────────────────────── */
function updateStats() {
  var emails   = state.emails;
  var total    = emails.length;
  var nValid   = emails.filter(function(e) { return e.status === 'valid';   }).length;
  var nInvalid = emails.filter(function(e) { return e.status === 'invalid'; }).length;
  var nPending = emails.filter(function(e) { return e.status === 'pending'; }).length;

  /* stat cards */
  document.getElementById('sTotal').textContent   = total;
  document.getElementById('sValid').textContent   = nValid;
  document.getElementById('sInvalid').textContent = nInvalid;
  document.getElementById('sPending').textContent = nPending;
  document.getElementById('scSub').textContent    = total ? total + ' extracted' : 'Upload a file to get started';
  document.getElementById('scValidSub').textContent =
    total ? Math.round(nValid / total * 100) + '% of total' : 'Ready to use';

  /* sidebar mini-stats */
  document.getElementById('sbValid').textContent   = nValid;
  document.getElementById('sbInvalid').textContent = nInvalid;
  document.getElementById('sbPending').textContent = nPending;

  /* donut */
  var donutSection = document.getElementById('donutSection');
  var donutEmpty   = document.getElementById('donutEmpty');

  if (total === 0) {
    donutSection.style.display = 'none';
    donutEmpty.style.display   = '';
    return;
  }

  donutSection.style.display = '';
  donutEmpty.style.display   = 'none';

  var dValid   = (nValid   / total) * C;
  var dInvalid = (nInvalid / total) * C;
  var dPending = (nPending / total) * C;

  setArc('arcInvalid', dInvalid, 0);
  setArc('arcPending', dPending, dInvalid);
  setArc('arcValid',   dValid,   dInvalid + dPending);

  document.getElementById('donutPct').textContent  = Math.round(nValid / total * 100) + '%';
  document.getElementById('lgValid').textContent   = nValid;
  document.getElementById('lgInvalid').textContent = nInvalid;
  document.getElementById('lgPending').textContent = nPending;
}

function setArc(id, len, offset) {
  var el = document.getElementById(id);
  el.setAttribute('stroke-dasharray',  len.toFixed(2) + ' ' + (C - len).toFixed(2));
  el.setAttribute('stroke-dashoffset', (-offset).toFixed(2));
}

/* ── RESULTS TABLE ─────────────────────────────────────────────────────── */
function getFiltered() {
  var list = state.emails;
  if (state.filter !== 'all') {
    list = list.filter(function(e) { return e.status === state.filter; });
  }
  if (state.search) {
    var q = state.search.toLowerCase();
    list  = list.filter(function(e) {
      return e.email.indexOf(q) !== -1 || e.domain.indexOf(q) !== -1;
    });
  }
  return list;
}

function renderTable() {
  var filtered = getFiltered();
  var total    = filtered.length;
  var pages    = Math.max(1, Math.ceil(total / PER_PAGE));
  if (state.page > pages) state.page = pages;
  var start = (state.page - 1) * PER_PAGE;
  var slice = filtered.slice(start, start + PER_PAGE);

  updateFilterTabs();

  document.getElementById('resultCount').textContent = total + ' result' + (total !== 1 ? 's' : '');
  document.getElementById('resultsSub').textContent  =
    total + ' email' + (total !== 1 ? 's' : '') + '\u00a0\u00b7\u00a0page ' + state.page + ' of ' + pages;

  var tbody   = document.getElementById('tableBody');
  var emptyEl = document.getElementById('emptyState');
  var tableEl = document.getElementById('mainTable');
  var paginEl = document.getElementById('paginationEl');

  if (slice.length === 0) {
    emptyEl.style.display = '';
    tableEl.style.display = 'none';
    paginEl.style.display = 'none';
    tbody.innerHTML = '';
    return;
  }

  emptyEl.style.display = 'none';
  tableEl.style.display = '';
  paginEl.style.display = '';
  tbody.innerHTML = '';

  slice.forEach(function(e, idx) {
    var rowNum  = start + idx + 1;
    var fmtChk  = e.formatOk ? '<span class="chk">\u2713</span>' : '<span class="crs">\u2717</span>';
    var mxChk;
    if      (e.mxOk === true)  mxChk = '<span class="chk">\u2713</span>';
    else if (e.mxOk === false) mxChk = '<span class="crs">\u2717</span>';
    else                        mxChk = '<span class="dsh">\u2014</span>';

    var badgeCls, statusLabel;
    if      (e.status === 'valid')   { badgeCls = 'badge-valid';   statusLabel = 'Valid'; }
    else if (e.status === 'invalid') { badgeCls = 'badge-invalid'; statusLabel = 'Invalid'; }
    else                              { badgeCls = 'badge-pending'; statusLabel = 'Unverified'; }

    var reasonCls = 'reason-cell';
    if (e.status === 'valid')   reasonCls += ' reason-valid';
    if (e.status === 'invalid') reasonCls += ' reason-invalid';
    if (e.status === 'pending') reasonCls += ' reason-pending';

    var reason = (e.mxReason) ? e.mxReason : (e.formatReason || '\u2014');

    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td style="color:var(--gray-400);font-size:12px">' + rowNum + '</td>' +
      '<td><div class="email-cell">' +
        '<span>' + escHtml(e.email) + '</span>' +
        '<button class="copy-btn" onclick="copyEmail(\'' + escAttr(e.email) + '\')" title="Copy">' +
          '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
            '<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>' +
          '</svg>' +
        '</button>' +
      '</div></td>' +
      '<td class="domain-cell">' + escHtml(e.domain) + '</td>' +
      '<td>' + fmtChk + '</td>' +
      '<td>' + mxChk + '</td>' +
      '<td><span class="badge ' + badgeCls + '"><span class="badge-dot"></span>' + statusLabel + '</span></td>' +
      '<td class="' + reasonCls + '">' + escHtml(reason) + '</td>' +
      '<td></td>';
    tbody.appendChild(tr);
  });

  renderPagination(pages);
}

function updateFilterTabs() {
  var all     = state.emails.length;
  var valid   = state.emails.filter(function(e) { return e.status === 'valid';   }).length;
  var invalid = state.emails.filter(function(e) { return e.status === 'invalid'; }).length;
  var pending = state.emails.filter(function(e) { return e.status === 'pending'; }).length;
  var tabs    = document.querySelectorAll('#filterTabs .tab');
  var labels  = ['All (' + all + ')', 'Valid (' + valid + ')', 'Invalid (' + invalid + ')', 'Unverified (' + pending + ')'];
  tabs.forEach(function(t, i) { t.textContent = labels[i]; });
}

function setFilter(f) {
  state.filter = f;
  state.page   = 1;
  var map  = { all: 0, valid: 1, invalid: 2, pending: 3 };
  var tabs = document.querySelectorAll('#filterTabs .tab');
  tabs.forEach(function(t, i) { t.classList.toggle('active', i === map[f]); });
  renderTable();
}

function onSearch() {
  state.search = document.getElementById('searchInput').value.toLowerCase();
  state.page   = 1;
  renderTable();
}

function renderPagination(pages) {
  var info = document.getElementById('pageInfo');
  var btns = document.getElementById('pageBtns');
  info.textContent = 'Page ' + state.page + ' of ' + pages;
  btns.innerHTML   = '';

  var prev = document.createElement('button');
  prev.className   = 'page-btn';
  prev.textContent = '\u2039';
  prev.disabled    = (state.page === 1);
  prev.onclick     = function() { state.page--; renderTable(); };
  btns.appendChild(prev);

  var maxShow = 5;
  var lo = Math.max(1, state.page - 2);
  var hi = Math.min(pages, lo + maxShow - 1);
  lo     = Math.max(1, hi - maxShow + 1);

  for (var p = lo; p <= hi; p++) {
    var b = document.createElement('button');
    b.className  = 'page-btn' + (p === state.page ? ' active' : '');
    b.textContent = p;
    (function(pp) {
      b.onclick = function() { state.page = pp; renderTable(); };
    })(p);
    btns.appendChild(b);
  }

  var next = document.createElement('button');
  next.className   = 'page-btn';
  next.textContent = '\u203a';
  next.disabled    = (state.page === pages);
  next.onclick     = function() { state.page++; renderTable(); };
  btns.appendChild(next);
}

/* ── CLIPBOARD ─────────────────────────────────────────────────────────── */
function copyEmail(email) {
  navigator.clipboard.writeText(email).then(function() {
    showToast('\ud83d\udccb Copied: ' + email);
  });
}

/* ── EXPORT ────────────────────────────────────────────────────────────── */
function downloadCSV() {
  var valid = state.emails.filter(function(e) { return e.status === 'valid'; });
  if (!valid.length) return;
  var rows = ['email,domain'].concat(valid.map(function(e) { return e.email + ',' + e.domain; }));
  triggerDownload(rows.join('\n'), 'valid-emails.csv', 'text/csv');
  showToast('\u2b07\ufe0f Downloaded ' + valid.length + ' emails as CSV');
}

function downloadTXT() {
  var valid = state.emails.filter(function(e) { return e.status === 'valid'; });
  if (!valid.length) return;
  triggerDownload(valid.map(function(e) { return e.email; }).join('\n'), 'valid-emails.txt', 'text/plain');
  showToast('\u2b07\ufe0f Downloaded ' + valid.length + ' emails as TXT');
}

function triggerDownload(content, filename, mime) {
  var a    = document.createElement('a');
  a.href   = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── HISTORY ───────────────────────────────────────────────────────────── */
var HISTORY_KEY = 'emailfilter_history';
var HISTORY_MAX = 20;

function saveHistory(entry) {
  var h = getHistory();
  h.unshift(entry);
  if (h.length > HISTORY_MAX) h.length = HISTORY_MAX;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h)); } catch(e) {}
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch(e) { return []; }
}

function clearHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch(e) {}
  renderHistory();
  showToast('\ud83d\uddd1\ufe0f History cleared');
}

function renderHistory() {
  var body = document.getElementById('historyBody');
  var h    = getHistory();

  if (h.length === 0) {
    body.innerHTML =
      '<div class="empty-state" style="padding:32px 0">' +
        '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"' +
          ' style="color:#CBD5E1;margin:0 auto 10px;display:block">' +
          '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '<p>No history yet</p>' +
      '</div>';
    return;
  }

  var items = h.map(function(e) {
    var d   = new Date(e.date);
    var ago = timeAgo(d);
    return (
      '<div class="history-item">' +
        '<div class="hi-icon">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' +
        '</div>' +
        '<div class="hi-body">' +
          '<div class="hi-title">' + e.total + ' email' + (e.total !== 1 ? 's' : '') + ' processed</div>' +
          '<div class="hi-meta">' +
            d.toLocaleDateString() + ' \u00b7 ' +
            d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
          '</div>' +
          '<div class="hi-badges">' +
            '<span class="hi-b hb-green">\u2713 ' + e.valid + ' valid</span>' +
            '<span class="hi-b hb-red">\u2717 ' + e.invalid + ' invalid</span>' +
            (e.pending ? '<span class="hi-b hb-amber">\u26a0 ' + e.pending + ' unverified</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="hi-time">' + ago + '</div>' +
      '</div>'
    );
  }).join('');

  body.innerHTML = '<div style="padding:4px 20px 8px">' + items + '</div>';
}

function timeAgo(date) {
  var s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

/* ── TOAST ─────────────────────────────────────────────────────────────── */
var toastTimer = null;
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.classList.remove('show'); }, 3200);
}

/* ── UTILS ─────────────────────────────────────────────────────────────── */
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escAttr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/* ── INIT ──────────────────────────────────────────────────────────────── */
(function init() {
  updateStats();
  renderHistory();
}());

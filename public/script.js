/* ══════════════════════════════════════════════════════════════
   Lacak Aduan — Frontend
   Vanilla JS · Supabase REST API · Leaflet
   ══════════════════════════════════════════════════════════════ */

const ST = ['Diterima', 'Diverifikasi', 'Diproses', 'Selesai'];
const DAY = 86_400_000;
const SESSION_KEY = 'la-session';
const SESSION_FLAG = 'la-has-session';
const THEME_KEY = 'la-theme';
const SEEN_KEY = 'la-seen';
const LOCATION_KEY = 'la-location';
const PUBLIC_STATISTICS_CACHE_KEY = 'la-public-statistics-v1';
const PUBLIC_STATISTICS_REFRESH_MS = 15_000;
const STAFF_COMPLAINTS_REFRESH_MS = 15_000;
let addressLookupTimer;
let addressLookupSequence = 0;
let complaintEvidenceSelection = null;
let complaintEvidencePreviewSequence = 0;
let staffEvidenceSelection = null;
let staffEvidencePreviewSequence = 0;

const CATS = [
  'Jalan rusak',
  'Sampah',
  'Lampu jalan',
  'Air dan drainase',
  'Layanan administrasi',
  'Lainnya',
];
const WORKSPACE_VIEW_TITLES = {
  overview: 'Pusat kendali aduan.',
  cases: 'Kelola aduan.',
  staff: 'Kelola petugas.',
  activity: 'Aktivitas terbaru.',
};

const CAT_CONFIG = {
  'Jalan rusak': { unit: 'Seksi Pemeliharaan Jalan', days: 7 },
  Sampah: { unit: 'Dinas Kebersihan', days: 3 },
  'Lampu jalan': { unit: 'Seksi Sarana Umum', days: 5 },
  'Air dan drainase': { unit: 'Tim Drainase', days: 2 },
  'Layanan administrasi': { unit: 'Bagian Pelayanan Kelurahan', days: 5 },
  Lainnya: { unit: 'Koordinasi Lintas Instansi', days: 7 },
};

const UNITS = Object.values(CAT_CONFIG).map((item) => item.unit);

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const nowIso = () => new Date().toISOString();

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );

/* ─── Toasts & loading ─── */
function toast(message, type = 'info', timeout = 4200) {
  const container = $('toast-container');
  if (!container) return;

  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = type === 'success' ? '✓' : type === 'error' ? '!' : 'i';
  const text = document.createElement('div');
  text.textContent = message;
  element.append(icon, text);
  container.append(element);

  window.setTimeout(() => {
    element.classList.add('is-leaving');
    window.setTimeout(() => element.remove(), 260);
  }, timeout);
}

function setLoading(button, loading, label = 'Memproses…') {
  if (!button) return;
  if (loading) {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = label;
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}

async function loadMathChallenge() {
  const question = $('n-captcha-question');
  if (!question) return false;
  try {
    const challenge = await apiRequest('/challenge');
    question.textContent = challenge.question;
    $('n-captcha-token').value = challenge.token;
    $('n-captcha-answer').value = '';
    $('n-captcha-error').textContent = '';
    return true;
  } catch {
    question.textContent = 'Soal verifikasi belum tersedia';
    $('n-captcha-token').value = '';
    $('n-captcha-error').textContent = 'Muat ulang halaman atau coba kembali sebentar lagi.';
    return false;
  }
}

async function reverseGeocodeLocation(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&accept-language=id`;

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return '';

    const data = await response.json();
    const address = data?.address || {};
    const road = address.road || address.street || '';
    const locality = address.neighbourhood || address.village || address.suburb || address.hamlet || address.quarter || '';
    const district = address.city_district || address.district || address.subdistrict || '';
    const administrativeArea = [
      address.county,
      address.state_district,
      address.city,
      address.town,
      address.municipality,
    ].find((part) => /^(kota|kabupaten)\s/i.test(part || ''))
      || address.city
      || address.town
      || address.municipality
      || address.county
      || address.state_district
      || '';
    const province = address.state || address.province || address.region || '';
    const parts = [];

    if (road) {
      const normalizedRoad = road.trim();
      const roadText = /^(jl|jalan)/i.test(normalizedRoad) ? normalizedRoad : `Jl. ${normalizedRoad}`;
      parts.push(roadText);
    }
    [locality, district, administrativeArea, province, address.country].forEach((part) => {
      if (!part) return;
      const normalizedPart = part.trim().toLocaleLowerCase('id-ID').replace(/^(kota|kabupaten)\s+/, '');
      const isDuplicate = parts.some((existing) => (
        existing.trim().toLocaleLowerCase('id-ID').replace(/^(kota|kabupaten)\s+/, '') === normalizedPart
      ));
      if (!isDuplicate) parts.push(part.trim());
    });

    return parts.join(', ') || data?.display_name?.split(',').slice(0, 6).join(', ') || '';
  } catch {
    return '';
  }
}

function lookupAddressForPoint(latitude, longitude) {
  const lookupSequence = ++addressLookupSequence;
  const currentLocation = $('n-loc')?.value || '';
  window.clearTimeout(addressLookupTimer);
  addressLookupTimer = window.setTimeout(async () => {
    const address = await reverseGeocodeLocation(latitude, longitude);
    const locationInput = $('n-loc');
    if (
      address
      && lookupSequence === addressLookupSequence
      && locationInput?.value === currentLocation
    ) {
      locationInput.value = address;
    }
  }, 1000);
}

/* ─── Theme ─── */
function themePreference() {
  try {
    return localStorage.getItem(THEME_KEY) || 'system';
  } catch {
    return 'system';
  }
}

function applyTheme(preference) {
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = preference === 'dark' || (preference === 'system' && systemDark) ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;

  const button = $('theme-toggle');
  if (button) {
    const label = theme === 'dark' ? 'Aktifkan tema terang' : 'Aktifkan tema gelap';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    button.title = label;
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#07130e' : '#f4f1e8');

  applyMapTheme();
}

function setupTheme() {
  applyTheme(themePreference());
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    if (themePreference() === 'system') applyTheme('system');
  };
  if (media.addEventListener) media.addEventListener('change', onChange);
  else if (media.addListener) media.addListener(onChange);

  $('theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* Preferensi tetap berlaku untuk sesi ini. */
    }
    applyTheme(next);
  });
}

/* ─── Live clock ─── */
function updateLiveClock() {
  const clockElement = $('live-clock');
  const dateElement = $('live-clock-date');
  if (!clockElement || !dateElement) return;

  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const parts = formatter.formatToParts(new Date());
  const getPart = (type) => parts.find((part) => part.type === type)?.value ?? '';

  clockElement.textContent = `${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
  clockElement.setAttribute('datetime', new Date().toISOString());
  dateElement.textContent = `${getPart('weekday')}, ${getPart('day')} ${getPart('month')} ${getPart('year')}`;
}

function startLiveClock() {
  updateLiveClock();
  window.setInterval(updateLiveClock, 1000);
}

/* ─── Formatting ─── */
function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const getPart = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${getPart('day')} ${getPart('month')} ${getPart('year')}, ${getPart('hour')}.${getPart('minute')}`;
}

function formatDisplayLocation(loc) {
  if (typeof loc !== 'string' || !loc.trim()) return '-';
  const parts = loc.split(',').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return '-';

  const cityIndex = parts.findIndex((part) => /^(kota|kabupaten)\b/i.test(part) || /\b(kota|kabupaten)\b/i.test(part));
  if (cityIndex !== -1) {
    return parts.slice(0, cityIndex + 1).join(', ');
  }

  return parts.slice(0, Math.min(4, parts.length)).join(', ');
}

/* ─── API ─── */
async function apiRequest(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`/api${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    credentials: 'same-origin',
    headers,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = new Error(payload?.message || 'Permintaan API gagal.');
    error.status = response.status;
    error.code = payload?.code;
    error.payload = payload;
    throw error;
  }

  return payload;
}

/* ─── Data state ─── */
let tickets = [];
let staffTickets = [];
let staffCaseDetails = new Map();
let staffCaseRequest = 0;
let selectedTicketCode = '';
let selectedBulkTicketCodes = new Set();
let deleteTargetCodes = [];
let activeWorkspaceView = 'overview';
let knownStaffComplaintCodes = new Set();
let staffCodesInitialized = false;
let staffRefreshInFlight = false;

function normalizeTicket(input) {
  const ticket = { ...input };
  const config = CAT_CONFIG[ticket.cat] || CAT_CONFIG.Lainnya;

  ticket.log = Array.isArray(ticket.log) ? ticket.log.filter(Boolean) : [];
  if (!ticket.log.length) {
    const at = ticket.at || nowIso();
    ticket.log = [{ s: 0, at, by: 'Sistem', note: 'Aduan diterima.' }];
  }

  ticket.priority = ['normal', 'high', 'urgent'].includes(ticket.priority)
    ? ticket.priority
    : 'normal';
  delete ticket.rating;
  ticket.unit = ticket.unit || config.unit;
  ticket.waitingForInfo = Boolean(ticket.waitingForInfo);
  ticket.audit = Array.isArray(ticket.audit) ? ticket.audit : [];
  ticket.evidence = ticket.evidence || null;
  ticket.attachments = Array.isArray(ticket.attachments) ? [...ticket.attachments] : [];
  const knownEvidence = new Set(ticket.attachments.map((attachment) => attachment.evidence));
  if (ticket.evidence && !knownEvidence.has(ticket.evidence)) {
    ticket.attachments.push({ evidence: ticket.evidence, source: 'Pelapor', at: ticket.at });
    knownEvidence.add(ticket.evidence);
  }
  ticket.log.forEach((entry) => {
    if (!entry.evidence || knownEvidence.has(entry.evidence)) return;
    ticket.attachments.push({
      evidence: entry.evidence,
      source: `Petugas · ${entry.by || 'Unit penanganan'}`,
      at: entry.at,
    });
    knownEvidence.add(entry.evidence);
  });
  ticket.email = typeof ticket.email === 'string' ? ticket.email : '';
  ticket.name = typeof ticket.name === 'string' ? ticket.name : '';

  const lat = Array.isArray(ticket.coordinates) ? Number(ticket.coordinates[0]) : NaN;
  const lng = Array.isArray(ticket.coordinates) ? Number(ticket.coordinates[1]) : NaN;
  ticket.coordinates =
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? [lat, lng]
      : null;

  if (!ticket.audit.length) {
    ticket.audit = ticket.log.map((entry) => ({
      kind: 'status',
      at: entry.at,
      by: entry.by,
      note: entry.note,
    }));
  }

  return ticket;
}

async function loadPublicTickets() {
  try {
    const payload = await apiRequest('/complaints');
    return Array.isArray(payload) ? payload.map(normalizeTicket) : [];
  } catch (error) {
    console.error('Gagal memuat aduan:', error.message);
    return [];
  }
}

function currentEntry(ticket) {
  return ticket.log[ticket.log.length - 1] || {
    s: 0,
    at: ticket.at || nowIso(),
    by: 'Sistem',
    note: '',
    visibility: 'public',
  };
}

const baseStatus = (ticket) => currentEntry(ticket).s;
const isClosed = (ticket) => baseStatus(ticket) === 3 || baseStatus(ticket) === -1;
const isWaiting = (ticket) => Boolean(ticket.waitingForInfo);

function statusLabel(ticket) {
  if (isWaiting(ticket)) return 'Menunggu informasi warga';
  const status = baseStatus(ticket);
  if (status === -1) return 'Ditolak';
  return ST[status] || 'Diterima';
}

function statusClass(ticket) {
  if (isWaiting(ticket)) return 's-wait';
  const status = baseStatus(ticket);
  if (status === 3) return 's-done';
  if (status === -1) return 's-no';
  return 's-go';
}

const trackingStatus = (ticket) => statusLabel(ticket);
const priorityLabel = (priority) => ({ urgent: 'Darurat', high: 'Tinggi', normal: 'Normal' })[priority] || 'Normal';
const priorityClass = (priority) => ({ urgent: 'p-urgent', high: 'p-high', normal: 'p-normal' })[priority] || 'p-normal';

function targetDays(ticket) {
  const base = (CAT_CONFIG[ticket.cat] || CAT_CONFIG.Lainnya).days;
  if (ticket.priority === 'urgent') return 1;
  if (ticket.priority === 'high') return Math.max(2, Math.ceil(base * 0.65));
  return base;
}

function dueDate(ticket) {
  return new Date(new Date(ticket.at).getTime() + targetDays(ticket) * DAY);
}

function isLate(ticket) {
  return !isClosed(ticket) && Date.now() > dueDate(ticket).getTime();
}

function elapsedDays(ticket) {
  const start = new Date(ticket.at).getTime();
  if (!Number.isFinite(start)) return 0;
  const end = isClosed(ticket) ? new Date(currentEntry(ticket).at).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / DAY));
}

function dueLabel(ticket) {
  if (isClosed(ticket)) return 'Ditutup';
  const remaining = Math.ceil((dueDate(ticket).getTime() - Date.now()) / DAY);
  if (remaining < 0) return `Terlambat ${Math.abs(remaining)} hari`;
  if (remaining === 0) return 'Tenggat hari ini';
  return `${remaining} hari lagi`;
}

function averageFinish(cases) {
  const finished = cases.filter((ticket) => baseStatus(ticket) === 3);
  if (!finished.length) return 0;
  return Math.round(finished.reduce((total, ticket) => total + elapsedDays(ticket), 0) / finished.length);
}

/* ─── Count-up metric ─── */
function setMetric(id, value, suffix = '') {
  const element = $(id);
  if (!element) return;
  const target = Number(value);
  if (!Number.isFinite(target) || reducedMotion()) {
    element.textContent = `${value}${suffix}`;
    element.dataset.value = String(value);
    return;
  }

  const start = Number(element.dataset.value || 0);
  const duration = 520;
  const begun = performance.now();

  const frame = (now) => {
    const progress = Math.min(1, (now - begun) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = `${Math.round(start + (target - start) * eased)}${suffix}`;
    if (progress < 1) window.requestAnimationFrame(frame);
    else element.dataset.value = String(target);
  };

  window.requestAnimationFrame(frame);
}

/* ─── Home ─── */
function renderSlaGrid() {
  const grid = $('sla-grid');
  if (!grid) return;
  grid.innerHTML = Object.entries(CAT_CONFIG)
    .map(
      ([category, config], index) =>
        `<li><button type="button" class="sla-card" data-sla-cat="${escapeHtml(category)}"><span class="sla-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="sla-body"><b>${escapeHtml(category)}</b><small>${escapeHtml(config.unit)}</small></span><span class="sla-days"><b>${config.days}</b><small>hari</small></span></button></li>`,
    )
    .join('');
}

function renderHome() {
  renderSlaGrid();
}

let publicStatisticsData = null;
let statisticsLoadPromise = null;

function validPublicStatistics(data) {
  return data
    && typeof data === 'object'
    && Number.isFinite(Number(data.total))
    && Array.isArray(data.monthly)
    && Array.isArray(data.categoryAverages)
    && Array.isArray(data.unitResponse)
    && Array.isArray(data.heatmap);
}

function loadCachedPublicStatistics() {
  try {
    const cached = JSON.parse(localStorage.getItem(PUBLIC_STATISTICS_CACHE_KEY) || 'null');
    if (!validPublicStatistics(cached)) return;
    publicStatisticsData = cached;
    renderPublicStatistics(cached);
  } catch (error) {
    console.warn('Cache statistik publik tidak dapat dibaca:', error.message);
  }
}

function animatePublicStat(element, value, suffix = '') {
  if (value === null || !Number.isFinite(Number(value))) {
    element.textContent = '—';
    delete element.dataset.value;
    return;
  }

  const target = Number(value);
  const start = Number(element.dataset.value || 0);
  if (reducedMotion() || start === target) {
    element.textContent = `${target.toLocaleString('id-ID')}${suffix}`;
    element.dataset.value = String(target);
    return;
  }

  const begun = performance.now();
  const duration = 650;
  const frame = (now) => {
    const progress = Math.min(1, (now - begun) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    element.textContent = `${current.toLocaleString('id-ID')}${suffix}`;
    if (progress < 1) window.requestAnimationFrame(frame);
    else element.dataset.value = String(target);
  };
  window.requestAnimationFrame(frame);
}

function renderPublicStatistics(data) {
  const summary = $('public-stat-summary');
  if (summary) {
    const metrics = [
      ['total', 'Total aduan', data.total, 'seluruh aduan tercatat', ''],
      ['active', 'Sedang ditangani', data.active, 'status masih berjalan', ''],
      ['timely', 'Selesai tepat waktu', data.onTimeRate, `${data.completed} aduan selesai dianalisis`, '%'],
      ['completed', 'Aduan selesai', data.completed, 'menjadi dasar metrik waktu', ''],
    ];
    if (!summary.querySelector('[data-stat]')) {
      summary.innerHTML = metrics.map(([key, label]) => (
        `<article class="public-stat-card" data-stat="${key}"><span>${label}</span><b>—</b><small></small></article>`
      )).join('');
    }
    metrics.forEach(([key, , value, note, suffix]) => {
      const card = summary.querySelector(`[data-stat="${key}"]`);
      animatePublicStat(card.querySelector('b'), value, suffix);
      card.querySelector('small').textContent = note;
    });
  }

  const chart = $('stats-monthly-chart');
  if (chart) {
    const max = Math.max(1, ...data.monthly.map((month) => month.count));
    chart.setAttribute('aria-label', data.monthly.map((month) => `${month.label}: ${month.count} aduan`).join('. '));
    chart.innerHTML = data.monthly.map((month) => {
      const height = month.count ? Math.max(8, Math.round((month.count / max) * 100)) : 3;
      const monthLabel = `${month.label} '${month.month.slice(2, 4)}`;
      return `<div class="public-trend-column" title="${escapeHtml(monthLabel)}: ${month.count} aduan"><b>${month.count}</b><span class="public-trend-track"><i style="height:${height}%"></i></span><small>${escapeHtml(monthLabel)}</small></div>`;
    }).join('');
  }

  const categories = $('stats-category-list');
  if (categories) {
    const categoryAverages = new Map(data.categoryAverages.map((item) => [item.category, item]));
    const max = Math.max(1, ...data.categoryAverages.map((item) => item.averageDays));
    categories.innerHTML = CATS.map((category) => {
      const item = categoryAverages.get(category);
      if (!item) {
        return `<div class="public-metric-row"><div class="public-metric-label"><b>${escapeHtml(category)}</b><span>Belum ada data</span></div><div class="public-metric-track"><i style="width:0%"></i></div></div>`;
      }
      return `<div class="public-metric-row"><div class="public-metric-label"><b>${escapeHtml(category)}</b><span>${item.averageDays} hari <small>· ${item.count} aduan</small></span></div><div class="public-metric-track"><i style="width:${Math.max(4, item.averageDays / max * 100)}%"></i></div></div>`;
    }).join('');
  }

  const units = $('stats-unit-list');
  if (units) {
    units.innerHTML = data.unitResponse.length
      ? data.unitResponse.map((item, index) => `<li><span class="public-rank">${String(index + 1).padStart(2, '0')}</span><span class="public-unit-name"><b>${escapeHtml(item.unit)}</b><small>${item.count} aduan terverifikasi</small></span><strong>${item.averageHours < 24 ? `${item.averageHours} jam` : `${(item.averageHours / 24).toFixed(1)} hari`}</strong></li>`).join('')
      : '<li class="stats-empty">Belum cukup data verifikasi untuk menampilkan peringkat.</li>';
  }

  const updated = $('stats-updated');
  if (updated) {
    const date = new Date(data.generatedAt);
    updated.textContent = `Diperbarui ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date)} WIB`;
  }
  // renderStatisticsMap dipanggil oleh ensureStatisticsMap setelah peta siap
}

async function loadPublicStatistics() {
  if (statisticsLoadPromise) return statisticsLoadPromise;
  const updated = $('stats-updated');
  statisticsLoadPromise = apiRequest('/statistics', { cache: 'no-store' })
    .then((data) => {
      publicStatisticsData = data;
      try {
        localStorage.setItem(PUBLIC_STATISTICS_CACHE_KEY, JSON.stringify(data));
      } catch (error) {
        console.warn('Cache statistik publik tidak dapat disimpan:', error.message);
      }
      renderPublicStatistics(data);
      // Render ulang peta setelah data masuk; juga invalidate size bila container baru terlihat
      if (statisticsMap) {
        renderStatisticsMap();
        window.requestAnimationFrame(() => {
          statisticsMap?.invalidateSize();
          window.setTimeout(() => statisticsMap?.invalidateSize(), 200);
        });
      }
      return data;
    })
    .catch((error) => {
      if (updated) {
        updated.textContent = publicStatisticsData
          ? 'Pembaruan otomatis tertunda; menampilkan data terakhir.'
          : `Statistik belum dapat dimuat. ${error.message}`;
      }
      if (!publicStatisticsData) {
        $('stats-monthly-chart').innerHTML = '<p class="stats-empty">Data tren belum tersedia.</p>';
      }
      return null;
    })
    .finally(() => { statisticsLoadPromise = null; });
  return statisticsLoadPromise;
}

/* ─── Public board ─── */
function renderStats() {
  const container = $('stats');
  if (!container) return;

  const finished = tickets.filter((ticket) => baseStatus(ticket) === 3);
  const rejected = tickets.filter((ticket) => baseStatus(ticket) === -1).length;
  const overdue = tickets.filter(isLate).length;
  const average = averageFinish(tickets);

  container.innerHTML = [
    ['Total', tickets.length, 'aduan tercatat'],
    ['Selesai', finished.length, 'dengan hasil'],
    ['Rata-rata', `${average}`, 'hari penyerahan'],
    ['Terlambat', overdue, rejected ? `${rejected} ditolak` : 'melewati target'],
  ]
    .map(
      ([label, value, note]) =>
        `<div class="stat"><span>${escapeHtml(label)}</span><b>${escapeHtml(String(value))}</b><small>${escapeHtml(note)}</small></div>`,
    )
    .join('');
}

function renderRows() {
  const rows = $('rows');
  if (!rows) return;

  const ordered = [...tickets].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  rows.innerHTML = ordered.length
    ? ordered
        .map(
          (ticket) => {
            const locText = formatDisplayLocation(ticket.loc);
            return `<tr data-code="${escapeHtml(ticket.code)}" tabindex="0" role="button" aria-label="Lihat riwayat aduan ${escapeHtml(ticket.code)}"><td class="ticket-code-cell"><b>${escapeHtml(ticket.code)}</b></td><td class="ticket-cat-cell">${escapeHtml(ticket.cat)}</td><td class="ticket-loc-cell" title="${escapeHtml(ticket.loc)}">${escapeHtml(locText)}</td><td class="ticket-status-cell"><span class="pill ${statusClass(ticket)}">${escapeHtml(trackingStatus(ticket))}</span></td><td class="ticket-age-cell">${elapsedDays(ticket)} hari</td><td class="row-open-cell"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 10h10m-4-4 4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="visually-hidden">Lihat detail</span></td></tr>`;
          }
        )
        .join('')
    : '<tr><td colspan="6" class="empty-state">Belum ada aduan yang masuk.</td></tr>';
}

function renderBoard() {
  renderStats();
  renderRows();
  renderPublicMap();
  renderHome();
}

/* ─── Public slip ─── */
function timeline(ticket) {
  const latestStatus = baseStatus(ticket);
  const progressStatus = latestStatus === -1 ? ticket.log[ticket.log.length - 2]?.s ?? 0 : latestStatus;

  return ST.map((name, index) => {
    const entries = ticket.log.filter((entry) => entry.s === index);
    const entry = entries[entries.length - 1];
    const isCurrent = index === progressStatus;

    if (entry) {
      const note =
        entry.visibility === 'internal' ? '' : `<p class="note">${escapeHtml(entry.note)}</p>`;
      return `<li class="${isCurrent ? 'cur' : ''}"><span class="dot"></span><h3>${name}</h3><div class="when">${formatDate(entry.at)}, oleh ${escapeHtml(entry.by)}</div>${note}</li>`;
    }

    return `<li class="todo"><span class="dot"></span><h3>${name}</h3><div class="when">Belum dilakukan</div></li>`;
  }).join('');
}

function evidenceUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const trimmed = value.trim();
  if (/^data:image\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '';
}

function evidenceMarkup(value) {
  const attachments = Array.isArray(value) ? value : [{ evidence: value, source: 'Bukti aduan' }];
  const items = attachments
    .map((attachment) => {
      const url = evidenceUrl(attachment?.evidence);
      if (!url) return '';
      const source = escapeHtml(attachment.source || 'Bukti aduan');
      const date = attachment.at ? `<small>${formatDate(attachment.at)}</small>` : '';
      return `<figure class="evidence-item"><button class="evidence-link" type="button" aria-label="Perbesar foto: ${source}"><img src="${escapeHtml(url)}" alt="${source}" loading="lazy"></button><figcaption><span>${source}</span>${date}</figcaption></figure>`;
    })
    .filter(Boolean)
    .join('');
  return items ? `<div class="evidence-gallery">${items}</div>` : '';
}

function slip(ticket) {
  const days = elapsedDays(ticket);
  const sla = targetDays(ticket);
  const progress = Math.min(100, Math.round((days / sla) * 100));
  const late = isLate(ticket);
  const state = baseStatus(ticket);

  const ageText = isClosed(ticket)
    ? `${state === 3 ? 'Selesai' : 'Ditutup'} dalam ${days} hari.`
    : late
      ? `Melewati target ${sla} hari.`
      : `Target ${sla} hari; ${dueLabel(ticket)}.`;

  const rejection =
    state === -1
      ? `<li class="no"><span class="dot"></span><h3>Ditolak</h3><div class="when">${formatDate(currentEntry(ticket).at)}, oleh ${escapeHtml(currentEntry(ticket).by)}</div>${currentEntry(ticket).visibility === 'internal' ? '' : `<p class="note">${escapeHtml(currentEntry(ticket).note)}</p>`}</li>`
      : '';

  const location = ticket.coordinates
    ? `<a class="map-link" href="https://www.openstreetmap.org/?mlat=${ticket.coordinates[0]}&mlon=${ticket.coordinates[1]}#map=17/${ticket.coordinates[0]}/${ticket.coordinates[1]}" target="_blank" rel="noopener">Lihat titik perkiraan di peta</a>`
    : '';

  const evidence = evidenceMarkup(ticket.attachments);

  return `<article class="slip"><div class="slip-h"><div><div class="code">${escapeHtml(ticket.code)}</div><p class="meta">${escapeHtml(ticket.cat)}, ${escapeHtml(ticket.loc)}<br>Masuk ${formatDate(ticket.at)}<br>${location}</p></div><div class="stamp ${statusClass(ticket)}">${escapeHtml(statusLabel(ticket))}</div></div><div class="slip-b"><p class="issue">“${escapeHtml(ticket.text)}”</p><div class="case-tags"><span class="priority-tag ${priorityClass(ticket.priority)}">Prioritas ${priorityLabel(ticket.priority)}</span><span class="unit-tag">${escapeHtml(ticket.unit)}</span></div>${evidence ? `<div class="evidence-box">${evidence}</div>` : ''}<div class="age"><div class="${late ? 'late-text' : ''}">${ageText}</div><div class="bar ${late ? 'over' : ''}" role="img" aria-label="${progress} persen dari target waktu"><i style="width:${progress}%"></i></div></div><ol class="tl">${timeline(ticket)}${rejection}</ol></div></article>`;
}

async function showTicket(code) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  const message = $('tmsg');
  const result = $('result');
  message.textContent = '';
  result.innerHTML = '';

  if (!/^ADU-\d{4}-\d{4,6}$/.test(normalizedCode)) {
    message.textContent = 'Format nomor aduan harus seperti ADU-2611-902617.';
    return;
  }

  message.textContent = 'Mencari aduan…';

  let ticket;
  try {
    ticket = await apiRequest(`/complaints/${encodeURIComponent(normalizedCode)}`);
  } catch (error) {
    message.textContent =
      error.status === 404
        ? `Nomor “${normalizedCode}” tidak ditemukan. Periksa huruf dan angkanya, lalu coba lagi.`
        : error.message;
    return;
  }

  message.textContent = '';
  const normalized = normalizeTicket(ticket);
  const index = tickets.findIndex((item) => item.code === normalized.code);
  if (index < 0) tickets.push(normalized);
  else tickets[index] = normalized;

  $('q').value = normalized.code;
  result.innerHTML = slip(normalized);
  result.scrollIntoView({
    behavior: reducedMotion() ? 'auto' : 'smooth',
    block: 'start',
  });
}

/* ─── Session ─── */
function currentSession() {
  try {
    const user = JSON.parse(sessionStorage.getItem(SESSION_KEY));
    return user && typeof user === 'object' ? user : null;
  } catch {
    return null;
  }
}

function rememberSession() {
  try {
    localStorage.setItem(SESSION_FLAG, '1');
  } catch {
    /* Penanda sesi hanya membantu menghindari permintaan auth yang tidak perlu. */
  }
}

function hasSessionMarker() {
  try {
    return localStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  try {
    localStorage.removeItem(SESSION_FLAG);
  } catch {
    /* Abaikan penyimpanan yang tidak tersedia. */
  }
  staffTickets = [];
  knownStaffComplaintCodes.clear();
  staffCodesInitialized = false;
  staffCaseDetails.clear();
  staffCaseRequest += 1;
  selectedTicketCode = '';
  selectedBulkTicketCodes = new Set();
}

function sessionExpired(error) {
  if (error?.status !== 401 && error?.status !== 403) return false;
  clearSession();
  setStaffView();
  toast('Sesi Anda berakhir. Silakan masuk kembali.', 'error');
  return true;
}

function accessibleTickets() {
  const user = currentSession();
  if (!user) return [];
  return user.role === 'admin' ? staffTickets : staffTickets.filter((ticket) => ticket.unit === user.unit);
}

function setStaffView() {
  const user = currentSession();
  const isAdmin = user?.role === 'admin';

  $('staff-login-view').hidden = Boolean(user);
  $('staff-workspace').hidden = !user;
  $('staff-nav-button').textContent = user ? (isAdmin ? 'Ruang admin' : 'Ruang petugas') : 'Masuk petugas';
  document.body.dataset.role = user ? user.role : 'public';
  document.body.classList.toggle('is-admin', Boolean(isAdmin));

  $('kpi-units').hidden = !isAdmin;
  $('staff-admin-panel').hidden = !isAdmin;
  $('bulk-actions').hidden = !isAdmin;
  $('workspace-nav').hidden = !user;
  $('workspace-nav').setAttribute('aria-label', isAdmin ? 'Menu admin' : 'Menu petugas');
  $('workspace-staff-view').hidden = !isAdmin;
  const deleteTicket = $('delete-ticket');
  if (deleteTicket) deleteTicket.hidden = !isAdmin;

  if (!user) return;

  $('role-chip').textContent = isAdmin ? 'Admin' : 'Petugas';
  $('staff-welcome').textContent = `${user.name || 'Petugas'} · ${isAdmin ? 'Administrator' : user.unit || 'Unit belum ditetapkan'}`;

  setWorkspaceView('overview');

  renderDashboard();
  if (isAdmin) renderStaffDirectory();
}

function workspaceViewTitle(view, user = currentSession()) {
  if (view === 'overview' && user?.role !== 'admin') return 'Ruang kerja petugas.';
  return WORKSPACE_VIEW_TITLES[view];
}

function setWorkspaceView(view) {
  const user = currentSession();
  if (!user) return;

  const allowedViews = user.role === 'admin'
    ? Object.keys(WORKSPACE_VIEW_TITLES)
    : ['overview', 'cases', 'activity'];
  activeWorkspaceView = allowedViews.includes(view) ? view : 'overview';
  $$('[data-admin-section]').forEach((section) => {
    section.hidden = section.dataset.adminSection !== activeWorkspaceView;
  });
  $('workspace-title').textContent = workspaceViewTitle(activeWorkspaceView, user);
  $$('[data-workspace-view]').forEach((button) => {
    const active = button.dataset.workspaceView === activeWorkspaceView;
    button.classList.toggle('is-active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

/* ─── Dashboard ─── */
function renderDashboard() {
  const user = currentSession();
  if (!user) return;

  const allCases = accessibleTickets();
  renderDashboardReport(allCases);
  const cases = filteredDashboardCases(allCases);
  const isAdmin = user.role === 'admin';
  const active = cases.filter((ticket) => !isClosed(ticket)).length;
  const late = cases.filter(isLate).length;
  const urgent = cases.filter((ticket) => ticket.priority !== 'normal' && !isClosed(ticket)).length;
  const units = new Set(cases.map((ticket) => ticket.unit).filter(Boolean)).size;
  const average = averageFinish(cases);

  setMetric('metric-active', active);
  setMetric('metric-late', late);
  setMetric('metric-urgent', urgent);
  setMetric('metric-average', average);
  setMetric('metric-units', units);

  renderStaffTable(allCases);
  renderActivity(allCases);

  const title = $('workspace-title');
  if (title) title.textContent = workspaceViewTitle(activeWorkspaceView, user);
}

function filteredDashboardCases(cases) {
  const from = $('report-from')?.value || '';
  const to = $('report-to')?.value || '';

  return cases.filter((ticket) => {
    const date = String(ticket.at || '').slice(0, 10);
    return (!from || date >= from)
      && (!to || date <= to);
  });
}

function renderTrendChart(cases) {
  const chart = $('complaint-trend');
  if (!chart) return;

  const grouping = $('report-grouping')?.value || 'month';
  const dateKeys = cases
    .map((ticket) => String(ticket.at || '').slice(0, 10))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  const latestDate = dateKeys[dateKeys.length - 1] || new Date().toISOString().slice(0, 10);
  const hasCustomRange = Boolean($('report-from')?.value || $('report-to')?.value);
  let defaultStart = new Date(`${latestDate}T12:00:00Z`);
  if (grouping === 'day') {
    defaultStart.setUTCDate(defaultStart.getUTCDate() - 29);
  } else if (grouping === 'year') {
    defaultStart.setUTCFullYear(defaultStart.getUTCFullYear() - 4, 0, 1);
  } else {
    defaultStart.setUTCDate(1);
    defaultStart.setUTCMonth(defaultStart.getUTCMonth() - 11);
  }
  const defaultFrom = defaultStart.toISOString().slice(0, 10);
  const from = $('report-from')?.value || (hasCustomRange ? dateKeys[0] || latestDate : defaultFrom);
  const to = $('report-to')?.value || latestDate;
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  const title = $('trend-title');
  if (title) {
    title.textContent = `Tren pengaduan per ${grouping === 'day' ? 'tanggal' : grouping === 'year' ? 'tahun' : 'bulan'}`;
  }
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    chart.innerHTML = '<p class="empty-row">Rentang tanggal tidak valid. Periksa kembali tanggal awal dan akhir.</p>';
    const summary = $('trend-summary');
    if (summary) summary.textContent = '0 aduan pada filter';
    return;
  }

  const periods = [];
  const cursor = new Date(start);
  if (grouping === 'day') {
    while (cursor <= end) {
      periods.push({
        key: cursor.toISOString().slice(0, 10),
        label: cursor.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          ...(start.getUTCFullYear() !== end.getUTCFullYear() ? { year: '2-digit' } : {}),
          timeZone: 'UTC',
        }),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  } else if (grouping === 'year') {
    cursor.setUTCDate(1);
    cursor.setUTCMonth(0);
    while (cursor <= end) {
      periods.push({ key: String(cursor.getUTCFullYear()), label: String(cursor.getUTCFullYear()) });
      cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    }
  } else {
    cursor.setUTCDate(1);
    while (cursor <= end) {
      periods.push({
        key: cursor.toISOString().slice(0, 7),
        label: cursor.toLocaleDateString('id-ID', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }

  const counts = new Map(periods.map((period) => [period.key, 0]));
  cases.forEach((ticket) => {
    const date = String(ticket.at || '').slice(0, 10);
    if (date < from || date > to) return;
    const key = grouping === 'day' ? date : grouping === 'year' ? date.slice(0, 4) : date.slice(0, 7);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  });

  const max = Math.max(1, ...counts.values());
  chart.innerHTML = periods.length
    ? periods.map((period) => {
      const count = counts.get(period.key);
      const height = count ? Math.max(5, Math.round((count / max) * 100)) : 2;
      return `<div class="trend-column" title="${escapeHtml(period.label)}: ${count} aduan"><span class="trend-value">${count || ''}</span><span class="trend-bar" style="--bar-height:${height}%"></span><small>${escapeHtml(period.label)}</small></div>`;
    }).join('')
    : '<p class="empty-row">Belum ada data pada periode ini.</p>';

  const summary = $('trend-summary');
  if (summary) summary.textContent = `${cases.filter((ticket) => {
    const date = String(ticket.at || '').slice(0, 10);
    return date >= from && date <= to;
  }).length} aduan pada filter`;
}

function renderDashboardHistory(cases) {
  const list = $('dashboard-history');
  if (!list) return;

  const activities = cases
    .flatMap((ticket) => ticket.audit
      .filter((event) => event.kind !== 'rating')
      .map((event) => ({ ...event, code: ticket.code })))
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, 6);

  list.innerHTML = activities.length
    ? activities.map((event) => (
      `<li><span class="activity-dot ${event.kind === 'request-info' ? 'alert' : ''}"></span><div><b>${escapeHtml(event.code)} · ${escapeHtml(event.by)}</b><p>${escapeHtml(event.note)}</p><small>${formatDate(event.at)}</small></div></li>`
    )).join('')
    : '<li><span class="activity-dot"></span><div><b>Belum ada perubahan</b><p>Riwayat perubahan aduan akan muncul di sini.</p></div></li>';
}

function renderDashboardReport(cases) {
  const filtered = filteredDashboardCases(cases);
  renderTrendChart(cases);
  renderDashboardHistory(filtered);
}

async function exportDashboardReport(event) {
  const button = event.currentTarget;
  const params = new URLSearchParams();
  ['from', 'to'].forEach((key) => {
    const value = $(`report-${key}`)?.value || '';
    if (value) params.set(key, value);
  });

  setLoading(button, true, 'Menyiapkan Excel…');
  try {
    const response = await fetch(`/api/staff/complaints/report.xlsx?${params}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    });
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const error = new Error(payload?.message || 'Laporan Excel gagal dibuat.');
      error.status = response.status;
      if (sessionExpired(error)) return;
      throw error;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-aduan-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Laporan Excel berhasil diunduh.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setLoading(button, false);
  }
}

async function refreshStaffComplaints() {
  if (!currentSession() || staffRefreshInFlight) return;
  staffRefreshInFlight = true;
  try {
    const latest = (await apiRequest('/staff/complaints', { cache: 'no-store' })).map(normalizeTicket);
    if (!staffCodesInitialized) {
      knownStaffComplaintCodes = new Set(latest.map((ticket) => ticket.code));
      staffCodesInitialized = true;
      staffTickets = latest;
      renderDashboard();
      return;
    }

    const newComplaints = latest.filter((ticket) => !knownStaffComplaintCodes.has(ticket.code));
    latest.forEach((ticket) => knownStaffComplaintCodes.add(ticket.code));
    staffTickets = latest;
    staffCaseDetails.clear();
    renderDashboard();

    if (newComplaints.length) {
      const newCodes = newComplaints.slice(0, 3).map((ticket) => ticket.code).join(', ');
      const remaining = newComplaints.length - Math.min(newComplaints.length, 3);
      const message = `${newComplaints.length} aduan baru masuk: ${newCodes}${remaining ? `, dan ${remaining} lainnya` : ''}.`;
      toast(message, 'info', 9000);
      if (activeWorkspaceView === 'cases') renderCaseEditor();
    }
  } catch (error) {
    if (!sessionExpired(error)) console.error('Gagal memperbarui daftar aduan petugas:', error.message);
  } finally {
    staffRefreshInFlight = false;
  }
}

function filteredStaffCases(cases) {
  const status = $('filter-status')?.value || 'all';
  const priority = $('filter-priority')?.value || 'all';

  return cases.filter((ticket) => {
    const statusMatch =
      status === 'all' ||
      (status === 'open' && !isClosed(ticket)) ||
      (status === 'late' && isLate(ticket)) ||
      (status === 'closed' && isClosed(ticket));
    const priorityMatch = priority === 'all' || ticket.priority === priority;
    return statusMatch && priorityMatch;
  });
}

function renderStaffTable(cases = accessibleTickets()) {
  const rows = $('staff-rows');
  if (!rows) return;

  const user = currentSession();
  const visible = filteredStaffCases(cases).sort(
    (a, b) => Number(isClosed(a)) - Number(isClosed(b)) || String(b.at || '').localeCompare(String(a.at || '')),
  );
  const availableCodes = new Set(cases.map((ticket) => ticket.code));
  selectedBulkTicketCodes = new Set([...selectedBulkTicketCodes].filter((code) => availableCodes.has(code)));

  rows.innerHTML = visible.length
    ? visible
        .map(
          (ticket) =>
            `<tr data-staff-code="${escapeHtml(ticket.code)}" tabindex="0" class="${isLate(ticket) ? 'is-late' : ''}"><td class="select-col"><input type="checkbox" data-select-ticket="${escapeHtml(ticket.code)}" ${selectedBulkTicketCodes.has(ticket.code) ? 'checked' : ''} aria-label="Pilih aduan ${escapeHtml(ticket.code)}"></td><td><b>${escapeHtml(ticket.code)}</b><small>${escapeHtml(ticket.loc)}</small><span class="row-unit">${escapeHtml(ticket.unit || '-')}</span></td><td><span class="pill ${statusClass(ticket)}">${escapeHtml(trackingStatus(ticket))}</span></td><td><span class="priority-tag ${priorityClass(ticket.priority)}">${priorityLabel(ticket.priority)}</span></td><td class="due-cell">${escapeHtml(dueLabel(ticket))}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="empty-state">Tidak ada aduan yang cocok dengan filter.</td></tr>';

  const visibleAllSelected = visible.length > 0 && visible.every((ticket) => selectedBulkTicketCodes.has(ticket.code));
  const anySelected = visible.some((ticket) => selectedBulkTicketCodes.has(ticket.code));

  ['staff-header-select', 'staff-select-all'].forEach((id) => {
    const checkbox = $(id);
    if (!checkbox) return;
    checkbox.checked = visibleAllSelected;
    checkbox.indeterminate = !visibleAllSelected && anySelected;
  });

  const deleteSelected = $('delete-selected');
  if (deleteSelected) {
    deleteSelected.disabled = selectedBulkTicketCodes.size === 0;
    deleteSelected.textContent = selectedBulkTicketCodes.size
      ? `Hapus terpilih (${selectedBulkTicketCodes.size})`
      : 'Hapus terpilih';
  }

  fillStaffSelect(cases);
}

function fillStaffSelect(cases = accessibleTickets()) {
  const select = $('s-t');
  if (!select) return;

  const ordered = [...cases].sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  if (!ordered.length) {
    staffCaseRequest += 1;
    select.innerHTML = '<option value="">Tidak ada aduan untuk unit ini</option>';
    selectedTicketCode = '';
    $('f-staff').hidden = true;
    $('case-detail').hidden = true;
    const help = $('case-help');
    if (help) help.textContent = 'Tidak ada aduan yang dapat diakses.';
    return;
  }

  $('f-staff').hidden = false;
  select.innerHTML = ordered
    .map(
      (ticket) =>
        `<option value="${escapeHtml(ticket.code)}">${escapeHtml(ticket.code)} · ${escapeHtml(ticket.cat)} · ${escapeHtml(trackingStatus(ticket))}</option>`,
    )
    .join('');

  const selected = ordered.some((ticket) => ticket.code === selectedTicketCode)
    ? selectedTicketCode
    : ordered.find((ticket) => !isClosed(ticket))?.code || ordered[0].code;

  selectedTicketCode = selected;
  select.value = selected;
  renderCaseEditor();
}

async function renderCaseEditor() {
  const user = currentSession();
  const select = $('s-t');
  const detail = $('case-detail');
  if (!select || !detail) return;

  const code = select.value;
  const requestId = ++staffCaseRequest;
  let ticket = staffCaseDetails.get(code);
  if (!ticket) {
    const summary = staffTickets.find((item) => item.code === code);
    if (!summary) return;
    $('f-staff').hidden = true;
    detail.hidden = false;
    detail.innerHTML = '<p class="hint">Memuat detail aduan dan bukti foto…</p>';
    try {
      const payload = await apiRequest(`/staff/complaints/${encodeURIComponent(code)}`);
      if (requestId !== staffCaseRequest || select.value !== code) return;
      ticket = normalizeTicket(payload);
      staffCaseDetails.set(code, ticket);
      const index = staffTickets.findIndex((item) => item.code === code);
      if (index >= 0) staffTickets[index] = ticket;
    } catch (error) {
      if (requestId !== staffCaseRequest || select.value !== code) return;
      if (sessionExpired(error)) return;
      detail.hidden = false;
      detail.innerHTML = `<p class="msg">${escapeHtml(error.message)}</p>`;
      return;
    }
  }
  if (requestId !== staffCaseRequest || select.value !== code) return;

  selectedTicketCode = ticket.code;
  const closed = isClosed(ticket);
  $('f-staff').hidden = closed;
  $('s-priority').value = ticket.priority;
  $('s-unit').value = ticket.unit;
  $('s-unit').disabled = user?.role !== 'admin';

  const stage = baseStatus(ticket);
  const nextStage = stage + 1;
  const options = nextStage >= 0 && nextStage <= 3
    ? `<option value="${nextStage}">${ST[nextStage]}</option>`
    : '';
  $('s-st').innerHTML = `${options}<option value="-1">Tolak aduan</option>`;
  $('s-st').required = true;
  updateStaffNoteField();

  const help = $('case-help');
  if (help) {
    help.textContent = closed
      ? `${ticket.code} · aduan sudah ditutup`
      : `${ticket.code} · target ${targetDays(ticket)} hari · ${ticket.unit}`;
  }

  const evidence = evidenceMarkup(ticket.attachments);
  const internalNotes = ticket.log
    .filter((entry) => entry.visibility === 'internal')
    .map(
      (entry) =>
        `<li><b>${escapeHtml(ST[entry.s] || 'Catatan petugas')}</b><small>${formatDate(entry.at)} · ${escapeHtml(entry.by)}</small><p>${escapeHtml(entry.note)}</p></li>`,
    )
    .join('');

  const photoText = evidence
    ? `<div class="evidence-box">${evidence}</div>`
    : '<p class="hint">Belum ada foto bukti.</p>';

  const emailLine = ticket.email
    ? `<br><b>Email:</b> <a href="mailto:${escapeHtml(ticket.email)}">${escapeHtml(ticket.email)}</a>`
    : '';

  detail.hidden = false;
  detail.innerHTML = `<p>${escapeHtml(ticket.text)}</p><p class="reporter-private"><b>Pelapor:</b> ${escapeHtml(ticket.name || 'Tidak mencantumkan nama')}${emailLine}</p><div class="case-tags"><span class="priority-tag ${priorityClass(ticket.priority)}">${priorityLabel(ticket.priority)}</span><span class="unit-tag">${escapeHtml(ticket.unit)}</span></div>${photoText}${internalNotes ? `<details class="internal-history"><summary>Catatan internal petugas</summary><ol>${internalNotes}</ol></details>` : ''}`;
}

function renderActivity(cases) {
  const list = $('activity-list');
  if (!list) return;

  const activities = cases
    .flatMap((ticket) => ticket.audit
      .filter((event) => event.kind !== 'rating')
      .map((event) => ({ ...event, code: ticket.code })))
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, 10);

  const lastSeen = Number(localStorage.getItem(SEEN_KEY) || 0);
  const unread = cases.filter((ticket) => new Date(ticket.at).getTime() > lastSeen).length;
  const count = $('notification-count');
  if (count) count.textContent = `${unread} aduan baru`;
  const dashboardCount = $('dashboard-notification-count');
  if (dashboardCount) dashboardCount.textContent = `${unread} aduan baru`;

  list.innerHTML = activities.length
    ? activities
        .map(
          (event) =>
            `<li><span class="activity-dot ${event.kind === 'request-info' ? 'alert' : ''}"></span><div><b>${escapeHtml(event.code)} · ${escapeHtml(event.by)}</b><p>${escapeHtml(event.note)}</p><small>${formatDate(event.at)}</small></div></li>`,
        )
        .join('')
    : '<li><span class="activity-dot"></span><div><b>Belum ada aktivitas</b><p>Perubahan pada aduan akan muncul di sini.</p></div></li>';
}

/* ─── Maps & geolocation ─── */
let publicMap = null;
let pickerMap = null;
let statisticsMap = null;
let pickerMarker = null;
let userLocation = readStoredLocation();
let locationRequest = null;

function readStoredLocation() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCATION_KEY) || 'null');
    if (Array.isArray(value) && value.length === 2) {
      const lat = Number(value[0]);
      const lng = Number(value[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        return [lat, lng];
      }
    }
  } catch {
    /* Abaikan lokasi tersimpan yang rusak. */
  }
  return null;
}

function storeLocation(location) {
  try {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
  } catch {
    /* Lokasi tetap dipakai untuk sesi ini. */
  }
}

function requestUserLocation(force = false) {
  if (force) locationRequest = null;
  if (userLocation && !force) return Promise.resolve(userLocation);
  if (locationRequest) return locationRequest;
  if (!navigator.geolocation) {
    return Promise.reject(new Error('Browser tidak mendukung lokasi perangkat.'));
  }

  locationRequest = new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        userLocation = [coords.latitude, coords.longitude];
        storeLocation(userLocation);
        resolve(userLocation);
      },
      () => reject(new Error('Izin lokasi tidak diberikan.')),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 5 * 60 * 1000 },
    );
  }).catch((error) => {
    locationRequest = null;
    throw error;
  });

  return locationRequest;
}

async function primeUserLocation() {
  if (userLocation) {
    centerMapsOnUser();
    return;
  }

  try {
    if (!navigator.permissions) return;
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    if (permission.state !== 'granted') return;
    await requestUserLocation();
    centerMapsOnUser();
  } catch {
    /* Izin lokasi diminta saat peta dibuka. */
  }
}

function defaultCenter() {
  if (userLocation) return { center: userLocation, zoom: 15 };

  const points = tickets.filter((ticket) => Array.isArray(ticket.coordinates)).map((ticket) => ticket.coordinates);
  if (points.length) {
    const lat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
    const lng = points.reduce((sum, point) => sum + point[1], 0) / points.length;
    return { center: [lat, lng], zoom: 12 };
  }

  return { center: [-2.5489, 118.0149], zoom: 5 };
}

function tileUrl() {
  return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
}

function addTileLayer(map) {
  return L.tileLayer(tileUrl(), {
    maxZoom: 19,
    subdomains: 'abc',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
}

function makeMap(containerId, fallbackId) {
  const fallback = $(fallbackId);
  if (!window.L) {
    if (fallback) {
      fallback.hidden = false;
      fallback.textContent =
        'Peta memerlukan koneksi internet. Pelacakan dan pengiriman aduan tetap dapat digunakan.';
    }
    return null;
  }

  if (fallback) fallback.hidden = true;
  const view = defaultCenter();
  const map = L.map(containerId, { scrollWheelZoom: false, zoomControl: true }).setView(
    view.center,
    view.zoom,
  );
  map._tile = addTileLayer(map);
  return map;
}

function applyMapTheme() {
  [publicMap, pickerMap, statisticsMap].forEach((map) => {
    if (!map) return;
    if (map._tile) map.removeLayer(map._tile);
    map._tile = addTileLayer(map);
  });
}

function userIcon() {
  return L.divIcon({
    className: 'user-marker',
    html: '<span></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function drawUserMarker(map) {
  if (!map || !userLocation) return;
  if (map._userMarker) {
    map._userMarker.setLatLng(userLocation);
  } else {
    map._userMarker = L.marker(userLocation, {
      icon: userIcon(),
      interactive: false,
      zIndexOffset: 900,
    }).addTo(map);
  }
}

function centerMapsOnUser() {
  if (!userLocation) return;

  if (publicMap) {
    drawUserMarker(publicMap);
    publicMap.setView(userLocation, 15);
  }

  if (pickerMap) {
    drawUserMarker(pickerMap);
    pickerMap.setView(userLocation, 15);
  }
}

function ensurePublicMap() {
  if (!publicMap) {
    publicMap = makeMap('public-map', 'public-map-fallback');
    if (publicMap) publicMap.markers = L.layerGroup().addTo(publicMap);
  }
  if (publicMap) {
    window.requestAnimationFrame(() => {
      publicMap?.invalidateSize();
      renderPublicMap();
      window.setTimeout(() => publicMap?.invalidateSize(), 200);
    });
    requestUserLocation()
      .then(() => centerMapsOnUser())
      .catch(() => {
        /* Peta tetap memakai pusat default. */
      });
  }
}

function ensureStatisticsMap() {
  if (!statisticsMap) {
    statisticsMap = makeMap('statistics-map', 'statistics-map-fallback');
    if (statisticsMap) statisticsMap.markers = L.layerGroup().addTo(statisticsMap);
  }
  if (statisticsMap) {
    // Panggil invalidateSize dua kali: segera dan setelah layout selesai
    // supaya Leaflet mengukur container yang mungkin baru muncul di DOM
    window.requestAnimationFrame(() => {
      statisticsMap?.invalidateSize();
      renderStatisticsMap();
      window.setTimeout(() => statisticsMap?.invalidateSize(), 200);
    });
  }
}

function renderStatisticsMap() {
  if (!statisticsMap?.markers || !publicStatisticsData) return;
  statisticsMap.markers.clearLayers();
  const fallback = $('statistics-map-fallback');
  if (!publicStatisticsData.heatmap.length) {
    fallback.hidden = false;
    fallback.textContent = 'Belum ada area dengan minimal 3 aduan untuk ditampilkan.';
    const view = defaultCenter();
    statisticsMap.setView(view.center, view.zoom);
    return;
  }
  fallback.hidden = true;
  const points = [];
  publicStatisticsData.heatmap.forEach((cell) => {
    points.push(cell.coordinates);
    const radius = Math.min(26, 10 + Math.sqrt(cell.count) * 4);
    L.circleMarker(cell.coordinates, {
      radius,
      color: '#b45309',
      weight: 1,
      fillColor: '#f97316',
      fillOpacity: 0.36,
    }).bindPopup(`<b>${cell.count} aduan</b><br>Area agregat`).addTo(statisticsMap.markers);
  });
  if (points.length) statisticsMap.fitBounds(points, { maxZoom: 14, padding: [28, 28] });
  else {
    const view = defaultCenter();
    statisticsMap.setView(view.center, view.zoom);
  }
}

function renderPublicMap() {
  if (!publicMap || !publicMap.markers) return;

  publicMap.markers.clearLayers();
  const points = [];

  tickets.forEach((ticket) => {
    if (!Array.isArray(ticket.coordinates) || ticket.coordinates.length !== 2) return;
    points.push(ticket.coordinates);

    const color = ticket.priority === 'urgent' ? '#cf523d' : ticket.priority === 'high' ? '#e89a4c' : '#0e8a5f';
    const fill = ticket.priority === 'urgent' ? '#f6b3a4' : ticket.priority === 'high' ? '#f5cf9f' : '#9fe3c6';

    const marker = L.circleMarker(ticket.coordinates, {
      radius: ticket.priority === 'urgent' ? 9 : 7,
      color,
      fillColor: fill,
      fillOpacity: 0.95,
      weight: 2,
    });
    marker.bindPopup(
      `<b>${escapeHtml(ticket.code)}</b><br>${escapeHtml(ticket.cat)}<br>${escapeHtml(trackingStatus(ticket))}`,
    );
    marker.addTo(publicMap.markers);
  });

  drawUserMarker(publicMap);

  if (userLocation) {
    publicMap.setView(userLocation, 15);
  } else if (points.length) {
    publicMap.fitBounds(points, { maxZoom: 14, padding: [30, 30] });
  } else {
    const view = defaultCenter();
    publicMap.setView(view.center, view.zoom);
  }
}

function ensurePickerMap() {
  if (!pickerMap) {
    pickerMap = makeMap('location-picker', 'picker-fallback');
    if (!pickerMap) return;
    pickerMap.on('click', (event) => {
      setPickerLocation(event.latlng.lat, event.latlng.lng);
      lookupAddressForPoint(event.latlng.lat, event.latlng.lng);
    });
    drawUserMarker(pickerMap);
  }

  window.requestAnimationFrame(() => pickerMap?.invalidateSize());

  const lat = Number($('n-lat')?.value);
  const lng = Number($('n-lng')?.value);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat && lng) {
    placePickerMarker(lat, lng);
  }

  requestUserLocation()
    .then(() => {
      if (!pickerMap) return;
      drawUserMarker(pickerMap);
      if (!pickerMarker) pickerMap.setView(userLocation, 15);
    })
    .catch(() => {
      /* Peta tetap memakai pusat default. */
    });
}

function placePickerMarker(latitude, longitude) {
  const point = [latitude, longitude];
  if (!pickerMap) return;
  if (!pickerMarker) pickerMarker = L.marker(point).addTo(pickerMap);
  else pickerMarker.setLatLng(point);
}

function setPickerLocation(latitude, longitude) {
  $('n-lat').value = Number(latitude).toFixed(6);
  $('n-lng').value = Number(longitude).toFixed(6);
  if (!pickerMap) return;
  placePickerMarker(latitude, longitude);
  pickerMap.setView([latitude, longitude], Math.max(pickerMap.getZoom(), 15));
}

function roundPublicPoint(latitude, longitude) {
  return [Number(Number(latitude).toFixed(3)), Number(Number(longitude).toFixed(3))];
}

async function locateUser() {
  const button = $('locate-me');
  if (!button) return;

  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = 'Mencari lokasi…';

  try {
    const location = await requestUserLocation(true);
    addressLookupSequence += 1;
    window.clearTimeout(addressLookupTimer);
    setPickerLocation(location[0], location[1]);
    const address = await reverseGeocodeLocation(location[0], location[1]);
    if (address) $('n-loc').value = address;
    centerMapsOnUser();
    toast(address ? 'Lokasi perangkat berhasil digunakan, alamat otomatis terisi.' : 'Lokasi perangkat berhasil digunakan.', 'success');
  } catch {
    const error = $('n-err');
    if (error) error.textContent = 'Lokasi tidak tersedia. Pilih titik langsung pada peta.';
    toast('Lokasi tidak tersedia. Silakan pilih titik pada peta.', 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
}

/* ─── Evidence ─── */
async function compressImage(file) {
  if (!file) return null;
  const isHeic = /^image\/hei[cf](?:-sequence)?$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
  if (!isHeic && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Format foto belum didukung. Pilih JPG, PNG, WebP, atau HEIC.');
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('Ukuran foto maksimal 10 MB sebelum dikompres.');

  let imageFile = file;
  if (isHeic) {
    if (typeof window.heic2any !== 'function') {
      throw new Error('Konverter HEIC belum siap. Muat ulang halaman atau pilih foto JPG/PNG.');
    }
    const converted = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
    if (!(convertedBlob instanceof Blob)) throw new Error('Foto HEIC gagal dikonversi.');
    imageFile = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
      type: 'image/jpeg',
    });
  }

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Foto gagal dibaca.'));
    reader.readAsDataURL(imageFile);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Foto gagal diproses.'));
    img.src = source;
  });

  let scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Foto gagal diproses.');

  for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (let quality = 0.78; quality >= 0.48; quality -= 0.1) {
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error('Foto gagal diproses.'))),
          'image/jpeg',
          quality,
        );
      });
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Foto gagal dibaca.'));
        reader.readAsDataURL(blob);
      });

      if (typeof dataUrl === 'string' && dataUrl.length <= 2_800_000) return dataUrl;
    }

    scale *= 0.8;
  }

  throw new Error('Foto terlalu besar untuk dikirim. Pilih gambar lain atau perkecil foto.');
}

/* ─── Compose ─── */
function resetCompose() {
  const form = $('f-new');
  if (form) {
    form.reset();
    form.hidden = false;
  }
  complaintEvidenceSelection = null;
  complaintEvidencePreviewSequence += 1;
  $('n-captcha-container').hidden = true;
  $('n-captcha-token').value = '';
  $('n-captcha-answer').value = '';
  $('n-captcha-error').textContent = '';
  const made = $('made');
  if (made) made.hidden = true;
  if ($('n-lat')) $('n-lat').value = '';
  if ($('n-lng')) $('n-lng').value = '';
  if ($('n-err')) $('n-err').textContent = '';
  if ($('n-file-label')) $('n-file-label').textContent = 'JPG/PNG/WebP/HEIC, otomatis dikompres';
  if ($('n-evidence-preview')) $('n-evidence-preview').hidden = true;
  if ($('n-evidence-preview-image')) $('n-evidence-preview-image').removeAttribute('src');
  if ($('n-evidence-preview-status')) $('n-evidence-preview-status').textContent = '';
  if (pickerMarker) {
    pickerMarker.remove();
    pickerMarker = null;
  }
}

function renderMade(ticket, emailDelivery, recipientEmail) {
  const made = $('made');
  if (!made) return;

  const emailSent = emailDelivery?.sent === true;
  const heading = emailSent ? 'Catat nomor ini.' : 'Aduan tersimpan.';
  const label = emailSent ? 'Aduan terkirim' : 'Email konfirmasi diperlukan';
  const emailNotice = emailSent
    ? `<div class="email-delivery email-delivery--sent"><span class="email-delivery-icon" aria-hidden="true">✓</span><span><b>Konfirmasi terkirim ke email</b><small>${escapeHtml(recipientEmail)}</small></span></div>`
    : `<div class="email-delivery email-delivery--failed"><span class="email-delivery-icon" aria-hidden="true">!</span><span><b>Email konfirmasi belum terkirim</b><small>Gunakan tombol kirim ulang. Aduan tidak perlu dikirim ulang.</small></span></div>`;
  const resendButton = emailSent
    ? ''
    : '<button class="btn btn-dark" id="m-resend" type="button">Kirim ulang email</button>';

  made.hidden = false;
  made.innerHTML = `<span class="label-chip soft">${label}</span><h2>${heading}</h2><div class="slip"><div class="slip-h"><div><div class="slip-code-row"><div class="code">${escapeHtml(ticket.code)}</div><button class="btn btn-ghost slip-copy" id="m-cp" type="button">Salin</button></div><p class="meta">Simpan nomor ini untuk melacak perkembangan aduan.</p></div><div class="stamp s-go">Diterima</div></div></div>${emailNotice}<div class="done-actions">${resendButton}<button class="btn btn-ghost" id="m-go" type="button">Lihat progres</button><button class="btn btn-ghost" id="m-new" type="button">Buat aduan lain</button></div><p class="done-hint" id="m-h"></p>`;

  $('m-resend')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setLoading(button, true, 'Mengirim ulang…');
    try {
      await apiRequest(`/complaints/${encodeURIComponent(ticket.code)}/confirmation`, {
        method: 'POST',
        body: JSON.stringify({ email: recipientEmail }),
      });
      const notice = made.querySelector('.email-delivery');
      notice.className = 'email-delivery email-delivery--sent';
      notice.innerHTML = `<span class="email-delivery-icon" aria-hidden="true">✓</span><span><b>Konfirmasi terkirim ke email</b><small>${escapeHtml(recipientEmail)}</small></span>`;
      made.querySelector('.label-chip').textContent = 'Aduan terkirim';
      made.querySelector('h2').textContent = 'Catat nomor ini.';
      button.remove();
      $('m-h').textContent = 'Email konfirmasi berhasil dikirim.';
      toast('Email konfirmasi berhasil dikirim.', 'success');
    } catch (error) {
      $('m-h').textContent = error.message;
      toast(error.message, 'error');
    } finally {
      if (button.isConnected) setLoading(button, false);
    }
  });

  $('m-cp')?.addEventListener('click', async () => {
    const button = $('m-cp');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(ticket.code);
      } else {
        const copyField = document.createElement('textarea');
        copyField.value = ticket.code;
        copyField.setAttribute('readonly', '');
        copyField.style.position = 'fixed';
        copyField.style.opacity = '0';
        document.body.append(copyField);
        let copied;
        try {
          copyField.select();
          copied = document.execCommand('copy');
        } finally {
          copyField.remove();
        }
        if (!copied) throw new Error('Penyalinan tidak didukung browser ini.');
      }
      button.textContent = 'Tersalin';
      $('m-h').textContent = 'Nomor tersalin.';
      toast('Nomor aduan tersalin.', 'success');
    } catch {
      $('m-h').textContent = `Nomor belum bisa disalin. Silakan salin manual: ${ticket.code}`;
    }
  });

  $('m-go')?.addEventListener('click', () => {
    tab('lacak');
    showTicket(ticket.code);
  });

  $('m-new')?.addEventListener('click', resetCompose);
  made.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
}

async function submitNewTicket(event) {
  event.preventDefault();
  const error = $('n-err');
  const submit = $('submit-complaint');
  error.textContent = '';

  const latitudeText = $('n-lat').value.trim();
  const longitudeText = $('n-lng').value.trim();

  if (Boolean(latitudeText) !== Boolean(longitudeText)) {
    error.textContent = 'Pilih titik peta secara lengkap atau kosongkan koordinat.';
    return;
  }

  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (latitudeText && (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)) {
    error.textContent = 'Koordinat lokasi tidak valid.';
    return;
  }

  const email = $('n-email').value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.textContent = 'Email wajib diisi dengan format yang valid.';
    $('n-email').focus();
    return;
  }

  const category = $('n-cat').value;
  const coordinates = latitudeText && longitudeText ? roundPublicPoint(latitude, longitude) : null;
  const complaintText = $('n-text').value.trim();
  if (!complaintText) {
    error.textContent = 'Jelaskan kejadian yang Anda alami agar petugas dapat menilai dengan cepat.';
    $('n-text').focus();
    return;
  }

  const captchaContainer = $('n-captcha-container');
  const captchaToken = $('n-captcha-token').value;
  const captchaAnswer = $('n-captcha-answer').value.trim();
  if (!captchaToken) {
    captchaContainer.hidden = false;
    if (await loadMathChallenge()) $('n-captcha-answer').focus();
    return;
  }
  if (!captchaAnswer) {
    $('n-captcha-error').textContent = 'Jawab soal matematika sebelum mengirim aduan.';
    $('n-captcha-answer').focus();
    return;
  }

  let evidence = null;
  try {
    const file = $('n-evidence').files[0];
    const selection = complaintEvidenceSelection;
    evidence = file
      ? await (selection?.file === file ? selection.promise : compressImage(file))
      : null;
  } catch (reason) {
    error.textContent = reason.message;
    return;
  }

  const payload = {
    cat: category,
    loc: $('n-loc').value.trim(),
    text: complaintText,
    name: $('n-name').value.trim(),
    email,
    priority: $('n-severity').value,
    coordinates,
    evidence,
    captchaToken,
    captchaAnswer,
  };

  setLoading(submit, true, 'Mengirim aduan…');

  let created;
  try {
    const response = await apiRequest('/complaints', { method: 'POST', body: JSON.stringify(payload) });
    if (response?.emailDelivery?.sent !== true) {
      throw Object.assign(new Error('Email konfirmasi belum berhasil dikirim.'), {
        code: 'EMAIL_DELIVERY_FAILED',
        payload: { complaintSaved: true, complaintCode: response?.code },
      });
    }
    created = normalizeTicket(response);
  } catch (apiError) {
    if (apiError.code === 'EMAIL_DELIVERY_FAILED' && apiError.payload?.complaintSaved && apiError.payload?.complaintCode) {
      created = normalizeTicket({
        ...payload,
        code: apiError.payload.complaintCode,
        at: nowIso(),
        waitingForInfo: false,
        log: [{ s: 0, at: nowIso(), by: 'Sistem', note: 'Aduan diterima.' }],
      });
      tickets.push(created);
      $('f-new').hidden = true;
      renderBoard();
      renderMade(created, { sent: false }, email);
      toast(apiError.message, 'error', 7000);
      return;
    }
    error.textContent = apiError.message;
    await loadMathChallenge();
    toast(apiError.message, 'error');
    return;
  } finally {
    setLoading(submit, false);
  }

  tickets.push(created);
  $('f-new').hidden = true;
  renderBoard();
  renderMade(created, { sent: true }, email);
  toast('Aduan terkirim dan nomor aduan telah dikirim ke email Anda.', 'success', 6000);
}

/* ─── Auth ─── */
async function submitLogin(event) {
  event.preventDefault();
  const error = $('login-error');
  const submit = $('login-submit');
  error.textContent = '';

  setLoading(submit, true, 'Memeriksa akun…');
  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: $('login-user').value.trim(),
        password: $('login-pass').value,
      }),
    });

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
    rememberSession();
    staffCaseDetails.clear();
    staffTickets = (await apiRequest('/staff/complaints')).map(normalizeTicket);
    knownStaffComplaintCodes = new Set(staffTickets.map((ticket) => ticket.code));
    staffCodesInitialized = true;
    $('f-login').reset();
    setStaffView();
    toast(`Selamat datang, ${result.user.name || 'Petugas'}.`, 'success');
  } catch (loginError) {
    clearSession();
    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    error.textContent = loginError.message;
    setStaffView();
  } finally {
    setLoading(submit, false);
  }
}

async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch {
    /* Cookie tetap dibersihkan di klien. */
  }

  clearSession();
  tickets = await loadPublicTickets();
  setStaffView();
  renderBoard();
  tab('petugas');
  toast('Anda telah keluar.', 'info');
}

/* ─── Staff dashboard actions ─── */
function mergePublicTicket(updated) {
  const index = tickets.findIndex((item) => item.code === updated.code);
  if (index < 0) return;

  const publicLog = (updated.log || []).filter((entry) => entry.visibility !== 'internal');
  const attachments = [...(tickets[index].attachments || [])];
  const knownEvidence = new Set(attachments.map((attachment) => attachment.evidence));
  const addAttachment = (attachment) => {
    if (typeof attachment.evidence !== 'string' || knownEvidence.has(attachment.evidence)) return;
    knownEvidence.add(attachment.evidence);
    attachments.push(attachment);
  };
  if (typeof updated.evidence === 'string') {
    addAttachment({ evidence: updated.evidence, source: 'Bukti aduan', at: updated.at });
  }
  publicLog.forEach((entry) => {
    if (typeof entry.evidence !== 'string') return;
    addAttachment({
      evidence: entry.evidence,
      source: `Petugas · ${entry.by || 'Unit penanganan'}`,
      at: entry.at,
    });
  });
  (updated.attachments || [])
    .filter((attachment) => attachment.visibility !== 'internal')
    .forEach((attachment) => addAttachment({
      evidence: attachment.evidence,
      source: attachment.source,
      at: attachment.at,
    }));

  tickets[index] = normalizeTicket({
    code: updated.code,
    cat: updated.cat,
    loc: updated.loc,
    text: updated.text,
    at: updated.at,
    priority: updated.priority,
    unit: updated.unit,
    coordinates: updated.coordinates,
    log: publicLog,
    attachments,
  });
}

async function submitStaffAction(event) {
  event.preventDefault();
  const user = currentSession();
  const ticket = staffCaseDetails.get($('s-t').value)
    || staffTickets.find((item) => item.code === $('s-t').value);
  const message = $('smsg');
  message.textContent = '';

  if (!user || !ticket || (user.role !== 'admin' && ticket.unit !== user.unit)) {
    message.textContent = 'Akun ini tidak memiliki akses ke aduan tersebut.';
    return;
  }
  if (isClosed(ticket)) {
    message.textContent = 'Aduan yang sudah ditutup tidak dapat diubah.';
    return;
  }

  const operation = event.submitter?.value || 'update';
  const statusValue = operation === 'update' ? Number($('s-st').value) : null;
  const rejecting = operation === 'update' && statusValue === -1;
  const note = (rejecting ? $('s-rejection-reason').value : $('s-note').value).trim();
  const visibility = $('s-visibility').value;

  if (!['public', 'internal'].includes(visibility)) {
    message.textContent = 'Pilih visibilitas catatan.';
    return;
  }
  if (operation === 'update' && !Number.isInteger(statusValue)) {
    message.textContent = 'Pilih status tindak lanjut.';
    return;
  }
  if (note.length > 2000) {
    message.textContent = 'Catatan tindak lanjut maksimal 2.000 karakter.';
    return;
  }
  if (!note) {
    message.textContent = statusValue === -1
      ? 'Alasan penolakan wajib diisi.'
      : 'Catatan tindak lanjut wajib diisi.';
    (rejecting ? $('s-rejection-reason') : $('s-note')).focus();
    return;
  }

  let evidence = null;
  try {
    const file = $('staff-evidence').files[0];
    evidence = file
      ? await (staffEvidenceSelection?.file === file ? staffEvidenceSelection.promise : compressImage(file))
      : null;
  } catch (reason) {
    message.textContent = reason.message;
    return;
  }

  const submitter = event.submitter;
  setLoading(submitter, true, 'Menyimpan…');

  try {
    const updated = await apiRequest(`/staff/complaints/${ticket.code}`, {
      method: 'PATCH',
      body: JSON.stringify({
        operation,
        note,
        rejectionReason: rejecting ? note : undefined,
        visibility,
        status: statusValue,
        priority: $('s-priority').value,
        unit: user.role === 'admin' ? $('s-unit').value : undefined,
        evidence: evidence || null,
      }),
    });

    const normalized = normalizeTicket(updated);
    const index = staffTickets.findIndex((item) => item.code === normalized.code);
    if (index >= 0) staffTickets[index] = normalized;
    staffCaseDetails.set(normalized.code, normalized);
    mergePublicTicket(normalized);

    $('s-note').value = '';
    $('s-rejection-reason').value = '';
    $('s-visibility').value = 'public';
    $('staff-evidence').value = '';
    staffEvidenceSelection = null;
    staffEvidencePreviewSequence += 1;
    $('staff-evidence-preview').hidden = true;
    $('staff-evidence-preview-image').removeAttribute('src');
    $('staff-evidence-preview-status').textContent = '';
    const updateMessage = 'Pembaruan tersimpan dan dapat dilihat warga melalui nomor aduan.';
    const emailSent = updated.emailNotification?.sent === true;
    $('smsg').textContent = emailSent
      ? `${updateMessage} Email pemberitahuan juga terkirim kepada pengadu.`
      : `${updateMessage} Namun, email pemberitahuan gagal dikirim. Periksa konfigurasi email.`;
    toast(
      emailSent
        ? 'Pembaruan dan email pemberitahuan terkirim.'
        : 'Pembaruan tersimpan, tetapi email pemberitahuan gagal dikirim.',
      emailSent ? 'success' : 'error',
    );
    renderBoard();
    renderDashboard();
    renderCaseEditor();
  } catch (error) {
    if (sessionExpired(error)) return;
    message.textContent = error.message;
    toast(error.message, 'error');
  } finally {
    setLoading(submitter, false);
  }
}

function updateStaffNoteField() {
  const rejected = $('s-st')?.value === '-1';
  const label = $('s-note-label');
  const note = $('s-note');
  const noteField = $('s-note-field');
  const reasonField = $('s-rejection-field');
  const reason = $('s-rejection-reason');
  const visibilityField = $('s-visibility-field');
  const visibility = $('s-visibility');
  if (!label || !note || !noteField || !reasonField || !reason || !visibilityField || !visibility) return;

  label.textContent = 'Catatan tindak lanjut';
  noteField.hidden = rejected;
  reasonField.hidden = !rejected;
  note.required = !rejected;
  reason.required = rejected;
  reason.setAttribute('aria-required', String(rejected));
  visibilityField.hidden = rejected;
  visibility.disabled = rejected;
  if (rejected) visibility.value = 'public';
  note.placeholder = 'Jelaskan tindakan atau keputusan tindak lanjut.';
}

function openDeleteModal() {
  const user = currentSession();
  if (!user || user.role !== 'admin') {
    $('smsg').textContent = 'Hanya admin yang dapat menghapus aduan.';
    return;
  }

  const ticket = staffTickets.find((item) => item.code === $('s-t').value);
  const selectedCodes = ticket ? [ticket.code] : [];
  if (!selectedCodes.length) {
    $('smsg').textContent = 'Pilih aduan yang ingin dihapus.';
    return;
  }

  deleteTargetCodes = selectedCodes;
  $('delete-modal-text').textContent =
    selectedCodes.length === 1
      ? `Apakah Anda yakin ingin menghapus aduan ${selectedCodes[0]}? Tindakan ini permanen dan tidak dapat dibatalkan.`
      : `Apakah Anda yakin ingin menghapus ${selectedCodes.length} aduan yang dipilih? Tindakan ini permanen dan tidak dapat dibatalkan.`;
  $('delete-modal').hidden = false;
}

function closeDeleteModal() {
  $('delete-modal').hidden = true;
  deleteTargetCodes = [];
}

async function executeDeleteTicket() {
  const user = currentSession();
  const confirm = $('confirm-delete');
  if (!user || user.role !== 'admin') {
    $('smsg').textContent = 'Hanya admin yang dapat menghapus aduan.';
    closeDeleteModal();
    return;
  }

  const codes = deleteTargetCodes.length
    ? [...deleteTargetCodes]
    : $('s-t').value
      ? [$('s-t').value]
      : [];
  if (!codes.length) {
    $('smsg').textContent = 'Pilih aduan yang ingin dihapus.';
    closeDeleteModal();
    return;
  }

  setLoading(confirm, true, 'Menghapus…');
  let result;
  try {
    result = await apiRequest('/staff/complaints', {
      method: 'DELETE',
      body: JSON.stringify({ codes }),
    });
    if (!Array.isArray(result?.deletedCodes)) {
      throw new Error('Respons penghapusan tidak valid. Muat ulang daftar aduan.');
    }
  } catch (error) {
    if (sessionExpired(error)) {
      closeDeleteModal();
      return;
    }
    $('smsg').textContent = error.message;
    toast(error.message, 'error');
    closeDeleteModal();
    return;
  } finally {
    setLoading(confirm, false);
  }

  const deletedCodes = result.deletedCodes;
  if (!deletedCodes.length) {
    selectedBulkTicketCodes.clear();
    $('smsg').textContent = 'Aduan yang dipilih tidak ditemukan atau sudah dihapus.';
    toast($('smsg').textContent, 'error');
    closeDeleteModal();
    renderDashboard();
    return;
  }

  staffTickets = staffTickets.filter((ticket) => !deletedCodes.includes(ticket.code));
  deletedCodes.forEach((code) => staffCaseDetails.delete(code));
  tickets = tickets.filter((ticket) => !deletedCodes.includes(ticket.code));
  selectedBulkTicketCodes = new Set();
  deleteTargetCodes = [];
  selectedTicketCode = '';
  closeDeleteModal();
  $('smsg').textContent = `${deletedCodes.length} aduan berhasil dihapus.`;
  toast(`${deletedCodes.length} aduan dihapus.`, 'success');
  renderBoard();
  renderDashboard();
}

/* ─── Staff management (admin) ─── */
async function renderStaffDirectory() {
  const user = currentSession();
  const list = $('staff-directory-list');
  if (!list || user?.role !== 'admin') return;

  try {
    const data = await apiRequest('/auth/staffs');
    if (!Array.isArray(data) || !data.length) {
      list.innerHTML = '<li class="empty-row">Belum ada petugas yang terdaftar.</li>';
      return;
    }

    list.innerHTML = data
      .map((staff) => {
        const status = staff.registered ? 'Terdaftar' : 'Belum dibuat';
        const accountIdentifier = staff.username || staff.email;
        const removeButton = staff.role === 'petugas'
          ? `<button class="btn btn-danger btn-small" type="button" data-delete-staff="${escapeHtml(staff.email)}" data-staff-label="${escapeHtml(accountIdentifier)}" aria-label="Hapus akun ${escapeHtml(staff.name || accountIdentifier)}">Hapus akun</button>`
          : '';
        const editButton = staff.role === 'petugas'
          ? `<button class="btn btn-ghost btn-small" type="button" data-edit-staff="${escapeHtml(staff.email)}" data-staff-identifier="${escapeHtml(accountIdentifier)}" data-staff-name="${escapeHtml(staff.name || '')}" data-staff-unit="${escapeHtml(staff.unit || '')}" data-staff-registered="${staff.registered ? 'true' : 'false'}">Ubah</button>`
          : '';
        return `<li class="staff-row"><div class="staff-row-info"><strong>${escapeHtml(staff.name || accountIdentifier || 'Petugas')}</strong><small>${staff.username ? `Username: ${escapeHtml(staff.username)}` : escapeHtml(staff.email || '')}</small><small>${escapeHtml(staff.unit || 'Unit belum ditetapkan')}</small></div><div class="staff-row-actions"><span class="staff-status ${staff.registered ? 'ready' : 'pending'}">${status}</span>${editButton}${removeButton}</div></li>`;
      })
      .join('');
  } catch (error) {
    if (sessionExpired(error)) return;
    list.innerHTML = `<li class="empty-row">${escapeHtml(error.message)}</li>`;
  }
}

function openStaffEdit(button) {
  const registered = button.dataset.staffRegistered === 'true';
  $('edit-staff-original-email').value = button.dataset.editStaff || '';
  $('edit-staff-name').value = button.dataset.staffName || '';
  $('edit-staff-email').value = button.dataset.staffIdentifier || button.dataset.editStaff || '';
  $('edit-staff-unit').value = button.dataset.staffUnit || '';
  $('edit-staff-password').value = '';
  $('edit-staff-password-field').hidden = !registered;
  $('edit-staff-pending').hidden = registered;
  $('edit-staff-error').textContent = '';
  $('staff-edit-modal').hidden = false;
  window.requestAnimationFrame(() => $('edit-staff-name').focus());
}

function closeStaffEdit() {
  $('staff-edit-modal').hidden = true;
  $('f-edit-staff').reset();
  $('edit-staff-error').textContent = '';
  $('edit-staff-error').classList.remove('success-msg');
}

async function submitStaffEdit(event) {
  event.preventDefault();
  const error = $('edit-staff-error');
  error.textContent = '';
  error.classList.remove('success-msg');

  const button = $('save-staff-edit');
  setLoading(button, true, 'Menyimpan…');
  try {
    const result = await apiRequest('/auth/staffs', {
      method: 'PATCH',
      body: JSON.stringify({
        originalEmail: $('edit-staff-original-email').value,
        name: $('edit-staff-name').value.trim(),
        identifier: $('edit-staff-email').value.trim(),
        unit: $('edit-staff-unit').value,
        password: $('edit-staff-password').value,
      }),
    });
    closeStaffEdit();
    toast(result?.message || 'Data petugas berhasil diperbarui.', 'success');
    await renderStaffDirectory();
  } catch (updateError) {
    if (sessionExpired(updateError)) return;
    error.textContent = updateError.message;
    toast(updateError.message, 'error');
  } finally {
    if (button.isConnected) setLoading(button, false);
  }
}

async function deleteStaffAccount(button) {
  const email = button.dataset.deleteStaff;
  const label = button.dataset.staffLabel || email;
  if (!email || !window.confirm(`Hapus akun petugas ${label}? Petugas tidak akan bisa masuk lagi.`)) return;

  setLoading(button, true, 'Menghapus…');
  try {
    const result = await apiRequest('/auth/staffs', {
      method: 'DELETE',
      body: JSON.stringify({ email }),
    });
    toast(result?.message || 'Akun petugas berhasil dihapus.', 'success');
    await renderStaffDirectory();
  } catch (error) {
    if (sessionExpired(error)) return;
    toast(error.message, 'error');
    await renderStaffDirectory();
  } finally {
    if (button.isConnected) setLoading(button, false);
  }
}

async function submitStaffRegistration(event) {
  event.preventDefault();
  const error = $('register-error');
  error.textContent = '';

  const payload = {
    name: $('register-name').value.trim(),
    identifier: $('register-identifier').value.trim(),
    unit: $('register-unit').value,
    role: 'petugas',
    password: $('register-pass').value,
  };

  const button = event.target.querySelector('button[type="submit"]');
  setLoading(button, true, 'Membuat akun…');

  try {
    const result = await apiRequest('/auth/staffs/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    $('f-register-staff').reset();
    error.textContent = result?.message || 'Akun petugas berhasil dibuat.';
    error.classList.add('success-msg');
    toast('Akun petugas berhasil dibuat.', 'success');
    await renderStaffDirectory();
  } catch (registrationError) {
    if (sessionExpired(registrationError)) return;
    error.textContent = registrationError.message;
    error.classList.remove('success-msg');
    toast(registrationError.message, 'error');
  } finally {
    setLoading(button, false);
  }
}

/* ─── Navigation ─── */
function closeMenu() {
  const header = $('site-header');
  const toggle = $('nav-toggle');
  header?.classList.remove('menu-open');
  toggle?.setAttribute('aria-expanded', 'false');
}

function tab(name) {
  closeMenu();

  $$('#main-nav button').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.tab === name));
  });

  ['beranda', 'lacak', 'buat', 'petugas'].forEach((section) => {
    const element = $(section);
    if (element) element.hidden = section !== name;
  });

  window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });

  if (name === 'lacak') ensurePublicMap();
  if (name === 'buat') {
    ensurePickerMap();
  }
  if (name === 'petugas') {
    setStaffView();
    if (currentSession()?.role === 'admin') renderStaffDirectory();
  }

  window.requestAnimationFrame(setupReveal);
}

/* ─── Reveal observer ─── */
function setupReveal() {
  const elements = $$('.reveal:not(.is-visible)');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window) || reducedMotion()) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        activeObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
  );

  elements.forEach((element) => observer.observe(element));
}

/* ─── Events ─── */
function bindEvents() {
  document.addEventListener('click', (event) => {
    const imageButton = event.target.closest('.evidence-link');
    if (imageButton) {
      const sourceImage = imageButton.querySelector('img');
      const preview = $('image-preview-image');
      if (sourceImage && preview) {
        preview.src = sourceImage.currentSrc || sourceImage.src;
        preview.alt = sourceImage.alt;
        $('image-preview-caption').textContent = imageButton.getAttribute('aria-label')?.replace('Perbesar foto: ', '') || 'Bukti aduan';
        $('image-preview-modal').hidden = false;
        $('image-preview-close').focus();
      }
    }

    if (event.target.closest('[data-close-image-preview]')) closeEvidencePreview();
  });

  $('image-preview-close')?.addEventListener('click', closeEvidencePreview);

  $$('#main-nav button').forEach((button) => {
    button.addEventListener('click', () => tab(button.dataset.tab));
  });

  $$('[data-go]').forEach((button) => {
    button.addEventListener('click', () => tab(button.dataset.go));
  });

  $('nav-toggle')?.addEventListener('click', () => {
    const header = $('site-header');
    const toggle = $('nav-toggle');
    const open = !header?.classList.contains('menu-open');
    header?.classList.toggle('menu-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('click', (event) => {
    const header = $('site-header');
    if (!header?.classList.contains('menu-open')) return;
    if (header.contains(event.target)) return;
    closeMenu();
  });

  window.addEventListener(
    'scroll',
    () => $('site-header')?.classList.toggle('is-scrolled', window.scrollY > 8),
    { passive: true },
  );

  $('sla-grid')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-sla-cat]');
    if (!card) return;
    tab('buat');
    if ($('made') && !$('made').hidden) resetCompose();
    $('n-cat').value = card.dataset.slaCat;
    $('n-loc').focus();
  });

  $('f-track')?.addEventListener('submit', (event) => {
    event.preventDefault();
    showTicket($('q').value);
  });

  $('q')?.addEventListener('input', (event) => {
    const position = event.target.selectionStart;
    event.target.value = event.target.value.toUpperCase();
    event.target.setSelectionRange(position, position);
  });

  $('rows')?.addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-code]');
    if (row) showTicket(row.dataset.code);
  });

  $('rows')?.addEventListener('keydown', (event) => {
    const row = event.target.closest('tr[data-code]');
    if (row && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      showTicket(row.dataset.code);
    }
  });

  $('f-new')?.addEventListener('submit', submitNewTicket);
  $('f-login')?.addEventListener('submit', submitLogin);
  $('f-register-staff')?.addEventListener('submit', submitStaffRegistration);
  $('f-edit-staff')?.addEventListener('submit', submitStaffEdit);
  $('staff-logout')?.addEventListener('click', logout);
  $('workspace-nav')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-workspace-view]');
    if (button) setWorkspaceView(button.dataset.workspaceView);
  });
  $('close-staff-edit')?.addEventListener('click', closeStaffEdit);
  $('cancel-staff-edit')?.addEventListener('click', closeStaffEdit);
  $('staff-edit-modal')?.addEventListener('click', (event) => {
    if (event.target.dataset.closeStaffEdit === 'true') closeStaffEdit();
  });

  $('n-evidence')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    const label = $('n-file-label');
    const preview = $('n-evidence-preview');
    const image = $('n-evidence-preview-image');
    const status = $('n-evidence-preview-status');
    const sequence = ++complaintEvidencePreviewSequence;
    complaintEvidenceSelection = null;
    if (label) label.textContent = file ? file.name : 'JPG/PNG/WebP/HEIC, otomatis dikompres';
    if (!file) {
      if (preview) preview.hidden = true;
      if (image) image.removeAttribute('src');
      if (status) status.textContent = '';
      return;
    }

    if (preview) preview.hidden = false;
    if (image) image.removeAttribute('src');
    if (status) {
      status.classList.remove('form-error');
      status.textContent = 'Menyiapkan pratinjau foto…';
    }
    const promise = compressImage(file);
    complaintEvidenceSelection = { file, promise };
    promise.then((evidence) => {
      if (sequence !== complaintEvidencePreviewSequence) return;
      if (image) image.src = evidence;
      if (status) status.textContent = 'Pratinjau foto yang akan dikirim.';
    }).catch((error) => {
      if (sequence !== complaintEvidencePreviewSequence) return;
      if (status) {
        status.classList.add('form-error');
        status.textContent = error.message;
      }
    });
  });

  $('staff-evidence')?.addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    const preview = $('staff-evidence-preview');
    const image = $('staff-evidence-preview-image');
    const status = $('staff-evidence-preview-status');
    const sequence = ++staffEvidencePreviewSequence;
    staffEvidenceSelection = null;
    if (!file) {
      if (preview) preview.hidden = true;
      if (image) image.removeAttribute('src');
      if (status) status.textContent = '';
      return;
    }

    if (preview) preview.hidden = false;
    if (image) image.removeAttribute('src');
    if (status) {
      status.classList.remove('form-error');
      status.textContent = 'Menyiapkan pratinjau foto…';
    }
    const promise = compressImage(file);
    staffEvidenceSelection = { file, promise };
    promise.then((evidence) => {
      if (sequence !== staffEvidencePreviewSequence) return;
      if (image) image.src = evidence;
      if (status) status.textContent = 'Pratinjau bukti penanganan yang akan diunggah.';
    }).catch((error) => {
      if (sequence !== staffEvidencePreviewSequence) return;
      if (status) {
        status.classList.add('form-error');
        status.textContent = error.message;
      }
    });
  });

  $('f-staff')?.addEventListener('submit', submitStaffAction);
  $('s-t')?.addEventListener('change', renderCaseEditor);
  $('s-st')?.addEventListener('change', updateStaffNoteField);
  $('delete-ticket')?.addEventListener('click', openDeleteModal);
  $('delete-selected')?.addEventListener('click', () => {
    const codes = [...selectedBulkTicketCodes];
    if (!codes.length) {
      $('smsg').textContent = 'Pilih minimal satu aduan untuk dihapus.';
      return;
    }
    if (codes.length > 100) {
      $('smsg').textContent = 'Maksimal 100 aduan dapat dihapus sekaligus. Kurangi pilihan atau gunakan filter.';
      toast($('smsg').textContent, 'error');
      return;
    }
    deleteTargetCodes = codes;
    $('delete-modal-text').textContent = `Apakah Anda yakin ingin menghapus ${codes.length} aduan yang dipilih? Tindakan ini permanen.`;
    $('delete-modal').hidden = false;
  });

  $('cancel-delete')?.addEventListener('click', closeDeleteModal);
  $('close-delete-modal')?.addEventListener('click', closeDeleteModal);
  $('confirm-delete')?.addEventListener('click', executeDeleteTicket);
  $('delete-modal')?.addEventListener('click', (event) => {
    if (event.target.dataset.closeDeleteModal === 'true') closeDeleteModal();
  });

  ['filter-status', 'filter-priority'].forEach((id) => {
    $(id)?.addEventListener('change', () => {
      selectedBulkTicketCodes.clear();
      renderStaffTable();
    });
  });

  ['report-from', 'report-to', 'report-grouping'].forEach((id) => {
    $(id)?.addEventListener('change', renderDashboard);
  });
  $('export-excel')?.addEventListener('click', exportDashboardReport);

  $('staff-rows')?.addEventListener('click', (event) => {
    const checkbox = event.target.closest('input[data-select-ticket]');
    if (checkbox) return;

    const row = event.target.closest('tr[data-staff-code]');
    if (!row) return;
    selectedTicketCode = row.dataset.staffCode;
    $('s-t').value = selectedTicketCode;
    renderCaseEditor();
  });

  $('staff-rows')?.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[data-select-ticket]');
    if (!checkbox) return;
    if (checkbox.checked) selectedBulkTicketCodes.add(checkbox.dataset.selectTicket);
    else selectedBulkTicketCodes.delete(checkbox.dataset.selectTicket);
    renderStaffTable();
  });

  $('staff-rows')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const checkbox = event.target.closest('input[data-select-ticket]');
    if (checkbox) {
      checkbox.click();
      return;
    }
    const row = event.target.closest('tr[data-staff-code]');
    if (!row) return;
    event.preventDefault();
    selectedTicketCode = row.dataset.staffCode;
    $('s-t').value = selectedTicketCode;
    renderCaseEditor();
  });

  ['staff-header-select', 'staff-select-all'].forEach((id) => {
    $(id)?.addEventListener('change', (event) => {
      const visible = filteredStaffCases(accessibleTickets());
      if (event.target.checked) visible.forEach((ticket) => selectedBulkTicketCodes.add(ticket.code));
      else visible.forEach((ticket) => selectedBulkTicketCodes.delete(ticket.code));
      renderStaffTable();
    });
  });

  $('staff-directory-list')?.addEventListener('click', (event) => {
    const editButton = event.target.closest('button[data-edit-staff]');
    if (editButton) {
      openStaffEdit(editButton);
      return;
    }
    const button = event.target.closest('button[data-delete-staff]');
    if (button) deleteStaffAccount(button);
  });

  $('locate-me')?.addEventListener('click', locateUser);
  const markNewComplaintsRead = () => {
    localStorage.setItem(SEEN_KEY, String(Date.now()));
    renderActivity(accessibleTickets());
  };
  $('mark-read')?.addEventListener('click', markNewComplaintsRead);
  $('mark-read-dashboard')?.addEventListener('click', markNewComplaintsRead);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (!$('image-preview-modal').hidden) closeEvidencePreview();
      closeDeleteModal();
      closeStaffEdit();
      closeMenu();
    }
  });
}

function closeEvidencePreview() {
  const modal = $('image-preview-modal');
  if (!modal || modal.hidden) return;
  modal.hidden = true;
  const image = $('image-preview-image');
  if (image) {
    image.removeAttribute('src');
    image.alt = '';
  }
}

/* ─── PWA (Progressive Web App) ─── */
let deferredInstallPrompt = null;

function setupPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err);
      });
    });
  }

  const installBtn = $('pwa-install-btn');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installBtn) installBtn.hidden = false;
  });

  installBtn?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    installBtn.hidden = true;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice?.outcome === 'accepted') {
      toast('Aplikasi berhasil dipasang di perangkat Anda.', 'success');
    }
    deferredInstallPrompt = null;
  });

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.hidden = true;
    deferredInstallPrompt = null;
    toast('Terima kasih telah memasang PantauKota.', 'success');
  });
}

/* ─── Init ─── */
async function initialize() {
  setupTheme();
  setupPWA();
  startLiveClock();

  $('n-cat').innerHTML = CATS.map((category) => `<option>${escapeHtml(category)}</option>`).join('');

  bindEvents();
  setupReveal();

  renderBoard();
  ensureStatisticsMap();
  loadCachedPublicStatistics();

  void loadPublicTickets().then((loadedTickets) => {
    tickets = loadedTickets;
    renderBoard();
  });
  void loadPublicStatistics();

  window.setInterval(() => {
    if (!document.hidden) loadPublicStatistics();
  }, PUBLIC_STATISTICS_REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      loadPublicStatistics();
      refreshStaffComplaints();
    }
  });
  window.addEventListener('focus', refreshStaffComplaints);

  if (hasSessionMarker()) {
    try {
      const { user } = await apiRequest('/auth/me');
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      rememberSession();
      staffCaseDetails.clear();
      staffTickets = (await apiRequest('/staff/complaints')).map(normalizeTicket);
      knownStaffComplaintCodes = new Set(staffTickets.map((ticket) => ticket.code));
      staffCodesInitialized = true;
    } catch {
      clearSession();
    }
  } else {
    clearSession();
  }

  setStaffView();
  window.setInterval(refreshStaffComplaints, STAFF_COMPLAINTS_REFRESH_MS);
  primeUserLocation();

  const trackingCode = new URLSearchParams(window.location.search).get('track');
  if (trackingCode) {
    tab('lacak');
    await showTicket(trackingCode);
  }
}

initialize();

/* ——— Password show/hide toggle ——— */
document.querySelectorAll('.pass-toggle').forEach((btn) => {
  const inputId = btn.getAttribute('aria-controls');
  const input = document.getElementById(inputId);
  const eyeOpen = btn.querySelector('.eye-open');
  const eyeClosed = btn.querySelector('.eye-closed');
  if (!input) return;

  btn.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    eyeOpen.hidden = isHidden;
    eyeClosed.hidden = !isHidden;
    btn.setAttribute('aria-label', isHidden ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    // Fokus tetap di input agar tidak terganggu
    input.focus();
  });
});

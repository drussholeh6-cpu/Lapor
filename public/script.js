const ST = ["Diterima", "Diverifikasi", "Diproses", "Selesai"];
const DAY = 86400000;
const STORE_KEY = "la-v2";
const SESSION_KEY = "la-session";
const THEME_KEY = "la-theme";
const CATS = [
  "Jalan rusak",
  "Sampah",
  "Lampu jalan",
  "Air dan drainase",
  "Layanan administrasi",
  "Lainnya",
];
const CAT_CONFIG = {
  "Jalan rusak": { unit: "Seksi Pemeliharaan Jalan", days: 7 },
  Sampah: { unit: "Dinas Kebersihan", days: 3 },
  "Lampu jalan": { unit: "Seksi Sarana Umum", days: 5 },
  "Air dan drainase": { unit: "Tim Drainase", days: 2 },
  "Layanan administrasi": { unit: "Bagian Pelayanan Kelurahan", days: 5 },
  Lainnya: { unit: "Koordinasi Lintas Instansi", days: 7 },
};
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );

function themePreference() {
  try {
    return localStorage.getItem(THEME_KEY) || "system";
  } catch {
    return "system";
  }
}

function applyTheme(preference) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme =
    preference === "dark" || (preference === "system" && systemDark)
      ? "dark"
      : "light";
  document.documentElement.dataset.theme = theme;
  const button = $("theme-toggle");
  if (button) {
    const label =
      theme === "dark" ? "Aktifkan tema terang" : "Aktifkan tema gelap";
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(theme === "dark"));
    button.title = label;
  }
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#090f0c" : "#f0f5f1");
}

function setupTheme() {
  applyTheme(themePreference());
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (themePreference() === "system") applyTheme("system");
  };
  if (media.addEventListener) media.addEventListener("change", onChange);
  else if (media.addListener) media.addListener(onChange);
  $("theme-toggle")?.addEventListener("click", () => {
    const current =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* Preferensi tetap diterapkan untuk sesi ini. */
    }
    applyTheme(next);
  });
}
const formatDate = (value) =>
  new Date(value)
    .toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/\./g, ":")
    .replace(" pukul", "");

function updateLiveClock() {
  const clockElement = $("live-clock");
  const dateElement = $("live-clock-date");
  if (!clockElement || !dateElement) return;

  const formatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const parts = formatter.formatToParts(new Date());
  const getPart = (type) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const timeText = `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`;
  const dateText = `${getPart("weekday")}, ${getPart("day")} ${getPart("month")} ${getPart("year")}`;

  clockElement.textContent = timeText;
  clockElement.setAttribute("datetime", new Date().toISOString());
  dateElement.textContent = dateText;
}

function startLiveClock() {
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
}

const todayIso = () => new Date().toISOString();
const currentEntry = (ticket) => ticket.log[ticket.log.length - 1];
const baseStatus = (ticket) => currentEntry(ticket).s;
const isClosed = (ticket) =>
  baseStatus(ticket) === 3 || baseStatus(ticket) === -1;
const isWaiting = (ticket) => Boolean(ticket.waitingForInfo);
const statusLabel = (ticket) =>
  isWaiting(ticket)
    ? "Menunggu informasi warga"
    : baseStatus(ticket) === -1
      ? "Ditolak"
      : ST[baseStatus(ticket)];
const statusClass = (ticket) =>
  isWaiting(ticket)
    ? "s-wait"
    : baseStatus(ticket) === 3
      ? "s-done"
      : baseStatus(ticket) === -1
        ? "s-no"
        : "s-go";
const priorityLabel = (priority) =>
  ({ urgent: "Darurat", high: "Tinggi", normal: "Normal" })[priority] ||
  "Normal";
const priorityClass = (priority) =>
  ({ urgent: "p-urgent", high: "p-high", normal: "p-normal" })[priority] ||
  "p-normal";

function ago(days, hour = 9) {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

function makeSeed() {
  return [
    {
      code: "ADU-2610-0101",
      cat: "Sampah",
      loc: "Gang Kenanga RT 01/RW 03",
      text: "Tumpukan sampah di sudut gang sudah seminggu tidak diangkut dan mulai berbau.",
      at: ago(4),
      priority: "high",
      log: [
        {
          s: 0,
          at: ago(4),
          by: "Sistem",
          note: "Aduan diterima dan tercatat.",
        },
        {
          s: 1,
          at: ago(3),
          by: "Rani Pratama",
          note: "Titik sampah sudah dicek. Armada pengangkut dijadwalkan besok pagi.",
        },
      ],
    },
    {
      code: "ADU-2610-0119",
      cat: "Layanan administrasi",
      loc: "Kantor kelurahan",
      text: "Mohon bantuan mengurus perubahan data kependudukan karena KK salah ketik.",
      at: ago(6),
      priority: "normal",
      log: [
        {
          s: 0,
          at: ago(6),
          by: "Sistem",
          note: "Aduan diterima dan tercatat.",
        },
        {
          s: -1,
          at: ago(5),
          by: "Bagian Pelayanan Kelurahan",
          note: "Perubahan data KK bukan wewenang kelurahan. Silakan datang ke Dinas Kependudukan dengan KK asli dan surat pengantar RT.",
        },
      ],
    },
    {
      code: "ADU-2610-0138",
      cat: "Jalan rusak",
      loc: "Jl. Anggrek RT 02/RW 01",
      text: "Aspal berlubang di tikungan, dua pengendara motor sudah jatuh.",
      at: ago(12),
      priority: "urgent",
      log: [
        {
          s: 0,
          at: ago(12),
          by: "Sistem",
          note: "Aduan diterima dan tercatat.",
        },
        {
          s: 1,
          at: ago(11),
          by: "Seksi Pemeliharaan Jalan",
          note: "Lubang diukur sekitar 12 cm. Rambu sementara sudah dipasang.",
        },
        {
          s: 2,
          at: ago(8),
          by: "Dinas PU",
          note: "Tim tambal cepat dijadwalkan.",
        },
        {
          s: 3,
          at: ago(5),
          by: "Dinas PU",
          note: "Lubang sudah ditambal dan dipadatkan.",
        },
      ],
      rating: {
        score: 4,
        comment: "Respons cepat setelah diteruskan.",
        at: ago(4),
      },
    },
    {
      code: "ADU-2610-0142",
      cat: "Jalan rusak",
      loc: "Jl. Melati depan SD, RT 04/RW 02",
      text: "Lubang besar di depan sekolah. Motor sering terpeleset saat anak-anak pulang.",
      at: ago(3),
      priority: "high",
      log: [
        {
          s: 0,
          at: ago(3),
          by: "Sistem",
          note: "Aduan diterima dan tercatat.",
        },
        {
          s: 1,
          at: ago(2),
          by: "Rani Pratama",
          note: "Lokasi sudah disurvei. Rambu sementara dipasang sambil menunggu tim perbaikan.",
        },
        {
          s: 2,
          at: ago(1),
          by: "Dinas PU",
          note: "Penambalan dijadwalkan setelah bahan aspal tiba.",
        },
      ],
      waitingForInfo: true,
      infoPrompt:
        "Apakah lubang masih berada tepat di depan gerbang sekolah? Mohon konfirmasi agar tim menemukan titik yang benar.",
      infoRequestedAt: ago(1),
    },
    {
      code: "ADU-2610-0151",
      cat: "Lampu jalan",
      loc: "Jl. Kamboja RT 06/RW 04",
      text: "Tiga tiang lampu mati sejak awal bulan. Jalan gelap dan rawan.",
      at: ago(2),
      log: [
        {
          s: 0,
          at: ago(2),
          by: "Sistem",
          note: "Aduan diterima dan tercatat.",
        },
        {
          s: 1,
          at: ago(1),
          by: "Seksi Sarana Umum",
          note: "Tiga titik sudah dicek dan diteruskan ke tim kelistrikan.",
        },
      ],
    },
    {
      code: "ADU-2610-0155",
      cat: "Air dan drainase",
      loc: "Jl. Dahlia RT 03/RW 02",
      text: "Selokan tersumbat dan air meluap ke jalan setiap hujan.",
      at: ago(1),
      log: [
        {
          s: 0,
          at: ago(1),
          by: "Sistem",
          note: "Aduan diterima dan tercatat.",
        },
      ],
    },
  ];
}

function normalizeTicket(ticket) {
  const config = CAT_CONFIG[ticket.cat] || CAT_CONFIG.Lainnya;
  ticket.log = Array.isArray(ticket.log) && ticket.log.length ? ticket.log : [];
  ticket.priority = ["normal", "high", "urgent"].includes(ticket.priority)
    ? ticket.priority
    : "normal";
  ticket.unit = ticket.unit || config.unit;
  ticket.waitingForInfo = Boolean(ticket.waitingForInfo);
  ticket.audit = Array.isArray(ticket.audit) ? ticket.audit : [];
  ticket.evidence = ticket.evidence || null;
  ticket.coordinates = Array.isArray(ticket.coordinates) && ticket.coordinates.length === 2
    ? ticket.coordinates
    : null;
  if (!ticket.audit.length) {
    ticket.audit = ticket.log.map((entry) => ({
      kind: "status",
      at: entry.at,
      by: entry.by,
      note: entry.note,
    }));
  }
  return ticket;
}

let tickets = [];

async function loadTicketsFromApi() {
  try {
    const payload = await apiRequest('/complaints');
    return Array.isArray(payload) ? payload.map(normalizeTicket) : [];
  } catch (error) {
    console.error('Gagal memuat aduan dari backend:', error.message);
    return [];
  }
}

async function apiRequest(path, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  const isJsonBody = options.body && typeof options.body === 'string' && !headers['Content-Type'];
  if (isJsonBody) {
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
    throw new Error(payload?.message || 'Permintaan API gagal.');
  }

  return payload;
}

let publicMap = null;
let pickerMap = null;
let pickerMarker = null;
let selectedTicketCode = "";
let selectedBulkTicketCodes = new Set();
let deleteTargetCodes = [];

function save() {
  return true;
}

function addAudit(ticket, kind, by, note) {
  ticket.audit.push({ kind, at: todayIso(), by, note });
}

function targetDays(ticket) {
  const base = (CAT_CONFIG[ticket.cat] || CAT_CONFIG.Lainnya).days;
  if (ticket.priority === "urgent") return 1;
  if (ticket.priority === "high") return Math.max(2, Math.ceil(base * 0.65));
  return base;
}

function dueDate(ticket) {
  return new Date(new Date(ticket.at).getTime() + targetDays(ticket) * DAY);
}

function isLate(ticket) {
  return !isClosed(ticket) && Date.now() > dueDate(ticket).getTime();
}

function elapsedDays(ticket) {
  const end = isClosed(ticket) ? new Date(currentEntry(ticket).at) : new Date();
  return Math.max(0, Math.floor((end - new Date(ticket.at)) / DAY));
}

function dueLabel(ticket) {
  const remaining = Math.ceil((dueDate(ticket).getTime() - Date.now()) / DAY);
  if (isClosed(ticket)) return "Ditutup";
  if (remaining < 0) return `Terlambat ${Math.abs(remaining)} hari`;
  if (remaining === 0) return "Tenggat hari ini";
  return `${remaining} hari lagi`;
}

function trackingStatus(ticket) {
  return isWaiting(ticket) ? "Menunggu info" : statusLabel(ticket);
}

function renderBoard() {
  const finished = tickets.filter((ticket) => baseStatus(ticket) === 3);
  const rejected = tickets.filter((ticket) => baseStatus(ticket) === -1).length;
  const overdue = tickets.filter(isLate).length;
  const average = finished.length
    ? Math.round(
        finished.reduce((total, ticket) => total + elapsedDays(ticket), 0) /
          finished.length,
      )
    : 0;
  $("stats").innerHTML =
    `Dari <b>${tickets.length}</b> aduan, <b>${finished.length}</b> selesai dan <b>${rejected}</b> ditutup. Rata-rata selesai <b>${average} hari</b>. <b>${overdue}</b> aduan melewati target waktu.`;
  $("rows").innerHTML = [...tickets]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(
      (ticket) =>
        `<tr data-code="${escapeHtml(ticket.code)}" tabindex="0"><td><b>${escapeHtml(ticket.code)}</b></td><td>${escapeHtml(ticket.cat)}</td><td>${escapeHtml(ticket.loc)}</td><td class="pill ${statusClass(ticket)}">${escapeHtml(trackingStatus(ticket))}</td><td>${elapsedDays(ticket)} hari</td></tr>`,
    )
    .join("");
  renderPublicMap();
  renderHome();
}

function timeline(ticket) {
  const latestStatus = baseStatus(ticket);
  const progressStatus =
    latestStatus === -1
      ? (ticket.log[ticket.log.length - 2]?.s ?? 0)
      : latestStatus;
  return ST.map((name, index) => {
    const entries = ticket.log.filter((entry) => entry.s === index);
    const entry = entries[entries.length - 1];
    const isCurrent = index === progressStatus;
    if (entry) {
      const note =
        entry.visibility === "internal"
          ? ""
          : `<p class="note">${escapeHtml(entry.note)}</p>`;
      return `<li class="${isCurrent ? "cur" : ""}"><span class="dot"></span><h3>${name}</h3><div class="when">${formatDate(entry.at)}, oleh ${escapeHtml(entry.by)}</div>${note}</li>`;
    }
    return `<li class="todo"><span class="dot"></span><h3>${name}</h3><div class="when">Belum dilakukan</div></li>`;
  }).join("");
}

function ratingMarkup(ticket) {
  if (ticket.rating) {
    return `<div class="rating-thanks"><b>${"★".repeat(ticket.rating.score)}${"☆".repeat(5 - ticket.rating.score)}</b><span>Terima kasih atas penilaian Anda.</span>${ticket.rating.comment ? `<p>${escapeHtml(ticket.rating.comment)}</p>` : ""}</div>`;
  }
  return `<form class="rating-form" data-code="${escapeHtml(ticket.code)}"><label for="rating-score">Bagaimana pengalaman layanan ini?</label><div class="rating-controls"><select id="rating-score" name="score" required><option value="">Pilih nilai</option><option value="5">5 - Sangat puas</option><option value="4">4 - Puas</option><option value="3">3 - Cukup</option><option value="2">2 - Kurang puas</option><option value="1">1 - Tidak puas</option></select><button class="btn" type="submit">Kirim penilaian</button></div><label for="rating-comment">Komentar <span class="optional">(opsional)</span></label><textarea id="rating-comment" name="comment" maxlength="300" placeholder="Ceritakan pengalaman Anda."></textarea></form>`;
}

function evidenceUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  if (/^data:image\//i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return "";
}

function evidenceMarkup(value) {
  const url = evidenceUrl(value);
  if (!url) return "";
  return `<a class="evidence-link" href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Bukti aduan" loading="lazy"></a>`;
}

function slip(ticket) {
  const days = elapsedDays(ticket);
  const sla = targetDays(ticket);
  const progress = Math.min(100, Math.round((days / sla) * 100));
  const late = isLate(ticket);
  const state = baseStatus(ticket);
  const ageText = isClosed(ticket)
    ? `${state === 3 ? "Selesai" : "Ditutup"} dalam ${days} hari.`
    : late
      ? `Melewati target ${sla} hari.`
      : `Target ${sla} hari; ${dueLabel(ticket)}.`;
  const waiting = ticket.waitingForInfo
    ? `<section class="info-request"><b>Petugas meminta informasi tambahan</b><p>${escapeHtml(ticket.infoPrompt || "Mohon lengkapi informasi aduan ini.")}</p><small>${formatDate(ticket.infoRequestedAt || todayIso())}</small><form class="info-response-form" data-code="${escapeHtml(ticket.code)}"><label for="response-${escapeHtml(ticket.code)}">Balasan Anda</label><textarea id="response-${escapeHtml(ticket.code)}" name="response" required minlength="5" placeholder="Tulis informasi tambahan untuk petugas."></textarea><button class="btn" type="submit">Kirim balasan</button></form></section>`
    : ticket.infoResponse
      ? `<p class="response-received"><b>Balasan informasi diterima</b><br>${escapeHtml(ticket.infoResponse.note)}<small>${formatDate(ticket.infoResponse.at)}</small></p>`
      : "";
  const rejection =
    state === -1
      ? `<li class="no"><span class="dot"></span><h3>Ditolak</h3><div class="when">${formatDate(currentEntry(ticket).at)}, oleh ${escapeHtml(currentEntry(ticket).by)}</div>${currentEntry(ticket).visibility === "internal" ? "" : `<p class="note">${escapeHtml(currentEntry(ticket).note)}</p>`}</li>`
      : "";
  const location = ticket.coordinates
    ? `<a class="map-link" href="https://www.openstreetmap.org/?mlat=${ticket.coordinates[0]}&mlon=${ticket.coordinates[1]}#map=17/${ticket.coordinates[0]}/${ticket.coordinates[1]}" target="_blank" rel="noopener">Lihat titik perkiraan di peta</a>`
    : "";
  const evidence = evidenceMarkup(ticket.evidence);
  return `<article class="slip"><div class="slip-h"><div><div class="code">${escapeHtml(ticket.code)}</div><p class="meta">${escapeHtml(ticket.cat)}, ${escapeHtml(ticket.loc)}<br>Masuk ${formatDate(ticket.at)}<br>${location}</p></div><div class="stamp ${statusClass(ticket)}">${escapeHtml(statusLabel(ticket))}</div></div><div class="slip-b"><p class="issue">“${escapeHtml(ticket.text)}”</p><div class="case-tags"><span class="priority-tag ${priorityClass(ticket.priority)}">Prioritas ${priorityLabel(ticket.priority)}</span><span class="unit-tag">${escapeHtml(ticket.unit)}</span></div>${evidence ? `<div class="evidence-box">${evidence}</div>` : ""}<div class="age"><div class="${late ? "late-text" : ""}">${ageText}</div><div class="bar ${late ? "over" : ""}" role="img" aria-label="${progress} persen dari target waktu"><i style="width:${progress}%"></i></div></div>${waiting}<ol class="tl">${timeline(ticket)}${rejection}</ol>${isClosed(ticket) ? ratingMarkup(ticket) : ""}</div></article>`;
}

async function showTicket(code) {
  const normalizedCode = String(code).trim().toUpperCase();
  $("tmsg").textContent = "";
  $("result").innerHTML = "";
  if (!normalizedCode) return;

  let ticket;
  try {
    ticket = await apiRequest(`/complaints/${encodeURIComponent(normalizedCode)}`);
  } catch (error) {
    $("tmsg").textContent = error.message.includes('tidak ditemukan')
      ? `Nomor “${String(code).trim()}” tidak ditemukan. Periksa huruf dan angkanya, lalu coba lagi.`
      : error.message;
    return;
  }
  if (!currentSession()) {
    const existingIndex = tickets.findIndex((item) => item.code === normalizedCode);
    if (existingIndex < 0) tickets.push(normalizeTicket(ticket));
    else tickets[existingIndex] = normalizeTicket(ticket);
  }
  $("q").value = ticket.code;
  $("result").innerHTML = slip(ticket);
  $("result").scrollIntoView({
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
    block: "start",
  });
}

function currentSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

function accessibleTickets() {
  const user = currentSession();
  if (!user) return [];
  return user.role === "admin"
    ? tickets
    : tickets.filter((ticket) => ticket.unit === user.unit);
}

function setStaffView() {
  const user = currentSession();
  $("staff-login-view").hidden = Boolean(user);
  $("staff-workspace").hidden = !user;
  $("staff-nav-button").textContent = user ? "Ruang petugas" : "Masuk petugas";
  if (user) {
    $("staff-welcome").textContent =
      `${user.name} · ${user.role === "admin" ? "Admin" : user.unit}`;
    renderDashboard();
  }
}

function tab(name) {
  if (name === "petugas" && !currentSession()) setStaffView();
  document.querySelectorAll("nav button").forEach((button) => {
    button.setAttribute("aria-selected", String(button.dataset.tab === name));
  });
  ["beranda", "lacak", "buat", "petugas"].forEach((section) => {
    $(section).hidden = section !== name;
  });
  window.scrollTo(0, 0);
  if (name === "lacak") ensurePublicMap();
  if (name === "buat") ensurePickerMap();
  if (name === "petugas" && currentSession()) setStaffView();
}

function makeMap(containerId, fallbackId, center = [-6.2, 106.816]) {
  const fallback = $(fallbackId);
  if (!window.L) {
    fallback.hidden = false;
    fallback.textContent =
      "Peta memerlukan koneksi internet. Pelacakan dan pengiriman aduan tetap dapat digunakan.";
    return null;
  }
  fallback.hidden = true;
  const map = L.map(containerId, { scrollWheelZoom: false }).setView(
    center,
    14,
  );
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  return map;
}

function ensurePublicMap() {
  if (!publicMap) {
    publicMap = makeMap("public-map", "public-map-fallback");
    if (publicMap) publicMap.markers = L.layerGroup().addTo(publicMap);
  }
  if (publicMap) renderPublicMap();
}

function renderPublicMap() {
  if (!publicMap) return;
  publicMap.markers.clearLayers();
  tickets.forEach((ticket) => {
    if (!Array.isArray(ticket.coordinates) || ticket.coordinates.length !== 2) {
      return;
    }
    const marker = L.circleMarker(ticket.coordinates, {
      radius: ticket.priority === "urgent" ? 9 : 7,
      color: ticket.priority === "urgent" ? "#c95043" : "#1b8063",
      fillColor: ticket.priority === "urgent" ? "#e98c62" : "#ddf276",
      fillOpacity: 0.9,
      weight: 2,
    });
    marker.bindPopup(
      `<b>${escapeHtml(ticket.code)}</b><br>${escapeHtml(ticket.cat)}<br>${escapeHtml(trackingStatus(ticket))}`,
    );
    marker.addTo(publicMap.markers);
  });
  publicMap.invalidateSize();
}

function ensurePickerMap() {
  if (!pickerMap) {
    pickerMap = makeMap("location-picker", "picker-fallback");
    if (!pickerMap) return;
    pickerMap.on("click", (event) =>
      setPickerLocation(event.latlng.lat, event.latlng.lng),
    );
  }
  requestAnimationFrame(() => pickerMap?.invalidateSize());
}

function setPickerLocation(latitude, longitude) {
  const point = [latitude, longitude];
  $("n-lat").value = latitude.toFixed(6);
  $("n-lng").value = longitude.toFixed(6);
  if (!pickerMap) return;
  if (!pickerMarker) pickerMarker = L.marker(point).addTo(pickerMap);
  else pickerMarker.setLatLng(point);
  pickerMap.setView(point, Math.max(pickerMap.getZoom(), 15));
}

function roundPublicPoint(latitude, longitude) {
  return [Number(latitude.toFixed(3)), Number(longitude.toFixed(3))];
}

function dataUrlToFile(dataUrl, filename) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/data:(image\/[a-zA-Z0-9.+-]+);base64/);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new File([bytes], filename, { type: mime ? mime[1] : "image/jpeg" });
}

async function prepareEvidence(file) {
  if (!file) return null;
  return compressImage(file);
}

async function compressImage(file) {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Pilih berkas gambar.");
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("Ukuran foto maksimal 2 MB.");
  }

  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Foto gagal dibaca."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Foto gagal diproses."));
    img.src = source;
  });

  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result ? resolve(result) : reject(new Error("Foto gagal diproses.")),
      "image/jpeg",
      0.78,
    );
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Foto gagal dibaca."));
    reader.readAsDataURL(blob);
  });
}

function renderHome() {
  const finished = tickets.filter((ticket) => baseStatus(ticket) === 3);
  const active = tickets.filter((ticket) => !isClosed(ticket)).length;
  const average = finished.length
    ? Math.round(
        finished.reduce((total, ticket) => total + elapsedDays(ticket), 0) /
          finished.length,
      )
    : 0;
  $("home-stats").innerHTML =
    `Saat ini <b>${active}</b> aduan sedang ditangani. <b>${finished.length}</b> selesai, rata-rata <b>${average} hari</b>.`;

  const slaGrid = $("sla-grid");
  if (slaGrid) {
    slaGrid.innerHTML = Object.entries(CAT_CONFIG)
      .map(
        ([category, config], index) =>
          `<li><button type="button" class="sla-card" data-sla-cat="${escapeHtml(category)}"><span class="sla-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span><span class="sla-body"><b>${escapeHtml(category)}</b><small>${escapeHtml(config.unit)}</small></span><span class="sla-days"><b>${config.days}</b><small>hari</small></span></button></li>`,
      )
      .join("");
  }
}

function renderDashboard() {
  const cases = accessibleTickets();
  const finished = cases.filter((ticket) => baseStatus(ticket) === 3);
  const rated = finished.filter((ticket) => ticket.rating);
  const average = finished.length
    ? Math.round(
        finished.reduce((total, ticket) => total + elapsedDays(ticket), 0) /
          finished.length,
      )
    : 0;
  $("metric-active").textContent = cases.filter(
    (ticket) => !isClosed(ticket),
  ).length;
  $("metric-late").textContent = cases.filter(isLate).length;
  $("metric-urgent").textContent = cases.filter(
    (ticket) => ticket.priority !== "normal" && !isClosed(ticket),
  ).length;
  $("metric-average").textContent = `${average} hari`;
  $("metric-rating").textContent = rated.length
    ? `${(rated.reduce((sum, ticket) => sum + ticket.rating.score, 0) / rated.length).toFixed(1)} / 5`
    : "-";
  $("metric-rating-count").textContent = `${rated.length} penilaian`;
  renderStaffTable(cases);
  renderActivity(cases);
}

function filteredStaffCases(cases) {
  const status = $("filter-status").value;
  const priority = $("filter-priority").value;
  return cases.filter((ticket) => {
    const statusMatch =
      status === "all" ||
      (status === "open" && !isClosed(ticket)) ||
      (status === "late" && isLate(ticket)) ||
      (status === "closed" && isClosed(ticket));
    const priorityMatch = priority === "all" || ticket.priority === priority;
    return statusMatch && priorityMatch;
  });
}

function renderStaffTable(cases = accessibleTickets()) {
  const visible = filteredStaffCases(cases).sort(
    (a, b) =>
      Number(isClosed(a)) - Number(isClosed(b)) || b.at.localeCompare(a.at),
  );
  const adminMode = currentSession()?.role === "admin";
  $("bulk-actions").hidden = !adminMode;
  $("staff-rows").innerHTML = visible.length
    ? visible
        .map(
          (ticket) =>
            `<tr data-staff-code="${escapeHtml(ticket.code)}" tabindex="0" class="${isLate(ticket) ? "is-late" : ""}"><td class="select-col"><input type="checkbox" data-select-ticket="${escapeHtml(ticket.code)}" ${selectedBulkTicketCodes.has(ticket.code) ? "checked" : ""} aria-label="Pilih aduan ${escapeHtml(ticket.code)}"></td><td><b>${escapeHtml(ticket.code)}</b><small>${escapeHtml(ticket.loc)}</small></td><td><span class="pill ${statusClass(ticket)}">${escapeHtml(trackingStatus(ticket))}</span></td><td><span class="priority-tag ${priorityClass(ticket.priority)}">${priorityLabel(ticket.priority)}</span></td><td class="due-cell">${escapeHtml(dueLabel(ticket))}</td></tr>`,
        )
        .join("")
    : '<tr><td colspan="5" class="empty-state">Tidak ada aduan yang cocok dengan filter.</td></tr>';
  const selectAll = $("staff-header-select");
  if (selectAll) {
    const allSelected = visible.length > 0 && visible.every((ticket) => selectedBulkTicketCodes.has(ticket.code));
    selectAll.checked = allSelected;
    selectAll.indeterminate = !allSelected && visible.some((ticket) => selectedBulkTicketCodes.has(ticket.code));
  }
  fillStaffSelect(cases);
}

function fillStaffSelect(cases = accessibleTickets()) {
  const allCases = [...cases].sort((a, b) => b.at.localeCompare(a.at));
  if (!allCases.length) {
    $("s-t").innerHTML =
      '<option value="">Tidak ada aduan untuk unit ini</option>';
    selectedTicketCode = "";
    $("f-staff").hidden = true;
    $("case-detail").hidden = true;
    $("case-help").textContent = "Tidak ada aduan yang dapat diakses.";
    return;
  }
  $("f-staff").hidden = false;
  $("s-t").innerHTML = allCases
    .map(
      (ticket) =>
        `<option value="${escapeHtml(ticket.code)}">${escapeHtml(ticket.code)} · ${escapeHtml(ticket.cat)} · ${escapeHtml(trackingStatus(ticket))}</option>`,
    )
    .join("");
  const selected = allCases.some((ticket) => ticket.code === selectedTicketCode)
    ? selectedTicketCode
    : allCases.find((ticket) => !isClosed(ticket))?.code || allCases[0].code;
  selectedTicketCode = selected;
  $("s-t").value = selected;
  renderCaseEditor();
}

function renderCaseEditor() {
  const ticket = tickets.find((item) => item.code === $("s-t").value);
  if (!ticket) return;
  selectedTicketCode = ticket.code;
  $("f-staff").hidden = isClosed(ticket);
  $("s-priority").value = ticket.priority;
  $("s-unit").value = ticket.unit;
  $("s-unit").disabled = currentSession()?.role !== "admin";
  const stage = baseStatus(ticket);
  const options = ST.map((name, index) =>
    index > stage ? `<option value="${index}">${name}</option>` : "",
  ).join("");
  $("s-st").innerHTML = `${options}<option value="-1">Tolak aduan</option>`;
  $("s-st").required = true;
  $("case-help").textContent = isClosed(ticket)
    ? `${ticket.code} · aduan sudah ditutup`
    : `${ticket.code} · target ${targetDays(ticket)} hari · ${ticket.unit}`;
  const evidence = evidenceMarkup(ticket.evidence);
  const internalNotes = ticket.log
    .filter((entry) => entry.visibility === "internal")
    .map(
      (entry) =>
        `<li><b>${escapeHtml(ST[entry.s] || "Catatan petugas")}</b><small>${formatDate(entry.at)} · ${escapeHtml(entry.by)}</small><p>${escapeHtml(entry.note)}</p></li>`,
    )
    .join("");
  const photoText = evidence
    ? `<div class="evidence-box">${evidence}</div>`
    : "<p class=\"hint\">Belum ada foto bukti.</p>";
  $("case-detail").hidden = false;
  $("case-detail").innerHTML =
    `<p>${escapeHtml(ticket.text)}</p><p class="reporter-private"><b>Pelapor:</b> ${escapeHtml(ticket.name || "Tidak mencantumkan nama")}</p><div class="case-tags"><span class="priority-tag ${priorityClass(ticket.priority)}">${priorityLabel(ticket.priority)}</span><span class="unit-tag">${escapeHtml(ticket.unit)}</span></div>${photoText}${ticket.waitingForInfo ? `<p class="info-request"><b>Menunggu jawaban warga</b><br>${escapeHtml(ticket.infoPrompt)}</p>` : ""}${ticket.infoResponse ? `<p class="response-received"><b>Jawaban warga</b><br>${escapeHtml(ticket.infoResponse.note)}</p>` : ""}${internalNotes ? `<details class="internal-history"><summary>Catatan internal petugas</summary><ol>${internalNotes}</ol></details>` : ""}`;
}

function renderActivity(cases) {
  const activities = cases
    .flatMap((ticket) =>
      ticket.audit.map((event) => ({ ...event, code: ticket.code })),
    )
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 10);
  const lastSeen = Number(localStorage.getItem("la-seen") || 0);
  const unread = activities.filter(
    (event) => new Date(event.at).getTime() > lastSeen,
  ).length;
  $("notification-count").textContent = `${unread} baru`;
  $("activity-list").innerHTML = activities.length
    ? activities
        .map(
          (event) =>
            `<li><span class="activity-dot ${event.kind === "request-info" ? "alert" : ""}"></span><div><b>${escapeHtml(event.code)} · ${escapeHtml(event.by)}</b><p>${escapeHtml(event.note)}</p><small>${formatDate(event.at)}</small></div></li>`,
        )
        .join("")
    : "<li>Belum ada aktivitas.</li>";
}

function renderMapPoint(ticket) {
  if (!ticket.coordinates) return "";
  const [latitude, longitude] = ticket.coordinates;
  return `<a class="map-link" href="https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}" target="_blank" rel="noopener">Titik lokasi perkiraan</a>`;
}

function nextCode() {
  const highest = Math.max(
    0,
    ...tickets.map((ticket) => Number(ticket.code.slice(-4)) || 0),
  );
  const date = new Date();
  return `ADU-${String(date.getFullYear()).slice(-2)}${String(date.getMonth() + 1).padStart(2, "0")}-${String(highest + 1).padStart(4, "0")}`;
}

function showMessage(element, text, kind = "error") {
  element.textContent = text;
  element.classList.toggle("success-msg", kind === "success");
  element.classList.toggle("msg", kind !== "success");
}

function openDeleteModal() {
  const user = currentSession();
  const ticket = tickets.find((item) => item.code === $("s-t").value);
  if (!user || user.role !== "admin") {
    $("smsg").textContent = "Hanya admin yang dapat menghapus aduan.";
    return;
  }

  const selectedCodes = deleteTargetCodes.length ? [...deleteTargetCodes] : ticket ? [ticket.code] : [];
  if (!selectedCodes.length) {
    $("smsg").textContent = "Pilih aduan yang ingin dihapus.";
    return;
  }

  const message = selectedCodes.length === 1
    ? `Apakah Anda yakin ingin menghapus aduan ${selectedCodes[0]}? Tindakan ini permanen dan tidak dapat dibatalkan.`
    : `Apakah Anda yakin ingin menghapus ${selectedCodes.length} aduan yang dipilih? Tindakan ini permanen dan tidak dapat dibatalkan.`;

  deleteTargetCodes = selectedCodes;
  $("delete-modal-text").textContent = message;
  $("delete-modal").hidden = false;
}

function closeDeleteModal() {
  $("delete-modal").hidden = true;
}

async function executeDeleteTicket() {
  const user = currentSession();
  if (!user || user.role !== "admin") {
    $("smsg").textContent = "Hanya admin yang dapat menghapus aduan.";
    closeDeleteModal();
    return;
  }

  const codes = deleteTargetCodes.length ? [...deleteTargetCodes] : $("s-t").value ? [$("s-t").value] : [];
  if (!codes.length) {
    $("smsg").textContent = "Pilih aduan yang ingin dihapus.";
    closeDeleteModal();
    return;
  }

  try {
    await apiRequest('/staff/complaints', {
      method: 'DELETE',
      body: JSON.stringify({ codes }),
    });
  } catch (error) {
    $("smsg").textContent = error.message;
    closeDeleteModal();
    return;
  }

  const backup = JSON.stringify(tickets);
  const beforeCount = tickets.length;
  tickets = tickets.filter((ticket) => !codes.includes(ticket.code));

  if (!save()) {
    tickets = JSON.parse(backup);
    $("smsg").textContent =
      "Penghapusan gagal. Penyimpanan browser penuh, coba lagi nanti.";
    closeDeleteModal();
    return;
  }

  selectedBulkTicketCodes = new Set();
  deleteTargetCodes = [];
  selectedTicketCode = "";
  $("smsg").textContent =
    beforeCount === tickets.length + codes.length
      ? `${codes.length} aduan berhasil dihapus.`
      : "Aduan berhasil dihapus.";
  closeDeleteModal();
  renderBoard();
  renderDashboard();
  if (typeof setStaffView === "function") setStaffView();
}

function bindEvents() {
  document.querySelectorAll("nav button").forEach((button) => {
    button.addEventListener("click", () => tab(button.dataset.tab));
  });
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => tab(button.dataset.go));
  });
  $("sla-grid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-sla-cat]");
    if (!card) return;
    tab("buat");
    if (!$("made").hidden) {
      $("made").hidden = true;
      $("f-new").hidden = false;
      $("f-new").reset();
      $("n-lat").value = "";
      $("n-lng").value = "";
      if (pickerMarker) pickerMarker.remove();
      pickerMarker = null;
    }
    $("n-cat").value = card.dataset.slaCat;
    $("n-loc").focus();
  });
  document
    .querySelector(".brand")
    .addEventListener("click", () => tab("beranda"));
  $("f-track").addEventListener("submit", (event) => {
    event.preventDefault();
    showTicket($("q").value);
  });
  document.querySelectorAll("[data-try]").forEach((button) => {
    button.addEventListener("click", () => showTicket(button.dataset.try));
  });
  $("rows").addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-code]");
    if (row) showTicket(row.dataset.code);
  });
  $("rows").addEventListener("keydown", (event) => {
    const row = event.target.closest("tr[data-code]");
    if (row && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      showTicket(row.dataset.code);
    }
  });
  $("f-new").addEventListener("submit", submitNewTicket);
  $("f-login").addEventListener("submit", submitLogin);
  $("staff-logout").addEventListener("click", logout);
  $("s-t").addEventListener("change", renderCaseEditor);
  $("delete-ticket").addEventListener("click", openDeleteModal);
  $("cancel-delete").addEventListener("click", closeDeleteModal);
  $("close-delete-modal").addEventListener("click", closeDeleteModal);
  $("confirm-delete").addEventListener("click", executeDeleteTicket);
  $("delete-modal").addEventListener("click", (event) => {
    if (event.target.dataset.closeDeleteModal === "true") closeDeleteModal();
  });
  $("f-staff").addEventListener("submit", submitStaffAction);
  ["filter-status", "filter-priority"].forEach((id) =>
    $(id).addEventListener("change", () => renderStaffTable()),
  );
  $("staff-rows").addEventListener("click", (event) => {
    const checkbox = event.target.closest("input[data-select-ticket]");
    if (checkbox) {
      const code = checkbox.dataset.selectTicket;
      if (checkbox.checked) selectedBulkTicketCodes.add(code);
      else selectedBulkTicketCodes.delete(code);
      return;
    }
    const row = event.target.closest("tr[data-staff-code]");
    if (!row) return;
    selectedTicketCode = row.dataset.staffCode;
    $("s-t").value = selectedTicketCode;
    renderCaseEditor();
  });
  $("staff-rows").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const checkbox = event.target.closest("input[data-select-ticket]");
    if (checkbox) {
      checkbox.click();
      return;
    }
    const row = event.target.closest("tr[data-staff-code]");
    if (!row) return;
    event.preventDefault();
    selectedTicketCode = row.dataset.staffCode;
    $("s-t").value = selectedTicketCode;
    renderCaseEditor();
  });
  $("staff-header-select").addEventListener("change", (event) => {
    const visible = filteredStaffCases(accessibleTickets());
    if (event.target.checked) {
      visible.forEach((ticket) => selectedBulkTicketCodes.add(ticket.code));
    } else {
      visible.forEach((ticket) => selectedBulkTicketCodes.delete(ticket.code));
    }
    renderStaffTable();
  });
  $("delete-selected").addEventListener("click", () => {
    const codes = [...selectedBulkTicketCodes];
    if (!codes.length) {
      $("smsg").textContent = "Pilih minimal satu aduan untuk dihapus.";
      return;
    }
    deleteTargetCodes = codes;
    $("delete-modal-text").textContent = `Apakah Anda yakin ingin menghapus ${codes.length} aduan yang dipilih? Tindakan ini permanen.`;
    $("delete-modal").hidden = false;
  });
  $("result").addEventListener("submit", (event) => {
    if (event.target.matches(".rating-form")) submitRating(event);
    else submitResidentAction(event);
  });
  $("locate-me").addEventListener("click", locateUser);
  $("mark-read").addEventListener("click", () => {
    localStorage.setItem("la-seen", String(Date.now()));
    renderActivity(accessibleTickets());
  });
}

async function submitLogin(event) {
  event.preventDefault();
  const email = $("login-user").value.trim();
  const password = $("login-pass").value;
  $("login-error").textContent = "";
  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(result.user));
    tickets = (await apiRequest('/staff/complaints')).map(normalizeTicket);
    $("f-login").reset();
    setStaffView();
  } catch (error) {
    sessionStorage.removeItem(SESSION_KEY);
    apiRequest('/auth/logout', { method: 'POST' }).catch(() => {});
    $("login-error").textContent = error.message;
  }
}

async function logout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (error) {
    console.warn('Logout request failed:', error.message);
  }
  sessionStorage.removeItem(SESSION_KEY);
  tickets = await loadTicketsFromApi();
  selectedTicketCode = "";
  setStaffView();
  renderBoard();
  tab("petugas");
}

async function submitNewTicket(event) {
  event.preventDefault();
  const error = $("n-err");
  error.textContent = "";
  const latitudeText = $("n-lat").value.trim();
  const longitudeText = $("n-lng").value.trim();
  if (Boolean(latitudeText) !== Boolean(longitudeText)) {
    error.textContent =
      "Pilih titik peta secara lengkap atau kosongkan koordinat.";
    return;
  }
  const latitude = Number(latitudeText);
  const longitude = Number(longitudeText);
  if (
    latitudeText &&
    (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180)
  ) {
    error.textContent = "Koordinat lokasi tidak valid.";
    return;
  }
  const file = $("n-evidence").files[0];
  let evidence = null;
  try {
    evidence = await prepareEvidence(file);
  } catch (reason) {
    error.textContent = reason.message;
    return;
  }
  const category = $("n-cat").value;
  const coordinates =
    latitudeText && longitudeText
      ? roundPublicPoint(latitude, longitude)
      : null;
  const at = todayIso();
  let ticket = normalizeTicket(
    {
      code: nextCode(),
      cat: category,
      loc: $("n-loc").value.trim(),
      text: $("n-text").value.trim(),
      name: $("n-name").value.trim(),
      at,
      priority: $("n-severity").value,
      unit: CAT_CONFIG[category].unit,
      coordinates,
      sampleData: false,
      evidence,
      log: [
        {
          s: 0,
          at,
          by: "Sistem",
          note: "Aduan diterima. Target waktu mengikuti jenis aduan.",
        },
      ],
      audit: [],
    },
    tickets.length,
  );
  addAudit(ticket, "created", "Sistem", "Aduan baru diterima.");

  try {
    ticket = await apiRequest('/complaints', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });
  } catch (apiError) {
    error.textContent = apiError.message;
    return;
  }

  ticket = normalizeTicket(ticket);
  tickets.push(ticket);
  if (!save()) {
    tickets.pop();
    error.textContent =
      "Penyimpanan browser penuh. Hapus beberapa foto bukti atau data yang tidak diperlukan lalu coba lagi.";
    return;
  }
  renderBoard();
  const form = $("f-new");
  form.hidden = true;
  const made = $("made");
  made.hidden = false;
  made.innerHTML = `<h2>Aduan terkirim. Catat nomor ini.</h2><div class="slip"><div class="slip-h"><div><div class="code">${escapeHtml(ticket.code)}</div><p class="meta">Simpan nomor ini untuk melacak perkembangan.</p></div><div class="stamp s-go">Diterima</div></div></div><div class="actions"><button class="btn" id="m-cp" type="button">Salin nomor</button><button class="btn alt" id="m-go" type="button">Lihat progres</button><button class="btn alt" id="m-new" type="button">Buat aduan lain</button></div><p class="hint" id="m-h"></p>`;
  $("m-cp").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(ticket.code);
      $("m-h").textContent = "Nomor tersalin.";
    } catch {
      $("m-h").textContent = `Catat nomor ini: ${ticket.code}`;
    }
  });
  $("m-go").addEventListener("click", () => {
    tab("lacak");
    showTicket(ticket.code);
  });
  $("m-new").addEventListener("click", () => {
    form.reset();
    form.hidden = false;
    made.hidden = true;
    $("n-lat").value = "";
    $("n-lng").value = "";
    if (pickerMarker) pickerMarker.remove();
    pickerMarker = null;
  });
}

async function submitResidentAction(event) {
  const form = event.target.closest(".info-response-form");
  if (!form) return;
  event.preventDefault();
  const ticket = tickets.find((item) => item.code === form.dataset.code);
  if (!ticket || !ticket.waitingForInfo) return;
  const note = new FormData(form).get("response").trim();
  const originalTicket = JSON.stringify(ticket);
  ticket.infoResponse = { note, at: todayIso() };
  ticket.waitingForInfo = false;

  try {
    const updated = await apiRequest(`/complaints/${ticket.code}/replies`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
    Object.assign(ticket, updated || ticket);
  } catch (error) {
    Object.assign(ticket, JSON.parse(originalTicket));
    $("tmsg").textContent = error.message;
    return;
  }

  if (!save()) {
    const restoredTicket = JSON.parse(originalTicket);
    Object.keys(ticket).forEach((key) => delete ticket[key]);
    Object.assign(ticket, restoredTicket);
    $("tmsg").textContent =
      "Balasan belum tersimpan. Penyimpanan browser penuh; coba lagi setelah mengosongkan ruang.";
    return;
  }
  showTicket(ticket.code);
}

async function submitRating(event) {
  event.preventDefault();
  const form = event.target;
  const ticket = tickets.find((item) => item.code === form.dataset.code);
  if (!ticket || !isClosed(ticket) || ticket.rating) return;
  const data = new FormData(form);
  const originalTicket = JSON.stringify(ticket);
  ticket.rating = {
    score: Number(data.get("score")),
    comment: String(data.get("comment") || "").trim(),
    at: todayIso(),
  };
  try {
    const updated = await apiRequest(`/complaints/${ticket.code}/ratings`, {
      method: 'POST',
      body: JSON.stringify(ticket.rating),
    });
    Object.assign(ticket, updated || ticket);
  } catch (error) {
    Object.assign(ticket, JSON.parse(originalTicket));
    $("tmsg").textContent = error.message;
    return;
  }

  if (!save()) {
    const restoredTicket = JSON.parse(originalTicket);
    Object.keys(ticket).forEach((key) => delete ticket[key]);
    Object.assign(ticket, restoredTicket);
    $("tmsg").textContent =
      "Penilaian belum tersimpan. Penyimpanan browser penuh; coba lagi setelah mengosongkan ruang.";
    return;
  }
  showTicket(ticket.code);
}

async function submitStaffAction(event) {
  event.preventDefault();
  const user = currentSession();
  const ticket = tickets.find((item) => item.code === $("s-t").value);
  if (
    !user ||
    !ticket ||
    (user.role !== "admin" && ticket.unit !== user.unit)
  ) {
    $("smsg").textContent = "Akun ini tidak memiliki akses ke aduan tersebut.";
    return;
  }
  if (isClosed(ticket)) {
    $("smsg").textContent = "Aduan yang sudah ditutup tidak dapat diubah.";
    return;
  }
  const originalTicket = JSON.stringify(ticket);
  const operation = event.submitter?.value || "update";
  const note = $("s-note").value.trim();
  const visibility = $("s-visibility").value;
  if (
    !["public", "internal"].includes(visibility) ||
    note.length < 10 ||
    (operation === "request-info" && visibility !== "public")
  ) {
    $("smsg").textContent =
      operation === "request-info"
        ? "Permintaan informasi selalu terlihat oleh warga; pilih visibilitas publik."
        : "Catatan minimal 10 karakter dan visibilitas harus dipilih.";
    return;
  }
  const restoreTicket = () => {
    const restoredTicket = JSON.parse(originalTicket);
    Object.keys(ticket).forEach((key) => delete ticket[key]);
    Object.assign(ticket, restoredTicket);
  };
  const priorityBefore = ticket.priority;
  const unitBefore = ticket.unit;
  ticket.priority = $("s-priority").value;
  if (user.role === "admin") ticket.unit = $("s-unit").value;
  if (priorityBefore !== ticket.priority) {
    addAudit(
      ticket,
      "priority",
      user.name,
      `Prioritas diubah menjadi ${priorityLabel(ticket.priority)}.`,
    );
  }
  if (unitBefore !== ticket.unit) {
    addAudit(
      ticket,
      "assignment",
      user.name,
      `Aduan diteruskan ke ${ticket.unit}.`,
    );
  }
  if (operation === "request-info") {
    ticket.waitingForInfo = true;
    ticket.infoPrompt = note;
    ticket.infoRequestedAt = todayIso();
    addAudit(
      ticket,
      "request-info",
      user.name,
      "Petugas meminta informasi tambahan dari warga.",
    );
  } else {
    const nextStatus = Number($("s-st").value);
    if (
      !Number.isInteger(nextStatus) ||
      (nextStatus !== -1 && nextStatus !== baseStatus(ticket) + 1)
    ) {
      restoreTicket();
      $("smsg").textContent =
        "Pilih status berikutnya secara berurutan atau pilih penolakan.";
      return;
    }
    const evidenceFile = $("staff-evidence").files[0];
    try {
      const evidence = await prepareEvidence(evidenceFile);
      if (evidence) {
        ticket.evidence = evidence;
        addAudit(
          ticket,
          "evidence",
          user.name,
          "Bukti foto penanganan ditambahkan.",
        );
      }
    } catch (reason) {
      restoreTicket();
      $("smsg").textContent = reason.message;
      return;
    }
    const at = todayIso();
    ticket.log.push({
      s: nextStatus,
      at,
      by: user.name,
      note,
      visibility,
    });
    ticket.waitingForInfo = false;
    addAudit(
      ticket,
      "status",
      user.name,
      `Status diubah menjadi ${nextStatus === -1 ? "Ditolak" : ST[nextStatus]}.`,
    );
  }
  try {
    const updated = await apiRequest(`/staff/complaints/${ticket.code}`, {
      method: 'PATCH',
      body: JSON.stringify({
        operation,
        note,
        visibility,
        status: operation === "update" ? Number($("s-st").value) : null,
        priority: ticket.priority,
        unit: ticket.unit,
        evidence: ticket.evidence || null,
      }),
    });
    Object.keys(ticket).forEach((key) => delete ticket[key]);
    Object.assign(ticket, normalizeTicket(updated));
  } catch (error) {
    restoreTicket();
    $("smsg").textContent = error.message;
    renderDashboard();
    return;
  }

  if (!save()) {
    restoreTicket();
    $("smsg").textContent =
      "Penyimpanan browser penuh. Hapus beberapa foto bukti atau data yang tidak diperlukan.";
    renderDashboard();
    return;
  }
  $("s-note").value = "";
  $("s-visibility").value = "public";
  $("staff-evidence").value = "";
  $("smsg").textContent =
    operation === "request-info"
      ? "Permintaan informasi tersimpan dan tampil saat warga melacak aduan."
      : "Pembaruan tersimpan dan dapat dilihat warga melalui nomor aduan.";
  renderBoard();
  renderDashboard();
  renderCaseEditor();
}

function locateUser() {
  if (!navigator.geolocation) {
    $("n-err").textContent = "Browser ini tidak menyediakan fitur lokasi.";
    return;
  }
  $("locate-me").disabled = true;
  $("locate-me").textContent = "Mencari lokasi...";
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      setPickerLocation(coords.latitude, coords.longitude);
      $("locate-me").disabled = false;
      $("locate-me").textContent = "Gunakan lokasi perangkat";
    },
    () => {
      $("n-err").textContent =
        "Lokasi tidak tersedia. Pilih titik langsung pada peta.";
      $("locate-me").disabled = false;
      $("locate-me").textContent = "Gunakan lokasi perangkat";
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
  );
}

async function initialize() {
  setupTheme();
  startLiveClock();
  $("n-cat").innerHTML = CATS.map(
    (category) => `<option>${escapeHtml(category)}</option>`,
  ).join("");
  tickets = await loadTicketsFromApi();
  try {
    const { user } = await apiRequest('/auth/me');
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    tickets = (await apiRequest('/staff/complaints')).map(normalizeTicket);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
  bindEvents();
  renderBoard();
  setStaffView();
}

initialize();

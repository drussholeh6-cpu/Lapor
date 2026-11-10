const complaintModel = require('../models/complaintModel');

const CATEGORY_TARGET_DAYS = {
  'Jalan rusak': 7,
  Sampah: 3,
  'Lampu jalan': 5,
  'Air dan drainase': 2,
  'Layanan administrasi': 5,
  Lainnya: 7,
};
const DAY_MS = 86_400_000;
const MIN_PUBLIC_CELL_COUNT = 3;
const CACHE_TTL_MS = 60_000;
let cachedStatistics = null;
let cacheExpiresAt = 0;
let refreshPromise = null;

function targetDays(complaint) {
  const base = CATEGORY_TARGET_DAYS[complaint.cat] || CATEGORY_TARGET_DAYS.Lainnya;
  if (complaint.priority === 'urgent') return 1;
  if (complaint.priority === 'high') return Math.max(2, Math.ceil(base * 0.65));
  return base;
}

function publicStatistics(complaints, now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + index, 1));
    return {
      month: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('id-ID', { month: 'short', timeZone: 'UTC' }).format(date),
      count: 0,
    };
  });
  const monthIndexes = new Map(months.map((month, index) => [month.month, index]));
  const completed = [];
  const categories = new Map();
  const units = new Map();
  const cells = new Map();
  let active = 0;

  for (const complaint of complaints) {
    const createdAt = Date.parse(complaint.at || '');
    if (!Number.isFinite(createdAt)) continue;
    const monthKey = new Date(createdAt).toISOString().slice(0, 7);
    const monthIndex = monthIndexes.get(monthKey);
    if (monthIndex !== undefined) months[monthIndex].count += 1;

    const log = (Array.isArray(complaint.log) ? complaint.log : [])
      .filter((entry) => entry && entry.visibility !== 'internal');
    const latest = log[log.length - 1];
    const status = Number(latest?.s ?? 0);
    if (status !== 3 && status !== -1) active += 1;

    if (status === 3) {
      const resolvedAt = Date.parse(latest?.at || '');
      if (Number.isFinite(resolvedAt) && resolvedAt >= createdAt) {
        const days = (resolvedAt - createdAt) / DAY_MS;
        completed.push({ days, onTime: days <= targetDays(complaint) });
        const category = complaint.cat || 'Lainnya';
        const aggregate = categories.get(category) || { category, totalDays: 0, count: 0 };
        aggregate.totalDays += days;
        aggregate.count += 1;
        categories.set(category, aggregate);
      }
    }

    const firstVerification = log.find((entry) => Number(entry?.s) === 1);
    const responseAt = Date.parse(firstVerification?.at || '');
    if (Number.isFinite(responseAt) && responseAt >= createdAt && complaint.unit) {
      const aggregate = units.get(complaint.unit) || { unit: complaint.unit, totalHours: 0, count: 0 };
      aggregate.totalHours += (responseAt - createdAt) / 3_600_000;
      aggregate.count += 1;
      units.set(complaint.unit, aggregate);
    }

    const coordinates = complaint.coordinates;
    if (Array.isArray(coordinates) && coordinates.length === 2) {
      const lat = Number(coordinates[0]);
      const lng = Number(coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)
        && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        const cellLat = Number((Math.round(lat / 0.02) * 0.02).toFixed(2));
        const cellLng = Number((Math.round(lng / 0.02) * 0.02).toFixed(2));
        const key = `${cellLat},${cellLng}`;
        const cell = cells.get(key) || { coordinates: [cellLat, cellLng], count: 0 };
        cell.count += 1;
        cells.set(key, cell);
      }
    }
  }

  return {
    generatedAt: now.toISOString(),
    total: complaints.length,
    active,
    completed: completed.length,
    onTimeRate: completed.length
      ? Math.round((completed.filter((item) => item.onTime).length / completed.length) * 100)
      : null,
    monthly: months,
    categoryAverages: [...categories.values()]
      .map(({ category, totalDays, count }) => ({ category, averageDays: Math.round((totalDays / count) * 10) / 10, count }))
      .sort((a, b) => a.category.localeCompare(b.category, 'id')),
    unitResponse: [...units.values()]
      .filter((item) => item.count >= MIN_PUBLIC_CELL_COUNT)
      .map(({ unit, totalHours, count }) => ({ unit, averageHours: Math.round((totalHours / count) * 10) / 10, count }))
      .sort((a, b) => a.averageHours - b.averageHours),
    heatmap: [...cells.values()].filter((cell) => cell.count >= MIN_PUBLIC_CELL_COUNT),
  };
}

async function getPublicStatistics() {
  if (cachedStatistics && Date.now() < cacheExpiresAt) return cachedStatistics;
  if (!refreshPromise) {
    refreshPromise = complaintModel.listComplaints()
      .then((complaints) => {
        cachedStatistics = publicStatistics(complaints);
        cacheExpiresAt = Date.now() + CACHE_TTL_MS;
        return cachedStatistics;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

module.exports = { getPublicStatistics, publicStatistics };

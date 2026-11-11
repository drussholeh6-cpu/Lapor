const assert = require('node:assert/strict');
const test = require('node:test');
const complaintModel = require('../models/complaintModel');
const {
  getPublicStatistics,
  invalidatePublicStatistics,
  publicStatistics,
} = require('../services/publicStatisticsService');

const now = new Date('2026-11-10T12:00:00.000Z');

function complaint(index, { createdAt, resolvedAt, responseAt, coordinates, status = 3 } = {}) {
  const at = createdAt || '2026-11-01T00:00:00.000Z';
  const log = [{ s: 0, at, visibility: 'public' }];
  if (responseAt) log.push({ s: 1, at: responseAt, visibility: 'public' });
  if (status === 3 && resolvedAt) log.push({ s: 3, at: resolvedAt, visibility: 'public' });
  return {
    code: `PRIVATE-${index}`,
    email: `resident-${index}@example.test`,
    cat: 'Sampah',
    priority: 'normal',
    unit: 'Dinas Kebersihan',
    at,
    coordinates,
    log,
  };
}

test('aggregates public service metrics and suppresses small map and unit groups', () => {
  const complaints = [
    complaint(1, { resolvedAt: '2026-11-02T00:00:00.000Z', responseAt: '2026-11-01T04:00:00.000Z', coordinates: [-6.201, 106.801] }),
    complaint(2, { resolvedAt: '2026-11-03T00:00:00.000Z', responseAt: '2026-11-01T05:00:00.000Z', coordinates: [-6.202, 106.802] }),
    complaint(3, { resolvedAt: '2026-11-05T00:00:00.000Z', responseAt: '2026-11-01T06:00:00.000Z', coordinates: [-6.203, 106.803] }),
    {
      ...complaint(4, { coordinates: [200, 300], status: 0 }),
      log: [
        { s: 0, at: '2026-11-04T00:00:00.000Z', visibility: 'public' },
        { s: 3, at: '2026-11-05T00:00:00.000Z', visibility: 'internal' },
      ],
    },
  ];

  const result = publicStatistics(complaints, now);
  assert.equal(result.total, 4);
  assert.equal(result.active, 1);
  assert.equal(result.completed, 3);
  assert.equal(result.onTimeRate, 67);
  assert.equal(result.monthly.length, 12);
  assert.equal(result.monthly.at(-1).month, '2026-11');
  assert.equal(result.monthly.at(-1).count, 4);
  assert.deepEqual(result.categoryAverages, [{ category: 'Sampah', averageDays: 2.3, count: 3 }]);
  assert.deepEqual(result.unitResponse, [{ unit: 'Dinas Kebersihan', averageHours: 5, count: 3 }]);
  assert.equal(result.heatmap.length, 1);
  assert.equal(result.heatmap[0].count, 3);
  assert.equal(JSON.stringify(result).includes('resident-1@example.test'), false);
  assert.equal(JSON.stringify(result).includes('PRIVATE-1'), false);
});

test('publishes heatmap cells for coordinates and ignores records without valid coordinates', () => {
  const result = publicStatistics([
    complaint(1, { resolvedAt: '2026-11-02T00:00:00.000Z', responseAt: '2026-11-01T01:00:00.000Z', coordinates: [-6.201, 106.801] }),
    complaint(2, { resolvedAt: '2026-11-02T00:00:00.000Z', responseAt: '2026-11-01T02:00:00.000Z' }),
    complaint(3, { coordinates: [200, 300] }),
  ], now);

  assert.equal(result.unitResponse.length, 1);
  assert.equal(result.heatmap.length, 1);
  assert.equal(result.heatmap[0].count, 1);
});

test('does not expose previously saved ratings in public complaint data', () => {
  const complaintData = {
    code: 'ADU-2611-000001',
    cat: 'Sampah',
    loc: 'Jalan Merdeka',
    text: 'Sampah belum diangkut.',
    at: '2026-11-01T00:00:00.000Z',
    priority: 'normal',
    unit: 'Dinas Kebersihan',
    rating: { score: 5, comment: 'Pelayanan bagus.' },
    log: [{ s: 0, at: '2026-11-01T00:00:00.000Z', visibility: 'public' }],
  };

  assert.equal(Object.hasOwn(complaintModel.publicComplaint(complaintData), 'rating'), false);
});

test('refreshes cached public statistics after complaint changes', async () => {
  const originalListComplaints = complaintModel.listComplaints;
  let complaints = [];
  complaintModel.listComplaints = async () => complaints;
  invalidatePublicStatistics();

  try {
    assert.equal((await getPublicStatistics()).total, 0);
    complaints = [complaint(1, { status: 0 })];
    assert.equal((await getPublicStatistics()).total, 0);
    invalidatePublicStatistics();
    assert.equal((await getPublicStatistics()).total, 1);
  } finally {
    complaintModel.listComplaints = originalListComplaints;
    invalidatePublicStatistics();
  }
});

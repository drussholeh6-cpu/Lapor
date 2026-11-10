const assert = require('node:assert/strict');
const test = require('node:test');
const { publicStatistics } = require('../services/publicStatisticsService');

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

test('does not publish ranking or heatmap cells with fewer than three records', () => {
  const result = publicStatistics([
    complaint(1, { resolvedAt: '2026-11-02T00:00:00.000Z', responseAt: '2026-11-01T01:00:00.000Z', coordinates: [-6.201, 106.801] }),
    complaint(2, { resolvedAt: '2026-11-02T00:00:00.000Z', responseAt: '2026-11-01T02:00:00.000Z', coordinates: [-6.202, 106.802] }),
  ], now);

  assert.equal(result.unitResponse.length, 0);
  assert.equal(result.heatmap.length, 0);
});

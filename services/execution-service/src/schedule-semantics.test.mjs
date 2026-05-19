import test from 'node:test';
import assert from 'node:assert/strict';

import { computeNextRunAt, getLocalClock } from './schedule-semantics.mjs';

test('daily schedule should move to next day when local time is passed', () => {
  const next = computeNextRunAt({
    scheduleType: 'daily',
    startTime: '08:00',
    timezone: 'Asia/Shanghai',
    from: '2026-05-19T01:30:00.000Z', // local 09:30
  });
  const local = getLocalClock(next, 'Asia/Shanghai');
  assert.equal(local.hour, 8);
  assert.equal(local.minute, 0);
  assert.equal(local.day, 20);
});

test('weekly schedule should pick nearest valid weekday in timezone', () => {
  const next = computeNextRunAt({
    scheduleType: 'weekly',
    startTime: '08:00',
    weekdays: [2, 4], // Tue/Thu
    timezone: 'Asia/Shanghai',
    from: '2026-05-19T01:30:00.000Z', // Tue local 09:30, so pick Thu
  });
  const local = getLocalClock(next, 'Asia/Shanghai');
  assert.equal(local.weekdayIso, 4);
  assert.equal(local.hour, 8);
  assert.equal(local.minute, 0);
});

test('interval schedule should honor interval days without polling scan', () => {
  const next = computeNextRunAt({
    scheduleType: 'interval',
    startTime: '06:15',
    intervalDays: 2,
    timezone: 'Asia/Shanghai',
    from: '2026-05-19T00:00:00.000Z', // local 08:00, past 06:15
  });
  const local = getLocalClock(next, 'Asia/Shanghai');
  assert.equal(local.hour, 6);
  assert.equal(local.minute, 15);
  assert.equal(local.day, 21);
});

test('DST forward should still produce a future instant', () => {
  const next = computeNextRunAt({
    scheduleType: 'daily',
    startTime: '02:30',
    timezone: 'America/Los_Angeles',
    from: '2026-03-08T08:00:00.000Z',
  });
  const nextDate = new Date(next);
  assert.equal(Number.isNaN(nextDate.getTime()), false);
  assert.equal(nextDate.getTime() > new Date('2026-03-08T08:00:00.000Z').getTime(), true);
});

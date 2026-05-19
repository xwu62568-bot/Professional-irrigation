function parseStartTime(startTime) {
  const raw = String(startTime ?? '00:00').trim();
  const [h = '0', m = '0', s = '0'] = raw.split(':');
  return {
    hour: Math.min(23, Math.max(0, Number(h) || 0)),
    minute: Math.min(59, Math.max(0, Number(m) || 0)),
    second: Math.min(59, Math.max(0, Number(s) || 0)),
  };
}

function zonedParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((item) => [item.type, item.value]));
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekdayIso: weekdayMap[map.weekday] ?? 1,
  };
}

function localToUtc(local, timezone) {
  // Iteratively converge local wall-clock time to UTC instant in target timezone.
  let guess = new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second));
  for (let i = 0; i < 4; i += 1) {
    const zoned = zonedParts(guess, timezone);
    const wantedMs = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
    const gotMs = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
    const diffMs = wantedMs - gotMs;
    if (diffMs === 0) break;
    guess = new Date(guess.getTime() + diffMs);
  }
  return guess;
}

function addDays(local, days) {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day + days, local.hour, local.minute, local.second));
  return {
    ...local,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

export function computeNextRunAt({
  scheduleType,
  startTime,
  weekdays = [],
  intervalDays = 1,
  timezone = 'UTC',
  from = new Date(),
}) {
  const base = from instanceof Date ? from : new Date(from);
  const baseLocal = zonedParts(base, timezone);
  const start = parseStartTime(startTime);
  let candidateLocal = {
    year: baseLocal.year,
    month: baseLocal.month,
    day: baseLocal.day,
    hour: start.hour,
    minute: start.minute,
    second: start.second,
  };

  if (scheduleType === 'daily') {
    let candidate = localToUtc(candidateLocal, timezone);
    if (candidate <= base) {
      candidateLocal = addDays(candidateLocal, 1);
      candidate = localToUtc(candidateLocal, timezone);
    }
    return candidate.toISOString();
  }

  if (scheduleType === 'weekly') {
    const validDays = [...new Set((weekdays ?? []).map((d) => Number(d)).filter((d) => d >= 1 && d <= 7))].sort((a, b) => a - b);
    const dayList = validDays.length > 0 ? validDays : [baseLocal.weekdayIso];
    let best = null;
    for (const dayValue of dayList) {
      let daysAhead = (dayValue - baseLocal.weekdayIso + 7) % 7;
      let local = addDays(candidateLocal, daysAhead);
      let candidate = localToUtc(local, timezone);
      if (candidate <= base) {
        daysAhead += 7;
        local = addDays(candidateLocal, daysAhead);
        candidate = localToUtc(local, timezone);
      }
      if (!best || candidate < best) best = candidate;
    }
    return best.toISOString();
  }

  const step = Math.max(1, Number(intervalDays) || 1);
  let candidate = localToUtc(candidateLocal, timezone);
  while (candidate <= base) {
    candidateLocal = addDays(candidateLocal, step);
    candidate = localToUtc(candidateLocal, timezone);
  }
  return candidate.toISOString();
}

export function getLocalClock(iso, timezone) {
  return zonedParts(new Date(iso), timezone);
}

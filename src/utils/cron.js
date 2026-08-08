/**
 * Minimal cron expression parser and scheduler.
 * Replaces the unmaintained `later` package with Node built-ins.
 *
 * Supports 5-field (minute hour day-of-month month day-of-week) and
 * 6-field (with a leading seconds) expressions. Each field accepts
 * wildcard, step, single value, range, range-with-step and
 * comma-separated lists. All times are interpreted in local time,
 * matching the previous `later.date.localTime()` default.
 */

const FIELD_BOUNDS = {
  second: [0, 59],
  minute: [0, 59],
  hour: [0, 23],
  dayOfMonth: [1, 31],
  month: [1, 12],
  dayOfWeek: [0, 7]
};

const FIELD_ORDER = [
  'second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'
];

const parseField = (field, min, max) => {
  const values = new Set();
  for (const token of field.split(',')) {
    if (token === '*') {
      for (let value = min; value <= max; value += 1) {
        values.add(value);
      }
      continue;
    }
    if (token.includes('/')) {
      const [base, stepToken] = token.split('/');
      const step = Number.parseInt(stepToken, 10);
      if (Number.isNaN(step) || step < 1) {
        throw new Error(`Invalid cron step "${stepToken}" in "${field}"`);
      }
      let start = min;
      let end = max;
      if (base !== '*') {
        if (base.includes('-')) {
          [start, end] = base.split('-').map(v => Number.parseInt(v, 10));
        } else {
          start = Number.parseInt(base, 10);
        }
      }
      if (Number.isNaN(start) || start < min || start > max
        || Number.isNaN(end) || end < min || end > max || start > end) {
        throw new Error(`Invalid cron value in "${field}"`);
      }
      for (let value = start; value <= end; value += step) {
        values.add(value);
      }
      continue;
    }
    if (token.includes('-')) {
      const [start, end] = token.split('-').map(v => Number.parseInt(v, 10));
      if (Number.isNaN(start) || Number.isNaN(end)
        || start < min || end > max || start > end) {
        throw new Error(`Invalid cron range in "${field}"`);
      }
      for (let value = start; value <= end; value += 1) {
        values.add(value);
      }
      continue;
    }
    const value = Number.parseInt(token, 10);
    if (Number.isNaN(value) || value < min || value > max) {
      throw new Error(`Invalid cron value "${token}" in "${field}"`);
    }
    values.add(value);
  }
  return values;
};

/**
 * Parse a cron expression into a schedule of Sets.
 * @param {string} expression
 * @param {boolean} [useSeconds=false]
 * @returns {Object}
 */
export const parseCron = (expression, useSeconds = false) => {
  const parts = String(expression).trim().split(/\s+/);
  const names = useSeconds ? FIELD_ORDER : FIELD_ORDER.slice(1);
  if (parts.length !== names.length) {
    throw new Error(
      `Cron expression must contain ${names.length} fields, got ${parts.length}: "${expression}"`
    );
  }
  const schedule = {};
  names.forEach((name, index) => {
    const [min, max] = FIELD_BOUNDS[name];
    schedule[name] = parseField(parts[index], min, max);
  });
  if (schedule.dayOfWeek) {
    if (schedule.dayOfWeek.has(7)) {
      schedule.dayOfWeek.delete(7);
      schedule.dayOfWeek.add(0);
    }
  }
  return schedule;
};

const matches = (schedule, date) => {
  if (schedule.second && !schedule.second.has(date.getSeconds())) {
    return false;
  }
  if (schedule.minute && !schedule.minute.has(date.getMinutes())) {
    return false;
  }
  if (schedule.hour && !schedule.hour.has(date.getHours())) {
    return false;
  }
  if (schedule.dayOfMonth && !schedule.dayOfMonth.has(date.getDate())) {
    return false;
  }
  if (schedule.month && !schedule.month.has(date.getMonth() + 1)) {
    return false;
  }
  if (schedule.dayOfWeek && !schedule.dayOfWeek.has(date.getDay())) {
    return false;
  }
  return true;
};

/**
 * Compute the next run date strictly after `from` that matches the schedule.
 * @param {Object} schedule
 * @param {Date} [from=new Date()]
 * @returns {Date}
 */
export const getNextRun = (schedule, from = new Date()) => {
  const stepMs = schedule.second ? 1000 : 60000;
  let current = new Date(Math.floor(from.getTime() / stepMs) * stepMs + stepMs);
  const deadline = from.getTime() + 366 * 24 * 3600 * 1000;

  while (current.getTime() <= deadline) {
    if (matches(schedule, current)) {
      return current;
    }
    //Fast-forward coarse fields so unschedulable expressions stay fast
    if (schedule.month && !schedule.month.has(current.getMonth() + 1)) {
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1, 0, 0, 0, 0);
      continue;
    }
    if (schedule.dayOfMonth && !schedule.dayOfMonth.has(current.getDate())) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }
    if (schedule.dayOfWeek && !schedule.dayOfWeek.has(current.getDay())) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }
    if (schedule.hour && !schedule.hour.has(current.getHours())) {
      current.setHours(current.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (schedule.minute && !schedule.minute.has(current.getMinutes())) {
      current.setMinutes(current.getMinutes() + 1, 0, 0);
      continue;
    }
    if (schedule.second && !schedule.second.has(current.getSeconds())) {
      current.setSeconds(current.getSeconds() + 1, 0);
      continue;
    }
    current = new Date(current.getTime() + stepMs);
  }

  throw new Error('Cron expression has no match within the next year');
};

const MAX_TIMEOUT = 2147483647;

/**
 * Run `callback` on `schedule` until the returned handle is cleared.
 * @param {function} callback
 * @param {Object} schedule
 * @returns {{clear: function}}
 */
export const setCronInterval = (callback, schedule) => {
  let timer = null;

  const scheduleNext = () => {
    const nextRun = getNextRun(schedule, new Date());
    const delay = Math.max(0, nextRun.getTime() - Date.now());
    timer = setTimeout(() => {
      scheduleNext();
      if (delay <= MAX_TIMEOUT) {
        callback();
      }
    }, Math.min(delay, MAX_TIMEOUT));
  };

  scheduleNext();

  return {
    clear() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
  };
};

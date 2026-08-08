import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCron, getNextRun, setCronInterval } from '../../src/utils/cron.js';

test('parse 5 field cron', () => {
  const schedule = parseCron('* * * * *');
  assert.equal(schedule.second, undefined);
  assert.equal(schedule.minute.size, 60);
  assert.equal(schedule.hour.size, 24);
  assert.equal(schedule.dayOfMonth.size, 31);
  assert.equal(schedule.month.size, 12);
  assert.equal(schedule.dayOfWeek.size, 7);
});

test('parse 6 field cron with seconds', () => {
  const schedule = parseCron('0/10 * * * * *', true);
  assert.deepEqual([...schedule.second].sort((a, b) => a - b), [0, 10, 20, 30, 40, 50]);
});

test('parse range, range with step and lists', () => {
  assert.deepEqual([...parseCron('1-5 * * * *').minute].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  assert.deepEqual(
    [...parseCron('1-10/3 * * * *').minute].sort((a, b) => a - b),
    [1, 4, 7, 10]
  );
  assert.deepEqual(
    [...parseCron('1,5,20 * * * *').minute].sort((a, b) => a - b),
    [1, 5, 20]
  );
});

test('parse normalizes sunday 7 to 0', () => {
  const schedule = parseCron('* * * * 7');
  assert.ok(schedule.dayOfWeek.has(0));
  assert.equal(schedule.dayOfWeek.has(7), false);
});

test('parse invalid field count throws', () => {
  assert.throws(() => parseCron('* * * *'), /must contain 5 fields/);
  assert.throws(() => parseCron('* * * * * *'), /must contain 5 fields/);
  assert.throws(() => parseCron('* * * * *', true), /must contain 6 fields/);
});

test('parse invalid value throws', () => {
  assert.throws(() => parseCron('99 * * * *'), /Invalid cron value/);
  assert.throws(() => parseCron('*/0 * * * *'), /Invalid cron step/);
  assert.throws(() => parseCron('5-1 * * * *'), /Invalid cron range/);
});

test('getNextRun every minute', () => {
  const next = getNextRun(parseCron('* * * * *'), new Date(2020, 0, 1, 12, 30, 45));
  assert.equal(next.getTime(), new Date(2020, 0, 1, 12, 31, 0).getTime());
});

test('getNextRun every second', () => {
  const next = getNextRun(parseCron('* * * * * *', true), new Date(2020, 0, 1, 12, 30, 45));
  assert.equal(next.getTime(), new Date(2020, 0, 1, 12, 30, 46).getTime());
});

test('getNextRun every 10 seconds aligns to step', () => {
  const next = getNextRun(parseCron('0/10 * * * * *', true), new Date(2020, 0, 1, 12, 30, 45));
  assert.equal(next.getTime(), new Date(2020, 0, 1, 12, 30, 50).getTime());
});

test('getNextRun daily schedule jumps to next day', () => {
  const next = getNextRun(parseCron('5 4 * * *'), new Date(2020, 0, 1, 12, 30, 45));
  assert.equal(next.getTime(), new Date(2020, 0, 2, 4, 5, 0).getTime());
});

test('getNextRun yearly schedule rolls over', () => {
  const next = getNextRun(parseCron('0 0 1 1 *'), new Date(2020, 0, 1, 12, 30, 45));
  assert.equal(next.getTime(), new Date(2021, 0, 1, 0, 0, 0).getTime());
});

test('getNextRun throws for unsatisfiable schedule', () => {
  assert.throws(() => getNextRun(parseCron('0 0 31 2 *'), new Date(2020, 0, 1, 0, 0, 0)), /no match/);
});

test('setCronInterval runs and clears', async () => {
  let count = 0;
  const handle = setCronInterval(() => {
    count += 1;
  }, parseCron('* * * * * *', true));

  await new Promise(resolve => setTimeout(resolve, 2500));
  assert.ok(count >= 1);

  handle.clear();
  const frozen = count;
  await new Promise(resolve => setTimeout(resolve, 1200));
  assert.equal(count, frozen);
});

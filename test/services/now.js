import test, { before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import moment from 'moment-timezone';
import DI from '../../src/di.js';
import * as providers from '../../src/services/providers.js';

DI.registerMockedProviders(Object.values(providers), `${import.meta.dirname}/../_demo_project/config`);
const now = DI.get('now');

before(() => {
  moment.tz.setDefault('Asia/Shanghai');
});

afterEach(() => {
  now.clear();
});

test('Change now by timestamp', () => {
  now.setNow(1481297817);
  assert.equal(now.getDatabaseDatetime(), '2016-12-09 23:36:57');
  assert.equal(now.getTimestamp(), 1481297817);
  assert.equal(now.getMoment().unix(), 1481297817);
});

test('Change now by string', () => {
  now.setNow('2016-12-09T23:42:06.000');
  assert.equal(now.getDatabaseDatetime(), '2016-12-09 23:42:06');
  assert.equal(now.getTimestamp(), 1481298126);
  assert.equal(now.getMoment().unix(), 1481298126);
});

test('Change now by other', () => {
  now.setNow(new Date(Date.UTC(2016, 11, 9)));
  assert.equal(now.getDatabaseDatetime(), '2016-12-09 08:00:00');
  assert.equal(now.getTimestamp(), 1481241600);
  assert.equal(now.getMoment().unix(), 1481241600);
});

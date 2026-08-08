import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTimestamp, getMilliTimestamp,
  getMicroTimestamp, getDatabaseDatetime
} from './../../src/utils/datetime.js';

test('Datetime length', () => {
  assert.equal(getTimestamp().toString().length, 10);
  assert.equal(getMilliTimestamp().toString().length, 13);
  assert.equal(getMicroTimestamp().toString().length, 16);
  assert.equal(getDatabaseDatetime().length, 19);
});

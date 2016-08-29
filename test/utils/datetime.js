import test from 'ava';
import {
  getTimestamp, getMilliTimestamp,
  getMicroTimestamp, getDatabaseDatetime
} from './../../src/utils/datetime';

test('Datetime length', (t) => {
  t.is(getTimestamp().toString().length, 10);
  t.is(getMilliTimestamp().toString().length, 13);
  t.is(getMicroTimestamp().toString().length, 16);
  t.is(getDatabaseDatetime().length, 19);
});

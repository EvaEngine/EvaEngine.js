import test from 'ava';
import moment from 'moment';
import DI from '../../src/di';
import * as providers from '../../src/services/providers';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);
const now = DI.get('now');

const tz = moment().utcOffset();
test.before(() => {
  process.env.TZ = 'Asia/Shanghai';
  moment().utcOffset('+08:00');
});

test.afterEach(() => {
  now.clear();
});

test('Change now by timestamp', (t) => {
  now.setNow(1481297817);
  t.is(now.getDatabaseDatetime(), '2016-12-09 23:36:57');
  t.is(now.getTimestamp(), 1481297817);
  t.is(now.getMoment().unix(), 1481297817);
});

test('Change now by string', (t) => {
  now.setNow('2016-12-09T23:42:06.000');
  t.is(now.getDatabaseDatetime(), '2016-12-09 23:42:06');
  t.is(now.getTimestamp(), 1481298126);
  t.is(now.getMoment().unix(), 1481298126);
});


test('Change now by other', (t) => {
  now.setNow(new Date(2016, 11, 9));
  t.is(now.getDatabaseDatetime(), '2016-12-09 00:00:00');
  t.is(now.getTimestamp(), 1481212800);
  t.is(now.getMoment().unix(), 1481212800);
});

test.after(() => {
  moment().utcOffset(tz);
});

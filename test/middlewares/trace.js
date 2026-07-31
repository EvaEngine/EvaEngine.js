import test from 'ava';
import DI from '../../src/di.js';
import * as providers from '../../src/services/providers.js';
import * as middlewares from '../../src/middlewares/providers.js';
import { mockRequest, mockResponse } from '../../src/utils/test.js';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);
DI.registerMockedProviders(Object.values(middlewares));
test('Unique request id', (t) => {
  const middleware = DI.get('trace')();
  const req = mockRequest();
  const res = mockResponse();
  middleware(req, res, () => {
  });
  t.truthy(res.getHeader('X-B3-SpanId'));
});

test('propagates disabled upstream sampling', (t) => {
  const middleware = DI.get('trace')();
  const req = mockRequest({
    headers: {
      'x-b3-traceid': 'trace-id',
      'x-b3-spanid': '1',
      'x-b3-sampled': '0'
    }
  });
  const res = mockResponse();
  middleware(req, res, () => {});
  t.is(res.getHeader('X-B3-Sampled'), 0);
});

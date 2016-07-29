import test from 'ava';
import DI from '../../src/di';
import * as providers from '../../src/services/providers';
import * as middlewares from '../../src/middlewares/providers';
import { mockRequest, mockResponse } from '../../src/utils/test';

DI.registerMockedProviders(Object.values(providers), `${__dirname}/../_demo_project/config`);
DI.registerMockedProviders(Object.values(middlewares));
test('Unique request id', (t) => {
  const middleware = DI.get('request_id')();
  const req = mockRequest();
  const res = mockResponse();
  middleware(req, res, () => {
  });
  t.truthy(res.getHeader('X-Request-Id'));
});

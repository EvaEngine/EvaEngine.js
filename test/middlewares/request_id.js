import test from 'ava';
import requestIdMiddleware from '../../src/middlewares/request_id';
import { mockRequest, mockResponse } from '../../src/utils/test';

test('Unique request id', (t) => {
  const middleware = requestIdMiddleware()();
  const req = mockRequest();
  const res = mockResponse();
  middleware(req, res, () => {
  });
  t.truthy(res.getHeader('X-Request-Id'));
});

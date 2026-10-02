import type { RequestHandler } from 'express';

const wrapper = (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise
      .resolve(fn(req, res, next))
      .catch(next);


export default wrapper;

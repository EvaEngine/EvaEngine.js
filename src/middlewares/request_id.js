import shortid from 'shortid';
import Namespace from '../services/namespace';
import { Dependencies } from 'constitute';

function RequestIdMiddleware(ns) {
  return () => (req, res, next) => {
    const id = shortid.generate();
    Object.assign(req, { id });
    res.setHeader('X-Request-Id', req.id);
    ns.bindEmitter(req);
    ns.bindEmitter(res);
    ns.run(() => {
      ns.set('rid', id);
      next();
    });
  };
}
Dependencies(Namespace)(RequestIdMiddleware);  //eslint-disable-line new-cap

export default RequestIdMiddleware;

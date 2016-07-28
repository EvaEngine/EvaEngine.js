import shortid from 'shortid';
import { Dependencies } from 'constitute';
import { getNamespace } from 'continuation-local-storage';

function RequestIdMiddleware() {
  return () => (req, res, next) => {
    const id = req.get('X-Request-Id') || shortid.generate();
    const namespace = getNamespace('eva.engine');
    Object.assign(req, { id });
    res.setHeader('X-Request-Id', req.id);
    namespace.bindEmitter(req);
    namespace.bindEmitter(res);
    namespace.run(() => {
      // console.log('set rid to namespace');
      namespace.set('rid', id);
      next();
    });
  };
}
Dependencies()(RequestIdMiddleware);  //eslint-disable-line new-cap

export default RequestIdMiddleware;

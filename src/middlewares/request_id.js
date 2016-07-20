import shortid from 'shortid';
import { Dependencies } from 'constitute';

function RequestIdMiddleware() {
  return () => (req, res, next) => {
    const id = req.get('X-Request-Id') || shortid.generate();
    Object.assign(req, { id });
    res.setHeader('X-Request-Id', req.id);
    next();
  };
}
Dependencies()(RequestIdMiddleware);  //eslint-disable-line new-cap

export default RequestIdMiddleware;

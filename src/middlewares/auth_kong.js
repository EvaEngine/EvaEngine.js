import { UnauthorizedException } from '../exceptions';
import wrapper from '../utils/wrapper';

/**
 * @returns {function()}
 * @constructor
 */
function AuthKongMiddleware() {
  return () => wrapper(async (req, res, next) => {
    if (req.headers['x-anonymous-consumer'] === 'true') {
      throw new UnauthorizedException('Authentication failed');
    }
    const uid = Number.parseInt(req.headers['x-consumer-custom-id'], 10);
    const mobile = req.headers['x-consumer-custom-username'];
    if (uid > 0) {
      res.set('X-Uid', uid);
      res.set('X-Mobile', mobile);
      req.auth = {
        uid,
        mobile
      };
      return next();
    }
    throw new UnauthorizedException('Authentication failed, invalid UID');
  });
}

export default AuthKongMiddleware;

import { UnauthorizedException } from '../exceptions/index.ts';
import wrapper from '../utils/wrapper.ts';

function AuthKongMiddleware() {
  return () => wrapper(async (req, res, next) => {
    if (req.headers['x-anonymous-consumer'] === 'true') {
      throw new UnauthorizedException('Authentication failed');
    }
    const uid = Number.parseInt(req.headers['x-consumer-custom-id'] as string, 10);
    const mobile = req.headers['x-consumer-custom-username'];
    if (uid > 0) {
      //express 类型将 header 值限制为 string，运行时 Node 接受数字并自动强转
      res.set('X-Uid', uid as unknown as string);
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

import { Dependencies } from '../di.ts';
import wrapper from '../utils/wrapper.ts';
import { UnauthorizedException } from '../exceptions/index.ts';
import Config from '../services/config.ts';
import Now from '../services/now.ts';
import JsonWebToken from '../services/jwt_token.ts';

interface TokenConfig {
  token: {
    faker: {
      enable: boolean;
      key: string;
      uid: string | number;
    };
  };
}

function AuthMiddleware(_config: Config, token: JsonWebToken, now: Now) {
  const config = _config.get() as TokenConfig;
  return () => wrapper(async (req, res, next) => {
    const jwToken = req.header('X-Token') || req.query.api_key;
    if (config.token.faker.enable === true && req.auth && req.auth.uid) {
      //express 类型将 header 值限制为 string，运行时 Node 接受数字并自动强转
      res.set('X-Uid', req.auth.uid as string);
      return next();
    }
    if (config.token.faker.enable === true && jwToken === config.token.faker.key) {
      req.auth = {
        type: 'fake',
        uid: config.token.faker.uid,
        token: config.token.faker.key
      };
      res.set('X-Uid', config.token.faker.uid as string);
      return next();
    }
    if (jwToken) {
      let parsedToken: unknown;
      try {
        parsedToken = await token.find(jwToken as string);
      } catch {
        throw new UnauthorizedException('Token not recognizable');
      }
      const { uid, expiredAt } = parsedToken as { uid?: unknown; expiredAt?: unknown };
      if (!uid) {
        throw new UnauthorizedException('User info not found in token');
      }
      if (typeof expiredAt !== 'number' || expiredAt <= now.getTimestamp()) {
        throw new UnauthorizedException('Token expired');
      }
      req.auth = {
        type: 'jwt',
        uid,
        token: jwToken as string
      };
      res.set('X-Uid', uid as string);
      return next();
    }

    if (req.session && (req.session as { uid?: string | number }).uid) {
      const sessionUid = (req.session as { uid?: string | number }).uid;
      req.auth = {
        type: 'session',
        uid: sessionUid,
        token: ''
      };
      res.set('X-Uid', sessionUid as string);
      return next();
    }
    throw new UnauthorizedException('No authority token found');
  });
}
Dependencies(Config, JsonWebToken, Now)(AuthMiddleware);
export default AuthMiddleware;

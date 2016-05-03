import wrapper from '../utils/wrapper';
import {
  UnauthorizedException
} from '../exceptions';
import { Dependencies } from 'constitute';
import Config from '../services/config';
import JsonWebToken from '../services/jwt_token';
import moment from 'moment';

function AuthMiddleware(_config, token) {
  const config = _config.get();
  /*eslint-disable no-param-reassign*/
  return () => wrapper(async(req, res, next) => {
    const jwToken = req.header('X-Token') || req.query.api_key;
    if (config.token.faker.enable === true && jwToken === config.token.faker.key) {
      req.auth = {
        type: 'fake',
        uid: config.token.faker.uid,
        token: config.token.faker.key
      };
      return next();
    }
    if (jwToken) {
      let parsedToken = {};
      try {
        parsedToken = await token.find(jwToken);
      } catch (e) {
        throw new UnauthorizedException('Token not recognizable');
      }
      const { uid, expiredAt } = parsedToken;
      if (!uid) {
        throw new UnauthorizedException('User info not found in token');
      }
      if (expiredAt < moment().unix()) {
        throw new UnauthorizedException('Token expired');
      }
      req.auth = {
        type: 'jwt',
        uid,
        token: jwToken
      };
      return next();
    }

    if (req.session && req.session.uid) {
      req.auth = {
        type: 'session',
        uid: req.session.uid,
        token: ''
      };
      return next();
    }
    throw new UnauthorizedException('No authority token found');
  });
  /*eslint-enable no-param-reassign*/
}
Dependencies(Config, JsonWebToken)(AuthMiddleware)
export default AuthMiddleware;

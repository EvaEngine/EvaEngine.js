import moment from 'moment';
import { Dependencies } from 'constitute';
import wrapper from '../utils/wrapper';
import {
  UnauthorizedException
} from '../exceptions';
import Config from '../services/config';
import JsonWebToken from '../services/jwt_token';

/**
 * @param _config {Config}
 * @param token {JsonWebToken}
 * @returns {function()}
 * @constructor
 */
function AuthMiddleware(_config, token) {
  const config = _config.get();
  return () => wrapper(async (req, res, next) => {
    const jwToken = req.header('X-Token') || req.query.api_key;
    if (config.token.faker.enable === true && jwToken === config.token.faker.key) {
      req.auth = { //eslint-disable-line no-param-reassign
        type: 'fake',
        uid: config.token.faker.uid,
        token: config.token.faker.key
      };
      res.set('X-Uid', config.token.faker.uid);
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
      req.auth = { //eslint-disable-line no-param-reassign
        type: 'jwt',
        uid,
        token: jwToken
      };
      res.set('X-Uid', uid);
      return next();
    }

    if (req.session && req.session.uid) {
      req.auth = { //eslint-disable-line no-param-reassign
        type: 'session',
        uid: req.session.uid,
        token: ''
      };
      res.set('X-Uid', req.session.uid);
      return next();
    }
    throw new UnauthorizedException('No authority token found');
  });
}
Dependencies(Config, JsonWebToken)(AuthMiddleware); //eslint-disable-line new-cap
export default AuthMiddleware;

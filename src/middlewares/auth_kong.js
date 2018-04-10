import { Dependencies } from 'constitute';
import _ from 'lodash';

import DI from '../di';
import wrapper from '../utils/wrapper';
import { UnauthorizedException } from '../exceptions';
import Config from '../services/config';

/**
 * @param _config {Config}
 * @returns {function()}
 * @constructor
 */
function AuthKongMiddleware(_config) {
  const config = _config.get();
  const token = DI.get('jwt');
  return () => wrapper(async (req, res, next) => {
    const jwToken = req.header('X-Token') || req.query.api_key;
    if (config.token.faker.enable === true && req.auth && req.auth.uid) {
      res.set('X-Uid', req.auth.uid);
      return next();
    }
    if (config.token.faker.enable === true && jwToken === config.token.faker.key) {
      req.auth = { //eslint-disable-line no-param-reassign
        type: 'fake',
        uid: config.token.faker.uid,
        token: config.token.faker.key
      };
      res.set('X-Uid', config.token.faker.uid);
      return next();
    }
    if (req.headers['x-consumer-custom-id']) {
      let uid;
      if (_.get(config, 'token.kong.noTokenSent')) {
        uid = req.headers['x-consumer-custom-id'];
      } else {
        const parsedToken = await token.find(jwToken);
        ({ uid } = parsedToken);
        if (!uid) {
          throw new UnauthorizedException('User info not found in token');
        }
        if (req.headers['x-consumer-custom-id'] !== uid.toString()) {
          throw new UnauthorizedException('Invalid token.');
        }
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

Dependencies(Config)(AuthKongMiddleware); //eslint-disable-line new-cap
export default AuthKongMiddleware;

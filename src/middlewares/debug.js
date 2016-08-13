import morgan from 'morgan';
import { Dependencies } from 'constitute';
import Env from '../services/env';
import Logger from '../services/logger';

/**
 * @param env {Env}
 * @param logger {Logger}
 * @returns {function()}
 * @constructor
 */
function DebugMiddleware(env, logger) {
  return () => {
    if (!env.isDevelopment()) {
      return (req, res, next) => {
        next();
      };
    }
    return morgan('combined', {
      stream: {
        write: (message) => {
          logger.debug(message);
        }
      }
    });
  };
}
Dependencies(Env, Logger)(DebugMiddleware); //eslint-disable-line new-cap
export default DebugMiddleware;

import morgan from 'morgan';
import { Dependencies } from 'constitute';
import Logger from '../services/logger';

/**
 * @param logger {Logger}
 * @returns {function()}
 * @constructor
 */
function DebugMiddleware(logger) {
  return () =>
    morgan('combined', {
      stream: {
        write: (message) => {
          logger.info(message);
        }
      }
    });
}
Dependencies(Logger)(DebugMiddleware); //eslint-disable-line new-cap
export default DebugMiddleware;

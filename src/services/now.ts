import constitute from 'constitute';
import moment from 'moment-timezone';
import { getTimestamp, getDatabaseDatetime } from '../utils/datetime.ts';
import Logger from './logger.ts';
import ServiceInterface from './interface.ts';

class Now extends ServiceInterface {
  logger: Logger;
  now: number | null;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.now = null;
  }

  setNow(now: number | moment.Moment | string | Date): this {
    if (typeof now === 'number') {
      this.now = now;
    } else if (now instanceof moment) {
      this.now = (now as moment.Moment).unix();
    } else {
      this.now = moment(now).unix();
    }
    this.logger.warn('Now has been force changed to %s', moment.unix(this.now));
    return this;
  }

  clear(): this {
    this.now = null;
    return this;
  }

  getTimestamp(): number {
    return this.now || getTimestamp();
  }

  getMoment(): moment.Moment {
    return this.now ? moment.unix(this.now) : moment();
  }

  getDatabaseDatetime(): string {
    return this.now ? moment.unix(this.now).format('YYYY-MM-DD HH:mm:ss') : getDatabaseDatetime();
  }
}

constitute.Dependencies(Logger)(Now);
export default Now;

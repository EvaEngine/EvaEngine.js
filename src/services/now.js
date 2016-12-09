import { Dependencies } from 'constitute';
import moment from 'moment';
import { getTimestamp, getDatabaseDatetime } from '../utils/datetime';
import Logger from './logger';

@Dependencies(Logger) //eslint-disable-line new-cap
export default class Now {
  /**
   * @param {Logger} logger
   */
  constructor(logger) {
    this.logger = logger;
    this.now = null;
  }

  setNow(now) {
    if (typeof now === 'number') {
      this.now = now;
    } else if (now instanceof moment) {
      this.now = now.unix();
    } else {
      this.now = moment(now).unix();
    }
    this.logger.warn('Now has been force changed to %s', moment.unix(this.now));
    return this;
  }

  clear() {
    this.now = null;
    return this;
  }

  getTimestamp() {
    return this.now || getTimestamp();
  }

  getMoment() {
    return moment.unix(this.now) || moment();
  }

  getDatabaseDatetime() {
    return this.now ? moment.unix(this.now).format('YYYY-MM-DD HH:mm:ss') : getDatabaseDatetime();
  }
}


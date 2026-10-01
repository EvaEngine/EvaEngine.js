import moment from 'moment-timezone';

export const getTimestamp = (): number =>
  Math.floor(Date.now() / 1000);

export const getMilliTimestamp = (): number =>
  Date.now();

export const getMicroTimestamp = (): number =>
  Date.now() * 1000;

export const getDatabaseDatetime = (): string =>
  moment().format('YYYY-MM-DD HH:mm:ss');

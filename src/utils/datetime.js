import moment from 'moment-timezone';

export const getTimestamp = () =>
  Math.floor(Date.now() / 1000);

export const getMilliTimestamp = () =>
  Date.now();

export const getMicroTimestamp = () =>
  Date.now() * 1000;

export const getDatabaseDatetime = () =>
  moment().format('YYYY-MM-DD HH:mm:ss');

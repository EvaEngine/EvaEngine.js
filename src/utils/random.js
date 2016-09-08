import random from 'lodash/random';

const randomString = (len = 16) => {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let str = '';
  for (let i = 0; i < len; i++) {
    const rand = random(0, digits.length - 1);
    str += digits[rand];
  }
  return str;
};

export default randomString;

export {
  randomString
};

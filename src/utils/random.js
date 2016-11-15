import random from 'lodash/random';

const randomString = (len = 16) => {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let str = '';
  for (let i = 0; i < len; i += 1) {
    const rand = random(0, digits.length - 1);
    str += digits[rand];
  }
  return str;
};

const randomNumber = (min, max) => {
  if (max) {
    return parseInt((Math.random() * ((max - min) + 1)) + min, 10);
  }
  return parseInt((Math.random() * min) + 1, 10);
};

export {
  randomNumber,
  randomString
};

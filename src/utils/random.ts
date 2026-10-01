import random from 'lodash/random.js';

const randomString = (len = 16): string => {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let str = '';
  for (let i = 0; i < len; i += 1) {
    const rand = random(0, digits.length - 1);
    str += digits[rand];
  }
  return str;
};

const randomNumber = (min: number, max?: number): number => {
  if (max) {
    return parseInt(String((Math.random() * ((max - min) + 1)) + min), 10);
  }
  return parseInt(String((Math.random() * min) + 1), 10);
};

export {
  randomNumber,
  randomString
};

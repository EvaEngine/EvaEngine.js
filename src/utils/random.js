const randomString = (len = 16) => {
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let str = '';
  for (let i = 0; i < len; i++) {
    const rand = Math.floor(Math.random() * len);
    if (rand !== 0 || str.length > 0) {
      str += digits[rand];
    }
  }
  return str;
};

export default randomString;

export {
  randomString
};

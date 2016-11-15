let env = null;

export const TYPES = {
  PRODUCTION: 'production',
  TEST: 'test',
  DEVELOPMENT: 'development'
};

export default class Env {
  get() {
    if (env) {
      return env;
    }

    env = [TYPES.PRODUCTION, TYPES.TEST, TYPES.DEVELOPMENT].indexOf(process.env.NODE_ENV) > -1
      ? process.env.NODE_ENV : TYPES.DEVELOPMENT;
    return env;
  }

  isTest() {
    return this.get() === TYPES.TEST;
  }

  isProduction() {
    return this.get() === TYPES.PRODUCTION;
  }

  isDevelopment() {
    return this.get() === TYPES.DEVELOPMENT;
  }
}

import ServiceInterface from './interface.ts';

let env: string | null = null;
export const TYPES = {
  PRODUCTION: 'production',
  TEST: 'test',
  DEVELOPMENT: 'development'
};

export default class Env extends ServiceInterface {
  get(): string {
    env = [TYPES.PRODUCTION, TYPES.TEST, TYPES.DEVELOPMENT].indexOf(process.env.NODE_ENV as string) > -1
      ? process.env.NODE_ENV as string : TYPES.DEVELOPMENT;
    return env;
  }

  isTest(): boolean {
    return this.get() === TYPES.TEST;
  }

  isProduction(): boolean {
    return this.get() === TYPES.PRODUCTION;
  }

  isDevelopment(): boolean {
    return this.get() === TYPES.DEVELOPMENT;
  }
}

import get from 'lodash/get.js';
import merge from 'lodash/merge.js';
import { createRequire } from 'module';
import constitute from 'constitute';
import Env from './env.ts';
import EngineConfig from '../config/index.ts';
import ServiceInterface from './interface.ts';

const require = createRequire(import.meta.url);

class Config extends ServiceInterface {
  env: Env;
  path: string | null | undefined;
  mergedFiles: string[];
  config: object | null;

  constructor(env: Env) {
    super();
    this.env = env;
    this.path = null;
    this.mergedFiles = [];
    this.config = null;
  }

  setPath(path: string | undefined): this {
    this.path = path;
    return this;
  }

  get(key?: string): unknown {
    if (this.config) {
      return key ? Config.search(key, this.config) : this.config;
    }
    this.config = this.loadConfigFromFiles();
    return key ? Config.search(key, this.config) : this.config;
  }

  loadConfigFromFiles(): object {
    const env = this.env.get();
    const configPath = this.path;
    const pathDefault = `${configPath}/config.default.cjs`;
    const pathEnv = `${configPath}/config.${env}.cjs`;
    const pathLocal = `${configPath}/config.local.${env}.cjs`;


    const configDefault: unknown = require(pathDefault);
    this.mergedFiles.push(pathDefault);
    const configEnv: unknown = require(pathEnv);
    this.mergedFiles.push(pathEnv);
    let configLocal: unknown = {};
    try {
      configLocal = require(pathLocal);
      this.mergedFiles.push(pathLocal);
    } catch {
      configLocal = {};
    }


    return merge({}, EngineConfig, configDefault as object, configEnv as object, configLocal as object);
  }

  getMergedFiles(): string[] {
    return this.mergedFiles;
  }

  reload(): void {
    this.config = null;
    this.mergedFiles = [];
  }

  static search(keyString: unknown, target: object): unknown {
    if (typeof keyString !== 'string') {
      return target;
    }
    return get(target, keyString);
  }
}

constitute.Dependencies(Env)(Config);
export default Config;

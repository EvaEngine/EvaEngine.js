import merge from 'lodash/merge';
import Env from './env';
import EngineConfig from '../config';
import { Dependencies } from 'constitute';

let config = null;

@Dependencies(Env) //eslint-disable-line new-cap
export default class Config {
  /**
   * @param env {Env}
   */
  constructor(env) {
    this.env = env;
    this.path = null;
  }

  setPath(path) {
    this.path = path;
  }

  get(key) {
    if (config) {
      return key ? Config.search(key, config) : config;
    }
    const env = this.env.get();
    const configPath = this.path;
    /*eslint-disable global-require*/
    const configDefault = require(`${configPath}/config.default`);
    const configEnv = require(`${configPath}/config.${env}`);
    let configLocal = {};
    try {
      configLocal = require(`${configPath}/config.local.${env}`);
    } catch (e) {
      configLocal = {};
    }
    /*eslint-enable global-require*/
    config = merge(merge(merge(EngineConfig, configDefault), configEnv), configLocal);
    return key ? Config.search(key, config) : config;
  }

  static search(key, target) {
    return target;
  }
}


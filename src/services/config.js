import merge from 'lodash/merge';
import { Dependencies } from 'constitute';
import Env from './env';
import EngineConfig from '../config';
import { RuntimeException } from '../exceptions';
import ServiceInterface from './interface';

let config = null;

@Dependencies(Env) //eslint-disable-line new-cap
export default class Config extends ServiceInterface {
  /**
   * @param env {Env}
   */
  constructor(env) {
    super();
    this.env = env;
    this.path = null;
    this.mergedFiles = [];
  }

  setPath(path) {
    this.path = path;
    return this;
  }

  get(key) {
    if (config) {
      return key ? Config.search(key, config) : config;
    }
    const env = this.env.get();
    const configPath = this.path;
    const pathDefault = `${configPath}/config.default`;
    const pathEnv = `${configPath}/config.${env}`;
    const pathLocal = `${configPath}/config.local.${env}`;
    /*eslint-disable global-require*/
    /*eslint-disable import/no-dynamic-require*/
    const configDefault = require(pathDefault);
    this.mergedFiles.push(pathDefault);
    const configEnv = require(pathEnv);
    this.mergedFiles.push(pathEnv);
    let configLocal = {};
    try {
      configLocal = require(pathLocal);
      this.mergedFiles.push(pathLocal);
    } catch (e) {
      configLocal = {};
    }
    /*eslint-enable import/no-dynamic-require*/
    /*eslint-enable global-require*/
    config = merge(EngineConfig, configDefault, configEnv, configLocal);
    return key ? Config.search(key, config) : config;
  }

  getMergedFiles() {
    return this.mergedFiles;
  }

  reload() {
    config = null;
  }

  /**
   * @param {string} keyString
   * @param {Object} target
   * @returns {*}
   */
  static search(keyString, target) {
    if (typeof keyString !== 'string') {
      return target;
    }
    const keys = keyString.split('.');
    let obj = target;
    for (const key of keys) {
      if ({}.hasOwnProperty.call(obj, key) === false) {
        throw new RuntimeException(`No config found by key ${keyString}`);
      }
      obj = obj[key];
    }
    return obj;
  }
}


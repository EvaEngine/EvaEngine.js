import _ from 'lodash';
import { Dependencies } from 'constitute';
import springConfigClient from 'cloud-config-client';
import Env from './env';
import EngineConfig from '../config';
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

  /**
   * Resolve configurations from Spring Cloud Config Server.
   * @param endpoint
   * @param name
   * @param profiles
   * @param label
   * @returns {Promise.<void>}
   */
  async resolveSpringConfig({ endpoint, name, profiles, label = 'master' }) {
    if (!config) {
      config = this.loadConfigFromFiles();
    }
    const configRemote = await springConfigClient.load({
      endpoint,
      name,
      profiles: _.isString(profiles) ? profiles.split(',') : [],
      label
    });
    configRemote.forEach((key, value) => {
      _.set(config, key, value);
    });
  }

  get(key) {
    if (config) {
      return key ? Config.search(key, config) : config;
    }
    config = this.loadConfigFromFiles();
    return key ? Config.search(key, config) : config;
  }

  loadConfigFromFiles() {
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
    return _.merge(EngineConfig, configDefault, configEnv, configLocal);
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
    return _.get(target, keyString);
  }
}


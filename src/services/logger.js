import constitute from 'constitute';
import moment from 'moment-timezone';
import winston from 'winston';
import { inspect } from 'util';
import Env from './env.js';
import Config from './config.js';
import Namespace from './namespace.js';
import ServiceInterface from './interface.js';


class Logger extends ServiceInterface {
  /**
   * @param env {Env}
   * @param config {Config}
   * @param namespace {Namespace}
   */
  constructor(env, config, namespace) {
    super();
    this.env = env;
    this.config = config;
    this.namespace = namespace;

    let level = env.isProduction() ? 'info' : 'debug';
    if (process.env.LOG_LEVEL) {
      level = process.env.LOG_LEVEL;
    }
    this.level = level;
    winston.level = level;
    this.instance = null;
    this.label = null;
    this.logfile = null;
  }

    getProto() {
    return winston;
  }

  getWinston() {
    return winston;
  }

  setLogFile(logfile) {
    this.logfile = logfile;
    return this;
  }

  setLabel(label) {
    this.label = label;
    return this;
  }

  setLevel(level) {
    this.level = level;
    return this;
  }

  /**
   * @returns {winston.Logger}
   */
  getInstance() {
    if (this.instance) {
      return this.instance;
    }
    const logPath = this.logfile || this.config.get('logger.file');
    this.instance = this.factory(logPath);
    return this.instance;
  }

  /**
   * @param logPath
   * @param key
   * @param level
   * @returns {winston.Logger}
   */
  factory(logPath, key = 'global', level = this.level) {
    const timestamp = () => moment().format();
    return logPath ? winston.createLogger({
      format: winston.format.splat(),
      transports: [
        new (winston.transports.Console)({
          name: `${key}-console`,
          timestamp,
          level,
          label: this.label
        }),
        new (winston.transports.File)({
          name: `${key}-file`,
          timestamp,
          json: false,
          level,
          label: this.label,
          filename: logPath
        })
      ]
    }) : winston.createLogger({
      format: winston.format.splat(),
      transports: [
        new (winston.transports.Console)({
          name: `${key}-console`,
          timestamp,
          level,
          label: this.label,
          colorize: !this.env.isProduction(),
          prettyPrint: !this.env.isProduction()
        })
      ]
    });
  }

  populateTraceId(args) {
    if (!this.namespace.get('tracer')) {
      return args;
    }
    const { spanId, traceId } = this.namespace.get('tracer') || {};
    if (spanId) {
      args.push(spanId);
    }
    if (spanId !== traceId) {
      args.push(traceId);
    }
    return args;
  }

  debug(...args) {
    return this.getInstance().debug(...this.populateTraceId(args));
  }

  verbose(...args) {
    return this.getInstance().verbose(...this.populateTraceId(args));
  }

  info(...args) {
    return this.getInstance().info(...this.populateTraceId(args));
  }

  warn(...args) {
    return this.getInstance().warn(...this.populateTraceId(args));
  }

  error(...args) {
    return this.getInstance().error(...this.populateTraceId(args));
  }

  dump(obj) {
    return this.debug(inspect(obj, { depth: null, colors: true }));
  }
}

constitute.Dependencies(Env, Config, Namespace)(Logger);
export default Logger;

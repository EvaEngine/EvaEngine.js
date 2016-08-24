import { Dependencies } from 'constitute';
import winston from 'winston';
import Env from './env';
import Config from './config';
import Namespace from './namespace';


@Dependencies(Env, Config, Namespace) //eslint-disable-line new-cap
export default class Logger {
  /**
   * @param env {Env}
   * @param config {Config}
   * @param namespace {Namespace}
   */
  constructor(env, config, namespace) {
    this.env = env;
    this.config = config;
    this.namespace = namespace;

    let level = env.isProduction() ? 'info' : 'debug';
    if (process.env.LOG_LEVEL) {
      level = process.env.LOG_LEVEL;
    }
    winston.level = this.level = level;
    this.instance = null;
    this.label = null;
    this.logfile = null;
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
    // winston.cli();
    if (this.env.isProduction()) {
      this.instance = logPath ? new (winston.Logger)({
        transports: [
          new (winston.transports.Console)({
            name: 'global-console',
            timestamp: true,
            level: this.level,
            label: this.label
          }),
          new (winston.transports.File)({
            name: 'global-file',
            json: false,
            level: this.level,
            label: this.label,
            filename: logPath
          })
        ]
      }) : new (winston.Logger)({
        transports: [
          new (winston.transports.Console)({
            name: 'global-console',
            timestamp: true,
            level: this.level,
            label: this.label
          })
        ]
      });
      return this.instance;
    }

    this.instance = new (winston.Logger)({
      transports: [
        new (winston.transports.Console)({
          name: 'global-console',
          timestamp: true,
          level: this.level,
          label: this.label,
          colorize: true,
          prettyPrint: true
        })
      ]
    });
    return this.instance;
  }

  populateTraceId(args) {
    if (!this.namespace.get('tracer')) {
      return args;
    }
    args.push({
      spanId: this.namespace.get('tracer').spanId,
      traceId: this.namespace.get('tracer').traceId
    });
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
}

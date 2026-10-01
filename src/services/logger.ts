import constitute from 'constitute';
import moment from 'moment-timezone';
import winston from 'winston';
import { inspect } from 'util';
import Env from './env.ts';
import Config from './config.ts';
import Namespace from './namespace.ts';
import ServiceInterface from './interface.ts';


class Logger extends ServiceInterface {
  env: Env;
  config: Config;
  namespace: Namespace;
  level: string;
  instance: winston.Logger | null;
  label: string | null;
  logfile: string | null;

  constructor(env: Env, config: Config, namespace: Namespace) {
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

  override getProto(): typeof winston {
    return winston;
  }

  getWinston(): typeof winston {
    return winston;
  }

  setLogFile(logfile: string): this {
    this.logfile = logfile;
    return this;
  }

  setLabel(label: string): this {
    this.label = label;
    return this;
  }

  setLevel(level: string): this {
    this.level = level;
    return this;
  }

  getInstance(): winston.Logger {
    if (this.instance) {
      return this.instance;
    }
    const logPath = this.logfile || this.config.get('logger.file') as string | false;
    this.instance = this.factory(logPath);
    return this.instance;
  }

  factory(logPath: string | false, key = 'global', level = this.level): winston.Logger {
    const timestamp = () => moment().format();
    return logPath ? winston.createLogger({
      format: winston.format.combine(winston.format.splat(), winston.format.json()),
      transports: [
        new (winston.transports.Console)({
          name: `${key}-console`,
          timestamp,
          level,
          label: this.label
        } as winston.transports.ConsoleTransportOptions),
        new (winston.transports.File)({
          name: `${key}-file`,
          timestamp,
          json: false,
          level,
          label: this.label,
          filename: logPath
        } as winston.transports.FileTransportOptions)
      ]
    }) : winston.createLogger({
      format: winston.format.combine(winston.format.splat(), winston.format.json()),
      transports: [
        new (winston.transports.Console)({
          name: `${key}-console`,
          timestamp,
          level,
          label: this.label,
          colorize: !this.env.isProduction(),
          prettyPrint: !this.env.isProduction()
        } as winston.transports.ConsoleTransportOptions)
      ]
    });
  }

  populateTraceId(args: unknown[]): [string, ...unknown[]] {
    if (!this.namespace.get('tracer')) {
      return args as [string, ...unknown[]];
    }
    const { spanId, traceId } = (this.namespace.get('tracer') || {}) as { spanId?: unknown; traceId?: unknown };
    if (spanId) {
      args.push(spanId);
    }
    if (spanId !== traceId) {
      args.push(traceId);
    }
    return args as [string, ...unknown[]];
  }

  debug(...args: unknown[]): winston.Logger {
    return this.getInstance().debug(...this.populateTraceId(args));
  }

  verbose(...args: unknown[]): winston.Logger {
    return this.getInstance().verbose(...this.populateTraceId(args));
  }

  info(...args: unknown[]): winston.Logger {
    return this.getInstance().info(...this.populateTraceId(args));
  }

  warn(...args: unknown[]): winston.Logger {
    return this.getInstance().warn(...this.populateTraceId(args));
  }

  error(...args: unknown[]): winston.Logger {
    return this.getInstance().error(...this.populateTraceId(args));
  }

  dump(obj: unknown): winston.Logger {
    return this.debug(inspect(obj, { depth: null, colors: true }));
  }
}

constitute.Dependencies(Env, Config, Namespace)(Logger);
export default Logger;

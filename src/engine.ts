import express from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import yargs from 'yargs/yargs';
import moment from 'moment-timezone';
import packageJson from '../package.json' with { type: 'json' };
import DI from './di.ts';
import * as ServiceProviders from './services/providers.ts';
import * as MiddlewareProviders from './middlewares/providers.ts';
import { StandardException, RuntimeException } from './exceptions/index.ts';
import { parseCron, setCronInterval } from './utils/cron.ts';
import type { Express, Router, ErrorRequestHandler } from 'express';
import type Command from './commands/interface.ts';
import type { EngineLike, EngineMeta } from './di.ts';
import type { ServiceProvider } from './services/providers.ts';
import type Config from './services/config.ts';
import type Logger from './services/logger.ts';
import type Namespace from './services/namespace.ts';

moment.tz.setDefault(process.env.TZ ? process.env.TZ : 'Asia/Shanghai');

export const MODES = {
  WEB: 'web',
  CLI: 'cli'
};

export {
  DI,
  express,
  yargs
};

let app: Express | null = null;

type YargsArgv = {
  $0: string;
  [key: string]: unknown;
};

//注册的命令必须满足基础 Command 契约（含 getArgv/getOptions 等实例能力）
type CommandClass = typeof Command;

type CommandModule = Record<string, CommandClass>;

let baseServiceProviders: Array<new (engine: EngineLike) => ServiceProvider> = [
  ServiceProviders.EnvProvider,
  ServiceProviders.ConfigProvider,
  ServiceProviders.LoggerProvider,
  ServiceProviders.NamespaceProvider,
  ServiceProviders.NowProvider,
  ServiceProviders.EventManagerProvider
];

let serviceProvidersForWeb: Array<new (engine: EngineLike) => ServiceProvider> = [
  ServiceProviders.RedisProvider,
  ServiceProviders.CacheProvider,
  ServiceProviders.HttpClientProvider,
  ServiceProviders.RestClientProvider,
  ServiceProviders.ValidatorBaseProvider,
  ServiceProviders.JsonWebTokenProvider
];

let middlewareProviders: Array<new (engine: EngineLike) => ServiceProvider> = [
  MiddlewareProviders.SessionMiddlewareProvider,
  MiddlewareProviders.AuthMiddlewareProvider,
  MiddlewareProviders.DebugMiddlewareProvider,
  MiddlewareProviders.ViewCacheMiddlewareProvider,
  MiddlewareProviders.ValidatorMiddlewareProvider,
  MiddlewareProviders.TraceMiddlewareProvider
];

let serviceProvidersForCLI: Array<new (engine: EngineLike) => ServiceProvider> = [
  ServiceProviders.CacheProvider,
  ServiceProviders.HttpClientProvider,
  ServiceProviders.RestClientProvider,
  ServiceProviders.RedisProvider
];

export default class EvaEngine {
  server: http.Server | https.Server | null;
  commands: CommandModule;
  command: Command | null;
  commandName: string | null;
  port: number | string | boolean;
  defaultErrorHandler: ErrorRequestHandler | null;
  serverErrorHandler: ((error: NodeJS.ErrnoException) => void) | null;
  uncaughtExceptionHandler: ((error: Error) => void) | null;
  crontabJobHandlers: Array<{ clear(): unknown } | NodeJS.Timeout>;
  meta: EngineMeta;
  logger: Logger;
  config: Config;
  namespace: Namespace;

  constructor({
    projectRoot,
    configPath,
    sourceRoot,
    config,
    logger,
    namespace,
    port = 3000
  }: {
    projectRoot: string;
    configPath?: string;
    sourceRoot?: string;
    config?: Config;
    logger?: Logger;
    namespace?: Namespace;
    port?: number | string;
  }, mode = MODES.WEB) {
    this.server = null;
    this.commands = {};
    this.command = null;
    this.commandName = null;
    this.port = ((val: number | string) => {
      const rawPort = parseInt(String(val), 10);
      if (Number.isNaN(rawPort)) {
        return val;
      }
      if (rawPort >= 0) {
        return rawPort;
      }
      return false;
    })(port);
    this.defaultErrorHandler = null;
    this.serverErrorHandler = null;
    this.uncaughtExceptionHandler = null;
    this.crontabJobHandlers = [];

    this.meta = {
      mode,
      port: this.port,
      projectRoot: path.normalize(projectRoot),
      configPath: path.normalize(configPath || `${projectRoot}/config`),
      sourceRoot: path.normalize(sourceRoot || `${projectRoot}/src`)
    };
    this.registerServiceProviders(EvaEngine.getBaseServiceProviders());
    this.logger = logger || DI.get('logger');
    this.config = config || DI.get('config');
    this.namespace = namespace || DI.get('namespace');
    this.logger.info('Engine started, Meta: %j', this.meta);
    this.logger.debug('Engine config files loaded: %j', this.config.getMergedFiles());
  }

  getMeta(): EngineMeta {
    return this.meta;
  }

  getDI(): typeof DI {
    return DI;
  }

  static getApp(): Express {
    if (app) {
      return app;
    }
    app = express();
    return app;
  }

  static createRouter(): Router {
    return express.Router();
  }

  getCLI(commandNameInput?: string): YargsArgv {
    if (Object.keys(this.commands).length < 1) {
      throw new RuntimeException('No command registered yet');
    }
    this.registerServiceProviders(EvaEngine.getServiceProvidersForCLI());
    this.logger.debug('Bound services %j', Object.keys(DI.getBound()));
    const [, , commandNameFromArgv] = process.argv;

    const commandName = commandNameInput || commandNameFromArgv;
    if (!commandName) {
      return yargs(process.argv.slice(2)).argv;
    }

    this.commandName = commandName;
    if (!this.commands[commandName]) {
      // StandardException takes a single argument and silently drops the rest,
      // so the legacy format-string call shape is kept as-is at runtime.
      // @ts-expect-error RuntimeException declares only one constructor argument
      throw new RuntimeException('Command %s not registered.', commandName);
    }
    const command = this.commands[commandName];

    if (!{}.hasOwnProperty.call(command, 'getSpec')
      || !{}.hasOwnProperty.call(command, 'getDescription')) {
      throw new RuntimeException('Command require getSpec and getDescription static method');
    }
    const { argv } = yargs(process.argv.slice(2))
      .command(commandName, command.getDescription(), Object.assign({
        verbose: {
          alias: 'v',
          count: true
        },
        help: {
          alias: '?'
        }
      }, command.getSpec()))
      .help()
      .count('verbose');


    const { verbose } = argv;
    const levels = ['info', 'verbose', 'debug', 'debug'];
    const level = levels[verbose] ? levels[verbose] : 'info';
    for (const [, transport = {}] of Object.entries(this.logger.getInstance().transports as Array<{ level?: string }>)) {
      transport.level = level;
    }
    return argv;
  }

  static setBaseServiceProviders(providers: Array<new (engine: EngineLike) => ServiceProvider>) {
    baseServiceProviders = providers;
  }

  static getBaseServiceProviders(): Array<new (engine: EngineLike) => ServiceProvider> {
    return baseServiceProviders;
  }


  static getServiceProvidersForWeb(): Array<new (engine: EngineLike) => ServiceProvider> {
    return serviceProvidersForWeb;
  }

  static setServiceProvidersForWeb(providers: Array<new (engine: EngineLike) => ServiceProvider>) {
    serviceProvidersForWeb = providers;
  }

  static getMiddlewareProviders(): Array<new (engine: EngineLike) => ServiceProvider> {
    return middlewareProviders;
  }

  static setMiddlewareProviders(providers: Array<new (engine: EngineLike) => ServiceProvider>) {
    middlewareProviders = providers;
  }

  static getServiceProvidersForCLI(): Array<new (engine: EngineLike) => ServiceProvider> {
    return serviceProvidersForCLI;
  }

  static setServiceProvidersForCLI(providers: Array<new (engine: EngineLike) => ServiceProvider>) {
    serviceProvidersForCLI = providers;
  }

  registerServiceProviders(providers: Array<new (engine: EngineLike) => ServiceProvider> = []) {
    return DI.registerServiceProviders(providers, this);
  }

  registerService(ProviderClass: new (engine: EngineLike) => ServiceProvider) {
    return DI.registerService(ProviderClass, this);
  }

  registerCommands(commands: CommandModule | CommandModule[] | CommandModule[][]) {
    //TODO: validate command
    const registerCommandClass = (commandClasses: CommandModule) => {
      Object.keys(commandClasses).forEach((commandClassName) => {
        const commandClass = commandClasses[commandClassName];
        this.commands[commandClass.getName()] = commandClass;
      });
    };
    if (Array.isArray(commands)) {
      if (Array.isArray(commands[0])) {
        (commands as CommandModule[][]).forEach(commandsPerFile => commandsPerFile.forEach(registerCommandClass));
      } else {
        (commands as CommandModule[]).forEach(registerCommandClass);
      }
    } else {
      registerCommandClass(commands);
    }
    this.logger.debug('Registered commands %j', Object.keys(this.commands));
    return this;
  }

  getCommand(): Command | null {
    return this.command;
  }

  getCommands(): CommandModule {
    return this.commands;
  }

  clearCommands(): void {
    this.commands = {};
  }

  clearCrontabs(): void {
    this.crontabJobHandlers.forEach((handler) => {
      if (handler && typeof (handler as { clear?: unknown }).clear === 'function') {
        (handler as { clear(): unknown }).clear();
      } else {
        clearInterval(handler as NodeJS.Timeout);
      }
    });
    this.crontabJobHandlers = [];
  }


  getCommandName(): string | null {
    return this.commandName;
  }

  setDefaultErrorHandler(handler: ErrorRequestHandler) {
    this.defaultErrorHandler = handler;
    return this;
  }

  getDefaultErrorHandler(): ErrorRequestHandler {
    const env = DI.get('env');
    return this.defaultErrorHandler ||
      ((err, req, res, next) => { //eslint-disable-line @typescript-eslint/no-unused-vars
        let exception = err;
        if (!(err instanceof Error)) {
          this.logger.error('%s %s | %o', req.method, req.originalUrl || req.url, exception);
          exception = (new RuntimeException('Unknown error')).setPrevError(err);
        }
        if (!(exception instanceof StandardException)) {
          exception = new RuntimeException(err);
        }
        if (exception instanceof RuntimeException) {
          //TODO: report to sentry
          //TODO: with req & res
          this.logger.error('%s %s | %o', req.method, req.originalUrl || req.url, exception);
        } else {
          this.logger.warn(
            '%s %s | %o',
            req.method,
            req.originalUrl || req.url,
            exception.getImportance() > 0 ? exception : exception.message
          );
        }
        return res
          .status(exception.getStatusCode())
          .json(Object.assign(
            exception.toJSON(),
            env.isDevelopment()
              ? {} : {
                prevError: {},
                filename: '',
                stack: [],
                fullStack: []
              }
          ));
      });
  }

  setUncaughtExceptionHandler(handler: (error: Error) => void) {
    this.uncaughtExceptionHandler = handler;
    return this;
  }

  getUncaughtExceptionHandler(): (error: Error) => void {
    return this.uncaughtExceptionHandler ||
      ((err) => {
        this.logger.error(err);
        try {
          const killTimer = setTimeout(() => {
            process.exit(1);
          }, 30000);
          killTimer.unref();
          this.server!.close();
        } catch (e) {
          this.logger.error('Error when exit %s', (e as Error).stack);
        }
      });
  }

  setServerErrorHandler(handler: (error: NodeJS.ErrnoException) => void) {
    this.serverErrorHandler = handler;
    return this;
  }

  getServerErrorHandler(): (error: NodeJS.ErrnoException) => void {
    return this.serverErrorHandler ||
      ((error) => {
        this.logger.error(error);
        if (error.syscall !== 'listen') {
          throw error;
        }

        const { port } = this;

        const bind = typeof port === 'string'
          ? `Pipe ${port}`
          : `Port ${port}`;

        // handle specific listen errors with friendly messages
        switch (error.code) {
          case 'EACCES':
            this.logger.error('%s requires elevated privileges', bind);
            process.exit(1);
            break;
          case 'EADDRINUSE':
            this.logger.error('%s is already in use', bind);
            process.exit(1);
            break;
          default:
            throw error;
        }
      });
  }

  bootstrap(): this {
    this.registerServiceProviders(EvaEngine.getServiceProvidersForWeb());
    this.registerServiceProviders(EvaEngine.getMiddlewareProviders());
    this.logger.info('Engine bootstrapped under env %s', DI.get('env').get());
    this.logger.debug('Bound services %j', Object.keys(DI.getBound()));
    return this;
  }

  //声明为 Express.use 的完整契约，保留路径/处理器组合的重载与回调参数推导；实现只做转发
  use: Express['use'] = (...args: unknown[]) =>
    EvaEngine.getApp().use(...(args as Parameters<Express['use']>));

  run(port?: number | string): this {
    process.on('uncaughtException', this.getUncaughtExceptionHandler());
    EvaEngine.getApp().set('port', port || this.port);
    EvaEngine.getApp().use(this.getDefaultErrorHandler());
    this.server = http.createServer(EvaEngine.getApp());
    this.server.listen(port || this.port);
    this.server.on('error', this.getServerErrorHandler());
    this.logger.info('Engine running http server by listening on %s', this.port);
    return this;
  }

  runHttps(port?: number | string, options: https.ServerOptions = {}): this {
    process.on('uncaughtException', this.getUncaughtExceptionHandler());
    EvaEngine.getApp().set('port', port || this.port);
    EvaEngine.getApp().use(this.getDefaultErrorHandler());
    this.server = https.createServer(options, EvaEngine.getApp());
    this.server.listen(port || this.port);
    this.server.on('error', this.getServerErrorHandler());
    this.logger.info('Engine running http server by listening on %s', this.port);
    return this;
  }

  getServer(): http.Server | https.Server | null {
    return this.server;
  }

  static getVersion(): string {
    return packageJson.version;
  }

  async runCLI(inputCommandName?: string): Promise<void> {
    const argv = this.getCLI(inputCommandName);
    const commandName = this.getCommandName();
    if (!commandName) {
      this.logger.info('Available commands:');
      Object.entries(this.commands).forEach(([name, commandClass]) => {
        this.logger.info(`- ${(`${name}  `).padEnd(30, '-')} ${commandClass.getDescription()}`);
      });
      return;
    }

    this.logger.debug('Start run command %s', commandName);
    this.logger.debug('Received arguments %j', argv);
    const CommandClass = this.commands[commandName];
    this.command = new CommandClass(argv);
    await this.command.run();
    this.logger.debug('CLI run finished');
  }

  runCrontab(sequence: string, commandString: string, useSeconds = false): void {
    if (Object.keys(this.commands).length < 1) {
      throw new RuntimeException('No command registered yet');
    }
    this.registerServiceProviders(EvaEngine.getServiceProvidersForCLI());
    this.logger.debug('Bound services %j', Object.keys(DI.getBound()));
    //Cron jobs run in local time, matching the previous later.date.localTime() default
    this.logger.info('Cron job using %s Timezone', 'Local');
    const [commandName, ...options] = commandString.split(' ');
    if (Object.keys(this.commands).includes(commandName) === false) {
      throw new RuntimeException(`Command ${commandName} not registered`);
    }
    const { argv } = yargs(options);
    const command = new this.commands[commandName](argv);

    let i = 1;
    const schedule = parseCron(sequence, useSeconds);
    const handler = setCronInterval(async() => {
      this.logger.info('Cron job [%s] | Round %d | started with params %j', commandName, i, argv);
      //Let job crash if any exception happen
      await command.run();
      this.logger.info('Cron job [%s] | Round %d | finished', commandName, i);
      i += 1;
    }, schedule); //useSeconds 为 True 时启用秒级字段
    this.logger.info('Cron job [%s] with sequence [%s] registered as %j', commandString, sequence, schedule);
    this.crontabJobHandlers.push(handler);
  }

  async runCommand(commandString: string): Promise<unknown> {
    const [commandName, ...options] = commandString.split(' ');
    if (Object.keys(this.commands).includes(commandName) === false) {
      throw new RuntimeException(`Command ${commandName} not registered`);
    }
    const { argv } = yargs(options);
    const command = new this.commands[commandName](argv);
    return command.run();
  }
}

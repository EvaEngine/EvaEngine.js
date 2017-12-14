import express from 'express';
import http from 'http';
import https from 'https';
import path from 'path';
import yargs from 'yargs';
import later from 'later';
import DI from './di';
import * as ServiceProviders from './services/providers';
import * as MiddlewareProviders from './middlewares/providers';
import {
  StandardException, RuntimeException
} from './exceptions';

export const MODES = {
  WEB: 'web',
  CLI: 'cli'
};

export {
  DI,
  express,
  yargs,
  later
};

let app = null;

let baseServiceProviders = [
  ServiceProviders.EnvProvider,
  ServiceProviders.ConfigProvider,
  ServiceProviders.LoggerProvider,
  ServiceProviders.NamespaceProvider,
  ServiceProviders.NowProvider,
  ServiceProviders.EventManagerProvider
];

let serviceProvidersForWeb = [
  ServiceProviders.RedisProvider,
  ServiceProviders.CacheProvider,
  ServiceProviders.HttpClientProvider,
  ServiceProviders.RestClientProvider,
  ServiceProviders.ValidatorBaseProvider,
  ServiceProviders.JsonWebTokenProvider
];

let middlewareProviders = [
  MiddlewareProviders.SessionMiddlewareProvider,
  MiddlewareProviders.AuthMiddlewareProvider,
  MiddlewareProviders.DebugMiddlewareProvider,
  MiddlewareProviders.ViewCacheMiddlewareProvider,
  MiddlewareProviders.ValidatorMiddlewareProvider,
  MiddlewareProviders.TraceMiddlewareProvider
];

let serviceProvidersForCLI = [
  ServiceProviders.CacheProvider,
  ServiceProviders.HttpClientProvider,
  ServiceProviders.RestClientProvider,
  ServiceProviders.RedisProvider
];

/**
 * @class EvaEngine
 */
export default class EvaEngine {
  /**
   * @param {string} projectRoot
   * @param {string} configPath
   * @param {string} sourceRoot
   * @param {Config} config
   * @param {Logger} logger
   * @param {string} namespace
   * @param {number} port
   * @param {string} mode
   */
  constructor({
    projectRoot,
    configPath,
    sourceRoot,
    config,
    logger,
    namespace,
    port = 3000
  }, mode = MODES.WEB) {
    this.server = null;
    this.commands = {};
    this.command = null;
    this.commandName = null;
    this.port = ((val) => {
      const rawPort = parseInt(val, 10);
      if (isNaN(rawPort)) {
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
    this.logger.info('Engine started, Meta:', this.meta);
    this.logger.debug('Engine config files loaded:', this.config.getMergedFiles());
    later.date.localTime();
  }

  /**
   * @returns {{mode: string, port: *, projectRoot, configPath, sourceRoot}|*}
   */
  getMeta() {
    return this.meta;
  }

  /**
   * @returns {DI}
   */
  getDI() {
    return DI;
  }

  /**
   * @returns {express}
   */
  static getApp() {
    if (app) {
      return app;
    }
    app = express();
    return app;
  }

  /**
   * @returns {express}
   */
  static createRouter() {
    return express.Router(); //eslint-disable-line new-cap
  }

  /**
   * @returns {yargs}
   */
  getCLI(commandNameInput) {
    if (Object.keys(this.commands).length < 1) {
      throw new RuntimeException('No command registered yet');
    }
    this.registerServiceProviders(EvaEngine.getServiceProvidersForCLI());
    this.logger.debug('Bound services', Object.keys(DI.getBound()));
    const [, , commandNameFromArgv] = process.argv;

    const commandName = commandNameInput || commandNameFromArgv;
    if (!commandName) {
      return yargs.argv;
    }

    this.commandName = commandName;
    if (!this.commands[commandName]) {
      throw new RuntimeException('Command %s not registered.', commandName);
    }
    const command = this.commands[commandName];

    if (!{}.hasOwnProperty.call(command, 'getSpec')
      || !{}.hasOwnProperty.call(command, 'getDescription')) {
      throw new RuntimeException('Command require getSpec and getDescription static method');
    }
    const argv = yargs
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
      .count('verbose')
      .argv;


    const verbose = argv.verbose;
    const levels = ['info', 'verbose', 'debug', 'debug'];
    const level = levels[verbose] ? levels[verbose] : 'info';
    for (const [, transport = {}] of Object.entries(this.logger.getInstance().transports)) {
      transport.level = level;
    }
    return argv;
  }

  static setBaseServiceProviders(providers) {
    baseServiceProviders = providers;
  }

  /**
   * @returns {[]}
   */
  static getBaseServiceProviders() {
    return baseServiceProviders;
  }


  /**
   * @returns []
   */
  static getServiceProvidersForWeb() {
    return serviceProvidersForWeb;
  }

  /**
   * @param {Array} providers
   */
  static setServiceProvidersForWeb(providers) {
    serviceProvidersForWeb = providers;
  }

  /**
   * @returns []
   */
  static getMiddlewareProviders() {
    return middlewareProviders;
  }

  static setMiddlewareProviders(providers) {
    middlewareProviders = providers;
  }

  /**
   * @returns []
   */
  static getServiceProvidersForCLI() {
    return serviceProvidersForCLI;
  }

  static setServiceProvidersForCLI(providers) {
    serviceProvidersForCLI = providers;
  }

  /**
   * @param {Array} providers
   */
  registerServiceProviders(providers = []) {
    return DI.registerServiceProviders(providers, this);
  }

  /**
   * @param {constructor} ProviderClass
   */
  registerService(ProviderClass) {
    return DI.registerService(ProviderClass, this);
  }

  /**
   * @param {(Array|Object)}commands
   * @returns {EvaEngine}
   */
  registerCommands(commands) {
    //TODO: validate command
    const registerCommandClass = (commandClasses) => {
      Object.keys(commandClasses).forEach((commandClassName) => {
        const commandClass = commandClasses[commandClassName];
        this.commands[commandClass.getName()] = commandClass;
      });
    };
    if (Array.isArray(commands)) {
      if (Array.isArray(commands[0])) {
        commands.forEach(commandsPerFile => commandsPerFile.forEach(registerCommandClass));
      } else {
        commands.forEach(registerCommandClass);
      }
    } else {
      registerCommandClass(commands);
    }
    this.logger.debug('Registered commands', Object.keys(this.commands));
    return this;
  }

  getCommand() {
    return this.command;
  }

  getCommands() {
    return this.commands;
  }

  clearCommands() {
    this.commands = [];
  }

  clearCrontabs() {
    this.crontabJobHandlers.forEach((handler) => {
      clearInterval(handler);
    });
    this.crontabJobHandlers = [];
  }


  /**
   * @returns {string}
   */
  getCommandName() {
    return this.commandName;
  }

  /**
   * @param {Function} handler
   * @returns {EvaEngine}
   */
  setDefaultErrorHandler(handler) {
    this.defaultErrorHandler = handler;
    return this;
  }

  /**
   * @returns {Function}
   */
  getDefaultErrorHandler() {
    const env = DI.get('env');
    return this.defaultErrorHandler ||
      ((err, req, res, next) => { //eslint-disable-line no-unused-vars
        let exception = err;
        if (!(err instanceof Error)) {
          this.logger.error(req.method, req.originalUrl || req.url, '|', exception);
          exception = (new RuntimeException('Unknown error')).setPrevError(err);
        }
        if (!(exception instanceof StandardException)) {
          exception = new RuntimeException(err);
        }
        if (exception instanceof RuntimeException) {
          //TODO: report to sentry
          //TODO: with req & res
          this.logger.error(req.method, req.originalUrl || req.url, '|', exception);
        } else {
          this.logger.warn(req.method, req.originalUrl || req.url, '|',
            exception.getImportance() > 0 ? exception : exception.message);
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

  /**
   * @param {Function} handler
   * @returns {EvaEngine}
   */
  setUncaughtExceptionHandler(handler) {
    this.uncaughtExceptionHandler = handler;
    return this;
  }

  /**
   * @returns {Function}
   */
  getUncaughtExceptionHandler() {
    return this.uncaughtExceptionHandler ||
      ((err) => {
        this.logger.error(err);
        try {
          const killTimer = setTimeout(() => {
            process.exit(1);
          }, 30000);
          killTimer.unref();
          this.server.close();
        } catch (e) {
          this.logger.error('Error when exit', e.stack);
        }
      });
  }

  /**
   * @param {Function} handler
   * @returns {EvaEngine}
   */
  setServerErrorHandler(handler) {
    this.serverErrorHandler = handler;
    return this;
  }

  /**
   * @returns {Function}
   */
  getServerErrorHandler() {
    return this.serverErrorHandler ||
      ((error) => {
        this.logger.error(error);
        if (error.syscall !== 'listen') {
          throw error;
        }

        const port = this.port;

        const bind = typeof port === 'string'
          ? `Pipe ${port}`
          : `Port ${port}`;

        // handle specific listen errors with friendly messages
        switch (error.code) {
          case 'EACCES':
            this.logger.error(bind, 'requires elevated privileges');
            process.exit(1);
            break;
          case 'EADDRINUSE':
            this.logger.error(bind, 'is already in use');
            process.exit(1);
            break;
          default:
            throw error;
        }
      });
  }

  /**
   * @returns {EvaEngine}
   */
  bootstrap() {
    this.registerServiceProviders(EvaEngine.getServiceProvidersForWeb());
    this.registerServiceProviders(EvaEngine.getMiddlewareProviders());
    this.logger.info('Engine bootstrapped under env', DI.get('env').get());
    this.logger.debug('Bound services', Object.keys(DI.getBound()));
    return this;
  }

  use(...args) {
    return EvaEngine.getApp().use(...args);
  }

  /**
   * @returns {EvaEngine}
   */
  run(port) {
    process.on('uncaughtException', this.getUncaughtExceptionHandler());
    EvaEngine.getApp().set('port', port || this.port);
    EvaEngine.getApp().use(this.getDefaultErrorHandler());
    this.server = http.createServer(EvaEngine.getApp());
    this.server.listen(port || this.port);
    this.server.on('error', this.getServerErrorHandler());
    this.logger.info('Engine running http server by listening', this.port);
    return this;
  }

  /**
   * @returns {EvaEngine}
   */
  runHttps(port, options = {}) {
    process.on('uncaughtException', this.getUncaughtExceptionHandler());
    EvaEngine.getApp().set('port', port || this.port);
    EvaEngine.getApp().use(this.getDefaultErrorHandler());
    this.server = https.createServer(options, EvaEngine.getApp());
    this.server.listen(port || this.port);
    this.server.on('error', this.getServerErrorHandler());
    this.logger.info('Engine running http server by listening', this.port);
    return this;
  }

  getServer() {
    return this.server;
  }

  static getVersion() {
    return require(`${__dirname}/../package.json`).version; //eslint-disable-line
  }

  async runCLI(inputCommandName) {
    const argv = this.getCLI(inputCommandName);
    const commandName = this.getCommandName();
    if (!commandName) {
      this.logger.info('Available commands:');
      Object.entries(this.commands).forEach(([name, commandClass]) => {
        this.logger.info('-', (`${name}  `).padEnd(30, '-'), commandClass.getDescription());
      });
      return;
    }

    this.logger.debug('Start run command', commandName);
    this.logger.debug('Received arguments', argv);
    const CommandClass = this.commands[commandName];
    this.command = new CommandClass(argv);
    await this.command.run();
    this.logger.debug('CLI run finished');
  }

  /**
   * @param {String} sequence
   * @param {String} commandString
   * @param {Boolean} useSeconds
   */
  runCrontab(sequence, commandString, useSeconds = false) {
    if (Object.keys(this.commands).length < 1) {
      throw new RuntimeException('No command registered yet');
    }
    this.registerServiceProviders(EvaEngine.getServiceProvidersForCLI());
    this.logger.debug('Bound services', Object.keys(DI.getBound()));
    this.logger.info('Cron job using %s Timezone', later.date.isUTC ? 'UTC' : 'Local');
    const [commandName, ...options] = commandString.split(' ');
    if (Object.keys(this.commands).includes(commandName) === false) {
      throw new RuntimeException(`Command ${commandName} not registered`);
    }
    const argv = yargs(options ? options.join(' ') : '').argv;
    const command = new this.commands[commandName](argv);

    let i = 1;
    const schedule = later.parse.cron(sequence, useSeconds);
    const handler = later.setInterval(async() => {
      this.logger.info('Cron job [%s] | Round %d | started with params %j', commandName, i, argv);
      //Let job crash if any exception happen
      await command.run();
      this.logger.info('Cron job [%s] | Round %d | finished', commandName, i);
      i += 1;
    }, schedule); //第二个参数为True表示支持秒
    this.logger.info('Cron job [%s] with sequence [%s] registered as %j', commandString, sequence, schedule);
    this.crontabJobHandlers.push(handler);
  }

  /**
   * @param commandString
   * @returns {Promise.<EvaEngine|Promise|*>}
   */
  async runCommand(commandString) {
    const [commandName, ...options] = commandString.split(' ');
    if (Object.keys(this.commands).includes(commandName) === false) {
      throw new RuntimeException(`Command ${commandName} not registered`);
    }
    const argv = yargs(options ? options.join(' ') : '').argv;
    const command = new this.commands[commandName](argv);
    return command.run();
  }
}

import DI from './di';
import express from 'express';
import http from 'http';
import path from 'path';
import yargs from 'yargs';
import later from 'later';
import * as ServiceProviders from './services/providers';
import * as MiddlewareProviders from './middlewares/providers';
import {
  StandardException, InvalidArgumentException, RuntimeException
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

/**
 * @class EvaEngine
 */
export default class EvaEngine {
  /**
   * @param {string} projectRoot
   * @param {string} configPath
   * @param {string} sourceRoot
   * @param {number} port
   * @param {string} mode
   */
  constructor({
    projectRoot,
    configPath,
    sourceRoot,
    port = 3000
  }, mode = MODES.WEB) {
    this.server = null;
    this.commands = {};
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

    this.meta = {
      mode,
      port: this.port,
      projectRoot: path.normalize(projectRoot),
      configPath: path.normalize(configPath || `${projectRoot}/config`),
      sourceRoot: path.normalize(sourceRoot || `${projectRoot}/src`)
    };
    this.registerServiceProviders(EvaEngine.getBaseServiceProviders());
    this.logger = DI.get('logger');
    this.config = DI.get('config');
    this.logger.info('Engine started, Meta:', this.meta);
    this.logger.debug('Engine config files loaded:', this.config.getMergedFiles());
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
  getCLI() {
    if (Object.keys(this.commands).length < 1) {
      throw new RuntimeException('No command registered yet');
    }
    this.registerServiceProviders(EvaEngine.getServiceProvidersForCLI());
    this.logger.debug('Bound services', Object.keys(DI.getBound()));
    const [, , commandName] = process.argv;

    if (!commandName) {
      return yargs.argv;
    }

    this.commandName = commandName;
    if (!this.commands[commandName]) {
      throw new RuntimeException('Command %s not registered.', commandName);
    }
    const command = this.commands[commandName];
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

  /**
   * @returns {[]}
   */
  static getBaseServiceProviders() {
    return [
      ServiceProviders.EnvProvider,
      ServiceProviders.ConfigProvider,
      ServiceProviders.LoggerProvider
    ];
  }

  /**
   * @returns {string}
   */
  getCommandName() {
    return this.commandName;
  }

  /**
   * @returns {[]}
   */
  static getServiceProvidersForWeb() {
    return [
      ServiceProviders.RedisProvider,
      ServiceProviders.CacheProvider,
      ServiceProviders.HttpClientProvider,
      ServiceProviders.RestClientProvider,
      ServiceProviders.JsonWebTokenProvider
    ];
  }

  /**
   * @returns {[]}
   */
  static getMiddlewareProviders() {
    return [
      MiddlewareProviders.SessionMiddlewareProvider,
      MiddlewareProviders.AuthMiddlewareProvider,
      MiddlewareProviders.DebugMiddlewareProvider,
      MiddlewareProviders.RequestIdMiddlewareProvider
    ];
  }

  /**
   * @returns {[]}
   */
  static getServiceProvidersForCLI() {
    return [
      ServiceProviders.CacheProvider,
      ServiceProviders.HttpClientProvider,
      ServiceProviders.RestClientProvider,
      ServiceProviders.RedisProvider
    ];
  }

  /**
   * @param {Array} providers
   */
  registerServiceProviders(providers = []) {
    for (const providerClass of providers) {
      this.registerService(providerClass);
    }
  }

  /**
   * @param {constructor} ProviderClass
   */
  registerService(ProviderClass) {
    const provider = new ProviderClass(this);
    if (!(provider instanceof ServiceProviders.ServiceProvider)) {
      throw new RuntimeException(`Input provider ${provider.name} not service provider`);
    }
    provider.register();
  }

  /**
   * @param {(Array|Object)}commands
   * @returns {EvaEngine}
   */
  registerCommands(commands) {
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
    const stackHandler = (stack) => {
      const lines = stack.split('\n');
      const stackOut = [];
      for (const line of lines) {
        if (!line.match(/node_modules|\(node\.js|\(native/)) {
          stackOut.push(line);
        }
      }
      return stackOut;
    };
    return this.defaultErrorHandler ||
      ((err, req, res, next) => { //eslint-disable-line no-unused-vars
        let exception = err;
        if (exception.message === 'invalid json') {
          //Special handle for Body parser
          exception = new InvalidArgumentException('Invalid JSON');
        }
        if (!(exception instanceof StandardException)) {
          this.logger.error(exception);
          return res.status(500).json({
            code: -1,
            message: err.message,
            prevError: {},
            errors: [],
            stack: env.isDevelopment() ? stackHandler(exception.stack) : [],
            fullStack: env.isDevelopment() ? exception.stack.split('\n') : []
          });
        }
        if (exception instanceof RuntimeException) {
          this.logger.error(exception);
        } else {
          this.logger.warn(exception.message);
        }
        return res.status(exception.getStatusCode()).json({
          code: exception.getCode(),
          message: exception.message,
          prevError: exception.getPrevError(),
          errors: Array.isArray(exception.getDetails()) ?
            exception.getDetails() : [exception.getDetails()],
          stack: env.isDevelopment() ? stackHandler(exception.stack) : [],
          fullStack: env.isDevelopment() ? exception.stack.split('\n') : []
        });
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

  getServer() {
    return this.server;
  }

  async runCLI() {
    const argv = this.getCLI();
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
    const command = new CommandClass(argv);
    await command.run();
    this.logger.debug('CLI run finished');
  }

  runCrontab(sequence, commandString, useSeconds = true) {
    if (Object.keys(this.commands).length < 1) {
      throw new RuntimeException('No command registered yet');
    }
    this.registerServiceProviders(EvaEngine.getServiceProvidersForCLI());
    this.logger.debug('Bound services', Object.keys(DI.getBound()));

    const [commandName, ...options] = commandString.split(' ');
    if (Object.keys(this.commands).includes(commandName) === false) {
      throw new RuntimeException('Command %s not registered', commandName);
    }
    const argv = yargs(options ? options.join(' ') : '').argv;
    const command = new this.commands[commandName](argv);
    let i = 1;
    later.setInterval(async() => {
      this.logger.info('Round %d | Cron job %s started with %s', i, commandName, argv);
      //Let job crash if any exception happen
      await command.run();
      this.logger.info('Round %d | Cron job %s finished', i, commandName);
      i++;
    }, later.parse.cron(sequence, useSeconds)); //第二个参数为True表示支持秒
    this.logger.info('Cron job %s registered by [ %s ]', commandString, sequence);
  }
}

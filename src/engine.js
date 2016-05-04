import DI from './di';
import express from 'express';
import http from 'http';
import path from 'path';
import yargs from 'yargs';
import * as ServiceProviders from './services/providers';
import * as MiddlewareProviders from './middlewares/providers';
import wrapper from './utils/wrapper';
import { pagination, paginationFilter } from './utils/pagination';
import {
  StandardException, InvalidArgumentException, RuntimeException
} from './exceptions';

export const MODES = {
  WEB: 'web',
  CLI: 'cli'
};

const utils = {
  wrapper,
  pagination,
  paginationFilter
};

export {
  DI,
  express,
  utils
};

let app = null;
export default class EvaEngine {
  constructor({
    projectRoot,
    configPath,
    sourceRoot,
    port
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
    this.logger.info('Engine started, Meta:', this.meta);
  }

  getMeta() {
    return this.meta;
  }

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

  static createRouter() {
    return express.Router(); //eslint-disable-line new-cap
  }

  getCLI() {
    this.registerServiceProviders(EvaEngine.getServiceProvidersForCLI());
    const [, , commandName] = process.argv;
    if (!commandName) {
      throw new RuntimeException('Please input command name.');
    }
    this.commandName = commandName;
    if (!this.commands[commandName]) {
      throw new RuntimeException('Command %s not registered.', commandName);
    }
    const command = this.commands[commandName];
    const argv = yargs
      .count('verbose')
      .alias('v', 'verbose')
      .command(commandName, command.getDescription(), command.getSpec())
      .help('?')
      .alias('?', 'help')
      .epilog('')
      .argv;
    return argv;
  }

  static getBaseServiceProviders() {
    return [
      ServiceProviders.EnvProvider,
      ServiceProviders.ConfigProvider,
      ServiceProviders.LoggerProvider
    ];
  }

  getCommandName() {
    return this.commandName;
  }

  static getServiceProvidersForWeb() {
    return [
      ServiceProviders.RedisProvider,
      ServiceProviders.HttpClientProvider,
      ServiceProviders.JsonWebTokenProvider
    ];
  }

  static getMiddlewareProviders() {
    return [
      MiddlewareProviders.SessionMiddlewareProvider,
      MiddlewareProviders.AuthMiddlewareProvider,
      MiddlewareProviders.DebugMiddlewareProvider
    ];
  }

  static getServiceProvidersForCLI() {
    return [
      ServiceProviders.HttpClientProvider,
      ServiceProviders.RedisProvider
    ];
  }

  registerServiceProviders(providers = []) {
    for (const providerClass of providers) {
      this.registerService(providerClass);
    }
  }

  registerService(ProviderClass) {
    const provider = new ProviderClass(this);
    if (!(provider instanceof ServiceProviders.ServiceProvider)) {
      throw new RuntimeException(`Input provider ${provider.name} not service provider`);
    }
    provider.register();
  }

  registerCommands(commandClasses) {
    //TODO 支持数组
    for (const commandClassName in commandClasses) {
      const commandClass = commandClasses[commandClassName];
      this.commands[commandClass.getName()] = commandClass;
    }
    this.logger.debug('Registered commands', Object.keys(this.commands));
    return this;
  }

  setDefaultErrorHandler(handler) {
    this.defaultErrorHandler = handler;
    return this;
  }

  getDefaultErrorHandler() {
    const env = DI.get('env');
    const stackHandler = (stack) => {
      const lines = stack.split('\n');
      const stackOut = [];
      for (const line of lines) {
        if (!line.match('/node_modules/')) {
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
            errors: [],
            quickStack: env.isDevelopment() ? stackHandler(exception.stack) : [],
            stack: env.isDevelopment() ? exception.stack.split('\n') : []
          });
        }
        if (exception instanceof RuntimeException) {
          this.logger.error(exception);
        } else {
          this.logger.warn(exception);
        }
        return res.status(exception.getStatusCode()).json({
          code: exception.getCode(),
          message: exception.message,
          errors: exception.getDetails(),
          quickStack: env.isDevelopment() ? stackHandler(exception.stack) : [],
          stack: env.isDevelopment() ? exception.stack.split('\n') : []
        });
      });
  }

  setUncaughtExceptionHandler(handler) {
    this.uncaughtExceptionHandler = handler;
    return this;
  }

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

  setServerErrorHandler(handler) {
    this.serverErrorHandler = handler;
    return this;
  }

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

  run() {
    process.on('uncaughtException', this.getUncaughtExceptionHandler());
    EvaEngine.getApp().set('port', this.port);
    EvaEngine.getApp().use(this.getDefaultErrorHandler());
    this.server = http.createServer(EvaEngine.getApp());
    this.server.listen(this.port);
    this.server.on('error', this.getServerErrorHandler());
    this.logger.info('Engine running http server by listening', this.port);
  }

  async runCLI() {
    const argv = this.getCLI();
    const commandName = this.getCommandName();
    this.logger.debug('Start run command', commandName);
    this.logger.debug('Received arguments', argv);
    const CommandClass = this.commands[commandName];
    const command = new CommandClass();
    await command.run(argv);
    this.logger.debug('CLI run finished');
  }
}

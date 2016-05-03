import DI from './di';
import express from 'express';
import http from 'http';
import path from 'path';
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
}

let app = null;
let router = null;
export default class EvaEngine {
  constructor({
    projectRoot,
    configPath,
    sourceRoot,
    port
  }, mode = MODES.WEB) {
    this.app = null;
    this.router = null;
    this.server = null;
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
      projectRoot: path.normalize(projectRoot),
      configPath: path.normalize(configPath || `${projectRoot}/config`),
      sourceRoot: path.normalize(sourceRoot || `${projectRoot}/src`),
      buildRoot: path.normalize(sourceRoot || `${projectRoot}/build`)
    };
    this.registerServiceProviders(this.getBaseServiceProviders());
    this.logger = DI.get('logger');
    this.logger.info('Engine started, Meta:', this.meta);
  }

  getMeta() {
    return this.meta;
  }

  getDI() {
    return DI;
  }

  static getApp() {
    if (app) {
      return app;
    }
    app = express();
    return app;
  }

  static getRouter() {
    if (router) {
      return router;
    }
    router = express.Router();
    return router;
  }

  getCLI() {
  }

  getBaseServiceProviders() {
    return [
      ServiceProviders.EnvProvider,
      ServiceProviders.ConfigProvider,
      ServiceProviders.LoggerProvider
    ];
  }

  getServiceProvidersForWeb() {
    return [
      ServiceProviders.RedisProvider,
      ServiceProviders.JsonWebTokenProvider
    ];
  }

  getMiddlewareProviders() {
    return [
      MiddlewareProviders.SessionMiddlewareProvider,
      MiddlewareProviders.AuthMiddlewareProvider,
      MiddlewareProviders.DebugMiddlewareProvider
    ];
  }

  getServiceProvidersForCLI() {
    return [
      ServiceProviders.RedisProvider
    ];
  }

  registerServiceProviders(providers = []) {
    for (const providerClass of providers) {
      this.register(providerClass);
    }
  }

  register(providerClass) {
    const provider = new providerClass(this);
    if (!(provider instanceof ServiceProviders.ServiceProvider)) {
      throw new RuntimeException(`Input provider ${provider.name} not service provider`);
    }
    provider.register();
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
      ((err, req, res, next) => {
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
          server.close();
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
    this.registerServiceProviders(this.getServiceProvidersForWeb());
    this.registerServiceProviders(this.getMiddlewareProviders());
    this.logger.info('Engine bootstrapped');
    this.logger.debug('Bound services', Object.keys(DI.getBound()));
    return this;
  }

  run() {
    process.on('uncaughtException', this.getUncaughtExceptionHandler());
    EvaEngine.getApp().set('port', this.port);
    EvaEngine.getApp().use(this.getDefaultErrorHandler());
    this.server = http.createServer(EvaEngine.getApp());
    this.server.listen(this.port);
    this.server.on('error', this.getServerErrorHandler());
    this.logger.info('Engine environment is', DI.get('env').get());
    this.logger.info('Engine running http server by listening', this.port);
  }
}

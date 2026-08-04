import SessionMiddleware from '../middlewares/session.js';
import AuthMiddleware from '../middlewares/auth.js';
import AuthKongMiddleware from '../middlewares/auth_kong.js';
import DebugMiddleware from '../middlewares/debug.js';
import TraceMiddleware from '../middlewares/trace.js';
import ViewCacheMiddleware from '../middlewares/view_cache.js';
import ValidatorMiddleware from '../middlewares/validator.js';
import DI from '../di.js';
import { ServiceProvider } from '../services/providers.js';

export class SessionMiddlewareProvider extends ServiceProvider {
  get name() {
    return 'session';
  }

  register() {
    DI.bindMethod(this.name, SessionMiddleware);
  }
}

export class AuthMiddlewareProvider extends ServiceProvider {
  get name() {
    return 'auth';
  }

  register() {
    if (DI.get('config').get('token.provider') === 'kong') {
      DI.bindMethod(this.name, AuthKongMiddleware);
    } else {
      DI.bindMethod(this.name, AuthMiddleware);
    }
  }
}

export class DebugMiddlewareProvider extends ServiceProvider {
  get name() {
    return 'debug';
  }

  register() {
    DI.bindMethod(this.name, DebugMiddleware);
  }
}

export class ViewCacheMiddlewareProvider extends ServiceProvider {
  get name() {
    return 'view_cache';
  }

  register() {
    DI.bindMethod(this.name, ViewCacheMiddleware);
  }
}

export class TraceMiddlewareProvider extends ServiceProvider {
  get name() {
    return 'trace';
  }

  register() {
    DI.bindMethod(this.name, TraceMiddleware);
  }
}

export class ValidatorMiddlewareProvider extends ServiceProvider {
  get name() {
    return 'validator';
  }

  register() {
    DI.bindMethod(this.name, ValidatorMiddleware);
  }
}

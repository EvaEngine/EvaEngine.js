import SessionMiddleware from '../middlewares/session';
import AuthMiddleware from '../middlewares/auth';
import DebugMiddleware from '../middlewares/debug';
import TraceMiddleware from '../middlewares/trace';
import ViewCacheMiddleware from '../middlewares/view_cache';
import DI from '../di';
import { ServiceProvider } from '../services/providers';

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
    DI.bindMethod(this.name, AuthMiddleware);
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

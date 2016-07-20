import SessionMiddleware from '../middlewares/session';
import AuthMiddleware from '../middlewares/auth';
import DebugMiddleware from '../middlewares/debug';
import RequestIdMiddleware from '../middlewares/request_id';
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

export class RequestIdMiddlewareProvider extends ServiceProvider {
  get name() {
    return 'request_id';
  }

  register() {
    DI.bindMethod(this.name, RequestIdMiddleware);
  }
}

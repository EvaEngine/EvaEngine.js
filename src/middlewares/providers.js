import SessionMiddleware from '../middlewares/session';
import AuthMiddleware from '../middlewares/auth';
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

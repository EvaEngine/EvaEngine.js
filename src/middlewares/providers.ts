import SessionMiddleware from '../middlewares/session.ts';
import AuthMiddleware from '../middlewares/auth.ts';
import AuthKongMiddleware from '../middlewares/auth_kong.ts';
import DebugMiddleware from '../middlewares/debug.ts';
import TraceMiddleware from '../middlewares/trace.ts';
import ViewCacheMiddleware from '../middlewares/view_cache.ts';
import ValidatorMiddleware from '../middlewares/validator.ts';
import DI from '../di.ts';
import { ServiceProvider } from '../services/providers.ts';

export class SessionMiddlewareProvider extends ServiceProvider {
  override get name(): string {
    return 'session';
  }

  override register(): void {
    DI.bindMethod(this.name, SessionMiddleware);
  }
}

export class AuthMiddlewareProvider extends ServiceProvider {
  override get name(): string {
    return 'auth';
  }

  override register(): void {
    if (DI.get('config').get('token.provider') === 'kong') {
      DI.bindMethod(this.name, AuthKongMiddleware);
    } else {
      DI.bindMethod(this.name, AuthMiddleware);
    }
  }
}

export class DebugMiddlewareProvider extends ServiceProvider {
  override get name(): string {
    return 'debug';
  }

  override register(): void {
    DI.bindMethod(this.name, DebugMiddleware);
  }
}

export class ViewCacheMiddlewareProvider extends ServiceProvider {
  override get name(): string {
    return 'view_cache';
  }

  override register(): void {
    DI.bindMethod(this.name, ViewCacheMiddleware);
  }
}

export class TraceMiddlewareProvider extends ServiceProvider {
  override get name(): string {
    return 'trace';
  }

  override register(): void {
    DI.bindMethod(this.name, TraceMiddleware);
  }
}

export class ValidatorMiddlewareProvider extends ServiceProvider {
  override get name(): string {
    return 'validator';
  }

  override register(): void {
    DI.bindMethod(this.name, ValidatorMiddleware);
  }
}

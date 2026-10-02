import httpMocker from 'node-mocks-http';
import type { RequestOptions } from 'node-mocks-http';
import EventEmitter from 'events';
import DI from '../di.ts';
import type Entities from '../entities/index.ts';

export const truncateAll = async (entities: Entities): Promise<void> => {
  const names: string[] = [];
  // getAll() 的静态类型只含 name/associate；truncate/tableName 由具体实体在运行时提供
  const allEntities = entities.getAll() as Record<string, {
    name: string;
    truncate?: unknown;
    tableName?: string;
  }>;
  Object.values(allEntities).forEach((entity) => {
    if (typeof entity.truncate === 'function' && entity.tableName) {
      names.push(`TRUNCATE \`${entity.tableName}\`;\n`);
    }
  });
  await entities.getInstance().query(names.join(''));
};

const mockResponse = () => httpMocker.createResponse({ eventEmitter: EventEmitter });
export { mockResponse };

export const mockRequest = (...args: Parameters<typeof httpMocker.createRequest>) => httpMocker.createRequest(...args);

export const mockInstance = (): unknown =>
  new Proxy({}, {
    get: () =>
      () => {
      }
  });

export const mockAuthRequest = (...args: [RequestOptions]) => {
  const uid = DI.get('config').get('token.faker.uid');
  Object.assign(args[0], {
    auth: {
      uid
    }
  });
  return httpMocker.createRequest(...args);
};

export { httpMocker };

// handle 的参数类型由各消费方控制器自定义；never[] 仅用于让任意 handle 签名都可传入
type ControllerLike = {
  handle: (...args: never[]) => unknown;
};

export const runController =
  (controller: ControllerLike, request: unknown, response = mockResponse()): Promise<unknown> =>
    new Promise((resolve, reject) => {
      response.on(
        'end',
        () => resolve(JSON.parse(response._getData()))
      );
      // 调用点按原实现直接传参，handle 的真实参数类型由具体控制器决定
      (controller.handle as (request: unknown, response: unknown, next: (err: unknown) => void) => unknown)(request, response, err => reject(err));
    });

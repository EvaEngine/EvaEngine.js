import httpMocker from 'node-mocks-http';
import EventEmitter from 'events';
import DI from '../di.js';

export const truncateAll = async (entities) => {
  const names = [];
  const allEntities = entities.getAll();
  Object.values(allEntities).forEach((entity) => {
    if (typeof entity.truncate === 'function' && entity.tableName) {
      names.push(`TRUNCATE \`${entity.tableName}\`;\n`);
    }
  });
  await entities.getInstance().query(names.join(''));
};

const mockResponse = () => httpMocker.createResponse({ eventEmitter: EventEmitter });
export { mockResponse };

export const mockRequest = (...args) => httpMocker.createRequest(...args);

export const mockInstance = () =>
  new Proxy({}, {
    get: () =>
      () => {
      }
  });

export const mockAuthRequest = (...args) => {
  const uid = DI.get('config').get('token.faker.uid');
  Object.assign(args[0], {
    auth: {
      uid
    }
  });
  return httpMocker.createRequest(...args);
};

export { httpMocker };

export const runController =
  (controller, request, response = mockResponse()) =>
    new Promise((resolve, reject) => {
      response.on(
        'end',
        () => resolve(JSON.parse(response._getData()))
      );
      controller.handle(request, response, err => reject(err));
    });

import httpMocker from 'node-mocks-http';
import EventEmitter from 'events';
import DI from '../di';

if (process.version.replace(/v|\./g, '') < 600) {
  global.Reflect = require('harmony-reflect'); //eslint-disable-line global-require
}
module.exports.truncateAll = async(entities) => {
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
module.exports.mockResponse = mockResponse;

module.exports.mockRequest = (...args) => httpMocker.createRequest(...args);

module.exports.mockInstance = () =>
  new Proxy({}, {
    get: () =>
      () => {
      }
  });

module.exports.mockAuthRequest = (...args) => {
  const uid = DI.get('config').get('token.faker.uid');
  Object.assign(args[0], {
    auth: {
      uid
    }
  });
  return httpMocker.createRequest(...args);
};

module.exports.httpMocker = httpMocker;

module.exports.runController =
  (controller, request, response = mockResponse()) =>
    new Promise((resolve, reject) => {
      response.on('end',
        () => resolve(
          JSON.parse(response._getData() //eslint-disable-line no-underscore-dangle
          )));
      controller.handle(request, response, err => reject(err));
    });

import httpMocker from 'node-mocks-http';
import EventEmitter from 'events';
import DI from '../di';

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

module.exports.mockAuthRequest = (...args) => {
  const { params: params = {} } = args[0];
  const config = DI.get('config');
  params.api_key = config.token.faker.key;
  args[0].params = params; //eslint-disable-line no-param-reassign
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

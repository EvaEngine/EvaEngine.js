import httpMocker from 'node-mocks-http';
import EventEmitter from 'events';
import chai from 'chai';
import { DI } from '../';

module.exports.truncateAll = async(entities) => {
  const names = [];
  for (const name in entities) {
    if (typeof entities[name].truncate === 'function' && entities[name].tableName) {
      names.push(`TRUNCATE \`${entities[name].tableName}\`;\n`);
    }
  }
  await entities.sequelize.query(names.join(''));
};

const mockResponse = () => httpMocker.createResponse({ eventEmitter: EventEmitter });
module.exports.mockResponse = mockResponse;
module.exports.mockRequest = (...args) => httpMocker.createRequest(...args);
module.exports.mockAuthRequest = (...args) => {
  const { params: params = {} } = args[0];
  const config = DI.get('config');
  params.api_key = config.token.faker.key;
  args[0].params = params;
  return httpMocker.createRequest(...args);
};
module.exports.httpMocker = httpMocker;

chai.should();
module.exports.assert = chai.assert;
module.exports.expect = chai.expect;


const runController = async(controller, request, response = mockResponse()) =>
  new Promise((resolve, reject) => {
    controller.handle(request, response, err => reject(err));
    response.on('end', () => resolve(JSON.parse(response._getData())));
  });
module.exports.runController = runController;

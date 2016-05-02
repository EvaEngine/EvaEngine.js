import httpMocker from 'node-mocks-http';
import EventEmitter from 'events';
import chai from 'chai';
// import { config } from '../src/di';
import assert from 'assert';

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
  params.api_key = config.token.faker.key;
  args[0].params = params;
  return httpMocker.createRequest(...args);
};
module.exports.httpMocker = httpMocker;

// module.exports.assert = assert;
chai.should();
module.exports.assert = chai.assert;


const runController = async(controller, request, response = mockResponse()) =>
  new Promise((resolve, reject) => {
    controller.handle(request, response, err => reject(err));
    response.on('end', () => resolve(JSON.parse(response._getData())));
  });
module.exports.runController = runController;

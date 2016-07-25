import test from 'ava';
import path from 'path';
import EvaEngine from '../src/engine';
import { mockRequest, mockResponse, mockInstance } from '../src/utils/test';
import { RuntimeException, LogicException } from '../src/exceptions';

test('Default errorHandler', (t) => {
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  });
  t.true(typeof engine.getDefaultErrorHandler() === 'function');
});

test('Error handler for not expect error', (t) => {
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    config: mockInstance(),
    logger: mockInstance()
  });
  const errorHandler = engine.getDefaultErrorHandler();
  const res = mockResponse();
  errorHandler(new Error('Not expected error'), mockRequest(), res, () => {
  });
  t.is(res.statusCode, 500);
  t.deepEqual(JSON.parse(res._getData()), {
    code: -1,
    name: 'BuiltinError',
    message: 'Not expected error',
    prevError: {},
    errors: [],
    stack: [],
    fullStack: []
  });
});

test('Error handler for RuntimeException', (t) => {
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    config: mockInstance(),
    logger: mockInstance()
  });
  const errorHandler = engine.getDefaultErrorHandler();
  const res = mockResponse();
  errorHandler(new RuntimeException('Runtime'), mockRequest(), res, () => {
  });
  t.is(res.statusCode, 500);
  t.deepEqual(JSON.parse(res._getData()), {
    code: 385400002849395800,
    name: 'RuntimeException',
    message: 'Runtime',
    prevError: {},
    errors: [],
    stack: [],
    fullStack: []
  });
});

test('Error handler for LogicException', (t) => {
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    config: mockInstance(),
    logger: mockInstance()
  });
  const errorHandler = engine.getDefaultErrorHandler();
  const res = mockResponse();
  errorHandler(new LogicException('Logic'), mockRequest(), res, () => {
  });
  t.is(res.statusCode, 400);
  t.deepEqual(JSON.parse(res._getData()), {
    code: 385400003318127170,
    name: 'LogicException',
    message: 'Logic',
    prevError: {},
    errors: [],
    stack: [],
    fullStack: []
  });
});

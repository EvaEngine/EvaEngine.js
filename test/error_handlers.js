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
  const err = JSON.parse(res._getData());
  t.is(err.name, 'RuntimeException');
  t.is(err.message, 'Not expected error');
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
  const err = JSON.parse(res._getData());
  t.is(err.name, 'RuntimeException');
  t.is(err.message, 'Runtime');
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
  const err = JSON.parse(res._getData());
  t.is(err.name, 'LogicException');
  t.is(err.message, 'Logic');
});

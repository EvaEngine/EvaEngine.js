import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import EvaEngine from '../src/engine.js';
import { mockRequest, mockResponse, mockInstance } from '../src/utils/test.js';
import { RuntimeException, LogicException } from '../src/exceptions/index.js';

test('Default errorHandler', () => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  });
  assert.equal(typeof engine.getDefaultErrorHandler(), 'function');
});

test('Error handler for not expect error', () => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    config: mockInstance(),
    logger: mockInstance()
  });
  const errorHandler = engine.getDefaultErrorHandler();
  const res = mockResponse();
  errorHandler(new Error('Not expected error'), mockRequest(), res, () => {
  });
  assert.equal(res.statusCode, 500);
  const err = JSON.parse(res._getData());
  assert.equal(err.name, 'RuntimeException');
  assert.equal(err.message, 'Not expected error');
});

test('Error handler for RuntimeException', () => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    config: mockInstance(),
    logger: mockInstance()
  });
  const errorHandler = engine.getDefaultErrorHandler();
  const res = mockResponse();
  errorHandler(new RuntimeException('Runtime'), mockRequest(), res, () => {
  });
  assert.equal(res.statusCode, 500);
  const err = JSON.parse(res._getData());
  assert.equal(err.name, 'RuntimeException');
  assert.equal(err.message, 'Runtime');
});

test('Error handler for LogicException', () => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    config: mockInstance(),
    logger: mockInstance()
  });
  const errorHandler = engine.getDefaultErrorHandler();
  const res = mockResponse();
  errorHandler(new LogicException('Logic'), mockRequest(), res, () => {
  });
  assert.equal(res.statusCode, 400);
  const err = JSON.parse(res._getData());
  assert.equal(err.name, 'LogicException');
  assert.equal(err.message, 'Logic');
});

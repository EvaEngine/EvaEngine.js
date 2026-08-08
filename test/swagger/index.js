import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import Sequelize from 'sequelize';
import { ExSwagger } from '../../src/swagger/index.js';
import * as exceptions from '../../src/exceptions/index.js';
import Entities from './../../src/entities/index.js';

const compileDistPath = `${import.meta.dirname}/_example/exports`;
const demoEntities = new Entities(
  `${import.meta.dirname}/../_demo_project/entities`,
  new Sequelize('database', null, null, { dialect: 'mysql' })
);

test('Could get file lists', async () => {
  const files = await ExSwagger.scanFiles(`${import.meta.dirname}/_example/**/*.js`);
  const ctrpath = `${import.meta.dirname}${path.sep}_example${path.sep}controller.js`.split(path.sep).join('/');
  assert.ok(files.includes(ctrpath));
});

test('Could parse annotations', async () => {
  const annotationContainers = await ExSwagger.filesToAnnotationsContainers([`${import.meta.dirname}/_example/controller.js`]);
  assert.equal(annotationContainers.length, 1);
  assert.equal(annotationContainers[0].getAnnotations().length, 6);
});

test('Could parse swagger docs', async () => {
  const annotationContainers = await ExSwagger.filesToAnnotationsContainers([`${import.meta.dirname}/_example/controller.js`]);
  const fragments = annotationContainers[0].collectFragments();
  assert.equal(fragments.length, 4);
  assert.ok(fragments[0].isDefinition());
  assert.equal(typeof fragments[0].value, 'object');
  assert.equal(typeof fragments[0].description, 'string');
  assert.ok(fragments[1].isPath());
  assert.equal(typeof fragments[1].value, 'object');
  assert.equal(typeof fragments[1].description, 'string');
  assert.ok(fragments[2].isException());
  assert.equal(typeof fragments[2].value, 'string');
  assert.equal(typeof fragments[2].description, 'string');
  assert.equal(1, annotationContainers[0].collectYamlErrors().length);
});

test('Scan exceptions', async () => {
  const scannedExceptions = await ExSwagger.scanExceptions(
    `${import.meta.dirname}/../../src/exceptions/**/*.js`, exceptions.StandardException
  );
  assert.ok(Object.keys(scannedExceptions).length >= 12);
});

test('default properties', async () => {
  const exSwagger = new ExSwagger({
    swaggerDocsTemplate: {},
    sourceRootPath: '/foo'
  });
  const states = exSwagger.getStates();
  assert.ok(states.sourceFilesPath.includes('/foo/**/*.js'));
});

test('Generate json file', async () => {
  const exSwagger = new ExSwagger({
    compileDistPath,
    models: demoEntities,
    swaggerDocsTemplate: { definitions: {}, paths: {} },
    sourceRootPath: `${import.meta.dirname}/_example`
  });
  await exSwagger.exportJson();
  assert.ok(JSON.parse(fs.readFileSync(`${compileDistPath}/docs.json`)));
});

test('throws annotation produces exception definition and response', async () => {
  const exSwagger = new ExSwagger({
    compileDistPath,
    models: demoEntities,
    swaggerDocsTemplate: { definitions: {}, paths: {} },
    sourceRootPath: `${import.meta.dirname}/_example`
  });
  const docs = await exSwagger.exportJson(`${compileDistPath}/docs-exception.json`);
  assert.ok(docs.definitions.LogicException);
  assert.equal(
    docs.paths['/estimates/price'].get.responses['400'].schema.$ref,
    '#/definitions/LogicException'
  );
});

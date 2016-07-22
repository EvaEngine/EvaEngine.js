import test from 'ava';
import path from 'path';
import fs from 'fs';
import { ExSwagger } from '../../src/swagger';
import * as exceptions from '../../src/exceptions';
import Entities from './../../src/entities';
import Sequelize from 'sequelize';

test('Could get file lists', async(t) => {
  const files = await ExSwagger.scanFiles(`${__dirname}/_example/**/*.js`);
  t.true(files.includes(`${__dirname}${path.sep}_example${path.sep}controller.js`));
});
test('Could parse annotions', async(t) => {
  const annotations = await ExSwagger.filesToAnnotations([`${__dirname}/_example/controller.js`]);
  t.is(annotations.length, 6);
});
test('Could parse swagger docs', async(t) => {
  const annotations = await ExSwagger.filesToAnnotations([`${__dirname}/_example/controller.js`]);
  const docs = ExSwagger.annotationsToFragments(annotations);
  t.is(docs.length, 4);
  t.is('definition', docs[0][0].type);
  t.true(typeof docs[0][0].value === 'object');
  t.true(typeof docs[0][0].description === 'string');
  t.is('path', docs[1][0].type);
  t.true(typeof docs[1][0].value === 'object');
  t.true(typeof docs[1][0].description === 'string');
  t.is('exception', docs[1][1].type);
  t.true(typeof docs[1][1].value === 'string');
  t.true(typeof docs[1][1].description === 'string');
  t.is('unknown', docs[3][0].type);
  t.is(1, ExSwagger.getYamlErrors().length);
});
test('Scan exceptions', async(t) => {
  const scannedExceptions = await ExSwagger.scanExceptions(
    `${__dirname}/../../src/exceptions/**/*.js`, exceptions.StandardException
  );
  t.true(Object.keys(scannedExceptions).length >= 12);
});

test('default properties', async(t) => {
  const exSwagger = new ExSwagger({
    swaggerDocsTemplate: {},
    sourceRootPath: '/foo'
  });
  const states = exSwagger.getStates();
  t.true(states.sourceFilesPath.includes('/foo/**/*.js'));
});

test('Generate json file', async(t) => {
  const compileDistPath = `${__dirname}/_example/exports`;
  const exSwagger = new ExSwagger({
    compileDistPath,
    models: new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize()),
    swaggerDocsTemplate: { definitions: {}, paths: {} },
    sourceRootPath: `${__dirname}/_example`
  });
  exSwagger.exportJson();
  t.truthy(JSON.parse(fs.readFileSync(`${compileDistPath}/docs.json`)));
});

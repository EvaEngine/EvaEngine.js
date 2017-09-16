import test from 'ava';
import fs from 'fs';
import Sequelize from 'sequelize';
import { ExSwagger } from '../../src/swagger';
import * as exceptions from '../../src/exceptions';
import Entities from './../../src/entities';

test('Could get file lists', async(t) => {
  const files = await ExSwagger.scanFiles(`${__dirname}/_example/**/*.js`);
  t.true(files.includes(`${__dirname}/_example/controller.js`));
});

test('Could parse annotations', async(t) => {
  const annotationContainers = await ExSwagger.filesToAnnotationsContainers([`${__dirname}/_example/controller.js`]);
  t.is(annotationContainers.length, 1);
  t.is(annotationContainers[0].getAnnotations().length, 6);
});

test('Could parse swagger docs', async(t) => {
  const annotationContainers = await ExSwagger.filesToAnnotationsContainers([`${__dirname}/_example/controller.js`]);
  const fragments = annotationContainers[0].collectFragments();
  t.is(fragments.length, 4);
  t.true(fragments[0].isDefinition());
  t.true(typeof fragments[0].value === 'object');
  t.true(typeof fragments[0].description === 'string');
  t.true(fragments[1].isPath());
  t.true(typeof fragments[1].value === 'object');
  t.true(typeof fragments[1].description === 'string');
  t.true(fragments[2].isException());
  t.true(typeof fragments[2].value === 'string');
  t.true(typeof fragments[2].description === 'string');
  t.is(1, annotationContainers[0].collectYamlErrors().length);
  //TODO: test unknown
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
    extraSourcePaths: [`${__dirname}/../../../lib/utils/**/*.js`],
    models: new Entities(`${__dirname}/../_demo_project/entities`, new Sequelize()),
    swaggerDocsTemplate: { definitions: {}, paths: {} },
    sourceRootPath: `${__dirname}/_example`
  });
  await exSwagger.exportJson();
  t.truthy(JSON.parse(fs.readFileSync(`${compileDistPath}/docs.json`)));
});

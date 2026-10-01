import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs';
import { Sequelize } from 'sequelize';
import { ExSwagger } from '../../src/swagger/index.ts';
import * as exceptions from '../../src/exceptions/index.ts';
import Entities from './../../src/entities/index.ts';

const compileDistPath = `${import.meta.dirname}/_example/exports`;
const demoEntities = new Entities(
  `${import.meta.dirname}/../_demo_project/entities`,
  // sequelize 类型要求 username/password 为 string，运行时保持原 null 实参
  new Sequelize('database', null as unknown as string, null as unknown as string, { dialect: 'mysql' })
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
    // src 异常源码已转为 TS，扫描 glob 相应由 **/*.js 调整为 **/*.ts
    `${import.meta.dirname}/../../src/exceptions/**/*.ts`, exceptions.StandardException
  );
  assert.ok(Object.keys(scannedExceptions).length >= 12);
});

test('default properties', async () => {
  // 原用例未传 compileDistPath；构造参数类型将其标为必填，双断言仅补类型不改运行时入参
  const exSwagger = new ExSwagger({
    swaggerDocsTemplate: {},
    sourceRootPath: '/foo'
  } as unknown as ConstructorParameters<typeof ExSwagger>[0]);
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
  // readFileSync 不带编码返回 Buffer，JSON.parse 运行时可接受，保持原调用
  assert.ok(JSON.parse(fs.readFileSync(`${compileDistPath}/docs.json`) as unknown as string));
});

test('throws annotation produces exception definition and response', async () => {
  const exSwagger = new ExSwagger({
    compileDistPath,
    models: demoEntities,
    swaggerDocsTemplate: { definitions: {}, paths: {} },
    sourceRootPath: `${import.meta.dirname}/_example`
  });
  // exportJson 返回 Record<string, unknown>，文档结构由注解生成，按用例消费的字段局部收窄
  const docs = (await exSwagger.exportJson(`${compileDistPath}/docs-exception.json`)) as {
    definitions: Record<string, unknown>;
    paths: Record<string, { get: { responses: Record<string, { schema: { $ref: string } }> } }>;
  };
  assert.ok(docs.definitions.LogicException);
  assert.equal(
    docs.paths['/estimates/price'].get.responses['400'].schema.$ref,
    '#/definitions/LogicException'
  );
});

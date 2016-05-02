import chai from 'chai';
import { describe, it } from 'mocha/lib/mocha';
import ExSwagger from '../../src/swagger';
import * as exceptions from '../../src/exceptions';
chai.should();
const assert = chai.assert;

describe('ExSwagger', () => {
  describe('Annotations', () => {
    it('Could get file lists', async () => {
      const files = await ExSwagger.scanFiles(`${__dirname}/_example/**/*.js`);
      assert.include(files, `${__dirname}/_example/controller.js`);
    });
    it('Could parse annotions', async () => {
      const annotations = await ExSwagger.getAnnotations([`${__dirname}/_example/controller.js`]);
      assert.lengthOf(annotations, 6);
    });
    //it('Multi folders support', async () => {
    //});
  });
  describe('Swagger Docs', () => {
    it('Could parse swagger docs', async () => {
      const annotations = await ExSwagger.getAnnotations([`${__dirname}/_example/controller.js`]);
      const docs = ExSwagger.getSwaggerDocs(annotations);
      //console.log(docs)
      assert.lengthOf(docs, 4);
      assert.equal('definition', docs[0][0].type);
      assert.isObject(docs[0][0].value);
      assert.isString(docs[0][0].description);
      assert.equal('path', docs[1][0].type);
      assert.isObject(docs[1][0].value);
      assert.isString(docs[1][0].description);
      assert.equal('exception', docs[1][1].type);
      assert.isString(docs[1][1].value);
      assert.isString(docs[1][1].description);
      assert.equal('unknown', docs[3][0].type);
      assert.equal(1, ExSwagger.getYamlErrors().length);
    });
  });
  describe('Models', () => {
    it('Get entities', async () => {
      //const swaggerModels = ExSwagger.getModels(entities, ['sequelize', 'Sequelize']);
      //console.log(swaggerModels);
    });
  });
  describe('Exceptions', () => {
    it('Scan exceptions', async () => {
      const scannedExceptions = await ExSwagger.scanExceptions(
        `${__dirname}/../../src/exceptions/**/*.js`, exceptions.StandardException
      );
      assert.isAtLeast(Object.keys(scannedExceptions).length, 12);
    });
  });
  describe('Export JSON', () => {
    it('default properties', async () => {
      const exSwagger = new ExSwagger({
        projectRoot: '/foo'
      });
      const states = exSwagger.getStates();
      assert.equal('/foo/**/*.js', states.annotationPath);
      assert.equal('/foo/**/exceptions/**/*.js', states.exceptionPath);
    });
  });
});

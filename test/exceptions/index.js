import chai from 'chai';
import * as exceptions from './../../src/exceptions';
import { describe, it } from 'mocha/lib/mocha';
chai.should();
const assert = chai.assert;

describe('Exceptions', () => {
  describe('Basic', () => {
    it('CRC32', () => {
      assert.equal(exceptions.StandardException.crc32('Hello World'), 1243066710);
    });
    it('Hash', () => {
      assert.equal(exceptions.StandardException.crc32('111111'), 404288374);
      assert.equal(exceptions.StandardException.hash('111111'), '0404288374');
    });
  });
  describe('LogicException', () => {
    it('Should extends standard exception', () => {
      assert.instanceOf(new exceptions.LogicException('foo'), exceptions.StandardException);
    });
    it('Code', () => {
      assert.equal(new exceptions.LogicException('foo').getCode(), 385400003318127193);
    });
    it('Status code', () => {
      assert.equal(new exceptions.LogicException('foo').getStatusCode(), 400);
    });
  });
});

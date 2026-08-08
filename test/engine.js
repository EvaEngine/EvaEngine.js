import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import EvaEngine, { DI } from '../src/engine.js';
import { RuntimeException } from '../src/exceptions/index.js';
import Command from '../src/commands/index.js';

test('default properties', () => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    port: 3000
  });
  const meta = engine.getMeta();
  assert.equal(meta.projectRoot, projectRoot);
  assert.equal(meta.configPath, `${projectRoot}${path.sep}config`);
  assert.equal(meta.sourceRoot, `${projectRoot}${path.sep}src`);
  assert.equal(meta.port, 3000);
  assert.equal(engine.getDI(), DI);
});

test('create app', () => {
  assert.ok(Object.prototype.hasOwnProperty.call(EvaEngine.getApp(), 'use'));
  assert.ok(Object.prototype.hasOwnProperty.call(EvaEngine.getApp(), 'route'));
});

test('bootstrap', () => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    port: 3000
  });
  engine.bootstrap();
  assert.ok(Object.keys(DI.getBound()).length > 10);
});

test('CLI without commands', () => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  }, 'cli');
  assert.equal(engine.getMeta().mode, 'cli');
  assert.throws(() => engine.getCLI(), RuntimeException);
});

test('CLI with commands', () => {
  class TestCommand extends Command {
    static getName() {
      return 'hello:world';
    }

    static getDescription() {
      return 'something';
    }

    static getSpec() {
      return {};
    }
  }
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  }, 'cli');
  engine.registerCommands({ test: TestCommand });
  assert.equal(Object.keys(engine.getCommands()).length, 1);
  assert.ok(Object.prototype.hasOwnProperty.call(engine.getCLI('hello:world'), '$0'));
  assert.equal(engine.getCommandName(), 'hello:world');
  engine.clearCommands();
  assert.equal(Object.keys(engine.getCommands()).length, 0);
  assert.equal(Array.isArray(engine.getCommands()), false);
});

test('Run commands', async () => {
  class TestCommand extends Command {
    static getName() {
      return 'hello:world';
    }

    static getDescription() {
      return 'something';
    }

    static getSpec() {
      return {};
    }

    getFoo() {
      return this.foo;
    }

    run() {
      this.foo = 'bar';
    }
  }
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  }, 'cli');
  engine.registerCommands({ test: TestCommand });
  await engine.runCLI('hello:world');
  assert.equal(engine.getCommand().getFoo(), 'bar');
});

test('rejects unknown command and cron without commands', async () => {
  const engine = new EvaEngine({ projectRoot: path.normalize(`${import.meta.dirname}/_demo_project`) }, 'cli');
  await assert.rejects(engine.runCommand('missing'), RuntimeException);
  assert.throws(() => engine.runCrontab('* * * * *', 'missing'), RuntimeException);
});

import test from 'ava';
import path from 'path';
import EvaEngine, { DI } from '../src/engine.js';
import { RuntimeException } from '../src/exceptions/index.js';
import Command from '../src/commands/index.js';

test('default properties', (t) => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    port: 3000
  });
  const meta = engine.getMeta();
  t.is(meta.projectRoot, projectRoot);
  t.is(meta.configPath, `${projectRoot}${path.sep}config`);
  t.is(meta.sourceRoot, `${projectRoot}${path.sep}src`);
  t.is(meta.port, 3000);
  t.is(engine.getDI(), DI);
});

test('create app', (t) => {
  t.true(EvaEngine.getApp().hasOwnProperty('use'));
  t.true(EvaEngine.getApp().hasOwnProperty('route'));
});

test('bootstrap', (t) => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    port: 3000
  });
  // t.is(Object.keys(DI.getBound()).length, 6);
  engine.bootstrap();
  t.true(Object.keys(DI.getBound()).length > 10);
});


test('CLI without commands', (t) => {
  const projectRoot = path.normalize(`${import.meta.dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  }, 'cli');
  t.is(engine.getMeta().mode, 'cli');
  t.throws(() => engine.getCLI(), { instanceOf: RuntimeException });
});

test('CLI with commands', (t) => {
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
  t.is(Object.keys(engine.getCommands()).length, 1);
  t.true(engine.getCLI('hello:world').hasOwnProperty('$0'));
  t.is(engine.getCommandName(), 'hello:world');
  engine.clearCommands();
  t.is(Object.keys(engine.getCommands()).length, 0);
  t.false(Array.isArray(engine.getCommands()));
});

test('Run commands', (t) => {
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
  engine.runCLI('hello:world');
  t.is(engine.getCommand().getFoo(), 'bar');
});

test('rejects unknown command and cron without commands', async (t) => {
  const engine = new EvaEngine({ projectRoot: path.normalize(`${import.meta.dirname}/_demo_project`) }, 'cli');
  await t.throwsAsync(engine.runCommand('missing'), { instanceOf: RuntimeException });
  t.throws(() => engine.runCrontab('* * * * *', 'missing'), { instanceOf: RuntimeException });
});


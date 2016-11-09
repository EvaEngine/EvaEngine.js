import test from 'ava';
import path from 'path';
import EvaEngine, { DI } from '../src/engine';
import { RuntimeException } from '../src/exceptions';
import Command from '../src/commands';

test('default properties', (t) => {
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
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
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot,
    port: 3000
  });
  t.is(Object.keys(DI.getBound()).length, 5);
  engine.bootstrap();
  t.true(Object.keys(DI.getBound()).length > 10);
});


test('CLI without commands', (t) => {
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  }, 'cli');
  t.is(engine.getMeta().mode, 'cli');
  t.throws(() => engine.getCLI(), RuntimeException);
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
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  }, 'cli');
  engine.registerCommands({ test: TestCommand });
  t.is(Object.keys(engine.getCommands()).length, 1);
  t.true(engine.getCLI('hello:world').hasOwnProperty('$0'));
  t.is(engine.getCommandName(), 'hello:world');
  engine.clearCommands();
  t.is(Object.keys(engine.getCommands()).length, 0);
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
  const projectRoot = path.normalize(`${__dirname}/_demo_project`);
  const engine = new EvaEngine({
    projectRoot
  }, 'cli');
  engine.registerCommands({ test: TestCommand });
  engine.runCLI('hello:world');
  t.is(engine.getCommand().getFoo(), 'bar');
});


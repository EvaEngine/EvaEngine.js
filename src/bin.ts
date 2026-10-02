//The package entry only exports the core object, so the CLI imports its
//building blocks directly (the legacy bin/engine named imports were broken)
import EvaEngine from './engine.ts';
import DI from './di.ts';
import * as exceptions from './exceptions/index.ts';
import * as commands from './commands/index.ts';

const engine = new EvaEngine({
  projectRoot: process.cwd()
}, 'cli');
engine.registerCommands([commands]);

const logger = DI.get('logger');
try {
  await engine.runCLI();
} catch (error) {
  //用 exitCode 而非 process.exit，让 finally 里的 Redis 清理自然完成后进程才结束
  process.exitCode = 1;
  if (error instanceof exceptions.StandardException) {
    logger.warn(error.getDetails());
    logger.warn(error.message);
  } else {
    logger.error(error);
  }
} finally {
  const redis = DI.get('redis');
  if (redis.isConnected()) {
    await redis.cleanup();
  }
}

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
  if (process.env.SPRING_CONFIG_ENDPOINT) {
    await DI.get('config').resolveSpringConfig({
      endpoint: process.env.SPRING_CONFIG_ENDPOINT,
      name: process.env.SPRING_CONFIG_NAME || 'unknown-spring-config-name',
      profiles: process.env.SPRING_CONFIG_PROFILES || process.env.NODE_ENV,
      label: process.env.SPRING_CONFIG_LABEL || 'main'
    });
  }
  await engine.runCLI();
} catch (error) {
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

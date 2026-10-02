import Command from './interface.ts';
import DI from '../di.ts';

interface TrampDbConfig {
  replication: {
    write: {
      host?: unknown;
      username?: unknown;
      password?: unknown;
    };
  };
  database?: unknown;
  port?: unknown;
  migrationPaths?: unknown;
}

export default class TrampConfig extends Command {
  static override getName(): string {
    return 'tramp:dump-config';
  }

  static override getDescription(): string {
    return 'Print tramp cli required config json';
  }

  static override getSpec(): object {
    return {};
  }

  override async run(): Promise<void> {
    const config = DI.get('config');
    const dbConfig = config.get('db') as TrampDbConfig;

    console.log(JSON.stringify({
      connection: {
        host: dbConfig.replication.write.host,
        user: dbConfig.replication.write.username,
        password: dbConfig.replication.write.password,
        database: dbConfig.database,
        port: dbConfig.port
      },
      editor: config.get('dev.editor') || 'webstorm',
      paths: dbConfig.migrationPaths
    }));
  }
}

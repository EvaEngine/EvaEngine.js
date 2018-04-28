import Command from './interface';
import DI from '../di';

export default class TrampConfig extends Command {
  static getName() {
    return 'tramp:dump-config';
  }

  static getDescription() {
    return 'Print tramp cli required config json';
  }

  static getSpec() {
    return {};
  }

  async run() {
    const config = DI.get('config');
    const dbConfig = config.get('db');
    // eslint-disable-next-line no-console
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


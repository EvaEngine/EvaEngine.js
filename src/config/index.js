export default {
  sequelize: {
    logging: true
  },
  logger: {
    file: ''
  },
  cache: {
    prefix: 'eva',
    driver: 'redis'
  },
  redis: {
    host: '127.0.0.1',
    port: 6379
  },
  db: {
    dialect: 'mysql',
    port: 3306,
    database: '',
    dialectOptions: {
      multipleStatements: true,
      timeout: 3
    },
    replication: {
      write: {
        host: '',
        username: '',
        password: '',
        pool: {}
      },
      read: []
    }
  },
  session: {
    cookie: {
      path: '/',
      httpOnly: false,
      secure: false,
      maxAge: 3600 * 1000 //这里单位是ms
    },
    store: null,
    secret: 'evaengine',
    resave: true,
    saveUninitialized: true
  },
  token: {
    prefix: '',
    secret: '',
    faker: {
      enable: false,
      key: 'eva',
      uid: 1
    }
  },
  swagger: {
    swagger: '2.0',
    info: {
      title: '',
      description: '',
      version: ''
    },
    produces: [
      'application/json'
    ],
    host: '',
    basePath: '/',
    schemes: [
      'http'
    ],
    paths: {},
    definitions: {}
  }
};

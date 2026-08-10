# EvaEngine for Node.js

[![NPM version](https://img.shields.io/npm/v/evaengine.svg?style=flat-square)](http://badge.fury.io/js/evaengine)
[![CI](https://github.com/EvaEngine/EvaEngine.js/actions/workflows/ci.yml/badge.svg)](https://github.com/EvaEngine/EvaEngine.js/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/EvaEngine/EvaEngine.js/branch/main/graph/badge.svg)](https://codecov.io/gh/EvaEngine/EvaEngine.js)
[![npm](https://img.shields.io/npm/dm/evaengine.svg?maxAge=2592000)](https://www.npmjs.com/package/evaengine)
[![License](https://img.shields.io/npm/l/evaengine.svg?maxAge=2592000?style=plastic)](https://github.com/EvaEngine/EvaEngine.js/blob/main/LICENSE)

**Application runtime** for Node.js microservices: one engine for **HTTP**, **CLI**, and **cron**, with DI, providers, middleware, config, cache, auth helpers, entities (Sequelize), exceptions, and Swagger generation.

> **Consumers (humans & agents):** this README is the full public guide. You do **not** need the repo `docs/` tree to use the package.

## Requirements

- Node.js **≥ 24**
- ESM (`"type": "module"`)
- npm (or any client that installs from the npm registry)

## Install

```bash
npm install evaengine
```

Optional starter: [EvaSkeleton.js](https://github.com/EvaEngine/EvaSkeleton.js).

## Import (important)

The package **default export** is a single `core` object. Named top-level exports are only `default` and `core` (same object).

```js
import eva from 'evaengine';
// or: import { core as eva } from 'evaengine';

const {
  EvaEngine,
  Command,
  DI,
  Entities,
  express,
  wrapper,
  services,
  middlewares,
  providers,
  exceptions,
  swagger,
  utils,
  commands,       // built-in CLI commands
  Joi,
  sequelize
} = eva;
```

Do **not** rely on `import { EvaEngine } from 'evaengine'` — that named export is not provided.

---

## Mental model

```text
new EvaEngine(meta, mode?)
  → base services bound (env, config, logger, namespace, now, event_manager)
  → bootstrap()                 # web services + middleware providers
  → use(...) / registerCommands
  → run() | runHttps() | runCLI() | runCrontab() | runCommand()
```

| Mode | Typical flow |
|------|----------------|
| `web` (default) | `bootstrap()` → `use()` → `run()` / `runHttps()` |
| `cli` | `registerCommands()` → `runCLI()` / `runCrontab()` / `runCommand()` |

**Process-level facts (plan for one engine per process):**

- `DI` is a **global** container.
- `EvaEngine.getApp()` is a **module-level** Express app singleton.
- `bootstrap()` registers **web** service + middleware providers. CLI paths register CLI services inside `getCLI` / `runCrontab`.
- Built-in `EventManager` is **in-process only** (not a message queue).

---

## Quick start

### Web

```js
import eva from 'evaengine';

const { EvaEngine, DI, wrapper, exceptions } = eva;
const { UnauthorizedException } = exceptions;

const engine = new EvaEngine({
  projectRoot: process.cwd(),
  port: Number(process.env.PORT) || 3000
  // configPath, sourceRoot optional
});

engine.bootstrap();

// Optional cross-cutting middleware (after bootstrap)
engine.use(DI.get('trace')());
// engine.use(DI.get('session')());
// engine.use(DI.get('auth')());

engine.use('/health', (req, res) => {
  res.json({ ok: true });
});

engine.use('/me', wrapper(async (req, res) => {
  if (!req.auth?.uid) {
    throw new UnauthorizedException('Login required');
  }
  res.json({ uid: req.auth.uid });
}));

engine.run();
```

### CLI

```js
import eva from 'evaengine';
import * as UserCommands from './commands/user.js';

const { EvaEngine } = eva;

const engine = new EvaEngine({ projectRoot: process.cwd() }, 'cli');
engine.registerCommands(UserCommands);
await engine.runCLI();
// node app.js user:create --name=Ada
```

### Cron

```js
import eva from 'evaengine';
import * as Jobs from './commands/jobs.js';

const { EvaEngine } = eva;

const engine = new EvaEngine({ projectRoot: process.cwd() }, 'cli');
engine.registerCommands([Jobs]);
// 6-field cron (seconds) when useSeconds default applies via parse; see runCrontab third arg
engine.runCrontab('0/10 * * * * *', 'hello:world --id=EvaEngine');
```

### Built-in CLI binary

```bash
npx engine
npx engine make:entity
npx engine make:dbview
npx engine make:graphql
npx engine tramp:dump-config
```

With Spring Cloud Config (bin only):

- `SPRING_CONFIG_ENDPOINT` (required to enable)
- `SPRING_CONFIG_NAME`, `SPRING_CONFIG_PROFILES`, `SPRING_CONFIG_LABEL`

---

## Project layout (recommended)

```text
project/
  package.json          # "type": "module"
  config/
    config.default.cjs
    config.development.cjs
    config.production.cjs
    config.local.development.cjs   # gitignored overrides
  src/
    app.js              # web entry
    cli.js
    commands/
    entities/
    routes/
  test/
```

---

## Configuration

Files under `{projectRoot}/config` (override with constructor `configPath`), merged in order:

1. Engine defaults (shipped inside the package)
2. `config.default.cjs`
3. `config.<NODE_ENV>.cjs`
4. optional `config.local.<NODE_ENV>.cjs` (missing file is ignored)

Use **CommonJS** `.cjs` in config (loaded via `require`).

```js
// config/config.default.cjs
module.exports = {
  app: { name: 'my-service' },
  redis: { host: '127.0.0.1', port: 6379, lazyConnect: true },
  cache: { prefix: 'myapp', driver: 'redis' },
  token: {
    secret: process.env.TOKEN_SECRET || '',
    provider: undefined, // set 'kong' to use Kong JWT + auth middleware
    faker: { enable: false, key: 'eva', uid: 1 }
  },
  session: {
    secret: process.env.SESSION_SECRET || 'change-me',
    resave: true,
    saveUninitialized: true,
    cookie: { path: '/', httpOnly: true, secure: false, maxAge: 3600_000 }
  },
  db: {
    dialect: 'mysql',
    port: 3306,
    database: '',
    replication: {
      write: { host: '', username: '', password: '', pool: {} },
      read: []
    }
  }
};
```

Read config at runtime:

```js
const config = DI.get('config');
config.get('redis.host');
config.get(); // whole object
```

### Environment variables

| Variable | Role |
|----------|------|
| `NODE_ENV` | Selects `config.<env>.cjs` |
| `PORT` | Common app port (pass into constructor if you use it) |
| `LOG_LEVEL` | Overrides logger level |
| `TZ` | Default timezone for moment (`Asia/Shanghai` if unset) |
| `CLI_NAME` | Logger label in CLI mode |
| `MAX_REQUEST_DEBUG_BODY` | Debug middleware body limit |
| `SEQUELIZE_REPLICATION_CONFIG_KEY` | Alternate key under `db` for replication config |
| `SPRING_CONFIG_*` | Bin remote config (see above) |

---

## DI & services

```js
DI.get('logger').info('hello');
DI.get('redis').getInstance();
DI.get('cache'); // cache facade
DI.get('jwt');
DI.get('http_client');
DI.get('rest_client');
DI.get('event_manager');
DI.get('namespace');
DI.get('now');
DI.get('env');
DI.get('validator_base');
```

| DI name | Bound in |
|---------|----------|
| `env`, `config`, `logger`, `namespace`, `now`, `event_manager` | constructor (base) |
| `redis`, `cache`, `http_client`, `rest_client`, `validator_base`, `jwt` | `bootstrap()` (web) or CLI run path |
| Middleware names below | `bootstrap()` |

**Custom provider:**

```js
import eva from 'evaengine';

const { DI, providers } = eva;
const { ServiceProvider } = providers.services;

class MyApiProvider extends ServiceProvider {
  get name() { return 'my_api'; }
  register() {
    DI.bindValue(this.name, { ping: () => 'pong' });
  }
}

engine.registerService(MyApiProvider);
// or replace whole lists:
// EvaEngine.setServiceProvidersForWeb([...EvaEngine.getServiceProvidersForWeb(), MyApiProvider]);
```

Testing helpers: `DI.reset()`, `DI.registerMockedProviders(providers, configPath)`, `DI.bindClass` / `bindValue` / `bindMethod`.

---

## Middleware

After `bootstrap()`, factories are bound by name. **Call the factory** (note double invoke where shown):

```js
engine.use(DI.get('trace')());
engine.use(DI.get('session')());
engine.use(DI.get('auth')());
// validator is a higher-order factory:
engine.use('/items', DI.get('validator')(() => ({
  query: eva.Joi.object({ page: eva.Joi.number().integer().required() })
})), handler);
```

| Name | Role |
|------|------|
| `session` | `express-session` (Redis store via connect-redis) |
| `auth` | JWT from `X-Token` or `api_key`, or session `uid`; optional faker token |
| `trace` | Request tracing (works with namespace) |
| `validator` | Joi request validation |
| `view_cache` | Response caching helper |
| `debug` | Debug output |

If `config.token.provider === 'kong'`, both `jwt` service and `auth` middleware switch to Kong variants.

Use `wrapper(async (req,res) => …)` so thrown `exceptions.*` reach the default error handler.

---

## Commands

```js
import eva from 'evaengine';

const { Command, DI } = eva;

export class HelloWorld extends Command {
  static getName() { return 'hello:world'; }
  static getDescription() { return 'Say hello'; }
  static getSpec() {
    return {
      id: { type: 'string', description: 'Who to greet' }
    };
  }
  async run() {
    const { id = 'world' } = this.getOptions();
    DI.get('logger').info(`Hello ${id}`);
  }
}
```

Register with `engine.registerCommands(moduleExports)` or arrays of modules. Names come from `getName()`.

Engine APIs: `runCLI()`, `runCommand('name --flag=1')`, `runCrontab(expression, 'name --flag=1', useSeconds?)`, `clearCommands()`, `clearCrontabs()`.

---

## Entities (Sequelize)

```js
import path from 'path';
import eva from 'evaengine';

const { Entities, DI } = eva;

const entities = new Entities(path.join(process.cwd(), 'src/entities'));
entities.init(); // builds Sequelize from config.db + scans directory

const User = entities.get('user');
const all = entities.getAll();
await entities.getTransaction(async (t) => { /* … */ });
```

Entity file (CJS or ESM factory loaded via `require`):

```js
// src/entities/user.cjs
module.exports = (sequelize, DataTypes) =>
  sequelize.define('user', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false }
  }, { tableName: 'users' });
```

---

## Exceptions

```js
import eva from 'evaengine';

const {
  StandardException,
  LogicException,
  InvalidArgumentException,
  UnauthorizedException,
  ResourceNotFoundException,
  RuntimeException
  // …see package `exceptions` export
} = eva.exceptions;
```

Default HTTP error handler (installed in `run` / `runHttps`) maps `StandardException` subclasses to JSON + status; production strips stack details.

---

## Swagger

Use `eva.swagger` (`ExSwagger`, annotation helpers) to generate Swagger 2.0 from source comments and models. Wire generation in your app script; UI assets come from `swagger-ui-dist` dependency.

---

## EvaEngine API surface

```text
constructor({ projectRoot, configPath?, sourceRoot?, port?, config?, logger?, namespace? }, mode?='web')
getMeta() getDI()
bootstrap() use(...args) run(port?) runHttps(port?, options?) getServer()
registerCommands(commands) getCommands() clearCommands() getCommand() getCommandName()
runCLI(name?) runCommand(commandString) runCrontab(seq, commandString, useSeconds?) clearCrontabs()
registerServiceProviders(providers) registerService(ProviderClass)
setDefaultErrorHandler / getDefaultErrorHandler
setUncaughtExceptionHandler / getUncaughtExceptionHandler
setServerErrorHandler / getServerErrorHandler
static getApp() createRouter() getVersion()
static get/set BaseServiceProviders | ServiceProvidersForWeb | ServiceProvidersForCLI | MiddlewareProviders
```

---

## What this is not

- Not only an Express wrapper — HTTP is one entry
- Not your domain framework or business rules layer
- Not a message bus (use a real MQ for reliable delivery)
- Not a full ORM product — Sequelize integration helpers only

---

## Library development (this repo)

```bash
git clone https://github.com/EvaEngine/EvaEngine.js.git
cd EvaEngine.js
npm install
npm run lint
npm run build
npm test          # needs Redis on 127.0.0.1:6379 for some tests
```

Release: semantic-release on `main` (Conventional Commits). Maintainer maps live under `docs/` in git only; they are **not** required for npm consumers.

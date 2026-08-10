# EvaEngine for Node.js

[![NPM version](https://img.shields.io/npm/v/evaengine.svg?style=flat-square)](http://badge.fury.io/js/evaengine)
[![CI](https://github.com/EvaEngine/EvaEngine.js/actions/workflows/ci.yml/badge.svg)](https://github.com/EvaEngine/EvaEngine.js/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/EvaEngine/EvaEngine.js/branch/main/graph/badge.svg)](https://codecov.io/gh/EvaEngine/EvaEngine.js)
[![npm](https://img.shields.io/npm/dm/evaengine.svg?maxAge=2592000)](https://www.npmjs.com/package/evaengine)
[![License](https://img.shields.io/npm/l/evaengine.svg?maxAge=2592000?style=plastic)](https://github.com/EvaEngine/EvaEngine.js/blob/main/LICENSE)

面向 Node.js 微服务的 **Application Runtime**：同一套引擎覆盖 **HTTP**、**CLI**、**定时任务**，并提供 DI、Provider、中间件、配置、缓存、鉴权辅助、实体（Sequelize）、异常体系与 Swagger 生成。

> **消费方（人与 agent）：** 本 README 即为完整对外说明。使用本包**不需要**阅读仓库内的 `docs/`。

## 环境要求

- Node.js **≥ 24**
- ESM（`"type": "module"`）
- npm（或其它可从 npm  registry 安装的客户端）

## 安装

```bash
npm install evaengine
```

可选脚手架：[EvaSkeleton.js](https://github.com/EvaEngine/EvaSkeleton.js)。

## 导入方式（重要）

包的 **default 导出** 是一个 `core` 对象。顶层具名导出只有 `default` 与 `core`（同一对象）。

```js
import eva from 'evaengine';
// 或：import { core as eva } from 'evaengine';

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
  commands,       // 内置 CLI 命令
  Joi,
  sequelize
} = eva;
```

**不要**依赖 `import { EvaEngine } from 'evaengine'`——该具名导出不存在。

---

## 心智模型

```text
new EvaEngine(meta, mode?)
  → 绑定 base 服务（env, config, logger, namespace, now, event_manager）
  → bootstrap()                 # web 服务 + 中间件 Provider
  → use(...) / registerCommands
  → run() | runHttps() | runCLI() | runCrontab() | runCommand()
```

| 模式 | 典型流程 |
|------|----------|
| `web`（默认） | `bootstrap()` → `use()` → `run()` / `runHttps()` |
| `cli` | `registerCommands()` → `runCLI()` / `runCrontab()` / `runCommand()` |

**进程级事实（按每进程一个 Engine 规划）：**

- `DI` 是**全局**容器。
- `EvaEngine.getApp()` 是**模块级** Express app 单例。
- `bootstrap()` 注册 **web** 服务与中间件 Provider；CLI 路径在 `getCLI` / `runCrontab` 内注册 CLI 服务。
- 内置 `EventManager` **仅进程内**（不是消息队列）。

---

## 快速开始

### Web

```js
import eva from 'evaengine';

const { EvaEngine, DI, wrapper, exceptions } = eva;
const { UnauthorizedException } = exceptions;

const engine = new EvaEngine({
  projectRoot: process.cwd(),
  port: Number(process.env.PORT) || 3000
  // configPath、sourceRoot 可选
});

engine.bootstrap();

// 可选横切中间件（须在 bootstrap 之后）
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

### 定时任务

```js
import eva from 'evaengine';
import * as Jobs from './commands/jobs.js';

const { EvaEngine } = eva;

const engine = new EvaEngine({ projectRoot: process.cwd() }, 'cli');
engine.registerCommands([Jobs]);
// 六段 cron（含秒）等细节见 runCrontab 第三参数 useSeconds
engine.runCrontab('0/10 * * * * *', 'hello:world --id=EvaEngine');
```

### 内置 CLI 二进制

```bash
npx engine
npx engine make:entity
npx engine make:dbview
npx engine make:graphql
npx engine tramp:dump-config
```

配合 Spring Cloud Config（仅 bin）：

- `SPRING_CONFIG_ENDPOINT`（设置后启用）
- `SPRING_CONFIG_NAME`、`SPRING_CONFIG_PROFILES`、`SPRING_CONFIG_LABEL`

---

## 推荐项目结构

```text
project/
  package.json          # "type": "module"
  config/
    config.default.cjs
    config.development.cjs
    config.production.cjs
    config.local.development.cjs   # 本地覆盖，建议 gitignore
  src/
    app.js              # web 入口
    cli.js
    commands/
    entities/
    routes/
  test/
```

---

## 配置

配置目录为 `{projectRoot}/config`（可用构造参数 `configPath` 覆盖），按以下顺序合并：

1. 引擎内置默认（随包提供）
2. `config.default.cjs`
3. `config.<NODE_ENV>.cjs`
4. 可选 `config.local.<NODE_ENV>.cjs`（不存在则忽略）

配置文件使用 **CommonJS** `.cjs`（经 `require` 加载）。

```js
// config/config.default.cjs
module.exports = {
  app: { name: 'my-service' },
  redis: { host: '127.0.0.1', port: 6379, lazyConnect: true },
  cache: { prefix: 'myapp', driver: 'redis' },
  token: {
    secret: process.env.TOKEN_SECRET || '',
    provider: undefined, // 设为 'kong' 时使用 Kong JWT 与对应 auth 中间件
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

运行时读取：

```js
const config = DI.get('config');
config.get('redis.host');
config.get(); // 完整对象
```

### 环境变量

| 变量 | 作用 |
|------|------|
| `NODE_ENV` | 选择 `config.<env>.cjs` |
| `PORT` | 常见应用端口（使用时传入构造参数） |
| `LOG_LEVEL` | 覆盖日志级别 |
| `TZ` | moment 默认时区（未设置时为 `Asia/Shanghai`） |
| `CLI_NAME` | CLI 模式下 logger 标签 |
| `MAX_REQUEST_DEBUG_BODY` | debug 中间件 body 限制 |
| `SEQUELIZE_REPLICATION_CONFIG_KEY` | `db` 下 replication 配置的替代键名 |
| `SPRING_CONFIG_*` | bin 远程配置（见上文） |

---

## DI 与服务

```js
DI.get('logger').info('hello');
DI.get('redis').getInstance();
DI.get('cache'); // 缓存门面
DI.get('jwt');
DI.get('http_client');
DI.get('rest_client');
DI.get('event_manager');
DI.get('namespace');
DI.get('now');
DI.get('env');
DI.get('validator_base');
```

| DI 名 | 绑定时机 |
|-------|----------|
| `env`、`config`、`logger`、`namespace`、`now`、`event_manager` | 构造时（base） |
| `redis`、`cache`、`http_client`、`rest_client`、`validator_base`、`jwt` | `bootstrap()`（web）或 CLI 执行路径 |
| 下文中间件名 | `bootstrap()` |

**自定义 Provider：**

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
// 或替换整表：
// EvaEngine.setServiceProvidersForWeb([...EvaEngine.getServiceProvidersForWeb(), MyApiProvider]);
```

测试辅助：`DI.reset()`、`DI.registerMockedProviders(providers, configPath)`、`DI.bindClass` / `bindValue` / `bindMethod`。

---

## 中间件

`bootstrap()` 之后按名称绑定工厂。**需要调用工厂**（注意部分场景二次调用）：

```js
engine.use(DI.get('trace')());
engine.use(DI.get('session')());
engine.use(DI.get('auth')());
// validator 是高阶工厂：
engine.use('/items', DI.get('validator')(() => ({
  query: eva.Joi.object({ page: eva.Joi.number().integer().required() })
})), handler);
```

| 名称 | 作用 |
|------|------|
| `session` | `express-session`（经 connect-redis 的 Redis 存储） |
| `auth` | 从 `X-Token` 或 `api_key` 取 JWT，或 session `uid`；可选 faker token |
| `trace` | 请求追踪（与 namespace 协作） |
| `validator` | Joi 请求校验 |
| `view_cache` | 响应缓存辅助 |
| `debug` | 调试输出 |

当 `config.token.provider === 'kong'` 时，`jwt` 服务与 `auth` 中间件均切换为 Kong 实现。

使用 `wrapper(async (req,res) => …)`，以便抛出的 `exceptions.*` 进入默认错误处理器。

---

## 命令（Command）

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

通过 `engine.registerCommands(moduleExports)` 或模块数组注册。名称来自 `getName()`。

Engine API：`runCLI()`、`runCommand('name --flag=1')`、`runCrontab(expression, 'name --flag=1', useSeconds?)`、`clearCommands()`、`clearCrontabs()`。

---

## 实体（Sequelize）

```js
import path from 'path';
import eva from 'evaengine';

const { Entities, DI } = eva;

const entities = new Entities(path.join(process.cwd(), 'src/entities'));
entities.init(); // 按 config.db 构建 Sequelize 并扫描目录

const User = entities.get('user');
const all = entities.getAll();
await entities.getTransaction(async (t) => { /* … */ });
```

实体文件（经 `require` 加载的 CJS 或 ESM 工厂）：

```js
// src/entities/user.cjs
module.exports = (sequelize, DataTypes) =>
  sequelize.define('user', {
    id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false }
  }, { tableName: 'users' });
```

---

## 异常

```js
import eva from 'evaengine';

const {
  StandardException,
  LogicException,
  InvalidArgumentException,
  UnauthorizedException,
  ResourceNotFoundException,
  RuntimeException
  // …完整列表见包导出 exceptions
} = eva.exceptions;
```

默认 HTTP 错误处理器在 `run` / `runHttps` 时挂载：将 `StandardException` 子类映射为 JSON 与状态码；生产环境会剥离 stack 等细节。

---

## Swagger

使用 `eva.swagger`（`ExSwagger`、注解辅助等）从源码注释与模型生成 Swagger 2.0。在应用脚本中自行接入生成流程；UI 资源来自依赖 `swagger-ui-dist`。

---

## EvaEngine API 一览

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

## 本库不是什么

- 不只是 Express 薄封装——HTTP 只是入口之一
- 不是业务领域框架或业务规则层
- 不是消息总线（可靠投递请用真正的 MQ）
- 不是完整 ORM 产品——仅提供 Sequelize 集成辅助

---

## 本仓库开发

```bash
git clone https://github.com/EvaEngine/EvaEngine.js.git
cd EvaEngine.js
npm install
npm run lint
npm run build
npm test          # 部分测试需要本机 Redis 127.0.0.1:6379
```

发版：在 `main` 上由 semantic-release（Conventional Commits）执行——仅发布 npm，不创建 GitHub Release。维护者文档在 git 的 `docs/` 下，**npm 消费方无需阅读**。
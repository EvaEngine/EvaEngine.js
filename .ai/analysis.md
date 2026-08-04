# EvaEngine Architecture Analysis

**分析版本**: 2026
**项目**: EvaEngine.js
**定位**: Node.js application runtime framework

## 1. Executive Summary

EvaEngine 的核心目标不是单纯封装 Express，而是为复杂 Node.js 应用提供一个可持续演化的运行时骨架。

它把应用启动、配置、依赖注入、基础设施服务、HTTP middleware、CLI command、Entity/ORM、事件与文档生成组织在同一个 Runtime 中。

核心思想可以概括为：

```text
Application
  -> Runtime / Engine
    -> Provider registration
      -> DI Container
        -> Service / Middleware / Command
          -> Domain and persistence capability
```

项目当前属于 **application runtime framework**，而不是纯 HTTP framework。

它解决的是：

- 如何统一 Web、CLI、Cron 等不同入口。
- 如何集中管理基础设施能力及其生命周期。
- 如何让服务可以替换、mock 和按配置选择实现。
- 如何自动发现 Entity、Command、Swagger metadata 等应用组件。
- 如何避免业务代码直接依赖 Redis、Logger、Config、JWT、HTTP client 等基础设施。

当前代码仍带有明显的 2018 年 Node 生态特征，例如全局 DI、模块级状态、ORM 与 Domain 耦合、旧式 request/later 依赖以及部分静态 metadata 处理。但其 Runtime、Provider、Metadata、Command/Event 方向仍然适合后续 Aurora Runtime 设计。

## 2. Core Goals

### 2.1 Unified Application Runtime

`EvaEngine` 是应用运行时的中心对象。它持有应用元数据、运行模式、命令注册表、HTTP server、Cron handler 和默认错误处理器。

支持的运行模式主要包括：

- Web/HTTP
- CLI
- Cron command
- HTTPS server
- Background-like command execution

这些入口都通过同一个 Engine 和同一套 DI/Provider 机制进入应用。

### 2.2 Capability-Oriented Infrastructure

基础设施被包装为可注入的 capability，例如：

- `Config`
- `Env`
- `Logger`
- `Redis`
- `Cache`
- `HttpClient`
- `RestClient`
- `JsonWebToken`
- `Namespace`
- `Now`
- `EventManager`
- `ValidatorBase`

业务或 middleware 不应该自行创建这些对象，而应通过 DI 获取 Provider 注册的服务。

### 2.3 Convention and Metadata Driven Application

EvaEngine 使用约定、扫描和 metadata 生成应用结构：

- Command 有静态 `getName()`、`getDescription()`、`getSpec()`。
- Entity 从目录扫描并注册到 Entity registry。
- Swagger 从 source files、注释、异常和 Sequelize model 生成文档。
- Provider 通过类集合批量注册。
- Middleware 通过 Provider 绑定为命名服务。

## 3. Problems Solved

### 3.1 Application Composition

没有 Runtime framework 时，Web server、CLI、Cron 往往各自初始化配置、Logger、Redis 和数据库，导致：

- 初始化顺序不一致。
- 服务重复创建。
- 配置读取分散。
- 测试替换困难。
- 不同入口的行为不一致。

Engine 通过统一的 bootstrap 和 provider registration 解决这些问题。

### 3.2 Dependency Coupling

直接使用：

```js
const redis = require('redis');
```

会使业务代码与具体实现绑定。EvaEngine 通过：

```text
Provider -> DI binding -> Service abstraction -> concrete implementation
```

允许替换实现、注入 mock，并支持按配置选择 JWT provider 等实现。

### 3.3 Cross-Cutting Concerns

Logger、Trace、Auth、Session、Validator、View Cache 等横切能力集中在 middleware/provider 层，而不是散落在每个 Controller 或 Command 中。

### 3.4 ORM and Documentation Automation

Entity scanner 和 Swagger generator 试图把数据库模型、源代码注释、异常类型转换为运行时 registry 和公开 API 文档，降低重复声明成本。

## 4. Core Abstractions

### 4.1 EvaEngine / Runtime

文件：`src/engine.js`

Engine 负责：

- 保存 `projectRoot`、`configPath`、`sourceRoot`、`mode`、`port` 等 metadata。
- 创建 Express application/router。
- 注册基础 Service Provider。
- 注册 Web/CLI middleware provider。
- 注册 Command。
- 启动 HTTP/HTTPS server。
- 解析并运行 CLI command。
- 注册 Cron command。
- 提供默认错误处理和 server error handling。
- 维护 Cron handler 并清理它们。

Engine 是 Kernel/Runtime 层的主要实现，但当前职责偏多，未来可以拆成：

```text
Kernel
  RuntimeContext
  ProviderRegistry
  CommandBus
  HttpRuntime
  CliRuntime
  CronRuntime
  ShutdownCoordinator
```

### 4.2 DI Container

文件：`src/di.js`

DI 对 `constitute.Container` 做了轻量包装，支持：

- `DI.get(key)`
- `DI.bindClass(name, Class)`
- `DI.bindValue(name, value)`
- `DI.bindMethod(name, method)`
- `DI.reset()`
- `DI.registerServiceProviders()`
- `DI.registerMockedProviders()`

DI 同时维护：

- 实际 container。
- 命名服务到 class/value/method 的 `bound` registry。

这是一个运行时 DI，而非类型安全 DI。它的主要价值是生命周期和可替换性，不是编译期检查。

### 4.3 ServiceProvider

文件：`src/services/providers.js`

`ServiceProvider` 是基础扩展抽象：

```js
class ServiceProvider {
  constructor(engine) {}
  get name() {}
  register() {}
}
```

现有 Provider 负责把具体服务绑定进 DI，例如：

- `ConfigProvider`
- `LoggerProvider`
- `RedisProvider`
- `CacheProvider`
- `HttpClientProvider`
- `RestClientProvider`
- `NamespaceProvider`
- `JsonWebTokenProvider`
- `EventManagerProvider`
- `NowProvider`

Provider 是 EvaEngine 最重要、也最值得保留的抽象之一，因为它定义了能力装配边界。

### 4.4 ServiceInterface

文件：`src/services/interface.js`

当前接口很薄，主要提供 `getProto()`。实际 service contract 由具体 service 的 public methods 决定。

主要服务包括：

- Config: 配置加载、查询、reload、Spring Config 解析。
- Logger: debug/verbose/info/warn/error/dump。
- Redis: getInstance、setOptions、cleanup、isConnected。
- Cache: get/set/del/has/flush/namespace。
- HTTP/REST Client: request、dumpRequest、dumpResponse。
- JWT: save/find/clear/encode/decode。
- EventManager: listener registration and emit。

### 4.5 Command

文件：`src/commands/interface.js`

Command 是 Web 之外的主要应用入口抽象：

```js
class Command {
  constructor(argv) {}
  getArgv() {}
  setArgv(argv) {}
  getOptions() {}
  static getName() {}
  static getDescription() {}
  static getSpec() {}
  run() {}
}
```

Command 通过 Engine 注册，并可由 CLI 或 Cron 调用。

理想分层应为：

```text
CLI / Cron / HTTP
  -> Command
    -> UseCase
      -> Domain Service
        -> Repository
```

当前 Command 仍可能直接访问 DI、Entity 和基础设施，UseCase boundary 尚未独立形成。

### 4.6 Middleware

Middleware 由 provider 注册为命名服务：

- session
- auth
- debug
- view_cache
- validator
- trace

Middleware 解决 HTTP 横切关注点，但部分 middleware 同时承担业务策略和基础设施访问，边界仍偏重。

### 4.7 Entity Registry

文件：`src/entities/index.js`

Entity 系统包括：

```text
Entity path
  -> filesystem scanner
    -> Sequelize model factory
      -> entity registry
        -> association setup
          -> query/persistence helper
```

`Entities` 负责：

- 扫描 Entity 文件。
- 创建 Sequelize model。
- 维护 `entities` registry。
- 调用 `associate`。
- 提供 query、transaction、uniqueInsert 等 persistence helper。
- 将 model metadata 提供给 Swagger。

当前 Entity 与 Sequelize persistence model 强耦合，还不是独立的 Domain Entity。

### 4.8 Swagger Metadata Pipeline

文件：`src/swagger/index.js`

Swagger pipeline 大致为：

```text
Source files
  -> Glob scanner
    -> Acorn comments/parser
      -> Doctrine/JSDoc parser
        -> Annotation/Fragment model
          -> Exceptions + Sequelize models merge
            -> Swagger JSON
```

这是 Metadata-driven automation 的典型实现，也是 EvaEngine 与 Aurora Knowledge Runtime 可以共享的思想。

## 5. Lifecycle Design

### 5.1 Current Lifecycle

当前典型 Web lifecycle：

```text
new EvaEngine(meta)
  -> bootstrap()
    -> register base service providers
    -> register web service providers
    -> register middleware providers
    -> bind services into DI
  -> register commands/controllers/entities as needed
  -> run(port)
    -> create HTTP server
    -> attach error handlers
    -> listen
  -> request lifecycle
  -> cleanup selected resources
```

CLI lifecycle：

```text
new EvaEngine(meta, 'cli')
  -> register CLI providers
  -> register commands
  -> getCLI()/runCLI()
  -> instantiate command
  -> command.run()
  -> cleanup Redis when caller performs cleanup
```

Cron lifecycle：

```text
runCrontab(sequence, commandString)
  -> validate command registry
  -> register CLI providers
  -> parse schedule
  -> create later interval
  -> invoke command.run() per round
  -> clearCrontabs()
```

### 5.2 Lifecycle Strengths

- Provider registration发生在 Runtime bootstrap 阶段。
- 服务按需由 DI 构造。
- Command 在执行时实例化。
- Redis、HTTP server、Cron handler 有明确的获取或清理入口。
- Web、CLI、Cron 使用同一套服务抽象。

### 5.3 Lifecycle Limitations

当前没有完整的统一 lifecycle protocol：

```text
register()
boot()
start()
shutdown()
```

Provider 主要只有 `register()`，因此：

- 资源建立时机依赖 service 的 `getInstance()`。
- shutdown 不由 Kernel 统一协调。
- server、Redis、HTTP client、Cron 的清理责任分散。
- 多次 bootstrap 或多个 Engine 实例可能产生状态污染。

未来建议：

```text
Provider.register(context)
Provider.boot(context)
Provider.start(context)
Provider.stop(context)
Provider.shutdown(context)
```

并由 `RuntimeContext` 管理所有 disposable resources。

## 6. Extension Mechanism

### 6.1 Service Providers

新增基础设施能力的主要方式：

1. 创建 `ServiceProvider` 子类。
2. 实现稳定的 `name`。
3. 在 `register()` 中绑定 class/value/method。
4. 将 Provider 加入 Engine 对应 provider list。

这是最清晰、最成熟的扩展机制。

### 6.2 Middleware Providers

新增 HTTP 横切能力时：

1. 创建 middleware factory。
2. 创建对应 Provider。
3. 使用 `DI.bindMethod(name, middlewareFactory)`。
4. 在 Runtime bootstrap 阶段注册。

### 6.3 Commands

通过继承 `Command` 并实现静态 metadata 扩展：

```js
class MyCommand extends Command {
  static getName() {}
  static getDescription() {}
  static getSpec() {}
  async run() {}
}
```

Engine 的 command registry 通过 `getName()` 建立命名路由。

### 6.4 Entity Files

将 Entity factory 放入约定目录即可被 scanner 发现。Entity 可以提供 `associate` 方法完成关联关系注册。

### 6.5 Configuration-Based Implementations

部分能力根据配置选择实现：

- JWT provider: local JWT 或 Kong JWT。
- Cache: Redis store 或 Null store。
- Namespace: enabled 或 disabled。
- Logger: environment/config 控制 level 和 file transport。

这属于 conditional binding，是 Provider 机制的核心价值。

## 7. Public Contract Candidates

以下 API 从入口导出、文档、测试和用户使用方式看，属于明显的 public contract。

### Package Entry

`src/index.js`/package main 导出的：

- `EvaEngine`
- `Command`
- `DI`
- `Entities`
- `engine` constants and helpers
- `express`
- `commands`
- `exceptions`
- `middlewares`
- `services`
- `providers`
- `swagger`
- `Joi`
- `sequelize`
- `wrapper`
- `utils`

### Engine Contract

- `new EvaEngine(meta, mode)`
- `getMeta()`
- `getDI()`
- `bootstrap()`
- `registerCommands()`
- `getCommands()`
- `clearCommands()`
- `run()`
- `runHttps()`
- `runCLI()`
- `runCommand()`
- `runCrontab()`
- `clearCrontabs()`
- `setDefaultErrorHandler()`
- `getDefaultErrorHandler()`
- `getServer()`
- `getVersion()`

### DI Contract

- `DI.get()`
- `DI.bindClass()`
- `DI.bindValue()`
- `DI.bindMethod()`
- `DI.reset()`
- `DI.registerServiceProviders()`
- `DI.registerMockedProviders()`

### Provider Contract

- `ServiceProvider`
- `name`
- `register()`
- Provider classes exported by `services/providers.js` and `middlewares/providers.js`

### Command Contract

- `Command`
- `Command.getName()`
- `Command.getDescription()`
- `Command.getSpec()`
- `Command.run()`
- `Command.getArgv()`
- `Command.getOptions()`

### Service Contract

The following methods are public because tests, providers or consumers call them directly:

- `Config.setPath/get/reload/getMergedFiles/resolveSpringConfig`
- `Logger.setLevel/setLabel/setLogFile/debug/verbose/info/warn/error/dump`
- `Redis.setOptions/getInstance/isConnected/cleanup`
- `Cache.get/set/del/has/flush/namespace`
- `HttpClient.request/dumpRequest/dumpResponse`
- `RestClient.request/setBaseUrl`
- `JsonWebToken.save/find/clear/encode/decode`
- `EventManager.addListener/emit/getAllowEvents/getEmitter`
- `Now.setNow/getNow/getTimestamp`
- `Entities.scan/init/getAll/getInstance/query/uniqueInsert/getTransaction`

### Middleware Contract

- Middleware factory returns `(req, res, next) => ...`.
- Auth sets `req.auth` and `X-Uid`.
- Trace sets B3 headers and trace metadata.
- Validator accepts schema factory/options/validator override.
- Session returns Express-compatible middleware.

## 8. Internal Implementation

以下代码应视为内部实现，除非用户明确依赖它们：

- `constitute.Container` 的具体使用方式。
- `DI` 内部 `bound` map 的数据结构。
- Engine 的 `baseServiceProviders`、`serviceProvidersForWeb`、`serviceProvidersForCLI` 数组。
- Engine 内部 `app` singleton、`server` 字段和 `crontabJobHandlers` 数组。
- Config 的文件合并实现、动态模块加载和默认配置对象。
- Redis 的 client cache 和连接选项拼接。
- Cache 的 `Store`、`NullStore`、`RedisStore`、`RedisNamespaceStore` 实现细节。
- Entity scanner 的 filesystem/filter 实现。
- Sequelize model factory 的具体加载方式。
- Swagger 的 Acorn/Doctrine/Glob pipeline 实现细节。
- `request` 原型 debug patch。
- `moment`、`later`、`ioredis`、`winston` 等具体库。
- `test/` 中所有 fixture、bootstrap、mock helpers。
- `lib/`、coverage reports、generated Swagger files。

内部实现可以重构，只要上述 public behavior 和导出 contract 保持兼容。

## 9. Architectural Boundaries

当前可以识别出以下逻辑层：

```text
Runtime / Kernel
  src/engine.js
  src/di.js
  src/services/providers.js

Infrastructure
  Config, Env, Logger, Redis, Cache
  HttpClient, RestClient, Namespace
  Sequelize integration

Application / Interface
  Commands
  Middleware
  CLI / HTTP / Cron entry points

Domain / Persistence
  Entities and model helpers
  EventManager
  JWT and business-facing services

Metadata / Automation
  Swagger scanner
  Entity scanner
  Command metadata
  Exception metadata
```

这个分层目前是隐式的，并非严格 module boundary。尤其 Entity 同时承担 Domain registry、ORM model loading、SQL helper 和 metadata source，属于未来重构的主要切入点。

## 10. Main Architectural Risks

### Global State

DI container、Config cache、Redis client、Express app 等状态容易跨 Engine 或测试实例共享。多 Runtime 并存时需要显式 Context 隔离。

### Infrastructure Leakage

Entity 直接暴露 Sequelize model，Cache 直接暴露 Redis semantics，HTTP client 包含 request 内部 patch。这些实现细节容易泄露到业务层。

### Lifecycle Fragmentation

Provider 没有统一 shutdown contract，资源清理由调用者或测试自行负责。

### Weak Type Contract

命名字符串 DI 和动态 metadata 缺少编译期检查。TypeScript interface、typed tokens 和 typed provider registry 可以降低风险。

### Event Reliability

当前 EventManager 是进程内事件机制，没有 queue、retry、dead letter、schema 或 delivery guarantee，不适合直接承担跨进程业务事件。

### Legacy Package Coupling

虽然 Runtime 已可在 Node 24 原生 ESM 下运行，但 `request`、`later`、`continuation-local-storage`、Sequelize model conventions 等仍带有旧生态耦合，应在后续版本逐步替换。

## 11. Recommended Future Direction

如果以 2026 重构 EvaEngine，建议保留思想而不是原样保留实现：

```text
Kernel
  -> RuntimeContext
    -> ProviderRegistry
      -> Lifecycle Coordinator
        -> CommandBus
          -> UseCase
            -> Domain
              -> Repository
                -> Storage
```

推荐演进：

1. 使用 TypeScript 和 typed dependency tokens。
2. 将 Config、Logger、Redis、HTTP 等 capability 定义为 interface。
3. 将 Provider lifecycle 扩展为 register/boot/start/stop/shutdown。
4. 将 Engine singleton 状态下沉到 RuntimeContext。
5. 将 Entity 拆分为 Domain Entity、Repository、Persistence Model。
6. 将 EventManager 升级为 typed in-process event bus，并为跨进程事件接入 queue。
7. 使用 OpenTelemetry 统一 Logs/Metrics/Traces。
8. 将 Command 作为 UseCase adapter，而不是业务逻辑容器。
9. 保留 Metadata registry，但使用明确 schema 和 versioned metadata。
10. 将 Swagger、OpenAPI、AI tool schema 等视为同一类 contract generation pipeline。

## 12. Final Assessment

EvaEngine 的最大价值不在某个 HTTP helper 或 ORM wrapper，而在四个架构判断：

1. **Runtime**：不同应用入口共享生命周期和能力。
2. **Provider**：基础设施能力可以注册、替换和按配置选择。
3. **Metadata**：应用组件能够被扫描、理解并自动生成文档/注册信息。
4. **Command/Event**：复杂应用可以通过明确入口和事件解耦。

这些思想与 Aurora Runtime、Knowledge Runtime 和 AI 产品基础设施高度相关。后续重构应把 EvaEngine 视为一个 Runtime architecture prototype：保留其边界意识与扩展方向，重新实现类型、生命周期、可观测性、可靠事件和云原生资源管理。

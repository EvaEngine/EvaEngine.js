# EvaEngine Public API Contract

**文档类型**: Open Source API Contract
**目标读者**: AI Coding Agent / EvaEngine Maintainer
**版本依据**: 当前工作树与 `package.json` 版本 `0.11.2`

## 1. Contract Classification

本文件使用三个层级：

### Public API

满足至少一个条件：

- 从 package 主入口导出。
- 在 README、docs 或项目使用示例中直接使用。
- 被测试作为外部行为调用。
- 明确承担应用接入或扩展职责。

### Stable Internal API

不是主要用户入口，但被多个 Runtime 组件、Provider 或测试依赖，修改时可能影响应用内部扩展。它应保持相对稳定，但当前没有独立版本化保证。

### Private Implementation

只用于实现内部行为，未被主入口或公开文档承诺。可以重构，除非改动间接改变 Public API 行为。

> 本项目没有完整的正式 API stability policy。除下文明确标记外，长期兼容承诺为 `UNKNOWN`。

## 2. Public API

## 2.1 Package Entry

入口：`package.json.main` 指向 `src/index.js`，根入口 `index.js` re-export 它。

### Default package export / named package exports

**Purpose**

提供 EvaEngine 的主要接入面，包括 Runtime、Command、DI、Entity、服务、middleware、异常、Provider 和基础依赖。

**When to use**

应用初始化、创建 Runtime、定义 Command、注册 Provider、访问公开异常或使用框架提供的服务时使用 package 入口。

**Constraints**

- 当前 package 要求 Node `>=24.0.0`。
- 当前 package 使用 ESM，调用方必须遵守 Node ESM 模块解析规则。
- package 入口同时暴露若干第三方依赖对象；这些对象是否属于长期稳定 contract，`UNKNOWN`。
- 具体导出集合由 `src/index.js` 的 `core` 对象决定。

**Compatibility expectation**

`EvaEngine`、`Command`、`DI`、`Entities` 和主要集合导出属于高置信度 Public API。第三方依赖转发、`dependencies` 对象以及完整导出对象的字段级长期稳定性为 `UNKNOWN`。

## 2.2 EvaEngine

**Purpose**

提供统一的应用 Runtime，组织 Web、CLI、Cron 等入口的配置、Provider、DI、Middleware、Command 和资源状态。

**When to use**

应用需要启动 Runtime、注册 Command、配置运行模式、启动 HTTP/HTTPS、执行 CLI 或注册 Cron 时使用。

**Constraints**

- 构造参数需要提供项目相关 metadata；完整必需字段集合应以 `getMeta()` 和当前 Engine 构造逻辑为准。
- `mode` 影响 Provider 集合和入口行为。
- Engine 依赖全局 DI 和部分模块级 Runtime 状态，多个 Engine 并存时的隔离保证为 `UNKNOWN`。
- `run()`、`runHttps()` 和 Cron 会创建外部资源；调用方必须负责或触发关闭流程。
- HTTP 行为依赖当前 Express 版本和 middleware 顺序。

**Compatibility expectation**

构造 Engine、读取 metadata、bootstrap、注册 Command、运行 CLI 是高置信度 Public API。HTTP/HTTPS server 的完整关闭语义、重复 bootstrap 行为和多实例隔离为 `UNKNOWN`。

相关公开行为：

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

## 2.3 Command

**Purpose**

为 CLI、Cron 以及未来非 HTTP 入口提供统一的应用操作适配器。

**When to use**

需要将一个可命名、可解析参数、可被 Engine 调度的应用操作暴露给 CLI 或 Cron 时，继承 `Command`。

**Constraints**

Command 应提供静态 metadata：

- `getName()`
- `getDescription()`
- `getSpec()`

Command 的执行入口是 `run()`。Command 不应依赖 HTTP request/response，也不应把大量领域逻辑放入 Command 本身。

`argv` 的具体来源和 yargs 版本行为属于 Runtime 约束；复杂参数类型的兼容性为 `UNKNOWN`。

**Compatibility expectation**

继承 `Command` 并实现上述静态 metadata 是高置信度 Public API。`getArgv()`、`setArgv()`、`getOptions()` 是已实现并被测试/Command 使用的 API，但其长期稳定级别为 `Stable Internal API`，除非后续文档正式承诺。

## 2.4 DI

**Purpose**

提供运行时依赖绑定、解析、替换和测试注册能力。

**When to use**

Provider 需要绑定 capability，应用测试需要替换 service，或应用需要解析已注册服务时使用。

**Constraints**

公开操作包括：

- `DI.get(key)`
- `DI.bindClass(name, Class)`
- `DI.bindValue(name, value)`
- `DI.bindMethod(name, method)`
- `DI.reset()`
- `DI.registerServiceProviders(providers, engine)`
- `DI.registerMockedProviders(providers, configPath)`

DI key 既可以是字符串也可以是 class/reference，但两者的完整优先级和生命周期行为未由独立文档定义，部分细节为 `UNKNOWN`。

DI 不是类型安全容器。字符串名称拼写错误、注册顺序错误和循环依赖会在运行时暴露。

**Compatibility expectation**

Provider 和测试代码直接依赖这些方法，因此它们属于高置信度 Public/Extension API。底层 `constitute.Container`、`bound` map 的结构以及实例缓存策略属于 Private Implementation。

## 2.5 ServiceProvider

**Purpose**

定义 Runtime capability 的装配扩展点。

**When to use**

需要新增服务、替换服务、根据配置绑定不同实现，或将能力纳入 Runtime bootstrap 时，继承 `ServiceProvider`。

**Constraints**

Provider 至少应提供：

- `name`
- `register()`
- 构造时接收 Runtime/Engine context

当前 Provider 生命周期主要只有 `register()`；`boot/start/stop/shutdown` 是否可用为 `UNKNOWN`，不应假设已经存在。

Provider 不应承载业务领域逻辑，也不应隐式创建无法关闭的后台资源。

**Compatibility expectation**

`ServiceProvider`、`name` 和 `register()` 是高置信度扩展契约。Provider 注册顺序是 Stable Internal API，当前没有独立的排序保证；依赖其他 Provider 的新增 Provider 必须明确依赖前置条件。

## 2.6 Entity Registry

入口：`Entities`。

**Purpose**

扫描 Entity factory、构造 Sequelize model、维护 entity registry、处理关联，并为查询、事务和 metadata generation 提供入口。

**When to use**

应用使用 EvaEngine 的 Entity/Sequelize 集成，需要加载 Entity 目录或访问已扫描模型时使用。

**Constraints**

公开行为包括：

- `new Entities(entitiesPath, sequelizeInstance?)`
- `scan(path, withAssociate?)`
- `init(withAssociate?)`
- `getAll()`
- `getInstance()`
- `getSequelize()`
- `query()`
- `uniqueInsert()`
- `getTransaction()`

Entity 当前与 Sequelize model/persistence 强耦合。Entity file factory 的参数形式、扫描文件约定和 association 行为是已使用的 contract，但长期兼容级别为 `UNKNOWN`。

`uniqueInsert()` 的生成 SQL 依赖 Sequelize dialect/query generator，调用方不应把 SQL 细节视为跨数据库稳定行为。

**Compatibility expectation**

Entity registry 的基本扫描和访问行为是 Public API；具体 Sequelize model 字段、ORM 内部 metadata 和 SQL 生成格式属于 Stable Internal API 或 Private Implementation，不能作为通用稳定 contract。

## 2.7 Middleware Provider API

包括 Session、Auth、Auth Kong、Debug、Trace、View Cache 和 Validator provider。

**Purpose**

将 HTTP 横切能力绑定为 Runtime 可解析的 middleware capability。

**When to use**

应用需要启用、替换或扩展认证、Session、校验、追踪、缓存和调试行为时使用 Provider。

**Constraints**

Middleware 最终必须符合 Express middleware 形态：

```text
(request, response, next) -> result or next(error)
```

Middleware 顺序是重要约束，但当前完整顺序保证为 `UNKNOWN`。Auth、Session、Trace 和 Cache 可能依赖 request/response 已存在的字段或 header。

**Compatibility expectation**

Provider name 和 middleware factory 形态是高置信度 Public/Extension API。具体 middleware 内部使用的 Express、Redis、JWT 或 request 字段属于 Stable Internal API；未在文档和测试中确认的 header/错误细节为 `UNKNOWN`。

## 2.8 Service Capabilities

以下 service 从 package service 集合导出，且在 Provider、测试或应用流程中被直接使用。它们属于 Public API 候选，但每个方法的长期语义并未全部正式文档化。

### Config

**Purpose**: 加载、合并和查询 Runtime 配置。

**When to use**: Provider 或应用需要读取配置时使用，不应直接读取环境变量或配置文件。

**Constraints**: `setPath()` 应在读取配置前设置；`get()` 会触发加载；`reload()` 重新加载。配置文件格式和 Spring Cloud response 细节为 `UNKNOWN`。

**Compatibility expectation**: `setPath/get/reload/getMergedFiles/resolveSpringConfig` 为 Stable Internal API；配置对象字段是否稳定取决于应用配置 contract，不能由 EvaEngine 统一保证。

### Logger

**Purpose**: 提供统一日志和调试输出。

**When to use**: Runtime、Provider、Middleware 和应用服务需要记录结构化或分级日志时使用。

**Constraints**: `debug/verbose/info/warn/error/dump` 是主要使用方法；具体 Winston logger instance、transport 和格式不应被业务代码依赖。

**Compatibility expectation**: 日志级别方法为 Stable Internal API。日志输出格式、transport 对象和 Winston 兼容性为 `UNKNOWN`。

### Redis

**Purpose**: 提供 Redis client capability 和连接生命周期管理。

**When to use**: Cache、JWT 或应用需要 Redis 操作时，通过 service 使用。

**Constraints**: 主要行为包括 `setOptions/getInstance/isConnected/cleanup`。当前底层实现依赖 ioredis 和 Redis 7 可用性；Redis command 细节不是 EvaEngine 自己定义的 contract。

**Compatibility expectation**: service lifecycle 方法为 Stable Internal API；返回的具体 ioredis instance API 为 `UNKNOWN`，除非调用方明确接受 ioredis coupling。

### Cache

**Purpose**: 提供 key/value、namespace、flush 和 Redis/Null store 抽象。

**When to use**: 应用需要缓存但不希望直接依赖 Redis 时使用。

**Constraints**: 主要操作包括 `get/set/del/has/flush/namespace`。TTL、NX/XX mutex 参数和序列化行为应以当前测试及实现为准；跨 store 的全部语义为 `UNKNOWN`。

**Compatibility expectation**: 基本 Cache capability 是 Stable Internal API；`Store`、`RedisStore`、`RedisNamespaceStore` 的具体类和 Redis key layout 属于 Private/Stable Internal API，不是无条件 Public Contract。

### HTTP Client / Rest Client

**Purpose**: 统一外部 HTTP 调用、错误映射、trace 传播和请求/响应诊断。

**When to use**: 应用服务访问外部 HTTP API 时使用，而不是直接在业务代码中创建 request client。

**Constraints**: `request()`、错误分类和 tracer integration 是主要行为。底层 request/request-promise-native 已停止维护，其内部 prototype 行为不应成为调用方 contract。

**Compatibility expectation**: HTTP client 的基本 request 行为为 Stable Internal API；具体请求对象字段、debug patch、错误对象原型和 TLS 行为为 `UNKNOWN`。

### JsonWebToken

**Purpose**: 提供 token encode/decode 及 token 保存、查找、清理能力。

**When to use**: Auth middleware 或应用需要 local token persistence 时使用。

**Constraints**: 主要操作包括 `save/find/clear/encode/decode`。token payload、过期字段、Redis key layout 和 secret 配置必须遵守当前应用配置；不同 provider 实现之间的完整语义一致性为 `UNKNOWN`。

**Compatibility expectation**: 基本 token service 方法为 Stable Internal API；payload schema 和 Kong provider 的远程 API 兼容性为 `UNKNOWN`。

### EventManager

**Purpose**: 提供进程内事件发布和 listener 注册。

**When to use**: 同一 Runtime 进程内需要解耦生产者和消费者时使用。

**Constraints**: 当前是进程内机制，不保证持久化、跨进程传递、重试、顺序或 dead-letter。

**Compatibility expectation**: `addListener/emit/getAllowEvents/getEmitter` 是 Stable Internal API；EventEmitter 实例直接暴露的全部 Node 行为为 `UNKNOWN`。

### Now

**Purpose**: 统一当前时间和可测试的时间替换。

**When to use**: 业务或 service 需要统一读取时间、时间戳或数据库时间格式时使用。

**Constraints**: `setNow/clear/getTimestamp/getMoment/getDatabaseDatetime` 的语义由当前实现定义；时区和 Moment formatting 属于配置/依赖行为。

**Compatibility expectation**: 时间读取方法为 Stable Internal API；具体 Moment instance 和格式跨版本稳定性为 `UNKNOWN`。

## 3. Stable Internal API

以下接口被多个内部模块或测试使用，但没有足够证据证明它们是面向所有 package consumers 的长期 Public Contract。

### 3.1 `ServiceInterface`

**Purpose**: 为 service 提供共同基类和 `getProto()` 约定。

**When to use**: 主要用于实现 EvaEngine service，而不是普通应用业务类。

**Constraints**: 该接口很薄，实际 service contract 仍由具体 service 定义。

**Compatibility expectation**: Stable Internal API。是否支持外部自定义 ServiceInterface implementation 为 `UNKNOWN`。

### 3.2 Service Provider 集合

`services/providers.js` 和 `middlewares/providers.js` 中的具体 Provider 类被 Runtime 使用并从 package 集合导出。

**Purpose**: 提供默认 Runtime 装配方案。

**When to use**: 需要复用默认能力绑定或基于现有 Provider 扩展时使用。

**Constraints**: Provider 顺序、名称、是否默认注册和不同 mode 下的集合属于 Runtime 组合规则。

**Compatibility expectation**: Provider base contract 稳定；具体 Provider 类名和默认集合的长期兼容性为 `UNKNOWN`。

### 3.3 Cache Store Classes

包括 `Store`、`NullStore`、`RedisStore`、`RedisNamespaceStore`。

**Purpose**: 作为 Cache 的内部 store strategy。

**When to use**: 仅在需要实现同一 Cache store strategy 时考虑。

**Constraints**: 这些类型暴露 Redis-specific behavior，不能被视为跨实现的通用 cache contract。

**Compatibility expectation**: Stable Internal API。具体类、构造参数、key layout 和 return values 的长期兼容性为 `UNKNOWN`。

### 3.4 Engine Provider Lists and Runtime State

包括默认 service provider 列表、web/CLI provider 列表、command registry、server state 和 Cron handler state。

**Purpose**: 组成当前 Runtime。

**When to use**: 不应由应用直接修改；扩展应通过 Provider、Command 或明确 Engine API 完成。

**Constraints**: 修改顺序可能改变依赖图和请求行为。

**Compatibility expectation**: Stable Internal API。字段结构、数组顺序和 registry 存储方式为 `UNKNOWN`。

## 4. Private Implementation

以下内容没有证据显示是外部 API，应视为 Private Implementation：

- `constitute.Container` 的具体使用。
- DI 内部 `bound` map 的数据结构。
- `Config` 的文件合并方式、动态加载方式和缓存字段。
- Redis client 的内部缓存字段和连接事件处理。
- Cache key layout、内部 Store 选择和序列化细节。
- Engine 的内部 server、app、command registry 和 Cron handler 存储。
- Middleware 内部包装、trace 实现和 response monkey patch。
- Entity scanner 的文件过滤、Sequelize model 加载细节和 SQL 生成过程。
- Swagger 使用的 Glob、Acorn、Doctrine、YAML parser pipeline。
- HTTP client 对 request 内部 prototype 的 debug patch。
- `src/config/index.js` 中的默认配置对象字段，除非应用文档另行承诺。
- `test/`、`coverage/`、生成文件和测试 fixture。
- 已删除的 Babel 配置、旧构建产物和内部迁移兼容代码。

修改这些内容时，维护者仍必须验证 Public API 的行为，但不需要保持内部实现形状。

## 5. Compatibility Policy

### Confirmed

以下兼容性由当前 package、README、测试或实际入口使用明确支持：

- Node.js `>=24.0.0`。
- ESM package entry。
- `EvaEngine`、`Command`、`DI`、`Entities` 的基本接入方式。
- Provider 的 `name/register` 扩展方式。
- Command 的 name/description/spec/run 约定。
- 当前测试所覆盖的服务、middleware 和 Entity 基本行为。

### Not Confirmed

以下内容不能从当前代码推断稳定承诺，必须标记为 `UNKNOWN`：

- 未导出的类或方法是否可被应用直接使用。
- 所有 service 方法的跨版本返回值和错误类型。
- 多个 Engine 同时运行时的隔离。
- Server/Redis/HTTP client 的完整 graceful shutdown 保证。
- Sequelize model 与底层 ORM metadata 的长期兼容性。
- 事件的可靠交付语义。
- Swagger、metadata 和扫描器的输入格式扩展性。
- 直接访问第三方依赖对象的兼容性。

## 6. Maintainer Rules

作为开源库维护者，新增或修改 API 时应：

1. 先确认 API 是否从 package entry 导出或被文档公开使用。
2. 若是 Public API，增加 contract test，而不只增加内部单元测试。
3. 明确 Purpose、When to use、Constraints 和 Compatibility expectation。
4. 对无法从代码或测试确认的内容标记 `UNKNOWN`。
5. 不把第三方库的类型、内部字段或错误对象自动升级为 EvaEngine contract。
6. 不因内部重构改变 Command、Provider、DI 和核心 service 的已验证行为。
7. 若需要破坏 Public API，更新版本策略和迁移说明。
8. 保持 Runtime、Provider、DI、Command 和 capability contract 之间的边界可解释。

## 7. Summary

EvaEngine 的真正公共 API 不是所有导出的类和方法，而是应用接入时依赖的几组行为契约：

```text
Runtime construction and execution
Provider-based capability extension
DI binding and resolution
Command entry contract
Entity registry integration
Selected service capabilities
```

其余代码应默认视为可演进的内部实现，除非文档、示例或测试明确证明它已经成为用户依赖的 contract。

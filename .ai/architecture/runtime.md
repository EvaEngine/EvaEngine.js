# EvaEngine Runtime Architecture

**文档类型**: Runtime Architecture
**目标读者**: AI Coding Agent
**适用范围**: EvaEngine Runtime 及其后续演进

## 1. Runtime 的目的

EvaEngine Runtime 的目的，是把一个 Node.js 应用从“若干可执行模块”组织成“一个具有统一运行规则的应用系统”。

Runtime 解决的核心问题不是 HTTP 路由，而是：

- 不同应用入口如何共享同一套能力。
- 基础设施何时创建、如何替换、何时关闭。
- 配置、日志、缓存、认证、数据库和外部服务如何被统一装配。
- 应用组件如何在运行前被发现、注册和验证。
- CLI、Cron、HTTP 等入口如何进入相同的应用执行模型。

Runtime 的基本设计判断是：

> 入口可以不同，运行时能力和生命周期必须保持一致。

## 2. Runtime 的边界

Runtime 位于应用入口和基础设施之间：

```text
External Entry
  HTTP / CLI / Cron / Worker
        |
        v
Application Runtime
  Context / Providers / DI / Lifecycle
        |
        v
Application Capabilities
  Config / Logger / Cache / DB / HTTP / Auth / Events
        |
        v
Infrastructure and Domain
```

Runtime 不拥有具体业务规则，也不应成为所有业务逻辑的容器。它负责组装、协调和约束，而不是决定领域行为。

## 3. 生命周期

### 3.1 生命周期阶段

EvaEngine 当前的运行过程可以抽象为：

```text
Construct
  -> Register
    -> Bootstrap
      -> Bind
        -> Execute
          -> Stop
            -> Shutdown
```

### 3.2 Construct

Runtime 首先建立应用上下文，包括：

- 项目根目录。
- 配置目录。
- 源码目录。
- 运行模式。
- 端口和入口相关元数据。

设计原因：

所有后续组件都应从同一个 Runtime context 获取环境信息，而不是各自推断工作目录、配置位置或运行模式。

### 3.3 Register

Register 阶段声明 Runtime 将提供哪些能力：

- 基础服务。
- Web 专用服务。
- CLI 专用服务。
- Middleware。
- Command。
- 可选实现，例如不同 JWT provider。

Register 的主要职责是建立组件关系，不应在此阶段执行长时间外部操作。

### 3.4 Bootstrap

Bootstrap 阶段根据当前运行模式完成 Provider 装配：

```text
Runtime
  -> Service Providers
    -> DI bindings
      -> Service graph
  -> Middleware Providers
    -> middleware bindings
  -> Command registration
```

Bootstrap 的意义是让应用在真正执行请求或命令之前拥有一个可预测的能力图谱。

### 3.5 Bind

Provider 把能力绑定到 DI container。绑定可以是：

- Class。
- Value。
- Factory/method。
- 根据配置选择的实现。

DI 负责延迟解析和构造对象。这样 Runtime 可以在装配阶段描述依赖，而不需要立即创建所有外部资源。

### 3.6 Execute

执行阶段由不同入口驱动：

- HTTP 请求进入 Express middleware chain。
- CLI 参数进入 Command。
- Cron schedule 触发 Command。
- 未来 Worker 可以进入同一 Command/Use Case boundary。

执行阶段应该只依赖已经完成 bootstrap 的 Runtime context。

### 3.7 Stop

Stop 阶段停止接受新的执行工作：

- 停止 Cron 调度。
- 停止接收新的 HTTP 请求。
- 停止派发新的后台任务。
- 等待必要的进行中操作完成。

### 3.8 Shutdown

Shutdown 阶段释放 Runtime 持有的资源：

- Redis/数据库连接。
- HTTP client 连接。
- Event/worker 资源。
- 日志和 tracing buffer。
- HTTP server。

当前实现对 shutdown 的协调仍然不完整。未来 Runtime 应将 shutdown 变成 Provider 的正式契约，而不是由调用者分别清理资源。

## 4. 核心组件关系

### 4.1 Engine

Engine 是 Runtime 的控制中心。它负责：

- 识别运行模式。
- 组织 Provider 注册顺序。
- 管理 HTTP/CLI/Cron 入口。
- 保存应用 metadata。
- 管理 Command registry。
- 安装默认错误处理。
- 持有 server 和 Cron 生命周期状态。

Engine 不应直接承担领域逻辑。它只应协调入口、能力和生命周期。

### 4.2 Runtime Context

当前 Runtime context 主要由 Engine metadata、DI container 和运行状态共同表达。

概念上，Runtime context 应包含：

```text
RuntimeContext
  metadata
  mode
  configuration
  provider registry
  dependency container
  resource registry
  logger/observability
  shutdown state
```

将这些状态显式集中在 Context 中，可以避免多个 Engine 实例之间共享隐式全局状态。

### 4.3 Provider Registry

Provider Registry 描述 Runtime 可以装配哪些能力。Provider 的作用是把能力从具体实现中隔离出来。

```text
Provider
  -> choose implementation
  -> configure implementation
  -> bind capability
  -> participate in lifecycle
```

例如，认证能力可以根据配置选择 local JWT 或 Kong JWT；缓存能力可以选择 Redis store 或 Null store。

### 4.4 DI Container

DI Container 是运行时对象图的解析器，而不是业务注册表。

它解决：

- 依赖关系解析。
- 延迟实例化。
- 测试替换。
- 命名 capability 绑定。

它不应成为业务状态的长期存储，也不应隐藏跨 Runtime 的共享状态。

### 4.5 Service Capabilities

服务是 Runtime 暴露给应用的能力边界，例如 Config、Logger、Redis、Cache、HTTP client、JWT 和 EventManager。

组件关系：

```text
Provider
  -> DI binding
    -> Service capability
      -> Domain/Application consumer
```

应用依赖 capability 的行为，而不是依赖具体第三方库的对象结构。

### 4.6 Middleware Runtime

Middleware Provider 把认证、Session、Trace、Validation、Debug 和 Cache 等横切能力装配到 HTTP pipeline。

```text
Request
  -> Session
    -> Auth
      -> Validation
        -> Trace/Debug/Cache
          -> Application handler
            -> Error handler
```

Middleware 的设计原因是把跨请求的规则集中处理，避免业务 handler 重复实现安全、日志和观测逻辑。

### 4.7 Command Runtime

Command 是 CLI、Cron 和未来 Worker 入口的统一适配层。

```text
CLI/Cron/Worker
  -> Command
    -> Application operation
```

Command 应保持轻量，负责输入解析和执行编排；业务规则应继续下沉到 Use Case 或 Domain service。

## 5. 数据流

### 5.1 Bootstrap 数据流

```text
Project metadata
  -> Config path and runtime mode
    -> Config capability
      -> Provider decisions
        -> DI bindings
          -> Resolvable service graph
```

配置首先影响 Runtime context，随后影响 Provider 选择，最后影响具体服务实例。

因此配置不是普通的全局变量，而是 Runtime capability 的输入。

### 5.2 HTTP 数据流

```text
HTTP request
  -> Runtime middleware chain
    -> request context / namespace
      -> authentication and validation
        -> application handler
          -> injected services
            -> domain/persistence/external APIs
              -> response
                -> logs/traces/cache headers
```

请求数据应沿着明确的边界流动：

- Request metadata 由 middleware 提取。
- Auth 结果写入 request context。
- 业务逻辑通过 capability 访问外部资源。
- Response metadata 由 Trace、Cache 和错误处理统一补充。

### 5.3 CLI/Cron 数据流

```text
Arguments or schedule
  -> Command metadata
    -> parsed options
      -> Command instance
        -> injected capabilities
          -> application operation
            -> result / error / logs
```

CLI 和 Cron 不应重新创建一套基础设施。它们应复用同一 Runtime provider model。

### 5.4 Metadata 数据流

```text
Source / Entity / Exception metadata
  -> scanner/parser
    -> registry or fragment model
      -> generated contract
        -> Swagger/OpenAPI/diagnostic output
```

Metadata pipeline 的目的，是让 Runtime 可以理解和描述应用，而不是只执行应用。

## 6. 控制流

### 6.1 Web 控制流

```text
new Engine
  -> bootstrap web providers
  -> register middleware
  -> attach error handling
  -> start HTTP server
  -> receive request
  -> execute middleware chain
  -> invoke application handler
  -> finalize response
  -> shutdown on process termination
```

Engine 控制入口，Provider 控制能力，Middleware 控制请求横切行为，Application handler 控制具体业务流程。

### 6.2 CLI 控制流

```text
new Engine(cli)
  -> bootstrap CLI providers
  -> register command classes
  -> parse command name and options
  -> instantiate selected command
  -> execute command
  -> report error
  -> release resources
```

Command registry 是 CLI 控制流中的路由表。Command name 是外部入口到应用操作之间的稳定标识。

### 6.3 Cron 控制流

```text
register schedule
  -> validate command exists
  -> create scheduler handle
  -> invoke command per schedule
  -> retain handle
  -> clear handles during stop
```

Cron handler 必须可被追踪和清理。调度器不能成为脱离 Runtime 生命周期的后台资源。

### 6.4 错误控制流

```text
failure in capability / middleware / command
  -> wrapper or runtime boundary
    -> normalized error
      -> application error handler
        -> log/trace
          -> protocol-specific response or process result
```

错误处理的目的不是隐藏错误，而是让错误在正确的 Runtime boundary 被分类、观测和转换。

## 7. 扩展点

### 7.1 Service Provider

最主要的 Runtime 扩展点。

适用于：

- 新增基础设施能力。
- 替换现有实现。
- 根据配置选择实现。
- 为测试提供 fake capability。

新增 Provider 时必须定义：

- capability name。
- 输入配置。
- 依赖关系。
- 实例生命周期。
- 失败语义。
- shutdown 行为。

### 7.2 Middleware Provider

适用于 HTTP 横切能力：

- Authentication。
- Authorization。
- Validation。
- Tracing。
- Request/response logging。
- Rate limiting。
- Caching。

Middleware 不应直接把不可替换的基础设施对象暴露给业务层。

### 7.3 Command

适用于 CLI、Cron 和 Worker adapter。Command 应声明自己的名称、描述和输入规格，并将业务执行交给 Use Case。

### 7.4 Capability Adapter

当接入新的数据库、消息系统、外部 API 或观测系统时，应先增加 capability adapter，再由 Provider 绑定，而不是从 Engine 或业务代码直接调用第三方库。

### 7.5 Metadata Provider

适用于：

- OpenAPI/Swagger。
- Domain schema。
- AI tool schema。
- Command catalog。
- Event schema。
- Runtime diagnostics。

Metadata provider 必须使用明确 schema，不应依赖无法解释的隐式扫描结果。

## 8. 设计限制

### 8.1 当前生命周期不完整

Provider 当前以注册为主，boot/start/stop/shutdown 语义尚未完全统一。因此资源创建和释放仍可能分散在 Service、Engine 或调用者中。

### 8.2 全局状态风险

DI、Express app、配置、Redis client 或其他 registry 如果以全局状态存在，会限制多 Runtime 并存、测试隔离和多租户场景。

### 8.3 DI 是运行时类型系统

命名 DI 缺少编译期检查。错误的名称、错误的绑定顺序和错误的实例类型可能在运行时才暴露。

### 8.4 Entity 与 Persistence 耦合

Entity runtime 同时承担模型扫描、ORM model、查询和 metadata 来源。它不等同于独立 Domain Entity。

### 8.5 EventManager 不是可靠消息系统

进程内事件不提供持久化、重试、跨进程传递或 dead-letter 语义。

### 8.6 Middleware 顺序是隐含契约

Session、Auth、Trace、Validation、Cache 和 Error handler 的顺序会影响行为。新增 middleware 时必须明确其前置依赖和响应阶段行为。

### 8.7 自动扫描带来隐式依赖

文件扫描和 metadata 推断降低了配置成本，但也会使依赖关系不明显。扫描失败、文件命名变化或 schema 变化必须具有可诊断错误。

### 8.8 第三方实现不属于 Runtime contract

Redis client、ORM、HTTP client、logger、scheduler 等库都应被视为可替换实现。Runtime contract 不应暴露它们的内部字段、生命周期或错误类型，除非这是明确的兼容性承诺。

## 9. AI Agent 修改规则

AI Agent 在修改 Runtime 相关代码时，应按以下顺序判断：

1. 这是入口控制、能力装配、请求流、命令流还是资源生命周期问题？
2. 修改的是 public contract 还是内部实现？
3. 是否改变了 Provider 注册顺序或依赖图？
4. 是否引入了新的全局状态或隐式 singleton？
5. 是否需要新的 shutdown 行为？
6. 是否改变了 HTTP、CLI、Cron 之间的共享语义？
7. 是否需要 capability contract test，而不仅是单元测试？
8. 是否可以通过 adapter 隔离第三方依赖？

默认原则：

- 先保持 Runtime 语义，再优化实现。
- 先定义边界，再添加依赖。
- 先补生命周期，再引入长连接或后台任务。
- 先验证错误和关闭路径，再验证 happy path。
- 不把 Domain logic 放入 Engine、Provider 或 Middleware。

## 10. Runtime 结论

EvaEngine Runtime 的价值在于统一应用入口、集中装配能力、控制基础设施边界，并让应用可以在 Web、CLI 和 Cron 等运行模式之间共享同一套架构语义。

它的核心不是 Engine 对象本身，而是以下关系：

```text
Runtime controls lifecycle
Provider composes capabilities
DI resolves dependencies
Middleware shapes request flow
Command adapts non-HTTP entry points
Metadata explains application structure
```

未来 Runtime 的演进方向，应继续保留这些关系，同时加强 Context 隔离、Provider lifecycle、类型安全、可观测性和可靠资源关闭。

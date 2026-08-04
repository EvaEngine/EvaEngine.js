# EvaEngine Vision

**文档类型**: Architecture Decision / Design Vision
**读者**: AI Coding Agent
**状态**: Foundational
**适用范围**: EvaEngine 及其后续 Runtime 演进

## 1. Why EvaEngine Exists

EvaEngine 存在的原因，是为复杂 Node.js 应用提供一个稳定的运行时边界。

复杂应用通常同时具有多个入口、多个基础设施依赖和多个横切关注点。HTTP 请求只是其中一种入口。CLI、定时任务、后台任务和事件处理同样需要使用配置、日志、缓存、数据库、认证和可观测性能力。

如果每个入口独立组装这些能力，应用会逐渐出现：

- 初始化顺序不一致。
- 资源生命周期不一致。
- 业务逻辑依赖具体基础设施。
- 测试需要启动完整外部环境。
- 不同入口拥有不同的运行语义。
- 系统难以替换基础设施或演进架构。

EvaEngine 的职责，是提供一个共同的 Application Runtime，使这些入口在相同的能力模型和生命周期约束下运行。

它的基本判断是：

> 应用入口可以不同，但应用能力和运行时规则应当统一。

## 2. Problem Statement

EvaEngine 解决的不是“如何启动一个 HTTP server”这一局部问题，而是以下组合问题：

### 2.1 多入口应用的统一组装

Web、CLI、Cron 和后台任务需要共享同一套配置、服务和错误处理规则，同时保留各自的入口语义。

### 2.2 基础设施依赖的隔离

应用代码应依赖稳定的能力边界，而不是依赖 Redis、ORM、HTTP client、具体日志库或云配置客户端的细节。

### 2.3 运行时能力的可替换性

日志、缓存、认证、数据库和外部服务客户端可能因环境、部署方式或产品阶段而变化。替换实现不应要求大规模修改业务代码。

### 2.4 横切能力的一致性

认证、验证、日志、追踪、Session、缓存和错误处理应由运行时统一管理，而不是在各个业务模块中重复实现。

### 2.5 应用结构的可理解性

运行时应能够识别应用中的组件、能力和关系，从而支持自动注册、文档生成、诊断和后续自动化。

## 3. What EvaEngine Is Not

### 3.1 不是 Express 的薄封装

HTTP 是一种运行入口，不是 EvaEngine 的全部抽象。EvaEngine 不应退化为路由注册器或 middleware 集合。

### 3.2 不是业务领域框架

EvaEngine 不定义具体业务模型、行业流程或领域规则。它提供运行时能力和应用组装机制，业务规则应由应用自身拥有。

### 3.3 不是 ORM 抽象层

EvaEngine 可以集成 ORM 和 persistence capability，但不应把领域模型永久绑定到某个 ORM 的数据结构、查询语言或生命周期。

### 3.4 不是消息队列

进程内事件机制不能被视为可靠消息传递。跨进程事件、重试、顺序、持久化和死信处理属于消息基础设施的职责。

### 3.5 不是全自动代码生成器

Convention、扫描和 metadata 可以减少重复配置，但不能替代明确的架构边界、业务决策和人工审查。

### 3.6 不是隐藏复杂性的全局单例集合

全局状态可以降低短期接入成本，但不能成为默认的资源隔离、生命周期管理或多实例运行方案。

## 4. Core Design Ideas

### 4.1 Runtime First

应用应首先被理解为 Runtime，而不是一组孤立的 HTTP handler。

Runtime 负责：

- 创建运行上下文。
- 装配应用能力。
- 管理入口生命周期。
- 处理资源启动和停止。
- 提供统一的错误和可观测性语义。

入口适配器可以变化，但它们应进入同一个 Runtime model。

### 4.2 Capabilities Over Implementations

基础设施应以 capability 的形式暴露。

应用需要的是“记录日志”“读取配置”“发送 HTTP 请求”“访问缓存”，而不是某个具体库的对象。具体实现属于 Provider 或 infrastructure boundary。

设计判断：

> 稳定的能力接口比稳定的第三方库更重要。

### 4.3 Providers as Composition Boundaries

Provider 是运行时能力的装配边界。

Provider 的职责不是承载业务逻辑，而是：

- 声明能力。
- 选择实现。
- 注册依赖。
- 参与生命周期。
- 暴露替换和测试入口。

Provider 应保持小而明确。一个 Provider 不应同时拥有多个不相关的业务职责。

### 4.4 Commands as Entry Adapters

Command 是应用入口和用例之间的适配层。

Command 可以被 CLI、Cron、Worker 或其他 Runtime 入口调用。它不应成为庞大的业务逻辑容器。

推荐方向：

```text
Entry
  -> Command
    -> Use Case
      -> Domain
        -> Repository
```

### 4.5 Metadata as an Application Understanding Mechanism

Metadata 的价值不只是生成 Swagger，而是让 Runtime 能够理解应用自身：

- 哪些组件存在。
- 哪些能力可用。
- 哪些命令可以执行。
- 哪些模型和异常构成应用 contract。
- 哪些关系需要被注册或展示。

Metadata 必须具备明确的 schema、来源和版本语义。隐式扫描不能成为不可解释的魔法。

### 4.6 Explicit Boundaries, Replaceable Internals

公共 contract 应围绕行为、能力和生命周期定义，而不是围绕第三方库的类名、字段和内部对象定义。

内部实现可以替换，只要：

- 能力行为保持一致。
- 错误语义保持可识别。
- 生命周期承诺保持一致。
- 公共输入输出保持兼容。

### 4.7 Events for Decoupling, Not Reliability by Default

事件用于解耦生产者和消费者，但事件的可靠性等级必须明确。

进程内事件默认是：

- 非持久化。
- 非跨进程。
- 可能丢失。
- 不提供自动重试。

若业务需要可靠交付，必须显式使用具备持久化、重试和 dead-letter 能力的消息基础设施。

## 5. Lifecycle Constraints

Runtime lifecycle 应被视为公共设计约束，而不是实现细节。

推荐生命周期：

```text
construct
  -> register
    -> boot
      -> start
        -> serve / execute
          -> stop
            -> shutdown
```

### Register

声明和绑定能力，不执行依赖外部资源的长时间操作。

### Boot

加载配置、建立 metadata、完成依赖关系检查，并准备运行环境。

### Start

建立网络连接、启动 worker、启用定时任务或开始接受请求。

### Stop

停止接收新的工作，取消调度，完成必要的 inflight work 处理。

### Shutdown

关闭连接、释放资源、结束 tracing/logging flush，并保证进程可以退出。

约束：

- 每个可持有资源的 Provider 都必须有可识别的停止和释放语义。
- 生命周期操作应尽可能幂等。
- 一个 Runtime 不应隐式控制另一个 Runtime 的资源。
- 测试必须可以创建隔离的 Runtime context。
- 失败的启动过程必须能够报告失败阶段和原因。

## 6. Extension Constraints

新增能力时，AI Coding Agent 应优先使用以下顺序：

1. 定义 capability contract。
2. 定义 provider/composition boundary。
3. 定义生命周期行为。
4. 定义配置和错误语义。
5. 添加 fake/in-memory implementation 或 test adapter。
6. 再接入具体外部基础设施。

不应直接在业务代码中：

- 创建全局数据库、Redis 或 HTTP client。
- 读取环境变量作为隐式配置协议。
- 依赖第三方库的内部字段。
- 通过 import side effect 注册未声明的能力。
- 用扫描替代明确的依赖关系。

## 7. Public Contract Rules

以下内容应优先视为公共契约：

- Runtime 的入口和生命周期语义。
- Provider 的注册和替换语义。
- Command 的 metadata 和执行语义。
- Service capability 的行为、输入、输出和错误。
- Middleware 的 `(request, response, next)` 行为。
- Entity/Repository 的领域边界，而非 ORM 内部对象。
- Metadata 的 schema 和版本。

以下内容默认属于内部实现：

- 具体 DI 容器。
- 第三方库的对象和内部字段。
- 扫描器、缓存、注册表和模块级变量的存储方式。
- 文件路径布局和生成文件格式，除非文档明确承诺。
- 测试 fixture 和测试 bootstrap。

AI Coding Agent 修改代码时，应先判断改动触及的是 public contract 还是内部实现。涉及 public contract 的修改必须说明兼容性影响并增加 contract test。

## 8. Decision Heuristics for AI Coding Agents

### Prefer

- 稳定边界，而不是快速穿透抽象。
- 显式依赖，而不是隐藏的全局状态。
- 小型 Provider，而不是大型万能服务。
- Use Case first，而不是 Controller first。
- 可替换 adapter，而不是直接绑定外部 SDK。
- 可观察、可测试、可关闭的生命周期。
- 失败可解释的 metadata 和自动发现。

### Avoid

- 为单个调用引入全局 singleton。
- 把 ORM model 当作 Domain Entity。
- 让 Command 直接承载大量业务规则。
- 把进程内 EventManager 当作可靠队列。
- 为了通过测试而屏蔽真实资源错误。
- 只升级 package version 而不验证 API contract。
- 用 lint 或格式化掩盖生命周期和依赖问题。

## 9. Relation to Future Runtimes

EvaEngine 的设计经验可以作为 Aurora Runtime 的基础，但 Aurora 不应机械复制其实现。

EvaEngine 主要管理：

```text
Application Capability
```

Aurora 主要管理：

```text
Knowledge Capability
```

二者可以共享：

- Runtime context
- Provider lifecycle
- Capability contracts
- Metadata registry
- Command/pipeline model
- Event boundaries
- Observability conventions

未来重构的目标不是保留旧 API 的全部表面，而是保留这些架构判断，并以更强的类型、生命周期、隔离和可靠性重新实现。

## 10. Summary

EvaEngine 存在，是为了让复杂应用在多个入口、多个基础设施和长期演进过程中保持可组装、可替换、可观察和可测试。

它不是 HTTP wrapper，也不是业务框架。它是 Application Runtime 的一组架构约束和扩展机制。

对未来实现最重要的判断是：

> Runtime 统一入口，Provider 组织能力，Metadata 描述应用，Command 连接入口与用例，事件负责解耦；具体库和存储实现必须停留在可替换边界之后。

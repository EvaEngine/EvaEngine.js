# 边界

## 何时读
判断改动是否越界、模块该不该动、能否引入新抽象时。

## 本库负责
- Runtime 生命周期组装（构造 / bootstrap / run* / 错误处理）
- DI 与 ServiceProvider / MiddlewareProvider 机制
- 内置 services、middlewares、commands、utils
- Entities 扫描与 Sequelize 集成辅助
- Exceptions 公共错误语义
- Swagger 从源码注释/模型生成
- 测试夹具与 CI/发版对库行为的保证
- 对外 package 导出行为的兼容（以测试+README 为准）

## 本库不负责
- 具体业务领域模型与用例实现
- 消费方仓库的目录/业务代码
- 可靠消息（跨进程 MQ、重试、死信）
- 替代 Sequelize/完整数据访问层产品化
- 多租户/多 Engine 强隔离运行时（当前全局 DI/app）

## 模块边界（摘要）
| 模块 | 做 | 不做 |
|---|---|---|
| engine | 入口编排、模式、命令表、HTTP server、cron handlers | 业务 handler 逻辑 |
| di | 绑定/解析/reset、注册 Provider | 业务状态 |
| services | 基础设施能力与 Provider | HTTP 协议细节（除 client） |
| middlewares | 请求级横切 | 持久化领域规则 |
| commands | CLI/Cron 适配与代码生成命令 | 长期承载厚领域逻辑（约定） |
| entities | 扫描、registry、常用 SQL 捷径 | 定义业务表结构本身 |
| exceptions | 错误分类与 JSON/HTTP 语义 | 业务校验规则内容 |
| swagger | 文档生成管线 | 运行时鉴权实现 |
| utils | 无状态/弱状态工具 | 隐藏的第二套 Runtime |

## 扩展点（消费方）
- 自定义 ServiceProvider / MiddlewareProvider
- `registerCommands` 注册业务 Command
- `setBaseServiceProviders` / `setServiceProvidersForWeb|CLI` / `setMiddlewareProviders` 替换集合
- 配置切换 JWT：`token.provider = kong`
- Entity 文件放入应用 entities 目录由 `Entities` 扫描

## 相关
- overview、各 `components/*/README.md`
- ADR：`architecture/adr/0001-runtime-first-multi-entry.md` 等

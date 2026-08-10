# 架构总览

验证于：2026-08-10（对照 `src/`、`package.json`、测试）

## 何时读
需要理解系统定位、主路径、目录结构时。

## 内容

### 是什么
`evaengine`：Node.js **Application Runtime** 库。统一 Web / CLI / Cron 入口下的配置、DI、服务、中间件、命令、实体与文档生成。

不是：纯 Express 封装、业务领域框架、消息队列、完整 ORM 产品。

### 主路径
```text
消费方应用
  → new EvaEngine(meta, mode)     # 注册 base providers（env/config/logger/namespace/now/event_manager）
  → bootstrap()                   # Web：web services + middleware providers
  → use(...) / registerCommands
  → run() | runHttps() | runCLI() | runCrontab() | runCommand()
```

Package 入口：`index.js` → `src/index.js`（`main`: `src/index.js`）。CLI bin：`bin/engine`。

### 关键结构
| 路径 | 角色 |
|---|---|
| `src/engine.js` | Runtime 中枢 |
| `src/di.js` | 全局 DI（constitute） |
| `src/services/` | 能力实现 + `providers.js` |
| `src/middlewares/` | HTTP 横切 + `providers.js` |
| `src/commands/` | Command 基类与内置命令 |
| `src/entities/` | Sequelize 实体扫描 registry |
| `src/exceptions/` | 异常体系 |
| `src/swagger/` | 注释/模型 → Swagger |
| `src/utils/` | 横切工具（含 cron） |
| `src/config/` | 引擎内置默认配置对象 |
| `template/` | make_entity 等 ejs 模板 |
| `test/` | node:test；`_demo_project` 夹具 |

### 模式
- `web`（默认）：`bootstrap` + HTTP(S)
- `cli`：构造时 mode=`cli`；CLI providers 在执行命令路径注册

### 栈（事实）
Node ≥24 ESM · Express 5 · constitute · Sequelize 6 · Joi · ioredis · Winston · yargs · moment-timezone · swagger-ui-dist

### 数据流摘要
- **配置**：内置默认 ← `config.default.cjs` ← `config.<NODE_ENV>.cjs` ← 可选 local；可选 Spring Cloud（bin）
- **HTTP**：Express app（模块级单例）← middleware（DI 取出）← 路由 ← 默认错误处理器
- **CLI/Cron**：注册 Command 类 → yargs 解析 → `command.run()`
- **DI**：Provider.register → bindClass/bindValue/bindMethod → `DI.get(name)`

## 相关
- 边界：`boundaries.md`
- 模块：`docs/components/*`
- 决策：`architecture/adr/`

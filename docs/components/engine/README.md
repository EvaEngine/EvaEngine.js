# engine

## 何时读
改启动、入口模式、命令注册、HTTP/CLI/Cron 编排、错误处理时。

## 职责
`EvaEngine`（`src/engine.js`）：应用 Runtime 中枢。持有 meta、命令表、server、cron handlers；注册 Provider；提供 bootstrap / run* / 默认错误处理。

## 边界
- 不做业务路由/用例实现
- 不保证多实例隔离（模块级 `app` + 全局 DI）

## 主要接口
- 构造：`new EvaEngine({ projectRoot, configPath?, sourceRoot?, port?, ... }, mode?)`
- meta：`getMeta()` → `{ mode, port, projectRoot, configPath, sourceRoot }`
- DI：`getDI()`；`registerServiceProviders` / `registerService`
- Web：`bootstrap()`、`use()`、`run(port?)`、`runHttps(port?, options?)`、`getServer()`、`static getApp()` / `createRouter()`
- 命令：`registerCommands`、`getCommands`、`clearCommands`、`runCLI`、`runCommand`、`runCrontab`、`clearCrontabs`
- 错误：`set/getDefaultErrorHandler`、`set/getUncaughtExceptionHandler`、`set/getServerErrorHandler`
- Provider 集合静态 getter/setter：base / web / CLI / middleware
- `static getVersion()`

## 模式与 Provider
- 构造即注册 **base**：Env, Config, Logger, Namespace, Now, EventManager
- `bootstrap()`：**web services**（Redis, Cache, HttpClient, RestClient, ValidatorBase, Jwt）+ **middlewares**
- CLI/Cron 路径内注册 **CLI services**（Cache, HttpClient, RestClient, Redis）

## 依赖
DI、services/providers、middlewares/providers、exceptions、utils/cron、express、yargs、moment-timezone、package.json version

## 雷区
- `getApp()` 懒创建进程级 Express；重复 Engine 共享同一 app
- 默认错误处理器把非 `StandardException` 包成 `RuntimeException`；生产环境剥离 stack
- Cron：`parseCron` + `setCronInterval`；`useSeconds` 控制秒级字段；job 异常会抛出（注释写明 let crash）
- TZ 在模块加载时设置

## 相关代码
- `src/engine.js`、`src/index.js`、`bin/engine`
- 测试：`test/engine.js`、`test/error_handlers.js`

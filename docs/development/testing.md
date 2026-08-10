# 测试

## 何时读
写/改测试、排查串测、对照行为契约时。

## 框架
- Node 内置 `node:test` + `node:assert/strict`
- 入口 bootstrap：`node --import ./test/bootstrap.js`
- `--test-concurrency=1`（全局 DI）
- `LOG_LEVEL=error NODE_ENV=test`

## Bootstrap
`test/bootstrap.js`：`DI.registerMockedProviders` 全部 service providers，config 指向 `test/_demo_project/config`。并 patch `util.isFunction` 兼容。

## 布局
- 与源码对应：`test/di.js`、`engine.js`、`services/*`、`middlewares/*`、`utils/*`、`entities`、`exceptions`、`swagger`、`commands`
- 夹具：`test/_demo_project`、`test/swagger/_example`、`test/_helpers`

## 惯例
- 涉及 DI 状态时注意 `DI.reset()` 或依赖 bootstrap 顺序
- 不删测试装通过；失败先修代码或标明环境依赖（如 Redis）
- 公共行为变更应有测试覆盖

## 相关
- `package.json` scripts.test
- CI 起 Redis 7 service

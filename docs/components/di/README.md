# di

## 何时读
改依赖注入、Provider 注册、测试隔离时。

## 职责
`src/di.js`：对 `constitute.Container` 的静态封装。维护字符串名 → 绑定 的 `bound`/`boundKind`（class/value/method）。

## 边界
- 全局单例容器；`reset()` 重建
- 不实现业务服务

## 主要接口
- `getContainer` / `getBound` / `get(service)`
- `bindClass` / `bindValue` / `bindMethod`
- `reset`
- `registerServiceProviders(providers, engine)` / `registerService(ProviderClass, engine)`
- `registerMockedProviders(providers, configPath)` — 测试用假 engine meta

## 依赖
constitute、`ServiceProvider` 基类、`RuntimeException`

## 雷区
- `get(string)` 未绑定抛 `RuntimeException`
- Provider 必须 `instanceof ServiceProvider`
- 测试并行会互相污染 → 当前 `npm test` 使用 `--test-concurrency=1`

## 相关
- `src/services/providers.js`（`ServiceProvider`）
- 测试：`test/di.js`、`test/bootstrap.js`

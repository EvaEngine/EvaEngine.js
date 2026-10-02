# di

## 何时读
改依赖注入、Provider 注册、测试隔离时。

## 职责
`src/di.ts`：内置原生容器（`Container` 类）与静态门面 `DI`。维护字符串名 → 绑定 的 `bound`/`boundKind`（class/value/method）。

依赖声明在目标自身：类用 `static dependencies = [...]`；函数工厂（无 static）用 di.ts 导出的 `Dependencies(...)(fn)` helper 写入同一属性。容器递归解析每个声明项，作为构造参数（类）或调用参数（函数工厂）注入。

## 边界
- 全局单例容器；`reset()` 重建
- 不实现业务服务

## 主要接口
- `getContainer` / `getBound` / `get(service)`
- `bindClass` / `bindValue` / `bindMethod`
- `reset`
- `registerServiceProviders(providers, engine)` / `registerService(ProviderClass, engine)`
- `registerMockedProviders(providers, configPath)` — 测试用假 engine meta

## 雷区
- `get(string)` 未绑定抛 `RuntimeException`
- Provider 必须 `instanceof ServiceProvider`
- 单例缓存按目标：class 绑定按类缓存（同一类多个绑定名共享一个实例——provider "先 `get` 预构建实例、原地突变、再 `bindClass(key, Class, [instance])`" 的模式因此对后续 `get` 可见）；value/method 绑定按绑定缓存（重绑得新实例）
- 函数工厂以容器为 `this` 调用，返回值（注入完成的内层函数）作为单例缓存
- 测试并行会互相污染 → 当前 `npm test` 使用 `--test-concurrency=1`

## 相关
- `src/services/providers.ts`（`ServiceProvider`）
- 测试：`test/di.ts`、`test/bootstrap.ts`

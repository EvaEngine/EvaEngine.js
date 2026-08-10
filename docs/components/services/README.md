# services

## 何时读
改基础设施能力、Provider 绑定名、JWT/Redis/Cache/Config 等时。

## 职责
可注入能力实现 + `providers.js` 装配。业务/middleware 应 `DI.get(name)` 获取，而非直接 `new` 第三方客户端（惯例）。

## 边界
- Provider 只装配，不写业务
- EventManager ≠ 可靠 MQ
- Cache 默认 redis driver；另有 null/namespace 等 store 实现见 `cache.js`

## 服务与 DI 名（Provider）
| DI 名 | 类 | 说明 |
|---|---|---|
| env | Env | NODE_ENV 等 |
| config | Config | 文件合并 + 可选 Spring |
| logger | Logger | Winston |
| namespace | Namespace | CLS（continuation-local-storage） |
| now | Now | 可测时钟 |
| event_manager | EventManager | 进程内事件 |
| redis | Redis | ioredis 包装 |
| cache | Cache | 缓存门面 |
| http_client | HttpClient | |
| rest_client | RestClient | |
| validator_base | ValidatorBase | Joi 包装 |
| jwt | JsonWebToken 或 KongJsonWebToken | `token.provider==='kong'` 切换 |

## 主要路径
- 实现：`src/services/*.js`
- 装配：`src/services/providers.js`
- 导出集合：`src/services/index.js`（不含 Kong JWT、providers）
- 基类：`ServiceInterface`（`getProto()`）

## Config 要点
合并：`EngineConfig(src/config)` + `config.default.cjs` + `config.<env>.cjs` + 可选 `config.local.<env>.cjs`。  
`resolveSpringConfig` 供远程覆盖（bin 使用）。

## 雷区
- Logger 标签：web 用 `web{port}`，cli 用 `CLI_NAME` 或 `cli`
- Redis `lazyConnect` 等来自配置；`cleanup`/`isConnected` 供退出
- constitute `Dependencies` 装饰在类上（如 Config←Env）

## 相关
- 测试：`test/services/*`
- 默认配置键：`components/config-default`

# middlewares

## 何时读
改 HTTP 横切：会话、鉴权、追踪、校验、视图缓存、调试时。

## 职责
Express 中间件工厂 + Middleware Providers（`DI.bindMethod`）。由 engine `bootstrap` 注册后通过 `DI.get('auth')` 等取出使用（消费方组装顺序）。

## 边界
- 不定义业务授权策略细节 beyond token/session
- 中间件顺序是消费方/约定契约，本库不强制全局 use 顺序（除错误处理器在 `run` 时挂上）

## 列表
| DI 名 | 实现 | 备注 |
|---|---|---|
| session | session.js | express-session；可接 redis store |
| auth | auth.js 或 auth_kong.js | `token.provider` 切换；`X-Token` / `api_key` / session / faker |
| debug | debug.js | |
| view_cache | view_cache.js | |
| validator | validator.js | |
| trace | trace.js | 与 namespace tracer 协作 |

## 路径
`src/middlewares/*`、`providers.js`、`index.js`

## 雷区
- Auth faker：`token.faker.enable` + key/uid（仅显式配置时）
- 多实现切换必须与 services 侧 JWT Provider 一致

## 相关
- 测试：`test/middlewares/*`（security/trace/view_cache）

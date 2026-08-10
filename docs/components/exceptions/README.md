# exceptions

## 何时读
改错误类型、HTTP 状态/JSON 形态、错误处理映射时。

## 职责
以 `StandardException` 为根的异常树；支持 code/status、prevError、toJSON、importance 等。Engine 默认错误处理器依赖此体系。

## 主要类型（导出）
- 逻辑：`LogicException`、`InvalidArgumentException`、`FormInvalidateException`、`ModelInvalidateException`、`UnauthorizedException`、`OperationNotPermittedException`、`ResourceNotFoundException`、`OperationUnsupportedException`、`ResourceConflictedException`、…
- 运行/IO：`RuntimeException`、`IOException`、`HttpRequestIOException`、`RestServiceIOException`、`DatabaseIOException`、…
- HTTP/Rest 逻辑异常分支见源码

## 边界
- 不包含业务校验文案库
- Swagger 可映射 exception → 文档片段

## 相关
- `src/exceptions/index.js`
- 测试：`test/exceptions/index.js`、`test/error_handlers.js`

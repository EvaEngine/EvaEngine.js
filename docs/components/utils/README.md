# utils

## 何时读
改分页、cron 解析、smart_query、api_scaffold、wrapper 等工具时。

## 职责
无/弱状态工具集，供 engine、services、应用复用。

## 主要成员（`src/utils/index.js` 导出）
- `wrapper`：async 中间件错误转发
- `pagination` / `paginationFilter`
- `cron`（engine 直接自 `cron.js` import：`parseCron`、`setCronInterval`）
- `smart_query`、`api_scaffold`、`request_client`
- 时间戳/host/case/random/crc32、`test` 辅助
- `merge`（lodash）

## 边界
- 避免变成隐藏 Runtime 或万能业务层
- `request_client` 与 services 下 HttpClient 职责相近时改前先读两边

## 相关
- 测试：`test/utils/*`

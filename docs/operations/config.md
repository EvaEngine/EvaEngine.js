# 配置与环境变量

## 何时读
排障配置加载、对接 Spring Config、查默认键时。

## 文件配置（应用侧）
路径默认 `{projectRoot}/config`：
1. 引擎内置 `src/config/index.js`
2. `config.default.cjs`
3. `config.<NODE_ENV>.cjs`
4. 可选 `config.local.<NODE_ENV>.cjs`（缺失忽略）

## 环境变量（代码中出现）
| 变量 | 用途 |
|---|---|
| `NODE_ENV` | 环境；配置文件名 |
| `LOG_LEVEL` | 覆盖 logger level |
| `TZ` | moment 默认时区（否则 Asia/Shanghai） |
| `CLI_NAME` | CLI logger 标签 |
| `PORT` | 常见于应用；engine 构造也接 port |
| `MAX_REQUEST_DEBUG_BODY` | debug 中间件相关 |
| `SEQUELIZE_REPLICATION_CONFIG_KEY` | 覆盖 db.replication 来源键 |
| `SPRING_CONFIG_ENDPOINT` | bin 拉远程配置 |
| `SPRING_CONFIG_NAME` / `PROFILES` / `LABEL` | Spring 参数 |

## 密钥
禁止把真实 secret 写入仓库；session.secret、token.secret 等必须在部署环境覆盖。

## 相关
- `components/config-default`、`components/services`

# 运行特征

## 何时读
排障进程行为、资源清理、入口差异时。

## 入口
| 入口 | 典型调用 |
|---|---|
| Web | `bootstrap` → `use` → `run` / `runHttps` |
| CLI | mode=`cli` → `registerCommands` → `runCLI` |
| Cron | `registerCommands` → `runCrontab(seq, cmdString)` |
| 单次命令 | `runCommand(cmdString)` |
| bin | `bin/engine` → runCLI + 可选 Spring + redis cleanup |

## 资源
- HTTP server：`getServer()`；uncaughtException 默认尝试 `server.close` 后延时 exit
- Redis：进程退出路径应 `cleanup`（bin finally 有示例）
- Cron handlers：`clearCrontabs`

## 已知限制（事实）
- 全局 DI 与模块级 Express app
- 生命周期无完整 stop/shutdown 框架 API（有 clear 与 server close 片段）
- 默认错误处理面向 JSON API

## 相关
- `components/engine`、`architecture/adr/*`

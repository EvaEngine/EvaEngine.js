# Project Memory

限高：全文建议 ≤150 行。超限先删 Assumed/过时/已升格进 docs 的条目。
只记：代码与 docs 都表达不好、且影响未来开发的信息。
不记：架构复述、API 说明、流水账、临时调试、git 能看到的变更列表。
置信：Confirmed（代码/测试/人确认）| Assumed（待验证，用完升格或删）。

更新：2026-08-10

## 当前焦点
- 进行中：无
- 下一步：无（README 消费方文档 + ADR 升格 + archive 清理已完成）

## 雷区与禁忌
- 全局 DI + 模块级 `app`：多 Engine 并存隔离未保证（Confirmed；ADR-0002）
- 包入口只有 default/`core`：`import { EvaEngine } from 'evaengine'` **不可用**；须 `import eva from 'evaengine'` 再解构（Confirmed，`index.js` re-export）
- 测前 `DI.reset()` / `test/bootstrap.js`；`--test-concurrency=1`（Confirmed）
- `bootstrap()` ≠ CLI providers；CLI 在 `getCLI`/`runCrontab` 内注册（Confirmed）
- JWT/Auth 双实现：`token.provider === 'kong'`（Confirmed）
- ESM 相对路径要 `.js`；entity 扫描用 `createRequire`（Confirmed）
- 默认 TZ：`process.env.TZ || 'Asia/Shanghai'`（Confirmed）
- EventManager ≠ MQ（Confirmed；ADR-0005）
- npm 发布物看 `.npmignore`；消费方契约在 README（Confirmed；ADR-0006）
- session 中间件读取 `_config.get().cookie`，默认配置 cookie 在 `session.cookie` 下——键路径不一致，改 session 配置时对照源码（Confirmed）

## 调试手册
- 测试需 Redis `127.0.0.1:6379`；bootstrap 用 `test/_demo_project/config`
- Spring Config 仅 `bin/engine` + `SPRING_CONFIG_ENDPOINT`
- 配置合并：内置 ← default.cjs ← `<env>.cjs ← local.<env>.cjs`

## 待验证
- （空）

## 协作偏好（项目级）
- 对外 README 英文；维护 docs/memory 中文
- 改 Public 行为：测试 + README
- 锁文件：提交 package-lock.json（ADR-0007）
- 架构大改：design-review + ADR

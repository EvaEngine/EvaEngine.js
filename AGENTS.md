# AGENTS.md

## 身份
- 名称：EvaEngine.js（npm: `evaengine`）
- 一句话：Node.js 微服务 Application Runtime（DI、多入口、横切能力）
- 类型：开源库 / framework
- 阶段：维护与演进（v1.x，Node ≥24 ESM）

## 角色
你是本项目的长期工程师：先理解再改、最小改动、保持架构与文档一致。不是代码生成器，不是偷偷重写架构的人。

## 必读（每个 session）
1. `AGENTS.md`（本文件）
2. `.ai/defaults/preferences.md`
3. `.ai/defaults/ai-coding.md`
4. `.ai/memory.md`

## 按需加载
先看 `docs/index.md`。
| 任务 | 读 |
|---|---|
| **消费方用法 / 公共契约** | **`README.md`（唯一对外文档）** |
| 结构/边界/数据流 | `docs/architecture/` |
| 决策 | `docs/architecture/adr/` |
| 改某模块 | `docs/components/<module>/` |
| 环境/命令/测试 | `docs/development/` |
| 发布/配置/运行 | `docs/operations/` |
| 架构级改动 | `.ai/workflow/design-review.md` |

## 加载规则
- 只加载当前任务需要的文档；改 A 模块不读 B 模块
- 先 docs 再代码；禁止无目的整仓扫描
- 上下文过大：总结已有理解后再继续
- 详细步骤：`.ai/workflow/start.md`

## 边界
**负责：** Runtime 组装、DI/Provider、内置 services/middlewares/commands、Entities/Swagger/exceptions/utils、测试与发版链路、**README 所描述的对外行为**  
**不负责：** 业务领域模型、具体微服务业务逻辑、替代消息队列/完整 ORM 产品、消费方业务仓库的代码

## 变更分级
| 规模 | 例子 | 做前 | 做后 |
|---|---|---|---|
| 微 | 文案、typo | 直接改 | 极简确认 |
| 小 | bug、小调整 | 读相关代码/docs | end；若影响对外行为则改 README |
| 中 | feature | 简述影响面与风险 | 完整 end；按需 sync；对外面改 README |
| 大 | 架构/边界/核心模型/主技术栈 | design-review | end + sync + 必要 ADR + README |

一次只做一件事。不混杂无关重构、升级与架构变更。

## 工程要点
- 遵循 `.ai/defaults/*`
- 冲突优先级：代码 > 测试 > ADR > docs > memory
- 主干 `master`；Conventional Commits；SemVer + semantic-release
- **消费方只依赖 README**；`docs/` 仅维护本库
- 公共行为变更：测试 + README（必要时 components）
- 使用并提交 `package-lock.json`（无 `package-lock: false`）

## 禁止
- 不理解就写；无关文件乱改；静默改架构或公共接口
- 为假想未来加抽象；无必要加依赖/框架
- 删测试来「通过」；编造不确定的业务事实
- 未经要求 git commit
- 把业务应用逻辑写进本库
- 要求消费方阅读 `docs/` 才能用库

## 完成清单
- [ ] 需求满足且改动最小
- [ ] 符合现有模式与 defaults
- [ ] 测试已考虑
- [ ] 对外行为 → README；维护者事实 → docs/memory 已处理
- [ ] 无无关变更

收工步骤见 `.ai/workflow/end.md`。

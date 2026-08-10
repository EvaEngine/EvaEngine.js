# docs 索引

**维护者**按需加载。npm 消费方只读仓库根目录 `README.md`，不依赖本目录。

| 任务 | 读 |
|---|---|
| 对外用法（人/消费方 agent） | `/README.md`（唯一消费方文档） |
| 系统是什么 / 主路径 | `architecture/overview.md` |
| 负责边界 | `architecture/boundaries.md` |
| 架构决策 | `architecture/adr/` |
| Runtime / Engine | `components/engine/README.md` |
| DI | `components/di/README.md` |
| Services | `components/services/README.md` |
| Middlewares | `components/middlewares/README.md` |
| Commands | `components/commands/README.md` |
| Entities | `components/entities/README.md` |
| Exceptions | `components/exceptions/README.md` |
| Swagger | `components/swagger/README.md` |
| Utils | `components/utils/README.md` |
| 内置默认配置 | `components/config-default/README.md` |
| 环境 / 命令 / 测试 | `development/` |
| 发版 / 配置 / 运行 | `operations/` |

冲突：代码 > 测试 > ADR > docs > memory。

# entities

## 何时读
改 Sequelize 集成、实体扫描、事务/uniqueInsert/查询捷径时。

## 职责
`Entities`：从目录扫描 entity 工厂（js/es6/cjs），注册到 map，调用 `associate`；可自建 Sequelize（读 config.db + sequelize 选项）或注入实例；SQL logging 可挂 tracer。

## 边界
- 不拥有业务 schema 定义
- 与 Sequelize API 耦合；非独立 ORM

## 主要接口
- 构造 `(entitiesPath, sequelizeInstance?)`
- `scan` / `init` / `query` / `uniqueInsert` / `getTransaction`
- `getSequelize` / `getInstance` / 取实体等（见源码）
- `static addTracer(options)`

## 依赖
Sequelize、DI(config/logger/namespace)、exceptions、utils 时间戳；`createRequire` 加载实体文件

## 雷区
- Namespace 启用时注入 Sequelize CLS
- `SEQUELIZE_REPLICATION_CONFIG_KEY` 可改写 replication 配置源键
- uniqueInsert 仅允许有限值类型

## 相关
- `src/entities/index.js`
- 测试：`test/entities/index.js`、夹具 `test/_demo_project/entities`

# config-default

## 何时读
改引擎内置默认配置键、默认值时。

## 职责
`src/config/index.js` 导出默认配置对象；`Config.loadConfigFromFiles` 将其置于 merge 最底层（再被应用 config 覆盖）。

## 主要键
app、sequelize、logger、trace、namespace、cache、redis、db（含 replication）、session、token（含 faker/provider）、swagger 骨架

## 边界
- 不是应用业务配置文件
- 密钥类默认值（如 session.secret）仅开发向，生产必须覆盖

## 相关
- `src/services/config.js`
- 夹具：`test/_demo_project/config/*.cjs`
- 运维：`docs/operations/config.md`

# commands

## 何时读
改 CLI 命令协议、内置代码生成命令、bin 行为时。

## 职责
- `Command` 基类（`interface.js`）：`getName/getDescription/getSpec` 静态方法 + `run()`
- 内置：`MakeEntity`、`MakeDbView`、`MakeGraphql`（`make_entity.js`）、`TrampConfig`（`tramp.js`）
- Engine `registerCommands` 按 `getName()` 建表；`runCLI`/`runCrontab`/`runCommand` 执行

## 边界
- Command 宜作入口适配，厚业务应在消费方 use case（设计惯例，非强制检查）
- 模板在 `template/*.ejs`

## 内置命令名（代码）
见各类 `static getName()`（make_entity / make_dbview 等以源码为准）。

## bin/engine
- mode cli，注册 `commands` 包导出
- 可选 `SPRING_CONFIG_*` 拉远程配置
- finally 尝试 redis cleanup

## 相关
- `src/commands/*`、`bin/engine`、`template/`
- 测试：`test/commands/make_entity.js`

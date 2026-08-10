# swagger

## 何时读
改 OpenAPI 生成、注释解析、模型片段映射时。

## 职责
从源码 JSDoc/注解、YAML 片段、Sequelize 模型与异常类型生成 Swagger 2.0 文档（`ExSwagger` 等）。依赖 acorn/doctrine/js-yaml 等。

## 边界
- 生成期/工具向；非运行时鉴权
- 解析失败有 `AcornParsingException` / `YamlParsingException`

## 主要导出
`Fragment`、`Annotation`、`AnnotationsContainer`、`ExSwagger`、`MODEL_TO_FRAGMENT_TYPES_MAPPING` 等（`src/swagger/index.js`）

## 雷区
- 注释格式与文件扫描路径敏感；改解析需对照 `test/swagger`

## 相关
- 测试：`test/swagger/index.js`、`test/swagger/_example`

# 常用命令

## 何时读
需要跑检查、测试、发布相关脚本时。

## npm scripts
| 命令 | 作用 |
|---|---|
| `npm run lint` | ESLint（typescript-eslint）：`src` `test` |
| `npm run build` | 清理并全量重建 `dist/`（无增量缓存），tsc 编译并生成声明文件（`scripts/rewrite-dts.mjs` 后处理） |
| `npm run ci:check` | lint + build |
| `prepack` | `npm pack` / `npm publish` 前自动执行 `npm run build`，保证打包产物对应当前源码 |
| `npm test` | node:test 原生运行 .ts 用例，concurrency=1，含 coverage 实验旗标 |
| `npm run release` / `semantic-release` | 发版（CI 主用） |

## Make
- `make pre-build`：npm install
- `make build`：git pull + npm install
- `make publish`：npm publish（含 registry 切换逻辑，慎用；正式发版走 semantic-release）

## 本地 CLI（库内置命令）
```bash
./bin/engine
# 或
./node_modules/.bin/engine make:entity
```

## 相关
- CI：`.github/workflows/ci.yml`
- 发版：`operations/release.md`

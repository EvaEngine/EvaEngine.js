# 常用命令

## 何时读
需要跑检查、测试、发布相关脚本时。

## npm scripts
| 命令 | 作用 |
|---|---|
| `npm run lint` | ESLint（typescript-eslint）：`src` `test` |
| `npm run build` | tsc 编译 `dist/` 并生成声明文件（`scripts/rewrite-dts.mjs` 后处理） |
| `npm run ci:check` | lint + build |
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

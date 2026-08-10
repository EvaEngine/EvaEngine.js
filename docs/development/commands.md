# 常用命令

## 何时读
需要跑检查、测试、发布相关脚本时。

## npm scripts
| 命令 | 作用 |
|---|---|
| `npm run lint` | ESLint：`src` `test` `index.js` |
| `npm run build` | 语法检查 `src/index.js` |
| `npm run ci:check` | lint + build |
| `npm test` | node:test，concurrency=1，含 coverage 实验旗标 |
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

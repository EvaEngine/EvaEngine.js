# 环境搭建

## 何时读
初次 clone、装依赖、跑通检查时。

## 要求
- Node.js ≥ 24
- npm
- 本地测 Redis 相关用例：Redis 在 `127.0.0.1:6379`（与 CI service 一致）

## 安装
```bash
git clone https://github.com/EvaEngine/EvaEngine.js.git
cd EvaEngine.js
npm install
```

## 验证
```bash
npm run lint
npm run build
npm test
```

## 项目形态
- ESM 库；`main`: `src/index.js`；根 `index.js` re-export
- 无独立 transpile 构建；`build` = `node --check src/index.js`
- 编辑器：`.editorconfig`；ESLint flat：`eslint.config.js`

## 相关
- `commands.md`、`testing.md`

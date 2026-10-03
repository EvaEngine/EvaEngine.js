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
- ESM 库；源码为严格 TypeScript（`src/**/*.ts`，仅可擦除语法）；`main`/`types`: `dist/index.js` / `dist/index.d.ts`（tsc 编译产物）
- 开发态零构建：Node ≥24 原生 type stripping 直接运行 .ts（无 tsx）；`build` = `tsc -p tsconfig.build.json` + `scripts/rewrite-dts.mjs`（声明文件说明符改写、ambient 类型随包）
- 编辑器：`.editorconfig`；lint：`.oxlintrc.json`（oxlint，原生解析 TS，不依赖 typescript 包）

## 相关
- `commands.md`、`testing.md`

# 发版

## 何时读
发 npm 包、改 CI/release、动版本策略时。

## 机制
- 主干：`main`
- `semantic-release` + conventionalcommits
- 插件：commit-analyzer、release-notes、changelog、npm、git（回写 `package.json`、`CHANGELOG.md`）
- Workflow：`.github/workflows/release.yml`（push main；需 `NPM_TOKEN`）
- CI 验证：`.github/workflows/ci.yml`（lint/build/test/pack dry-run；Node 24；Redis service）

## 发布物
`.npmignore` 白名单：`.ai/**`、`src/**`、`bin/**`、`template/**`、`index.js`、`package.json`、`README.md`  
（注意：业务 docs/ 默认不进包，除非改 npmignore）

## 相关
- `.releaserc.json`、`CHANGELOG.md`

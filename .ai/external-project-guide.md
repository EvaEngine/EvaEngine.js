# EvaEngine 外部项目生成指南（AI 视角）

**文档类型**: External Usage Guide
**读者**: AI Coding Agent / 外部开发者
**目标**: 基于 EvaEngine 从零生成一个可运行的新项目

## 1. 目标

给定一个空目录，如何基于 EvaEngine 快速生成一个可运行的外部项目。

重点不是“改这个库本身”，而是“用这个库生成一个新的业务项目”。

## 2. 适用场景

适用于以下类型的项目：

- Web 服务项目
- CLI 工具项目
- 定时任务项目
- 带缓存、鉴权、Session、Swagger 的微服务骨架

## 3. 生成步骤

### Step 1: 初始化项目目录

创建一个新的项目根目录，并生成基础文件结构：

```text
project-root/
  package.json
  src/
    app.js
    commands/
    entities/
    middlewares/
    services/
  config/
  test/
  README.md
```

### Step 2: 初始化 npm 包

生成 package.json，至少包含：

- 项目名称
- type: module
- 依赖：evaengine
- scripts：lint / build / test

推荐的最小配置如下：

```json
{
  "name": "my-eva-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "lint": "eslint src test",
    "build": "node --check src/app.js",
    "test": "ava"
  },
  "dependencies": {
    "evaengine": "^0.11.2"
  },
  "devDependencies": {
    "ava": "^8.0.1",
    "eslint": "^9.0.0"
  }
}
```

### Step 3: 安装依赖

```bash
npm install
```

### Step 4: 创建入口文件

在 src/app.js 中创建一个基础 Web 服务入口：

```js
import { EvaEngine } from 'evaengine';

const engine = new EvaEngine({
  projectRoot: process.cwd(),
  port: 3000
});

engine.bootstrap();
engine.use('/', (req, res) => {
  res.json({ hello: 'world' });
});
engine.run();
```

### Step 5: 创建配置目录

创建 config 目录，用于存放配置文件：

```text
config/
  config.default.js
  config.development.js
  config.local.development.js
```

建议配置文件中至少包含：

- 端口
- 日志级别
- Session / Auth 配置
- Redis / Cache 配置（如需要）

### Step 6: 创建 CLI 命令（可选）

如果项目需要命令行能力，可以新增 src/commands 下的命令文件：

```js
export default class HelloCommand {
  static getName() {
    return 'hello:world';
  }

  static getDescription() {
    return 'Print hello world';
  }

  async run() {
    console.log('hello world');
  }
}
```

然后在入口里注册：

```js
import { EvaEngine } from 'evaengine';
import HelloCommand from './commands/hello.js';

const engine = new EvaEngine({ projectRoot: process.cwd() }, 'cli');
engine.registerCommands([HelloCommand]);
await engine.runCLI();
```

### Step 7: 创建业务实体（可选）

如果项目需要数据库/ORM 能力，创建实体目录：

```text
src/entities/
  user.js
```

实体应尽量保持：

- 业务语义清晰
- 配置独立
- 与外部基础设施解耦

### Step 8: 创建测试文件

建议为核心功能新增测试：

```text
test/
  app.test.js
  commands/
```

测试应优先覆盖：

- 路由是否可访问
- 命令是否正确执行
- 错误处理是否正常

### Step 9: 运行项目

开发环境中可以先启动服务：

```bash
node src/app.js
```

如果是 CLI 模式：

```bash
node src/cli.js
```

## 4. 推荐的默认项目结构

```text
my-eva-project/
  config/
  src/
    app.js
    cli.js
    commands/
    entities/
    middlewares/
    services/
  test/
  README.md
```

## 5. 生成时的默认约定

当 AI 需要基于 EvaEngine 生成一个新项目时，建议默认遵守以下规则：

- 先生成一个最小可运行版本，再逐步补业务能力
- 优先使用 Web 服务入口作为默认入口
- CLI/Crontab 作为可选扩展能力
- 使用配置文件而不是把配置硬编码进业务代码
- 把基础设施能力（Redis、JWT、Cache、Logger）通过框架能力接入，而不是手写重复逻辑
- 先保证能跑起来，再补复杂功能

## 6. 推荐的生成顺序

1. 初始化 package.json
2. 安装 evaengine
3. 生成 Web 服务入口
4. 生成 config 目录
5. 生成一个 hello world 路由
6. 生成一个 CLI command
7. 生成测试
8. 运行 lint / build / test

## 7. 生成完成后的验收标准

一个“生成成功”的项目应满足：

- 能安装依赖
- 能启动 Web 服务
- 能返回一个简单响应
- 能执行最基本的 CLI 命令
- 能通过基础测试

## 8. 结论

从零生成一个基于 EvaEngine 的项目，最重要的是先把“运行时骨架”搭起来，再把业务逻辑放进去。

优先级顺序建议是：

```text
先能跑起来 -> 再加 CLI -> 再加定时任务 -> 再加数据库/实体 -> 再加复杂中间件
```

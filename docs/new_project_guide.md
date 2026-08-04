# EvaEngine.js 新项目上手指南

这是给人看的使用说明，重点是：怎么安装、怎么启动、怎么用。

## 1. 先准备环境

- Node.js 24 或更新版本
- npm

如果你只是想使用这个框架，直接安装即可：

```bash
npm install evaengine
```

如果你想在本地开发这个仓库：

```bash
git clone https://github.com/EvaEngine/EvaEngine.js.git
cd EvaEngine.js
npm install
```

## 2. 启动一个 Web 服务

最简单的方式是先创建一个入口文件，然后初始化一个 EvaEngine 实例：

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

然后在浏览器里打开：

```text
http://localhost:3000
```

## 3. 启动 CLI 命令

如果你想把它当成命令行工具来用，可以注册命令：

```js
import { EvaEngine } from 'evaengine';
import * as UserCommands from './commands/user.js';

const engine = new EvaEngine({
  projectRoot: process.cwd()
}, 'cli');

engine.registerCommands(UserCommands);
await engine.runCLI();
```

## 4. 启动定时任务

也可以把它当成定时任务引擎：

```js
import { EvaEngine } from 'evaengine';
import * as HelloWorldCommands from './commands/hello_world.js';

const engine = new EvaEngine({
  projectRoot: process.cwd()
}, 'cli');

engine.registerCommands([HelloWorldCommands]);
engine.runCrontab('0/10 * * * * *', 'hello:world --id=EvaEngine');
```

## 5. 常用环境变量

项目里常用的环境变量有：

- `NODE_ENV`
- `PORT`
- `LOG_LEVEL`
- `CLI_NAME`
- `MAX_REQUEST_DEBUG_BODY`
- `SEQUELIZE_REPLICATION_CONFIG_KEY`

## 6. 生成实体

如果你要生成实体或数据库视图，可以直接用 CLI：

```bash
./node_modules/.bin/engine make:entity
./node_modules/.bin/engine make:dbview
```

## 7. 运行测试和检查

开发时可以这样用：

```bash
npm run lint
npm run build
npm test
```

## 8. 推荐的起步方式

如果你想快速开始，最省事的方法是直接基于官方 skeleton 项目改：

- [EvaSkeleton.js](https://github.com/EvaEngine/EvaSkeleton.js)

这样能少走很多弯路，也更容易把项目结构维护好。

---


```
Root
├── assets/                     前端源代码(如前后未分离)
├── build/                      编译后代码(自动生成)
├── circle.yml                  CI配置文件
├── config/                     配置文件目录
├── coverage/                   代码覆盖率报告(自动生成)
├── docker-compose.yml          docker-compose编排文件
├── dockerfiles/                Docker文件
├── gulpfile.babel.js           gulp配置
├── logs/                       Log目录
├── migrations                  ORM迁移文件
├── nodemon.json                Nodemon配置
├── package.json
├── public/                     前端代码构建后目录
├── seeders/                    Dummy数据生成脚本
├── sql/                        数据库Schema
├── src                         源代码
│   ├── app.js                  Web App入口
│   ├── cli.js                  CLI Mode入口
│   ├── commands/               CLI Commands Classes
│   ├── crontab.js              定时任务入口
│   ├── entities/               ORM实体目录
│   ├── middlewares/            中间件目录
│   ├── models/                 Models目录
│   ├── routes/                 Routers(Controllers)目录
│   ├── swagger.js              Swagger文档生成脚本
│   └── utils/                  工具类
├── test                        测试代码
└── views                       View模板
```

- 所有项目内的文件夹及文件名均采用**小写加下划线**

## 启动新项目

启动新项目的最快方法是复制[EvaSkeleton.js](https://github.com/EvaEngine/EvaSkeleton.js)代码进行修改。

## 环境变量

项目默认支持的环境变量有

- `PORT`: Web App启动所占用端口
- `NODE_ENV`: Node环境, 可选项为 `production` 生产环境, `development` 开发环境, `test` 测试环境, `ci` CI
- `LOG_LEVEL`: Log等级, 可选项为 `error`, `warn`, `info`, `verbose`, `debug`


## Build in NPM Script:

项目默认会有以下NPM Scripts:

- `npm run dev`    启动开发环境Web, 端口默认为3000, 如想更换端口可使用 `PORT=3001 npm run dev`
- `npm start`      启动生产环境Web, 需要确保已经运行过`npm run build`
- `npm run build`  将代码编译为Node可运行版本
- `npm test`       运行单元测试并生成单元测试报告
- `npm run ava`    仅运行单元测试
- `npm run lint`   运行代码规范检查
- `npm run swagger`生成API文档

## Makefile

考虑到非Node语言的兼容,项目的构建统一使用`make`。 项目默认会有以下指令:

- `make pre-build` 可选, 安装项目全局依赖
- `make build` 必须, 构建项目

或者可以用Docker构建

- `make docker-pre-build` 从源代码构建Docker镜像
- `make docker-build`     运行Docker镜像构建项目
- `make docker-up`  通过docker-compose编排启动项目

## 代码规范

代码规范遵守[Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)


## 配置文件

配置文件在DI加载时会做三层合并

- config.default.js
    - config.development.js
        - config.local.development.js

说明:

- config.default 负责维持配置文件的数据结构, 优先级最低, 进入代码库
- config.[development|test|production] 负责不同环境的差异化配置,生产环境部分不涉及安全的配置可以放在这里, 进入代码库
- config.local.[development|test|production]  优先级最高, 定义在此文件中的key会成为最终配置, 不进入代码库

## 测试

单元测试基于[ava](https://github.com/avajs/ava)

建议单元测试目录下保持与`src`目录下完全一致的目录结构,测试文件与源代码文件一一对应

## API规范

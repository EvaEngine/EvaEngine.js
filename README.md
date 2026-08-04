# EvaEngine for Node.js

[![NPM version](https://img.shields.io/npm/v/evaengine.svg?style=flat-square)](http://badge.fury.io/js/evaengine)
[![CI](https://github.com/EvaEngine/EvaEngine.js/actions/workflows/ci.yml/badge.svg)](https://github.com/EvaEngine/EvaEngine.js/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/EvaEngine/EvaEngine.js/branch/master/graph/badge.svg)](https://codecov.io/gh/EvaEngine/EvaEngine.js)
[![npm](https://img.shields.io/npm/dm/evaengine.svg?maxAge=2592000)](https://www.npmjs.com/package/evaengine)
[![License](https://img.shields.io/npm/l/evaengine.svg?maxAge=2592000?style=plastic)](https://github.com/EvaEngine/EvaEngine.js/blob/master/LICENSE)

EvaEngine is a lightweight Node.js microservice development engine. It gives you dependency injection, middleware, CLI commands, scheduled jobs, session and auth helpers, cache support, Swagger generation, and a simple way to structure services.

## Requirements

- Node.js 24 or newer
- npm

## Install

For a new project:

```bash
npm install evaengine
```

For local development of this repository:

```bash
git clone https://github.com/EvaEngine/EvaEngine.js.git
cd EvaEngine.js
npm install
```

## Quick Start

### Run as a web server

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

Then open http://localhost:3000.

### Run as a CLI app

```js
import { EvaEngine } from 'evaengine';
import * as UserCommands from './commands/user.js';

const engine = new EvaEngine({
  projectRoot: process.cwd()
}, 'cli');

engine.registerCommands(UserCommands);

await engine.runCLI();
```

### Run as a cron job

```js
import { EvaEngine } from 'evaengine';
import * as HelloWorldCommands from './commands/hello_world.js';

const engine = new EvaEngine({
  projectRoot: process.cwd()
}, 'cli');

engine.registerCommands([HelloWorldCommands]);
engine.runCrontab('0/10 * * * * *', 'hello:world --id=EvaEngine');
```

## Common Commands

```bash
npm run lint
npm run build
npm test
```

## Environment Variables

Common variables include:

- `NODE_ENV`
- `PORT`
- `LOG_LEVEL`
- `CLI_NAME`
- `MAX_REQUEST_DEBUG_BODY`
- `SEQUELIZE_REPLICATION_CONFIG_KEY`

## Generate entities

```bash
./node_modules/.bin/engine make:entity
./node_modules/.bin/engine make:dbview
```

## Start from a skeleton project

If you want a ready-made starting point, use the skeleton repository:

- [EvaSkeleton.js](https://github.com/EvaEngine/EvaSkeleton.js)

For project conventions and setup guidance, see [docs/new_project_guide.md](docs/new_project_guide.md).

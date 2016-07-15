# EvaEngine For Node

[![NPM version](https://img.shields.io/npm/v/evaengine.svg?style=flat-square)](http://badge.fury.io/js/evaengine)
[![Build Status](https://travis-ci.org/EvaEngine/EvaEngine.js.svg?branch=master)](https://travis-ci.org/EvaEngine/EvaEngine.js)
[![Dependencies Status](https://david-dm.org/EvaEngine/EvaEngine.js.svg)](https://david-dm.org/EvaEngine/EvaEngine.js)
[![codecov](https://codecov.io/gh/EvaEngine/EvaEngine.js/branch/master/graph/badge.svg)](https://codecov.io/gh/EvaEngine/EvaEngine.js)

A development engine for NodeJS.

- Full DI support (Inject by ES7 decorators as well)
- ES7 Async & Await support
- CLI mode support
- Better exceptions design
- Swagger document generator


## Quick Start

Clone this skeleton project to quick start:

[EvaSkeleton.js](https://github.com/EvaEngine/EvaSkeleton.js)

- [项目规范(中文版)](docs/new_project_guide.md)

### Run as web server

``` js
import { EvaEngine } from 'evaengine';

const engine = new EvaEngine({
  projectRoot: `${__dirname}/..`,
  port: 3000
});

engine.bootstrap();
engine.use('/', (req, res) => {
  res.json({ hello: 'world' });
});
engine.run();
```

Then visit `http://localhost:3000` to view API.

### Run as CLI

``` js
import { EvaEngine } from 'evaengine';
import * as UserCommands from './commands/user';
const engine = new EvaEngine({
  projectRoot: `${__dirname}/..`
}, 'cli');
engine.registerCommands(UserCommands);
(async() => {
    await engine.runCLI();
})();
```

### Run as Cron Job

``` js
import { EvaEngine } from 'evaengine';
import * as HelloWorldCommands from './commands/hello_world';

const engine = new EvaEngine({
  projectRoot: `${__dirname}/..`
}, 'cli');
engine.registerCommands([
  HelloWorldCommands
]);

engine.runCrontab('0/10 * * * * *', 'hello:world --id=EvaEngine');
```

## Swagger Support

Process as follow:

- ES7 Files =(Babel)=> 
- ES5 Files =(acorn)=> 
- AST =(filter)=> 
- Annotations =(doctrine)=>
- JsDocs =(convert)=> 
- Fragments + EvaEngine Exceptions + Sequelize Models =(Merge & Compile)=>
- Swagger Specification JSON File


## Debug with Projects

```
cd EvaNode
npm link
cd your_project
npm link evaengine
```


## TODO

- [ ] log format uniform
- [ ] CLI list all available commands
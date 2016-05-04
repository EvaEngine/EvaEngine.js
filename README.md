# EvaEngine For Node

[![NPM version](https://img.shields.io/npm/v/evaengine.svg?style=flat-square)](http://badge.fury.io/js/evaengine)
[![Build Status](https://travis-ci.org/EvaEngine/EvaNode.svg?branch=master)](https://travis-ci.org/EvaEngine/EvaNode)
[![Dependencies Status](https://david-dm.org/EvaEngine/EvaNode.svg)](https://david-dm.org/EvaEngine/EvaNode)
[![Coverage Status](https://coveralls.io/repos/github/EvaEngine/EvaNode/badge.svg?branch=master)](https://coveralls.io/github/EvaEngine/EvaNode?branch=master)

A development engine for NodeJS.

- Full DI support (Inject by ES7 decorators as well)
- ES7 Async & Await support
- Better exceptions design
- Swagger document generator


## Quick Start

### Run as web server

``` js
import EvaEngine from 'evaengine/src/engine';
const engine = new EvaEngine({
  projectRoot: `${__dirname}/..`,
  port: process.env.PORT || 3000
});
engine.bootstrap();
engine.use('/', 
  (req, res) => { res.json({ hello => 'world'}); });
engine.run();
```

### Run as CLI

```
import EvaEngine from 'evaengine/src/engine';
const engine = new EvaEngine({
  projectRoot: `${__dirname}/..`,
  commandRoot: `${__dirname}/commands`,
}, 'cli');
engine.run();
```

### Run as Cron job


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
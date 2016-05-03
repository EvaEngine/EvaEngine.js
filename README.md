# EvaEngine For Node

[![Build Status](https://travis-ci.org/EvaEngine/EvaNode.svg?branch=master)](https://travis-ci.org/EvaEngine/EvaNode)

A development engine for NodeJS.



## Quick Start

``` js
import EvaEngine from 'evaengine/src/engine';
const engine = new EvaEngine({
  projectRoot: `${__dirname}/..`,
  port: process.env.PORT || 3000
});

engine.bootstrap();
EvaEngine.getApp().use('/', 
  (req, res) => { res.json({ hello => 'world'}); });
engine.run();
```

## Swagger Support

ES7 Files =(Babel)=> ES5 Files =(acorn)=> AST =(doctrine)=> Annotations + EvaEngine Exceptions + Sequelize Models =(Merge & Compile)=> Swagger Specification JSON File


## Debug with Projects

```
cd EvaNode
npm link
cd your_project
npm link evaengine
```
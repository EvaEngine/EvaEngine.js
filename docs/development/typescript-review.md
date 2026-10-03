# TypeScript 重写 Review

审查日期：2026-10-02。基线：`33f8e4f3b41bdec6fcd7808c44905282aea7de86`；审查版本：`c2d69ca2b75c8d1f1363d42a507afaf76001305e`。

范围为 `8c4030b`、`fbc20da`、`cb962bb`、`c2d69ca` 四个提交，涵盖 128 个文件：源码和测试的 TS 改写、声明生成、包入口、CLI、发布工作流与文档。开始审查时工作区干净。本次仅新增本报告，未修复实现、提交、发布或修改其他仓库。

## 审查结论

运行时迁移的基本路径通过验证，但目前不能认为“严格模式下类型开箱即用”和“发布产物可可靠重建”已经成立。发现 **7 个已复现问题：3 个 P1、4 个 P2**。建议先处理包构建入口、DI 中间件与实体类型，再验收发布物。

P1 表示应优先修复：影响包可用性或主要 TS 消费路径；P2 表示特定开发路径失效或公共类型契约缺损。这里的类型问题不表示现有 JavaScript 消费方必然发生运行时回归。

| 编号 | 优先级 | 问题 | 影响 |
|---|---|---|---|
| R1 | P1 | 打包生命周期不构建 dist | 干净 checkout 可打出入口不存在的包；已有 dist 可被陈旧发布 |
| R2 | P1 | DI 缺少内置中间件类型 | README 的标准中间件调用在 strict 下报错 |
| R3 | P1 | Entities 返回类型丢失 ORM 能力 | `get/getAll` 无法调用正常 Sequelize 查询方法 |
| R4 | P2 | Engine.use 使用 unknown[] | 路由回调无参数推导，且错误参数也能通过编译 |
| R5 | P2 | getCommand 只暴露 run | 丢失基础 Command 的 getArgv/getOptions |
| R6 | P2 | 源码态 Swagger 漏掉内置分页定义 | 源码与 dist 生成不同的文档，可能产生悬空引用 |
| R7 | P2 | 增量缓存使缺失产物无法重建 | 移走 dist 后正式 build 报 ENOENT |

## 验证证据与边界

本机 Node 为 `v24.18.0`；使用仓库 lockfile、现有 npm 工具链和本机可访问的 Redis。没有升级依赖或改变服务配置。

| 检查 | 结果 | 能证明的范围 |
|---|---|---|
| `npm run ci:check` | 通过 | lint（该次评审时为 ESLint）与发布源码编译、声明后处理通过 |
| `npm test` | 145 tests，145 pass，0 fail | 现有源码态回归用例通过；总行覆盖率 79.53% |
| `npx tsc --noEmit -p tsconfig.json` | 通过 | 当前 src 与 test 的静态检查通过 |
| 构建后 pack，再在隔离项目仅安装生产依赖 | 通过 | dist、声明、template、bin 实际进入包 |
| 隔离项目 strict/NodeNext，skipLibCheck=false，仅导入 evaengine | 通过 | 入口声明与依赖可解析；未发现简单导入即报错的问题 |
| 同一隔离项目使用公共 API | 12 个编译错误 | R2—R5：真实消费接口类型不完整 |
| 源码与安装包分别运行 Web/CLI 冒烟 | 均通过 | HTTP health、trace 工厂、401 异常映射、runCommand 参数传递 |
| 源码与安装包分别生成 Swagger | 定义集合不同 | R6 |
| 干净归档直接 npm pack | 成功，但无 dist | R1；不是 pack 命令失败，而是成功生成不可用包 |
| 隔离 checkout npm ci 后 build，移走 dist，再 build | 首次成功、第二次失败 | R7；已排除依赖软链接造成的编译干扰 |

审查对所有对应的 `src/**/*.ts` 与基线 JS 做了编译后结构比较，再检查类型、路径与副作用；比较时剔除了注释、类型和无初始化的字段声明，因此这项辅助比较本身不证明所有 JS 行为等价。另行检查了类字段、加载机制、异常、DI、Provider、HTTP client、缓存、namespace、cron、实体扫描、代码生成和 Swagger 路径。

没有连接真实 MySQL 执行 SQL、运行真实 Kong/Spring Config 集成、生成生产数据库对应的实体，或实际执行 semantic-release/npm publish。CI/发布平台状态不在本报告的实测范围。

## R1：打包生命周期缺少构建 [P1]

位置：[package.json](../../package.json#L11)、[.npmignore](../../.npmignore)、[release workflow](../../.github/workflows/release.yml#L37)。

`main/types/bin` 已改为依赖 dist，dist 又不进 Git；但 scripts 没有 `prepack`、`prepare` 或其他打包构建钩子。`prepublish` 只有测试，不能保证编译产物存在或最新。发布 workflow 的显式 Build 保护了这条 CI 路径，不能保护单独 pack、手工 publish 或 Git 来源的安装路径。

实测将 HEAD 用 `git archive` 放入隔离目录，未手动 build，直接运行正常的 `npm pack --json`。命令成功，文件仅包含 LICENSE、README、bin/engine、package.json 和三个模板，**没有任何 dist 文件**。按包入口导入时得到 `ERR_MODULE_NOT_FOUND`，缺失目标为 `evaengine/dist/index.js`。

已有 dist 时还有另一种触发条件：修改源码后直接打包，npm 不会更新旧 JS/声明；因此“pack 成功”不能证明包对应当前源码。

建议：将正式打包收敛到构建钩子，例如 `prepack` 调用可重建产物的 build；如明确支持 Git 安装，再保证其安装生命周期也能生成 dist。应结合 R7 处理缓存，不能只追加一个仍依赖旧缓存的钩子。

验收：干净 checkout 经过安装后直接 pack，包内入口完整；源码变更后直接 pack，安装包呈现新行为；将 tarball 安装进隔离消费者，分别验证 import、CLI 和声明编译。保持 CI 的显式验证。

## R2：DI 没有为内置中间件提供类型 [P1]

位置：[src/di.ts](../../src/di.ts#L58)、[middleware providers](../../src/middlewares/providers.ts)。

`DI.get` 对 env/config/logger 等内置 service 提供了专门 overload，却没有覆盖 `trace/session/auth/debug/validator/view_cache`。这些名字全部落到 `get<T = unknown>(name: string): T`，返回 unknown，无法调用工厂。

从实际 tarball 导入后，下列 README 契约在 strict 下得到 `TS2571: Object is of type 'unknown'`：

```ts
import eva from 'evaengine';
const { EvaEngine, DI } = eva;
const engine = new EvaEngine({ projectRoot: process.cwd() });
engine.use(DI.get('trace')());
engine.use(DI.get('session')());
engine.use(DI.get('auth')());
engine.use('/items', DI.get('validator')(() => ({
  query: eva.Joi.object({ page: eva.Joi.number() })
})), eva.wrapper(async (_req, res) => { res.json({ ok: true }); }));
```

仓库测试用 `as () => RequestHandler` 等断言绕开了相同问题，所以源码测试及全项目 tsc 通过不能替代消费方验收。

建议：复用各内置 middleware factory 的实际返回类型补齐 DI 的固定名称映射，准确保留 validator 的高阶工厂形状和 auth provider 的替换机制。自定义服务仍可使用泛型或扩展类型，不应要求内置 API 用户手写断言。

验收：README 的中间件例子作为独立 TS 消费者，在 strict、skipLibCheck=false 下直接编译通过；错误工厂参数能够报错。

## R3：Entities 返回类型丢失 ORM 公共能力 [P1]

位置：[src/entities/index.ts](../../src/entities/index.ts#L53)、[get/getAll](../../src/entities/index.ts#L279)、[getSequelize](../../src/entities/index.ts#L269)。

新 `EntityModel` 只有 name 和可选 associate；`get/getAll` 将所有加载到的 Sequelize Model 固定成这个最小结构。消费方无法使用 README 展示的核心查询路径，也无法通过泛型参数指定自己的模型类型。

独立消费者实测：

```ts
const entities = new eva.Entities('/tmp/entities');
entities.get('user').findAll();     // TS2339
entities.getAll().user.findByPk(1); // TS2339
```

`getSequelize(): typeof Sequelize` 还有相邻的运行时/类型不一致：返回的运行时类具有 DataTypes、Op 等属性，而上游该具名 class 声明没有暴露它们。`entities.getSequelize().DataTypes.STRING` 与 `.Op.ne` 均得到 TS2339。本次没有观察到具名导入引起运行时类身份变化。

建议：基础模型类型至少复用 Sequelize 的 ModelStatic/Model，并支持消费方模型注册表或泛型返回类型；额外 associate 作为真实扩展表达。getSequelize 应准确表达实际返回的兼容入口。不要把“扫描实现只读 name”当成“消费方只能读 name”。

验收：从安装包获取模型后，findAll/findByPk/create 及 association 能力能编译；具体模型属性可由消费方保留；getSequelize 的 DataTypes/Op/QueryTypes 与运行时一致。实际数据库查询还需另行集成验证。

## R4：Engine.use 丢失 Express 参数推导和校验 [P2]

位置：[src/engine.ts](../../src/engine.ts#L420)。

`use(...args: unknown[])` 只在实现内部断言为 Express 参数，发布的声明仍是 unknown[]。类型断言不会传递到调用点。

严格消费者的正常写法报两个 TS7006：

```ts
engine.use('/health', (req, res) => {
  res.json({ method: req.method });
});
```

相反，`engine.use(123)` 可以通过该签名的编译，却不符合 Express 的中间件契约。这同时损失了开发便利和错误检查。

建议：复用 Express use 的公共重载契约，保留路径、普通/错误处理器、处理器数组等有效组合。仅取重载函数的 `Parameters` 最后一个签名可能丢失合法重载，修复时需要验证这些组合。

验收：常见路由及错误处理回调自动推导参数；合法的 Router/数组调用通过；数字或无效处理器在编译时报错。

## R5：getCommand 丢失基础 Command 接口 [P2]

位置：[src/engine.ts](../../src/engine.ts#L40)、[getCommand](../../src/engine.ts#L284)、[test/engine.ts](../../test/engine.ts#L104)。

`CommandInstance` 仅含 run，导致 getCommand/getCommands 的类型视图不包含基类 Command 的 getArgv/getOptions/setOptions 等方法。即使已处理 null，仍无法调用这些基础接口：

```ts
engine.getCommand()?.getArgv();    // TS2339
engine.getCommand()?.getOptions(); // TS2339
```

测试将返回值断言为 TestCommand 后继续检查，掩盖了此公共声明缺损。业务子类扩展方法需要额外类型信息可以接受，但基础 Command 方法不应丢失。

建议：表达实际基础 Command 契约，并根据是否继续支持仅提供 run 的结构化命令选择适当的重载/泛型；避免为内部调用便利将公共返回类型永久收窄。

验收：基础 Command 的调用无需断言；注册后的业务子类可通过显式类型信息保留其扩展方法；若支持结构化命令，保留该既有路径。

## R6：源码态 Swagger 静默遗漏内置分页定义 [P2]

位置：[src/swagger/index.ts](../../src/swagger/index.ts#L676)、[src/utils/pagination.ts](../../src/utils/pagination.ts#L77)。

默认 extraSourcePaths 仍为 `../utils/**/*.js`。TS 重写删除了该位置的 JS 文件，源码态扫描得到空列表，漏掉 pagination.ts 中的 Pagination/PaginationSnake 注解。dist 中有 JS，所以安装包路径正常。它违反了文档对源码态直接运行的预期，而且失败是静默的。

使用相同 `_example` 夹具和空 definitions/paths 模板分别调用源文件与安装包的 exportJson，得到：

```text
source: PriceEstimate, LogicException, Error
dist:   PaginationSnake, Pagination, PriceEstimate, LogicException, Error
```

如果业务注解引用内置分页 schema，源码产物就可能保留 `$ref` 却没有对应 definition。现有 Swagger 用例验证了 LogicException，未断言分页定义。

不能只把 glob 改成 `.ts`：实测 Acorn 直接解析 pagination.ts 报 `Unexpected token (9:5)`，对应 TS type 声明。

建议：明确同一套注解管线如何支持源码态和发布态，例如利用可擦除 TS 语法的解析前处理保留注释，或让正式生成路径明确使用构建产物并同步开发契约。复用既有管线，避免维护两套分页 schema。

验收：两个运行模式输出包含相同内置定义；引用 Pagination/PaginationSnake 的路由不存在悬空引用；若调整开发要求，README 与正式入口同步说明。

## R7：增量缓存阻止缺失 dist 的重建 [P2]

位置：[tsconfig.build.json](../../tsconfig.build.json#L7)、[scripts/rewrite-dts.mjs](../../scripts/rewrite-dts.mjs#L28)。

build 使用位于 node_modules/.cache 的 tsbuildinfo。源文件未变化时，tsc 可以依据缓存跳过发射，即使 dist 已不存在；随后 rewrite-dts 无条件扫描 dist，抛出 ENOENT。

在隔离的真实 npm ci 安装中，首次 `npm run build` 成功。将 dist 移为 built-dist、保留缓存，再执行相同 build，tsc 阶段结束后后处理报 `ENOENT: scandir .../dist`。没有删除用户工作区产物。

在一次性 checkout 中可用以下单行命令复现（built-dist 名称应未被使用）：

```bash
npm run build && mv dist built-dist && npm run build
```

建议：正式发布构建提供确定的全量重建路径，或在输出缺失时正确失效缓存。仅让后处理忽略 ENOENT 会掩盖缺失 JS，不能修复包。还应避免输出目录保留已经删除源码对应的陈旧文件。

验收：首次构建、重复构建、移走输出后构建都成功；删除/重命名源码后的 tarball 不包含废弃模块；结合 R1 验证实际安装包。

## 已有问题与验证缺口（不计入 7 项新增问题）

以下现象在基线已存在，不能归因于本次 TS 重写：

- `NsStore.active()` 将 CLS 的 active 属性作为函数调用；新实现通过双重断言保留它。类型检查发现的语义冲突应登记为既有缺陷，而不是用断言解释为已经安全。本报告仅比较了基线和新代码，未扩展验证所有 CLS 异步/事务路径。
- HTTP request client 收到响应头就清除 timeout，之后才 `response.text()`；响应体读取不受该计时器完整覆盖。基线顺序相同，没有进行慢速响应体专项实测。
- CLI 捕获错误后没有设置失败退出状态。新的 src/bin.ts 继承了旧 bin 的 catch/finally 行为；本次修复了旧 bin 的导入入口，不等于失败状态已正确。
- README 展示 `getTransaction(async callback)`，实现仍把参数作为 options 合并并创建非托管事务；新 TransactionOptions 类型会拒绝该文档写法。文档与实现的矛盾在基线已有，不应以新增 callback 支持来静默改变事务语义。

当前 CI 运行源码态测试，pack 检查也只是 dry-run；不会将实际 tarball 安装到 TS/JS 消费者。build tsconfig 只包含 src，原生 Node test 又擦除类型，CI 没有独立运行包含 test 的完整 tsconfig 检查。本次手动检查通过，但这项检查尚未成为正式门禁。

部分维护者文档仍保留旧发布清单与 `.js` 测试路径，例如 operations/release.md 的 `src/**`、`index.js` 发布描述。应按最终发布契约同步；这些文档过期不等于实际 tarball 仍包含旧入口。

## 修复后的验收顺序

1. 修复 R1/R7，验证干净打包、重建和安装后的真实入口。
2. 修复 R2/R3/R4/R5，以 README 和标准 ORM/Command 用法建立独立的 strict 消费者编译门禁，避免用测试断言替代契约。
3. 修复 R6，断言源码/发布态内置 schema 完整和 `$ref` 可解析。
4. 重跑 lint、完整 tsc、145 个现有测试和安装包冒烟；同步与最终行为不一致的文档。
5. MySQL、CLS 事务、Kong、Spring Config 和真实发布仍需各自的集成验收，不能由上述绿灯推断已经验证。

---
title: "审查 r05：tooling"
type: reference
status: draft
phase: N/A
updated: 2026-09-30
summary: "浏览器单测会把模块加载失败和页面崩溃当成通过，文件接口不限制仓库路径；增量构建不随 workbench 源码重写扩展点清单；Node 单测吞掉未处理异常后仍以 0 退出。"
---

# 发现

## r05-1 高

- 症状：浏览器单测页调用 `__readFileInTests`、`__writeFileInTests`、`__unlinkInTests` 或 `__mkdirPInTests` 时，路径字符串里没有本次随机 URL 前缀就会按原路径读、写、删或建目录。传入仓库外绝对路径，或在前缀后面接上 `..`，会改到仓库外面的文件。
- 位置：`test/unit/browser/index.js` 第 208–225 行
- 引用：

```
208|		function massagePath(p) {
209|			// TODO@jrieken FISHY but it enables snapshot
210|			// in ESM browser tests
211|			p = String(p).replace(/\\/g, '/').replace(prefix, rootDir);
212|			return p;
213|		}
214|
215|		switch (request.url) {
216|			case '/remoteMethod/__readFileInTests':
217|				return remoteMethod(request, response, p => fs.promises.readFile(massagePath(p), 'utf-8'));
218|			case '/remoteMethod/__writeFileInTests':
219|				return remoteMethod(request, response, (p, contents) => fs.promises.writeFile(massagePath(p), contents));
220|			case '/remoteMethod/__readDirInTests':
221|				return remoteMethod(request, response, p => fs.promises.readdir(massagePath(p)));
222|			case '/remoteMethod/__unlinkInTests':
223|				return remoteMethod(request, response, p => fs.promises.unlink(massagePath(p)));
224|			case '/remoteMethod/__mkdirPInTests':
225|				return remoteMethod(request, response, p => fs.promises.mkdir(massagePath(p), { recursive: true }));
```

- 为什么是问题：`massagePath` 只把路径里的随机前缀换成 `rootDir`，替换结果和未命中前缀的原路径都直接交给 `fs`。`__unlinkInTests` 与 `__writeFileInTests` 因此可以删除或覆盖仓库外的文件。
- 方向：规范化路径后，拒绝落在仓库根以外的目标。

## r05-2 中

- 症状：浏览器单测动态 `import` 失败时，该文件被换成空模块继续跑。只跑这一个坏文件，或其余用例都通过时，进程以 0 退出。
- 位置：`test/unit/browser/renderer.html` 第 237–240 行
- 引用：

```
237|				const m = await new Promise((resolve, reject) => import(`../../../${out}/${file}.js`).then(resolve, err => {
238|					console.log("BAD " + file + JSON.stringify(err, undefined, '\t'));
239|					resolve({});
240|				}));
```

- 为什么是问题：失败分支调用 `resolve({})`，该文件里的用例不会注册，也不会发出 fail。同文件第 278 行 `mocha.run(failCount => resolve(failCount === 0))` 在零个失败时仍当作成功；`test/unit/browser/index.js` 第 319–327 行只在 `failingTests` 非空时返回失败信息。
- 方向：模块加载失败应记入失败，并让进程以非 0 退出。

## r05-3 中

- 症状：浏览器单测在 `page.evaluate` 期间页面崩溃，或 `loadAndRun` 抛错时，错误只打印到控制台。当时还没有失败用例的话，整次运行以退出码 0 结束。
- 位置：`test/unit/browser/index.js` 第 305–327 行
- 引用：

```
305|	try {
306|		// @ts-expect-error
307|		await page.evaluate(opts => loadAndRun(opts), {
308|			modules: testModules,
309|			grep: args.grep,
310|		});
311|	} catch (err) {
312|		console.error(err);
313|	}
314|	if (!isDebug) {
315|		server?.dispose();
316|		await browser.close();
317|	}
318|
319|	if (failingTests.length > 0) {
320|		let res = `The followings tests are failing:\n - ${failingTests.map(({ title, message }) => `${title} (reason: ${message})`).join('\n - ')}`;
321|
322|		if (failingModuleIds.length > 0) {
323|			res += `\n\nTo DEBUG, open ${browserType.toUpperCase()} and navigate to ${target.href}?${failingModuleIds.map(module => `m=${module}`).join('&')}`;
324|		}
325|
326|		return `${res}\n`;
327|	}
```

- 为什么是问题：`catch` 吃掉异常后函数返回 `undefined`。同文件第 412–419 行只把非空返回值当成失败，随后 `process.exit(didFail ? 1 : 0)`，这次运行就是通过。
- 方向：`page.evaluate` 失败时应返回失败信息，或直接以非 0 退出。

## r05-4 中

- 症状：增量 `build-fast` 在修改了 `src/vs/workbench/**/*.ts` 里的 `registerExtensionPoint` 之后，不会重跑 `compile-extension-point-names`。`extensionPoints.json` 仍是旧列表：新扩展点进不了清单，已删除的扩展点还会留着。
- 位置：`build/next/build-fast.ts` 第 149–157 行
- 引用：

```
149|export function createBuildFastPrerequisites(fullBuild: boolean, changedPaths: readonly string[]): BuildFastPrerequisites {
150|	const apiProposalsChanged = changedPaths.some(filePath => filePath.startsWith('src/vscode-dts/') || filePath === API_PROPOSALS_OUTPUT);
151|	const extensionPointsOutputChanged = changedPaths.includes(EXTENSION_POINTS_OUTPUT);
152|	const tasks = fullBuild
153|		? ['copy-codicons', 'compile-api-proposal-names', 'compile-extension-point-names']
154|		: [
155|			...(apiProposalsChanged ? ['compile-api-proposal-names'] : []),
156|			...(extensionPointsOutputChanged ? ['compile-extension-point-names'] : []),
157|		];
```

- 为什么是问题：非全量时，这个任务只在变更列表里已经有第 19 行的 `extensionPoints.json` 时才加入。同一轮里 `src/` 变更只把 client 标成 incremental（第 214–216 行），转译改过的 ts，不会生成这份 json。生成任务的输入是 `build/lib/compilation.ts` 第 406 行的 `src/vs/workbench/**/*.ts`。
- 方向：workbench 下的 ts 变更应触发 `compile-extension-point-names`。

## r05-5 中

- 症状：Node 单测出现未捕获异常或未处理的 Promise 拒绝时，运行器只把堆栈打到控制台。mocha 没有失败用例时，进程仍以 0 退出。
- 位置：`test/unit/node/index.js` 第 121–128 行
- 引用：

```
121|	process.on('uncaughtException', function(e) {
122|		console.error(e.stack || e);
123|	});
124|
125|	process.on('unhandledRejection', function(reason) {
126|		console.error('Unhandled promise rejection:');
127|		console.error(reason && (/** @type {Error} */ (reason)).stack || reason);
128|	});
```

- 为什么是问题：这两个监听器吞掉默认的崩溃退出，也不设置失败标记。第 267 行 `runner.run(failures => process.exit(failures ? 1 : 0))` 只看 mocha 失败数。测试函数返回之后，`Promise.reject` 或 `setTimeout` 里抛出的错误不会让本次运行失败。
- 方向：把未捕获异常和未处理拒绝记入失败，并反映到退出码。

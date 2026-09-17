/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const WINDOW_REL = 'src/vs/workbench/electron-browser/window.ts';
const BROWSER_WINDOW_REL = 'src/vs/workbench/browser/window.ts';
const PROGRESS_REL = 'src/vs/platform/progress/common/progress.ts';
const DIALOGS_REL = 'src/vs/platform/dialogs/common/dialogs.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const CONTRIBUTIONS_REL = 'src/vs/workbench/common/contributions.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const WEB_FACTORY_REL = 'src/vs/workbench/browser/web.factory.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsModel.ts';
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('workbench native window leftover Promise fire-and-forget catch scan (D722)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const integrityIife = `(async () => {
			const isAdmin = await this.nativeHostService.isAdmin();
			const { isPure } = await this.integrityService.isPure();

			// Update to title
			this.titleService.updateProperties({ isPure, isAdmin });

			// Show warning message (unix only)
			if (isAdmin && !isWindows) {
				this.notificationService.warn(localize('runningAsRoot', "It is not recommended to run {0} as root user.", this.productService.nameShort));
			}
		})()`;
		const beforeShutdownProgress = `this.progressService.withProgress({
			location: ProgressLocation.Window, 	// use window progress to not be too annoying about this operation
			delay: 800,							// delay so that it only appears when operation takes a long time
			title: this.toShutdownLabel(reason, false),
		}, () => {
			return Event.toPromise(Event.any(
				this.lifecycleService.onWillShutdown, 	// dismiss this dialog when we shutdown
				this.lifecycleService.onShutdownVeto, 	// or when shutdown was vetoed
				this.dialogService.onWillShowDialog		// or when a dialog asks for input
			));
		})`;
		const shellEnvProgress = `this.progressService.withProgress({
			title: localize('resolveShellEnvironment', "Resolving shell environment..."),
			location: ProgressLocation.Window,
			delay: 1600,
			buttons: [localize('learnMore', "Learn More")]
		}, () => shellEnv, () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2149667'))`;
		const calls = [
			'this.handleWarnings()',
			integrityIife,
			'this.onOpenFiles(argsRaw[0] as IOpenFileRequest)',
			'this.trackClosedWaitFiles(filesToWait.waitMarkerFileUri, coalesce(filesToWait.paths.map(path => path.fileUri)))',
			'this.doAddRemoveFolders()',
			beforeShutdownProgress,
			`this.dialogService.error(this.toShutdownLabel(reason, true), localize('shutdownErrorDetail', "Error: {0}", toErrorMessage(error)))`,
			shellEnvProgress,
		] as const;
		assert.strictEqual(calls.length, 8);
		for (const call of calls) {
			assertDoubleThen(source, call);
		}
	});

	test('handleWarnings leftover fire-and-forget and integrity IIFE are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		assertPromiseSignature(source, 'private async handleWarnings(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.handleWarnings()');
		assertDoubleThen(source, `(async () => {
			const isAdmin = await this.nativeHostService.isAdmin();
			const { isPure } = await this.integrityService.isPure();

			// Update to title
			this.titleService.updateProperties({ isPure, isAdmin });

			// Show warning message (unix only)
			if (isAdmin && !isWindows) {
				this.notificationService.warn(localize('runningAsRoot', "It is not recommended to run {0} as root user.", this.productService.nameShort));
			}
		})()`);
	});

	test('onOpenFiles / trackClosedWaitFiles leftover fire-and-forget are Promise double-chain; returned trackClosedWaitFiles stays skipped', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		assertPromiseSignature(source, 'private async onOpenFiles(request: INativeOpenFileRequest): Promise<void> {');
		assertPromiseSignature(source, 'private async trackClosedWaitFiles(waitMarkerFile: URI, resourcesToWaitFor: URI[]): Promise<void> {');
		assertDoubleThen(source, 'this.onOpenFiles(argsRaw[0] as IOpenFileRequest)');
		assertDoubleThen(source, 'this.trackClosedWaitFiles(filesToWait.waitMarkerFileUri, coalesce(filesToWait.paths.map(path => path.fileUri)))');
		assert.ok(source.includes('return this.trackClosedWaitFiles(URI.revive(request.filesToWait.waitMarkerFileUri), coalesce(request.filesToWait.paths.map(path => URI.revive(path.fileUri))));'));
		assert.ok(!source.includes('return this.trackClosedWaitFiles(URI.revive(request.filesToWait.waitMarkerFileUri), coalesce(request.filesToWait.paths.map(path => URI.revive(path.fileUri)))).catch'));
	});

	test('doAddRemoveFolders scheduler leftover is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		assertPromiseSignature(source, 'private async doAddRemoveFolders(): Promise<void> {');
		assertDoubleThen(source, 'this.doAddRemoveFolders()');
	});

	test('withProgress leftover fire-and-forget are Promise double-chain; onWillShutdown withProgress stays skipped', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		assertPromiseSignature(progress, '): Promise<R>;');
		assert.ok(progress.includes('withProgress<R>('));
		assertDoubleThen(source, `this.progressService.withProgress({
			location: ProgressLocation.Window, 	// use window progress to not be too annoying about this operation
			delay: 800,							// delay so that it only appears when operation takes a long time
			title: this.toShutdownLabel(reason, false),
		}, () => {
			return Event.toPromise(Event.any(
				this.lifecycleService.onWillShutdown, 	// dismiss this dialog when we shutdown
				this.lifecycleService.onShutdownVeto, 	// or when shutdown was vetoed
				this.dialogService.onWillShowDialog		// or when a dialog asks for input
			));
		})`);
		assertDoubleThen(source, `this.progressService.withProgress({
			title: localize('resolveShellEnvironment', "Resolving shell environment..."),
			location: ProgressLocation.Window,
			delay: 1600,
			buttons: [localize('learnMore', "Learn More")]
		}, () => shellEnv, () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2149667'))`);
		assert.ok(source.includes(`this.progressService.withProgress({
				location: ProgressLocation.Dialog, 				// use a dialog to prevent the user from making any more interactions now`));
		assert.ok(source.includes('return Event.toPromise(this.lifecycleService.onDidShutdown); // dismiss this dialog when we actually shutdown'));
		assert.ok(source.includes(`}, () => {
				force();
			});`));
		assert.ok(!source.includes(`}, () => {
				force();
			})${doubleCatch}`));
	});

	test('dialogService.error leftover fire-and-forget is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		assertPromiseSignature(dialogs, 'error(message: string, detail?: string): Promise<void>;');
		assertDoubleThen(source, `this.dialogService.error(this.toShutdownLabel(reason, true), localize('shutdownErrorDetail', "Error: {0}", toErrorMessage(error)))`);
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / D697 Ready-Restored / workbench browser leftover stay skipped', () => {
		const nativeWindow = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const browserWindow = fs.readFileSync(resolveSource(BROWSER_WINDOW_REL), 'utf8');
		const contributions = fs.readFileSync(resolveSource(CONTRIBUTIONS_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const webFactory = fs.readFileSync(resolveSource(WEB_FACTORY_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const editorParts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');

		assert.ok(nativeWindow.includes('this.setupOpenHandlers();'));
		assert.ok(nativeWindow.includes('this.openerService.open('));
		assert.ok(!/this\.openerService\.open\([^)]*\)\.catch\(onUnexpectedError\)/.test(nativeWindow));
		assert.ok(nativeWindow.includes('async resolveExternalUri(uri: URI, options?: OpenOptions): Promise<IResolvedExternalUri | undefined> {'));
		assert.ok(!/resolveExternalUri\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(nativeWindow));
		assert.ok(nativeWindow.includes('this.lifecycleService.when(LifecyclePhase.Ready).then(() => this.nativeHostService.notifyReady()).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(nativeWindow.includes('run: () => this.nativeHostService.relaunch()'));
		assert.ok(!nativeWindow.includes('run: () => this.nativeHostService.relaunch().catch'));
		assert.ok(nativeWindow.includes('this.configurationService.updateValue(setting, false);'));
		assert.ok(!nativeWindow.includes('this.configurationService.updateValue(setting, false).catch'));

		assert.ok(browserWindow.includes('this.setupOpenHandlers();'));
		assert.ok(browserWindow.includes(')).then(async () => {'));
		assert.ok(!browserWindow.includes('onUnexpectedError'));

		assert.ok(contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase));'));
		assert.ok(!contributions.includes('lifecycleService.when(phase).then(() => this.doInstantiateByPhase(instantiationService, logService, environmentService, phase)).catch'));

		assert.ok(editorParts.includes('void editorPart.activeGroup.openEditor(defaultInput).catch(onUnexpectedError).catch(onUnexpectedError);'));

		assert.ok(webFactory.includes('new BrowserMain(domElement, options).open().then(workbench => {'));
		assert.ok(!webFactory.includes('onUnexpectedError'));

		assert.ok(breadcrumbs.includes('}).catch(err => {'));
		assert.ok(breadcrumbs.includes('onUnexpectedError(err);'));
		assert.ok(!breadcrumbs.includes(`${doubleCatch}`));

		for (const source of [nativeWindow, browserWindow, layout]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const LIFECYCLE_REL = 'src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts';
const UPDATE_IPC_REL = 'src/vs/platform/update/common/updateIpc.ts';
const UPDATE_ABS_REL = 'src/vs/platform/update/electron-main/abstractUpdateService.ts';
const UPDATE_SNAP_REL = 'src/vs/platform/update/electron-main/updateService.snap.ts';
const UPDATE_WIN32_REL = 'src/vs/platform/update/electron-main/updateService.win32.ts';
const UPDATE_IFACE_REL = 'src/vs/platform/update/common/update.ts';
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const KEYBOARD_REL = 'src/vs/platform/keyboardLayout/electron-main/keyboardLayoutMainService.ts';
const HISTORY_REL = 'src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
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

suite('platform leftover remaining Promise fire-and-forget catch scan (D700)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const files = [LIFECYCLE_REL, UPDATE_IPC_REL, UPDATE_ABS_REL, UPDATE_SNAP_REL, UPDATE_WIN32_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(files.length, 5);
		assert.strictEqual(sites, 8);
	});

	test('lifecycle leftover when Ready then is Promise double-chain; sync registerListeners stays skipped', () => {
		const source = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(source, 'when(phase: LifecycleMainPhase): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.when(LifecycleMainPhase.Ready).then(() => this.registerListeners())');
		assert.ok(source.includes('private registerListeners(): void {'));
		assert.ok(!source.includes('this.registerListeners().catch'));
	});

	test('lifecycle leftover unload CLOSE then is Promise double-chain; returned doQuit then stays skipped', () => {
		const source = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(source, 'unload(window: ICodeWindow, reason: UnloadReason): Promise<boolean /* veto */>;');
		const thenCall = `this.unload(window, UnloadReason.CLOSE).then(veto => {
				if (veto) {
					this.windowToCloseRequest.delete(windowId);
					return;
				}

				this.windowToCloseRequest.add(windowId);

				// Fire onBeforeCloseWindow before actually closing
				this.trace(\`Lifecycle#onBeforeCloseWindow.fire() - window ID \${windowId}\`);
				this._onBeforeCloseWindow.fire(window);

				// No veto, close window now
				window.close();
			})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
		assert.ok(source.includes('return this.doQuit(willRestart).then(veto => {'));
		assert.ok(!source.includes(`return this.doQuit(willRestart).then(veto => {}${doubleCatch}`));
	});

	test('updateIpc leftover _getInitialState then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(UPDATE_IPC_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		assertPromiseSignature(ipc, 'call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, `this.channel.call<State>('_getInitialState').then(state => this.state = state)`);
	});

	test('abstractUpdate leftover void overwrite / download and quit then are Promise double-chain; interval / await stay skipped', () => {
		const source = fs.readFileSync(resolveSource(UPDATE_ABS_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(UPDATE_IFACE_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(source, 'private async checkForOverwriteUpdates(explicit: boolean = false): Promise<boolean> {');
		assertPromiseSignature(iface, 'downloadUpdate(explicit: boolean): Promise<void>;');
		assertPromiseSignature(lifecycle, 'quit(willRestart?: boolean): Promise<boolean /* veto */>;');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this.checkForOverwriteUpdates()');
		assertDoubleThen(source, 'void this.downloadUpdate(false)');
		const quitThen = `this.lifecycleMainService.quit(true /* will restart */).then(vetod => {
			this.logService.trace(\`update#quitAndInstall(): after lifecycle quit() with veto: \${vetod}\`);
			if (vetod) {
				this.logService.info('update#quitAndInstall(): quit was vetoed, restoring Ready state');
				this.setState(readyState);
				return;
			}

			this.logService.trace('update#quitAndInstall(): running raw#quitAndInstall()');
			this.doQuitAndInstall();
		})`;
		assert.ok(source.includes(`${quitThen}${doubleCatch};`));
		assert.ok(!source.includes(`${quitThen};`));
		assert.ok(!source.includes(`${quitThen}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this.overwriteUpdatesCheckInterval.cancelAndSet(() => this.checkForOverwriteUpdates(), 5 * 60 * 1000);'));
		assert.ok(!source.includes('() => this.checkForOverwriteUpdates().catch(onUnexpectedError)'));
		assert.ok(source.includes('const didOverwrite = await this.checkForOverwriteUpdates(true);'));
		assert.ok(source.includes('.catch(err => {'));
	});

	test('snap leftover quit then is Promise double-chain; two-arg then stays skipped', () => {
		const source = fs.readFileSync(resolveSource(UPDATE_SNAP_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'quit(willRestart?: boolean): Promise<boolean /* veto */>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const quitThen = `this.lifecycleMainService.quit(true /* will restart */).then(vetod => {
			this.logService.trace(\`update#quitAndInstall(): after lifecycle quit() with veto: \${vetod}\`);
			if (vetod) {
				this.logService.info('update#quitAndInstall(): quit was vetoed, restoring Ready state');
				this.setState(readyState);
				return;
			}

			this.logService.trace('update#quitAndInstall(): running raw#quitAndInstall()');
			this.doQuitAndInstall();
		})`;
		assert.ok(source.includes(`${quitThen}${doubleCatch};`));
		assert.ok(!source.includes(`${quitThen};`));
		assert.ok(!source.includes(`${quitThen}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this.scheduleCheckForUpdates(30 * 1000).then(undefined, err => this.logService.error(err));'));
		assert.ok(source.includes('this.isUpdateAvailable().then(result => {'));
		assert.ok(source.includes('}, err => {'));
	});

	test('win32 leftover void checkForUpdates is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(UPDATE_WIN32_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(UPDATE_IFACE_REL), 'utf8');
		assertPromiseSignature(iface, 'checkForUpdates(explicit: boolean): Promise<void>;');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this.checkForUpdates(false)');
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / already-done stay skipped', () => {
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const updateIpc = fs.readFileSync(resolveSource(UPDATE_IPC_REL), 'utf8');
		const updateAbs = fs.readFileSync(resolveSource(UPDATE_ABS_REL), 'utf8');
		const snap = fs.readFileSync(resolveSource(UPDATE_SNAP_REL), 'utf8');
		const win32 = fs.readFileSync(resolveSource(UPDATE_WIN32_REL), 'utf8');
		const keyboard = fs.readFileSync(resolveSource(KEYBOARD_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		assert.ok(lifecycle.includes('private registerListeners(): void {'));
		assert.ok(!lifecycle.includes('this.registerListeners().catch'));
		assert.ok(keyboard.includes(`lifecycleMainService.when(LifecycleMainPhase.AfterWindowOpen).then(() => this._initialize())${doubleCatch};`));
		assert.ok(history.includes(`this.lifecycleMainService.when(LifecycleMainPhase.Eventually).then(() => this.handleWindowsJumpList())${doubleCatch};`));
		for (const source of [lifecycle, updateIpc, updateAbs, snap, win32]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('openerService.open'));
			assert.ok(!source.includes('IOpenerService'));
			assert.ok(!source.includes('then(clear,clear)'));
			assert.ok(!source.includes('githubTransport'));
		}
	});
});

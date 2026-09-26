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
const SHELL_REL = 'src/vs/platform/terminal/node/windowsShellHelper.ts';
const COMMAND_REL = 'src/vs/platform/terminal/common/capabilities/commandDetectionCapability.ts';
const AUTO_REL = 'src/vs/platform/terminal/node/terminalContrib/autoReplies/terminalAutoResponder.ts';
const CHILD_REL = 'src/vs/platform/terminal/node/childProcessMonitor.ts';
const ADDON_REL = 'src/vs/platform/terminal/common/xterm/shellIntegrationAddon.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const SCANNER_REL = 'src/vs/platform/extensionManagement/common/extensionsScannerService.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const HOVER_REL = 'src/vs/platform/hover/browser/hoverService.ts';
const HOVER_WIDGET_REL = 'src/vs/platform/hover/browser/updatableHoverWidget.ts';
const REQUEST_REL = 'src/vs/platform/terminal/common/requestStore.ts';
const PROCESS_REL = 'src/vs/platform/terminal/node/terminalProcess.ts';
const WINDOW_IMPL_REL = 'src/vs/platform/windows/electron-main/windowImpl.ts';
const WINDOWS_MAIN_REL = 'src/vs/platform/windows/electron-main/windowsMainService.ts';
const WATCHER_REL = 'src/vs/platform/extensionManagement/node/extensionsWatcher.ts';
const LANGUAGE_REL = 'src/vs/platform/languagePacks/node/languagePacks.ts';
const FILE_MANAGED_REL = 'src/vs/platform/policy/common/fileManagedSettingsIpc.ts';
const TELEMETRY_REL = 'src/vs/platform/telemetry/common/telemetryIpc.ts';

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

suite('platform terminal leftover Promise fire-and-forget catch scan (D720)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const files = [SHELL_REL, COMMAND_REL, AUTO_REL, CHILD_REL, ADDON_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(files.length, 5);
		assert.strictEqual(sites, 8);
	});

	test('windowsShellHelper leftover _startMonitoringShell / checkShell / getShellName then are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SHELL_REL), 'utf8');
		assertPromiseSignature(source, 'private async _startMonitoringShell(): Promise<void> {');
		assertPromiseSignature(source, 'async checkShell(): Promise<void> {');
		assertPromiseSignature(source, 'async getShellName(): Promise<string> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._startMonitoringShell()');
		assertDoubleThen(source, 'this.checkShell()');
		const thenCall = `this.getShellName().then(title => {
				if (generation !== this._checkShellGeneration || this._store.isDisposed) {
					return;
				}
				const type = this.getShellType(title);
				if (type !== this._shellType) {
					this._onShellTypeChanged.fire(type);
					this._onShellNameChanged.fire(title);
					this._shellType = type;
					this._shellTitle = title;
				}
			})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('commandDetection leftover _waitForCursorMove then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(COMMAND_REL), 'utf8');
		assertPromiseSignature(source, 'private _waitForCursorMove(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('this._waitForCursorMove().then(() => {'));
		assert.ok(source.includes(`			})${doubleCatch};`));
		assert.ok(!source.includes('this._waitForCursorMove().then(() => {') || source.includes(`${doubleCatch};`));
		assert.ok(!source.includes(`this._waitForCursorMove().then(() => {}${doubleCatch}`));
		assert.strictEqual((source.match(/this\._waitForCursorMove\(\)\.then/g) ?? []).length, 1);
		assert.ok(!source.includes('this._waitForCursorMove().then(() => {\n				// Calculate the number of lines the content may have shifted, this will max out at\n				// scrollback count since the standard behavior will be used then\n				const potentialShiftedLineCount = Math.min(rowsDifference, baseY);\n				// For each command within the viewport, assume commands are in the correct order\n				for (let i = this._capability.commands.length - 1; i >= 0; i--) {\n					const command = this._capability.commands[i];\n					if (!command.marker || command.marker.line < baseY || command.commandStartLineContent === undefined) {\n						break;\n					}\n					const line = this._terminal.buffer.active.getLine(command.marker.line);\n					if (!line || line.translateToString(true) === command.commandStartLineContent) {\n						continue;\n					}\n					const shiftedY = command.marker.line - potentialShiftedLineCount;\n					const shiftedLine = this._terminal.buffer.active.getLine(shiftedY);\n					if (shiftedLine?.translateToString(true) !== command.commandStartLineContent) {\n						continue;\n					}\n					// HACK: xterm.js doesn\'t expose this by design as it\'s an internal core\n					// function an embedder could easily do damage with. Additionally, this\n					// can\'t really be upstreamed since the event relies on shell integration to\n					// verify the shifting is necessary.\n					interface IXtermWithCore extends Terminal {\n						_core: {\n							_bufferService: {\n								buffer: {\n									lines: {\n										onDeleteEmitter: {\n											fire(data: { index: number; amount: number }): void;\n										};\n									};\n								};\n							};\n						};\n					}\n					(this._terminal as IXtermWithCore)._core._bufferService.buffer.lines.onDeleteEmitter.fire({\n						index: this._terminal.buffer.active.baseY,\n						amount: potentialShiftedLineCount\n					});\n				}\n			});'));
	});

	test('autoResponder leftover timeout then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(AUTO_REL), 'utf8');
		const asyncSrc = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSrc, 'export function timeout(millis: number): CancelablePromise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'timeout(1000).then(() => this._throttled = false)');
	});

	test('childProcessMonitor leftover _refreshActive fire-and-forgets are Promise double-chain; sync handleInput / _refreshInactive stay skipped', () => {
		const source = fs.readFileSync(resolveSource(CHILD_REL), 'utf8');
		assertPromiseSignature(source, 'private async _refreshActive(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(source.includes('handleInput() {'));
		assert.ok(source.includes('private _refreshInactive(): void {'));
		assertDoubleThen(source, 'this._refreshActive()');
		assert.strictEqual((source.match(/this\._refreshActive\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(!source.includes('this._refreshActive();'));
		assert.ok(!source.includes('this.handleInput().catch'));
		assert.ok(!source.includes('this._refreshInactive().catch'));
	});

	test('shellIntegration leftover _ensureCapabilitiesOrAddFailureTelemetry is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ADDON_REL), 'utf8');
		assertPromiseSignature(source, 'private async _ensureCapabilitiesOrAddFailureTelemetry(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._ensureCapabilitiesOrAddFailureTelemetry()');
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / assigned then / already-done / windows electron-main stay skipped', () => {
		const shell = fs.readFileSync(resolveSource(SHELL_REL), 'utf8');
		const command = fs.readFileSync(resolveSource(COMMAND_REL), 'utf8');
		const auto = fs.readFileSync(resolveSource(AUTO_REL), 'utf8');
		const child = fs.readFileSync(resolveSource(CHILD_REL), 'utf8');
		const addon = fs.readFileSync(resolveSource(ADDON_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const hoverWidget = fs.readFileSync(resolveSource(HOVER_WIDGET_REL), 'utf8');
		const request = fs.readFileSync(resolveSource(REQUEST_REL), 'utf8');
		const processSrc = fs.readFileSync(resolveSource(PROCESS_REL), 'utf8');
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_IMPL_REL), 'utf8');
		const windowsMain = fs.readFileSync(resolveSource(WINDOWS_MAIN_REL), 'utf8');
		const watcher = fs.readFileSync(resolveSource(WATCHER_REL), 'utf8');
		const language = fs.readFileSync(resolveSource(LANGUAGE_REL), 'utf8');
		const fileManaged = fs.readFileSync(resolveSource(FILE_MANAGED_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		assertPromiseSignature(files, 'exists(resource: URI): Promise<boolean>;');
		assert.ok(scanner.includes('this.fileService.exists(toCheck).then(exists => {'));
		assert.ok(!scanner.includes(doubleCatch));
		assert.ok(hover.includes(`timeout(delay).then(() => {
			if (hover.hover && !hover.hover.isDisposed) {
				this._currentDelayedHoverWasShown = true;
				this._showHover(hover, options);
			}
		});`));
		assert.ok(!hover.includes(doubleCatch));
		assert.ok(hoverWidget.includes('managedContent = content.markdown(token).then(resolvedContent => resolvedContent ?? content.markdownNotSupportedFallback);'));
		assert.ok(!hoverWidget.includes(doubleCatch));
		assert.ok(request.includes('timeout(this._timeout, tokenSource.token).then(() => reject(`Request ${requestId} timed out (${this._timeout}ms)`));'));
		assert.ok(!request.includes(doubleCatch));
		assert.ok(processSrc.includes('this._windowsShellHelper?.checkShell();'));
		assert.ok(!processSrc.includes(`this._windowsShellHelper?.checkShell()${doubleCatch}`));
		assert.ok(windowImpl.includes(`this.ready().then(() => {
				if (!token.isCancellationRequested) {
					this.send(channel, ...args);
				}
			})${doubleCatch};`));
		assert.ok(windowsMain.includes(`this.workspacesHistoryMainService.addRecentlyOpened(recents)${doubleCatch};`));
		assert.ok(watcher.includes('this.initialize().then(null, error => logService.error(\'Error while initializing Extensions Watcher\', getErrorMessage(error)));'));
		assert.ok(!watcher.includes(doubleCatch));
		assert.ok(language.includes('.then(() => this.languagePacks);'));
		assert.ok(!language.includes(doubleCatch));
		assert.ok(fileManaged.includes('const rawSnapshot = channel.call<RawManagedSettingsData>(\'getRawManagedSettings\').then(managedSettings => {'));
		assert.ok(!fileManaged.includes(doubleCatch));
		assert.ok(telemetry.includes('.then(undefined, err => `Failed to log telemetry: ${console.warn(err)}`);'));
		assert.ok(!telemetry.includes(doubleCatch));
		assert.ok(child.includes('private _refreshInactive(): void {'));
		assert.ok(!child.includes('this._refreshInactive().catch'));
		for (const source of [shell, command, auto, child, addon]) {
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

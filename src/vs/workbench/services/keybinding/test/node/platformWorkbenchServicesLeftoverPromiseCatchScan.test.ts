/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const KEYBOARD_REL = 'src/vs/platform/keyboardLayout/electron-main/keyboardLayoutMainService.ts';
const HISTORY_REL = 'src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts';
const COMMAND_REL = 'src/vs/workbench/services/commands/common/commandService.ts';
const LANGUAGE_REL = 'src/vs/workbench/services/language/common/languageService.ts';
const EDITOR_REL = 'src/vs/workbench/services/editor/browser/editorService.ts';
const SCANNER_REL = 'src/vs/workbench/services/extensionManagement/browser/webExtensionsScannerService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const KEYBINDING_REL = 'src/vs/workbench/services/keybinding/browser/keybindingService.ts';
const LIFECYCLE_MAIN_REL = 'src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const GROUPS_REL = 'src/vs/workbench/services/editor/common/editorGroupsService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
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

suite('platform/workbench services leftover Promise fire-and-forget catch scan (D696)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const keyboard = fs.readFileSync(resolveSource(KEYBOARD_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const command = fs.readFileSync(resolveSource(COMMAND_REL), 'utf8');
		const language = fs.readFileSync(resolveSource(LANGUAGE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		const calls = [
			[keyboard, 'lifecycleMainService.when(LifecycleMainPhase.AfterWindowOpen).then(() => this._initialize())'],
			[history, 'this.lifecycleMainService.when(LifecycleMainPhase.Eventually).then(() => this.handleWindowsJumpList())'],
			[command, 'this._extensionService.whenInstalledExtensionsRegistered().then(value => this._extensionHostIsReady = value)'],
			[language, `this._extensionService.whenInstalledExtensionsRegistered().then(() => {
			this.updateMime();
		})`],
			[editor, 'this.editorGroupService.whenReady.then(() => this.onEditorGroupsReady())'],
			[scanner, 'lifecycleService.when(LifecyclePhase.Eventually).then(() => this.updateCaches())'],
			[enablement, `this.extensionsManager.whenInitialized().then(() => {
			if (!isDisposed) {
				uninstallDisposable.dispose();
				this._onDidChangeExtensions([], [], false);
				this._register(this.extensionsManager.onDidChangeExtensions(({ added, removed, isProfileSwitch }) => this._onDidChangeExtensions(added, removed, isProfileSwitch)));
				this.loopCheckForMaliciousExtensions();
			}
		})`],
			[keybinding, `this.userKeybindings.initialize().then(() => {
			if (this.userKeybindings.keybindings.length) {
				this.updateResolver();
			}
		})`],
		] as const;
		assert.strictEqual(calls.length, 8);
		for (const [source, call] of calls) {
			assertDoubleThen(source, call);
		}
	});

	test('keyboardLayout leftover when AfterWindowOpen then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(KEYBOARD_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_MAIN_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecycleMainPhase): Promise<void>;');
		assertPromiseSignature(source, 'private _initialize(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'lifecycleMainService.when(LifecycleMainPhase.AfterWindowOpen).then(() => this._initialize())');
	});

	test('workspacesHistory leftover when Eventually then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_MAIN_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecycleMainPhase): Promise<void>;');
		assertPromiseSignature(source, 'private async handleWindowsJumpList(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.lifecycleMainService.when(LifecycleMainPhase.Eventually).then(() => this.handleWindowsJumpList())');
	});

	test('command leftover whenInstalledExtensionsRegistered then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(COMMAND_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._extensionService.whenInstalledExtensionsRegistered().then(value => this._extensionHostIsReady = value)');
	});

	test('language leftover whenInstalledExtensionsRegistered then is Promise double-chain; sync updateMime stays skipped', () => {
		const source = fs.readFileSync(resolveSource(LANGUAGE_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this._extensionService.whenInstalledExtensionsRegistered().then(() => {
			this.updateMime();
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
		assert.ok(source.includes('private updateMime(): void {'));
		assert.ok(source.includes('this.updateMime();'));
		assert.ok(!source.includes('this.updateMime().catch'));
	});

	test('editor leftover whenReady then is Promise double-chain; sync onEditorGroupsReady stays skipped', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const groups = fs.readFileSync(resolveSource(GROUPS_REL), 'utf8');
		assertPromiseSignature(groups, 'readonly whenReady: Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.editorGroupService.whenReady.then(() => this.onEditorGroupsReady())');
		assert.ok(source.includes('private onEditorGroupsReady(): void {'));
		assert.ok(source.includes('\t\t\tthis.onEditorGroupsReady();'));
		assert.ok(!source.includes('this.onEditorGroupsReady().catch'));
	});

	test('webExtensionsScanner leftover when Eventually then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(source, 'private async updateCaches(): Promise<void> {');
		assert.ok(source.includes("import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'lifecycleService.when(LifecyclePhase.Eventually).then(() => this.updateCaches())');
	});

	test('extensionEnablement leftover whenInitialized then is Promise double-chain; loop leftover stays skipped', () => {
		const source = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		assertPromiseSignature(source, 'whenInitialized(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this.extensionsManager.whenInitialized().then(() => {
			if (!isDisposed) {
				uninstallDisposable.dispose();
				this._onDidChangeExtensions([], [], false);
				this._register(this.extensionsManager.onDidChangeExtensions(({ added, removed, isProfileSwitch }) => this._onDidChangeExtensions(added, removed, isProfileSwitch)));
				this.loopCheckForMaliciousExtensions();
			}
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
		assert.ok(source.includes('.then(() => this.loopCheckForMaliciousExtensions());'));
		assert.ok(!source.includes(`.then(() => this.loopCheckForMaliciousExtensions())${doubleCatch}`));
	});

	test('keybinding leftover initialize then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		assertPromiseSignature(source, 'async initialize(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this.userKeybindings.initialize().then(() => {
			if (this.userKeybindings.keybindings.length) {
				this.updateResolver();
			}
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty stay skipped', () => {
		const keyboard = fs.readFileSync(resolveSource(KEYBOARD_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const command = fs.readFileSync(resolveSource(COMMAND_REL), 'utf8');
		const language = fs.readFileSync(resolveSource(LANGUAGE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		assert.ok(language.includes('private updateMime(): void {'));
		assert.ok(!language.includes('this.updateMime().catch'));
		assert.ok(editor.includes('private onEditorGroupsReady(): void {'));
		assert.ok(!editor.includes('this.onEditorGroupsReady().catch'));
		for (const source of [keyboard, history, command, language, editor, scanner, enablement, keybinding]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('openerService.open'));
			assert.ok(!source.includes('IOpenerService'));
		}
	});
});

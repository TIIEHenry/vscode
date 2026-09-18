/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const KEYBOARD_LAYOUT_IFACE_REL = 'src/vs/platform/keyboardLayout/common/keyboardLayoutService.ts';
const NAVIGATOR_REL = 'src/vs/workbench/services/keybinding/browser/navigatorKeyboard.ts';
const KEYBINDINGS_CONTRIB_REL = 'src/vs/workbench/contrib/keybindings/browser/keybindings.contribution.ts';
const SYSTEM_WIDE_REL = 'src/vs/workbench/contrib/keybindings/electron-browser/systemWideKeybindings.contribution.ts';
const KEYBINDING_REL = 'src/vs/workbench/services/keybinding/browser/keybindingService.ts';
const LAYOUT_REL = 'src/vs/workbench/services/keybinding/browser/keyboardLayoutService.ts';
const NATIVE_LAYOUT_REL = 'src/vs/workbench/services/keybinding/electron-browser/nativeKeyboardLayout.ts';
const NATIVE_LAYOUT_SVC_REL = 'src/vs/workbench/services/keybinding/electron-browser/nativeKeyboardLayoutService.ts';
const KEYBINDING_EDITING_REL = 'src/vs/workbench/services/keybinding/common/keybindingEditing.ts';

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

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	const needle = `${call}${doubleCatch}`;
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

const syncCall = 'this.sync()';
const lockCall = `void Promise.resolve(keyboard?.lock(['Escape']))`;
const holdFinallyCall = `this._keybindingHoldMode.p.finally(() => {
			listener.dispose();
			focusTracker.dispose();
		})`;
const initializeThenCall = `this.initialize().then(() => {
				if (keyboardMappingEquals(this._keyboardMapping, keyboardMapping)) {
					// the mappings are equal
					return;
				}

				this._keyboardMapping = keyboardMapping;
				this._keyboardLayoutInfo = keyboardLayoutInfo;
				this._onDidChangeKeyboardLayout.fire();
			})`;

const d788Calls: Array<[string, string, number]> = [
	[SYSTEM_WIDE_REL, syncCall, 1],
	[KEYBINDING_REL, lockCall, 1],
	[KEYBINDING_REL, holdFinallyCall, 1],
	[NATIVE_LAYOUT_SVC_REL, initializeThenCall, 1],
];

suite('keybindings leftover remaining overflowed to keybinding leftover Promise fire-and-forget catch scan (D788)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('keybindings leftover remaining has fewer than four legal sites so this knife moved to services/keybinding leftover remaining', () => {
		const contrib = fs.readFileSync(resolveSource(KEYBINDINGS_CONTRIB_REL), 'utf8');
		const systemWide = fs.readFileSync(resolveSource(SYSTEM_WIDE_REL), 'utf8');
		const contribLegal = countWrapped(systemWide, syncCall);
		assert.ok(contribLegal < 4, `expected keybindings legal leftover <4, got ${contribLegal}`);
		assert.strictEqual(contribLegal, 1);
		assert.strictEqual(countDoubleChains(systemWide), 1);
		assert.ok(systemWide.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(systemWide, syncCall);
		assert.ok(!systemWide.includes('() => this.sync(), 200)'));
		assert.ok(contrib.includes('commandService.executeCommand(showWindowLogActionId).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.strictEqual(countDoubleChains(contrib), 1);
		assert.ok(contrib.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(!contrib.includes(`run(accessor: ServicesAccessor): void {${doubleCatch}`));
	});

	test('this knife covers four leftover Promise double-chain sites after keybindings leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d788Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
	});

	test('keybindings leftover this.sync is Promise double-chain; Action2 executeCommand already-double / scheduleSync stay skipped', () => {
		const systemWide = fs.readFileSync(resolveSource(SYSTEM_WIDE_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(KEYBINDINGS_CONTRIB_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(systemWide, 'private async sync(): Promise<void> {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(systemWide.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(systemWide, syncCall);
		assert.ok(systemWide.includes('private scheduleSync(): void {'));
		assert.ok(systemWide.includes('this.scheduleSync();'));
		assert.ok(!systemWide.includes(`this.scheduleSync()${doubleCatch}`));
		assert.ok(systemWide.includes('await this.nativeHostService.syncSystemWideKeybindings(payload);'));
		assert.ok(!systemWide.includes(`syncSystemWideKeybindings(payload)${doubleCatch}`));
		assert.ok(contrib.includes('commandService.executeCommand(showWindowLogActionId).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!contrib.includes('commandService.executeCommand(showWindowLogActionId);'));
	});

	test('keybinding leftover lock PromiseLike / hold-mode finally / initialize then are Promise double-chain', () => {
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		const nativeSvc = fs.readFileSync(resolveSource(NATIVE_LAYOUT_SVC_REL), 'utf8');
		const navigator = fs.readFileSync(resolveSource(NAVIGATOR_REL), 'utf8');
		const layoutIface = fs.readFileSync(resolveSource(KEYBOARD_LAYOUT_IFACE_REL), 'utf8');
		assertPromiseSignature(navigator, 'lock(keyCodes?: string[]): Promise<void>;');
		assertPromiseSignature(nativeSvc, 'public initialize(): Promise<void> {');
		assertPromiseSignature(layoutIface, 'getKeyboardLayoutData(): Promise<IKeyboardLayoutData>;');
		assert.ok(keybinding.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(nativeSvc.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(keybinding, lockCall);
		assertWrapped(keybinding, holdFinallyCall);
		assertWrapped(nativeSvc, initializeThenCall);
		assert.ok(!keybinding.includes("keyboard?.lock(['Escape']);"));
		assert.ok(keybinding.includes('return this._keybindingHoldMode.p;'));
		assert.ok(!keybinding.includes(`return this._keybindingHoldMode.p${doubleCatch}`));
		assert.ok(nativeSvc.includes('return this._initPromise;'));
		assert.ok(!nativeSvc.includes(`return this._initPromise${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Watch / Resolve / Pty / Connect / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(KEYBINDINGS_CONTRIB_REL), 'utf8');
		const systemWide = fs.readFileSync(resolveSource(SYSTEM_WIDE_REL), 'utf8');
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const nativeLayout = fs.readFileSync(resolveSource(NATIVE_LAYOUT_REL), 'utf8');
		const nativeSvc = fs.readFileSync(resolveSource(NATIVE_LAYOUT_SVC_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(KEYBINDING_EDITING_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');

		assert.ok(contrib.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(contrib.includes('commandService.executeCommand(showWindowLogActionId).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!contrib.includes('IOpenerService'));
		assert.ok(!systemWide.includes('IOpenerService'));
		assert.ok(!systemWide.includes('.then('));
		assert.ok(!systemWide.includes('.then(undefined,'));

		assert.ok(layout.includes('return await (navigator as INavigatorWithKeyboard).keyboard.getLayoutMap().then((e: any) => {'));
		assert.ok(!layout.includes(`getLayoutMap().then((e: any) => {}${doubleCatch}`));
		assert.ok(layout.includes('public setLayoutFromBrowserAPI(): void {'));
		assert.ok(layout.includes('this.setLayoutFromBrowserAPI();'));
		assert.ok(!layout.includes('this.setLayoutFromBrowserAPI().catch'));
		assert.ok(keybinding.includes('this.userKeybindings.initialize().then(() => {'));
		assert.ok(keybinding.includes(`})${doubleCatch};`));
		assert.ok(keybinding.includes('this.watchDisposables.add(this.fileService.watch(dirname(this.userDataProfileService.currentProfile.keybindingsResource)));'));
		assert.ok(!keybinding.includes('fileService.watch(dirname(this.userDataProfileService.currentProfile.keybindingsResource)).catch'));
		assert.ok(keybinding.includes('e.join(this.whenCurrentProfileChanged());'));
		assert.ok(!keybinding.includes(`e.join(this.whenCurrentProfileChanged())${doubleCatch}`));
		assert.ok(keybinding.includes('return this._keybindingHoldMode.p;'));
		assert.ok(nativeLayout.includes('this._register(this._nativeKeyboardLayoutService.onDidChangeKeyboardLayout(async () => {'));
		assert.ok(nativeLayout.includes('this._register(_configurationService.onDidChangeConfiguration(async (e) => {'));
		assert.ok(!nativeLayout.includes(doubleCatch));
		assert.ok(editing.includes('return this.queue.queue(() => this.doEditKeybinding(keybindingItem, key, when, true));'));
		assert.ok(!editing.includes(doubleCatch));

		for (const source of [contrib, systemWide, keybinding, layout, nativeLayout, nativeSvc, editing]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});

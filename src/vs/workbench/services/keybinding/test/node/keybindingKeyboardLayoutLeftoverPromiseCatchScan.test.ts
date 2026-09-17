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
const LAYOUT_REL = 'src/vs/workbench/services/keybinding/browser/keyboardLayoutService.ts';
const KEYBINDING_REL = 'src/vs/workbench/services/keybinding/browser/keybindingService.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';

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
	assert.ok(source.includes(`${call}${doubleCatch};`) || source.includes(`${call}${doubleCatch})`) || source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const layoutchangeThen = `this._getBrowserKeyMapping().then((mapping: IKeyboardMapping | null) => {
					if (this.isKeyMappingActive(mapping)) {
						return;
					}

					this.setLayoutFromBrowserAPI();
				})`;
const updateLayoutThen = `this._getBrowserKeyMapping(keyboardEvent).then(keyMap => {
			// might be false positive
			if (this.isKeyMappingActive(keyMap)) {
				return;
			}
			this.setActiveKeyMapping(keyMap);
		})`;
const validateLayoutThen = `this._getBrowserKeyMapping().then((keymap: IRawMixedKeyboardMapping | null) => {
						if (this.isKeyMappingActive(keymap)) {
							return;
						}

						this.setLayoutFromBrowserAPI();
					})`;
const importThen = `import(/* webpackIgnore: true */FileAccess.asBrowserUri(\`vs/workbench/services/keybinding/browser/keyboardLayouts/layout.contribution.\${platform}.js\` satisfies AppResourcePath).path).then((m) => {
			const keymapInfos: IKeymapInfo[] = m.KeyboardLayoutContribution.INSTANCE.layoutInfos;
			this._keymapInfos.push(...keymapInfos.map(info => (new KeymapInfo(info.layout, info.secondaryLayouts, info.mapping, info.isUserKeyboardLayout))));
			this._mru = this._keymapInfos;
			this._initialized = true;
			this.setLayoutFromBrowserAPI();
		})`;
const userLayoutInitThen = `this._userKeyboardLayout.initialize().then(() => {
			if (this._userKeyboardLayout.keyboardLayout) {
				this._factory.registerKeyboardLayout(this._userKeyboardLayout.keyboardLayout);

				this.setUserKeyboardLayoutIfMatched();
			}
		})`;
const reloadThen = `this.reload().then(changed => {
			if (changed) {
				this._onDidChange.fire();
			}
		})`;

suite('workbench/services/keybinding keyboard-layout leftover Promise fire-and-forget catch scan (D741)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers seven leftover Promise double-chain sites; D696 wrap stays', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		const d741 = [
			[layout, layoutchangeThen],
			[layout, updateLayoutThen],
			[layout, validateLayoutThen],
			[layout, importThen],
			[layout, userLayoutInitThen],
			[layout, reloadThen],
			[keybinding, reloadThen],
		] as const;
		assert.strictEqual(d741.length, 7);
		for (const [source, call] of d741) {
			assertDoubleThen(source, call);
		}
		assert.ok(keybinding.includes(`this.userKeybindings.initialize().then(() => {
			if (this.userKeybindings.keybindings.length) {
				this.updateResolver();
			}
		})${doubleCatch};`));
	});

	test('leftover _getBrowserKeyMapping layoutchange / update / validate thens are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		assertPromiseSignature(source, 'private async _getBrowserKeyMapping(keyboardEvent?: IKeyboardEvent): Promise<IRawMixedKeyboardMapping | null> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, layoutchangeThen);
		assertDoubleThen(source, updateLayoutThen);
		assertDoubleThen(source, validateLayoutThen);
	});

	test('leftover layout.contribution import then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, importThen);
	});

	test('leftover userKeyboardLayout.initialize then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		assertPromiseSignature(source, 'async initialize(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, userLayoutInitThen);
	});

	test('leftover UserKeyboardLayout / UserKeybindings reload scheduler thens are Promise double-chain', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		assertPromiseSignature(layout, 'private async reload(): Promise<boolean> {');
		assertPromiseSignature(keybinding, 'private async reload(): Promise<boolean> {');
		assert.ok(layout.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(keybinding.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(layout, reloadThen);
		assertDoubleThen(keybinding, reloadThen);
	});

	test('opener / D145 / consumed getLayoutMap then / sync void / grpc Wire / Connect / Watch / Resolve / Pty stay skipped', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		assert.ok(layout.includes('return await (navigator as INavigatorWithKeyboard).keyboard.getLayoutMap().then((e: any) => {'));
		assert.ok(!layout.includes(`getLayoutMap().then((e: any) => {}${doubleCatch}`));
		assert.ok(layout.includes('public setLayoutFromBrowserAPI(): void {'));
		assert.ok(layout.includes('this.setLayoutFromBrowserAPI();'));
		assert.ok(!layout.includes('this.setLayoutFromBrowserAPI().catch'));
		assert.ok(layout.includes('private _updateKeyboardLayoutAsync(initialized: boolean, keyboardEvent?: IKeyboardEvent) {'));
		assert.ok(layout.includes('this._updateKeyboardLayoutAsync(this._initialized);'));
		assert.ok(!layout.includes('this._updateKeyboardLayoutAsync(this._initialized).catch'));
		for (const source of [layout, keybinding]) {
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

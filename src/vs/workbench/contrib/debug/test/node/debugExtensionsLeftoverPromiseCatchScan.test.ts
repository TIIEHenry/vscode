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
const UTILS_REL = 'src/vs/workbench/contrib/extensions/common/extensionsUtils.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts';
const ACTION_VIEW_REL = 'src/vs/workbench/contrib/debug/browser/debugActionViewItems.ts';
const COMMANDS_REL = 'src/vs/workbench/contrib/debug/browser/debugCommands.ts';

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

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch};`));
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('debug/extensions leftover Promise fire-and-forget catch scan (D690)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('extensionsUtils keymap leftover Promise.all is double-chain; then(undefined) gone', () => {
		const source = fs.readFileSync(resolveSource(UTILS_REL), 'utf8');
		const call = 'Promise.all(identifiers.map(identifier => this.checkForOtherKeymaps(identifier)))';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/Promise\.all\(identifiers\.map\(identifier => this\.checkForOtherKeymaps\(identifier\)\)\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}\n\t\t\t\t${doubleCatch};`));
		assert.ok(!source.includes(`${call}\n\t\t\t\t.then(undefined, onUnexpectedError);`));
		assert.ok(!source.includes(`${call}\n\t\t\t\t.catch(onUnexpectedError);`));
	});

	test('extensionsWidgets leftover gallery manifest then is double-chain; openView stays skipped', () => {
		const source = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const galleryThen = `extensionGalleryManifestService.getExtensionGalleryManifest().then(manifest => {
			if (this._store.isDisposed) {
				return;
			}
			this.extensionGalleryManifest = manifest;
			this.render();
		})`;
		assert.ok(source.includes(`${galleryThen}${doubleCatch};`));
		assert.ok(!source.includes(`${galleryThen};`));
		assert.ok(!source.includes(`${galleryThen}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true));'));
		assert.ok(!source.includes('this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true)).catch'));
	});

	test('extensionsActions leftover theme / queryLocal thens are double-chain; opener stays skipped', () => {
		const source = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		assert.ok(source.includes("import { getErrorMessage, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		const colorThen = `this.workbenchThemeService.getColorThemes().then(colorThemes => {
			this.enabled = this.computeEnablement(colorThemes);
			this.class = this.enabled ? SetColorThemeAction.EnabledClass : SetColorThemeAction.DisabledClass;
		})`;
		const fileThen = `this.workbenchThemeService.getFileIconThemes().then(fileIconThemes => {
			this.enabled = this.computeEnablement(fileIconThemes);
			this.class = this.enabled ? SetFileIconThemeAction.EnabledClass : SetFileIconThemeAction.DisabledClass;
		})`;
		const productThen = `this.workbenchThemeService.getProductIconThemes().then(productIconThemes => {
			this.enabled = this.computeEnablement(productIconThemes);
			this.class = this.enabled ? SetProductIconThemeAction.EnabledClass : SetProductIconThemeAction.DisabledClass;
		})`;
		assert.ok(source.includes(`${colorThen}${doubleCatch};`));
		assert.ok(source.includes(`${fileThen}${doubleCatch};`));
		assert.ok(source.includes(`${productThen}${doubleCatch};`));
		assert.ok(!source.includes(`${colorThen};`));
		assert.ok(!source.includes(`${fileThen};`));
		assert.ok(!source.includes(`${productThen};`));
		assertDoubleChain(source, 'this.extensionsWorkbenchService.queryLocal().then(() => this.updateExtensions())', 1);
		assert.ok(source.includes('run: () => this.openerService.open(downloadUrl).then(() => {'));
		assert.ok(!source.includes(`this.openerService.open(downloadUrl)${doubleCatch}`));
	});

	test('debug leftover getDynamicProviders / stepInTargets thens are double-chain', () => {
		const actionView = fs.readFileSync(resolveSource(ACTION_VIEW_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assert.ok(actionView.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(commands.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const dynamicThen = `configManager.getDynamicProviders().then(providers => {
			if (providers.length !== this.providers.length) {
				this.providers = providers;
				this.updateOptions();
			}
		})`;
		const stepThen = `session.stepInTargets(frame.frameId).then(targets => {
			qp.busy = false;
			if (targets?.length) {
				qp.items = targets?.map(target => ({ target, label: target.label }));
			} else {
				qp.placeholder = nls.localize('editor.debug.action.stepIntoTargets.none', "No step targets available");
			}
		})`;
		assert.ok(actionView.includes(`${dynamicThen}${doubleCatch};`));
		assert.ok(commands.includes(`${stepThen}${doubleCatch};`));
		assert.ok(!actionView.includes(`${dynamicThen};`));
		assert.ok(!commands.includes(`${stepThen};`));
		assert.ok(!actionView.includes(`${dynamicThen}.catch(onUnexpectedError);`));
		assert.ok(!commands.includes(`${stepThen}.catch(onUnexpectedError);`));
	});
});

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
const OUTLINE_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/outline/notebookOutline.ts';
const FIND_WIDGET_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/notebookFindWidget.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';
const KEYMAP_REL = 'src/vs/workbench/contrib/notebook/browser/services/notebookKeymapServiceImpl.ts';
const KERNEL_PICK_REL = 'src/vs/workbench/contrib/notebook/browser/viewParts/notebookKernelQuickPickStrategy.ts';

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

suite('Notebook leftover Promise fire-and-forget catch scan (D684)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('outline doComputeSymbols leftover void is double-chain', () => {
		const source = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('public async doComputeSymbols(cancelToken: CancellationToken): Promise<void> {'));
		assertDoubleChain(source, 'void this.doComputeSymbols(cancelToken)', 1);
	});

	test('find widget replaceOne / replaceAll leftover thens are double-chain', () => {
		const source = fs.readFileSync(resolveSource(FIND_WIDGET_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes(`viewModel.replaceOne(cell, match.range, replaceString).then(() => {
				this._progressBar.stop();
			})${doubleCatch};`));
		assert.ok(source.includes(`viewModel.replaceAll(this._findModel.findMatches, replaceStrings).then(() => {
			this._progressBar.stop();
		})${doubleCatch};`));
		assert.ok(!source.includes(`viewModel.replaceOne(cell, match.range, replaceString).then(() => {
				this._progressBar.stop();
			});`));
		assert.ok(!source.includes(`viewModel.replaceAll(this._findModel.findMatches, replaceStrings).then(() => {
			this._progressBar.stop();
		});`));
	});

	test('findModel highlightCurrentFindMatchDecoration leftover Promises are double-chain', () => {
		const source = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async highlightCurrentFindMatchDecoration(cellIndex: number, matchIndex: number): Promise<number | null> {'));
		assert.strictEqual((source.match(/\.then\(async offset => \{/g) ?? []).length, 2);
		assert.strictEqual((source.match(/highlightCurrentFindMatchDecoration\([^)]+\)\.then\(async offset => \{[\s\S]*?\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assertDoubleChain(source, 'void this.highlightCurrentFindMatchDecoration(0, 0)', 1);
		assertDoubleChain(source, 'void this.highlightCurrentFindMatchDecoration(nextIndex.index, nextIndex.remainder)', 1);
		assert.ok(!source.includes('\t\t\tthis.highlightCurrentFindMatchDecoration(0, 0);'));
		assert.ok(!source.includes('\t\tthis.highlightCurrentFindMatchDecoration(nextIndex.index, nextIndex.remainder);'));
	});

	test('keymap Promise.all leftover single-chain is double-chain', () => {
		const source = fs.readFileSync(resolveSource(KEYMAP_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes(`Promise.all(identifiers.map(identifier => this.checkForOtherKeymaps(identifier)))
				.catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(!source.includes('.then(undefined, onUnexpectedError);'));
		assert.ok(!source.includes('Promise.all(identifiers.map(identifier => this.checkForOtherKeymaps(identifier)))\n\t\t\t\t.catch(onUnexpectedError);'));
	});

	test('kernel quick pick opener leftover stays skipped', () => {
		const source = fs.readFileSync(resolveSource(KERNEL_PICK_REL), 'utf8');
		assert.ok(source.includes('void this._openerService.open(uri, { openExternal: true });'));
		assert.ok(!source.includes('void this._openerService.open(uri, { openExternal: true }).catch'));
	});
});

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
const OVERVIEW_REL = 'src/vs/sessions/contrib/aiCustomizationTreeView/browser/aiCustomizationOverviewView.ts';

function aiCustomizationOverviewViewSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), OVERVIEW_REL),
		path.join(thisDir, '../../browser/aiCustomizationOverviewView.ts'),
		path.join(thisDir, '../../../../../../../', OVERVIEW_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `aiCustomizationOverviewView.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('AICustomizationOverviewView leftover fire-and-forget catch scan (D614)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('loadCounts voids single-catch onUnexpectedError (D614)', () => {
		const source = fs.readFileSync(aiCustomizationOverviewViewSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.loadCounts()';
		const singleCall = `${call}${singleCatch}`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async loadCounts(): Promise<void>'));
		assert.ok(source.includes('private reloadCounts(): void {'));
		// Catalog, workspace, project-root, and first render all go through reloadCounts, which is the only loadCounts void.
		assert.strictEqual((source.match(/void this\.loadCounts\(\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\.loadCounts\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${singleCall};`));
		assert.ok(!source.includes(`${singleCall})`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call}${doubleCatch})`));
		assert.ok(!source.includes('() => this.loadCounts()'));
		assert.ok(!source.includes('\t\t\tthis.loadCounts();'));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});

suite('AICustomizationOverviewView leftover fire-and-forget catch scan (D622)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('openOverview voids single-catch onUnexpectedError (D622)', () => {
		const source = fs.readFileSync(aiCustomizationOverviewViewSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.openOverview()';
		const singleCall = `${call}${singleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async openOverview(): Promise<void>'));
		assert.strictEqual((source.match(/void this\.openOverview\(\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\.openOverview\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(singleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes('\t\t\t\tthis.openOverview();'));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});

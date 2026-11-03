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
const VIEW_REL = 'src/vs/sessions/contrib/sessions/browser/views/automationsView.ts';

function automationsViewSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), VIEW_REL),
		path.join(thisDir, '../../browser/views/automationsView.ts'),
		path.join(thisDir, '../../../../../../../', VIEW_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `automationsView.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(text: string): number {
	const matches = text.match(/\.catch\([a-zA-Z0-9_$.]+\)\s*\.catch\([a-zA-Z0-9_$.]+\)/g);
	return matches ? matches.length : 0;
}

suite('AutomationsView leftover fire-and-forget catch scan (D603)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('automationsView leftover voids single-catch onUnexpectedError (D603)', () => {
		const source = fs.readFileSync(automationsViewSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const sites = [
			'void this.runNow(currentAutomation)',
			'void this.confirmDelete(currentAutomation)',
			'void this.openEditDialog(currentAutomation)',
			'void this.openCreateDialog()',
			'void this.markAllRunsRead(this.currentRuns.get())',
			'void this.openRunSession(resource)',
		] as const;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual(countDoubleChains(source), 0);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)/g) ?? []).length, 6);
		for (const site of sites) {
			assert.strictEqual((source.split(site).length - 1), 1, `${site} should appear once`);
			assert.ok(source.includes(`${site}${singleCatch}`), `${site} missing single-catch`);
		}
	});
});

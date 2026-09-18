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
const SOURCE_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';

function gettingStartedSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/gettingStarted.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `gettingStarted.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('GettingStarted leftover fire-and-forget catch scan (D664)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('recentlyOpened then() leftover sites are each then + double-chain; single-chain gone for these sites', () => {
		// recentlyOpened is Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(gettingStartedSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const buildThen = `this.recentlyOpened.then(({ workspaces }) => {
			const workspacesWithID = this.filterRecentlyOpened(workspaces);

			const updateEntries = () => {
				recentlyOpenedList.setEntries(workspacesWithID);
			};

			updateEntries();
			recentlyOpenedList.register(this.labelService.onDidChangeFormatters(() => updateEntries()));
		})`;
		const refreshThen = `this.recentlyOpened.then(({ workspaces }) => {
			const workspacesWithID = this.filterRecentlyOpened(workspaces);
			this.recentlyOpenedList.value?.setEntries(workspacesWithID);
		})`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.recentlyOpened\.then\(/g) ?? []).length, 2);
		assert.strictEqual((source.split(buildThen).length - 1), 1);
		assert.strictEqual((source.split(refreshThen).length - 1), 1);
		assert.ok(source.includes(`${buildThen}${doubleCatch};`));
		assert.ok(source.includes(`${refreshThen}${doubleCatch};`));
		assert.ok(!source.includes(`${buildThen};`));
		assert.ok(!source.includes(`${refreshThen};`));
		assert.ok(!source.includes(`${buildThen}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${refreshThen}.catch(onUnexpectedError);`));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 15);
		assert.strictEqual((source.match(/\.catch\(/g) ?? []).length, 30);
	});
});

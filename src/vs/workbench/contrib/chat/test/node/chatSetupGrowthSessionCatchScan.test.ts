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
const SOURCE_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupGrowthSession.ts';

function chatSetupGrowthSessionSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/chatSetup/chatSetupGrowthSession.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatSetupGrowthSession.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatSetupGrowthSession leftover fire-and-forget catch scan (D657)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Restored then() leftover site is then + double-chain; single-chain gone in this file only', () => {
		// lifecycleService.when returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatSetupGrowthSessionSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const thenSite = `this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
			if (this._store.isDisposed || this._dismissed) {
				return;
			}
			this._register(this.chatWidgetService.onDidAddWidget(() => {
				this.dismiss();
			}));
		})`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/lifecycleService\.when\(LifecyclePhase\.Restored\)\.then\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\.catch\(/g) ?? []).length, 2);
		assert.ok(source.includes(`${thenSite}${doubleCatch};`));
		assert.ok(!source.includes(`${thenSite};`));
		assert.ok(!source.includes(`${thenSite}.catch(onUnexpectedError);`));
	});
});

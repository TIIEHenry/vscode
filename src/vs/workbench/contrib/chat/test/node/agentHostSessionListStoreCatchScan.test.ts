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
const STORE_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionListStore.ts';

function agentHostSessionListStoreSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), STORE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/agentSessions/agentHost/agentHostSessionListStore.ts'),
		path.join(thisDir, '../../../../../../../', STORE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentHostSessionListStore.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentHostSessionListStore leftover fire-and-forget catch scan (D570)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('workspace-folders refresh void is double-caught; bare/single-chain gone in this file only', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(agentHostSessionListStoreSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleRefresh = `void this.refresh(CancellationToken.None)${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(source.includes('async refresh('));
		assert.strictEqual((source.match(/void this\.refresh\(CancellationToken\.None\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleRefresh));
		assert.ok(!source.includes('void this.refresh(CancellationToken.None);'));
		assert.ok(!source.includes('void this.refresh(CancellationToken.None).catch(onUnexpectedError);'));
	});
});

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
const AGENT_PLUGINS_VIEW_REL = 'src/vs/workbench/contrib/chat/browser/agentPluginsView.ts';

function agentPluginsViewSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), AGENT_PLUGINS_VIEW_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/agentPluginsView.ts'),
		path.join(thisDir, '../../../../../../../', AGENT_PLUGINS_VIEW_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `agentPluginsView.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentPluginsListView leftover fire-and-forget catch scan (D567)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('agentPluginsView scheduler show void double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(agentPluginsViewSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleShow = `void this.show(this.currentQuery)${doubleCatch};`;
		assert.ok(source.includes("from '../../../../base/common/errors.js'"));
		assert.ok(source.includes('onUnexpectedError'));
		assert.strictEqual((source.match(/void this\.show\(this\.currentQuery\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleShow));
		assert.ok(!source.includes('void this.show(this.currentQuery);'));
		assert.ok(!source.includes('void this.show(this.currentQuery).catch(onUnexpectedError);'));
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(thisDir, '../../../../../../');
const CHANNEL_CLIENT_PATH = path.join(REPO_ROOT, 'src/vs/platform/universeAgent/common/universeAgentConnectionChannelClient.ts');

suite('UniverseAgentConnectionChannelClient fire-and-forget scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('hydrate and refreshPhaseAndNotify voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(CHANNEL_CLIENT_PATH, 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes(`void this.refreshPhaseAndNotify()${doubleCatch}`));
		assert.ok(source.includes(`void this.hydrate()${doubleCatch}`));
		assert.ok(source.includes("from '../../../base/common/errors.js'"));
		assert.ok(!source.includes('void this.refreshPhaseAndNotify();'));
		assert.ok(!source.includes('void this.hydrate();'));
		assert.ok(!source.includes('void this.refreshPhaseAndNotify().catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.hydrate().catch(onUnexpectedError);'));
	});

	test('requestAgentTreeRefresh remote void is double-caught (D561)', () => {
		// Typed void on IUniverseAgentConnection; ProxyChannel still returns a Promise.
		const source = fs.readFileSync(CHANNEL_CLIENT_PATH, 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleCaught = `void Promise.resolve(this.remote.requestAgentTreeRefresh(sessionId))${doubleCatch};`;
		assert.ok(source.includes(doubleCaught));
		assert.strictEqual((source.match(/void Promise\.resolve\(this\.remote\.requestAgentTreeRefresh\(sessionId\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(!source.includes('void this.remote.requestAgentTreeRefresh(sessionId);'));
		assert.ok(!source.includes('void this.remote.requestAgentTreeRefresh(sessionId).catch(onUnexpectedError);'));
		assert.ok(!source.includes(`void this.remote.requestAgentTreeRefresh(sessionId)${doubleCatch}`));
	});
});

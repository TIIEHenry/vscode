/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts';

function baseAgentHostSessionsProviderSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/baseAgentHostSessionsProvider.ts'),
		path.join(thisDir, '../../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `baseAgentHostSessionsProvider.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('BaseAgentHostSessionsProvider leftover fire-and-forget catch scan (D618)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_dispatchActiveClientWhenResolved / _resolveRunningSessionConfig voids double-catch onUnexpectedError (D618)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(baseAgentHostSessionsProviderSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const dispatch = 'void this._dispatchActiveClientWhenResolved(cancellation.token, activeSession.sessionId, rawId, cached, connection, scope)';
		const resolve = 'void this._resolveRunningSessionConfig(sessionId, cached, nextValues)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _dispatchActiveClientWhenResolved('));
		assert.ok(source.includes('private async _resolveRunningSessionConfig(sessionId: string, cached: AgentHostSessionAdapter, values: Record<string, unknown>): Promise<void> {'));
		assert.strictEqual((source.match(/void this\._dispatchActiveClientWhenResolved\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._resolveRunningSessionConfig\(/g) ?? []).length, 2);
		assert.ok(source.includes(`${dispatch}${doubleCatch};`));
		assert.ok(source.includes(`${resolve}${doubleCatch};`));
		assert.ok(!source.includes(`${dispatch};`));
		assert.ok(!source.includes(`${resolve};`));
		assert.ok(!source.includes(`${dispatch}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${resolve}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this._logService.warn(`[${this.id}] Failed to re-resolve session config for ${sessionId}: ${err}`);'));
	});
});

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
const CONNECTION_REL = 'src/vs/platform/universeAgent/node/universeAgentConnectionService.ts';
const HOST_REL = 'src/vs/platform/universeAgent/node/sessionViewHost.ts';
const TREE_REL = 'src/vs/platform/universeAgent/node/agentTreeCoordinator.ts';
// 2f35686b611 widened the connection-service import to `CancellationError, onUnexpectedError`;
// match the shared tail so one constant still covers all three sources.
const ERRORS_IMPORT = "onUnexpectedError } from '../../../base/common/errors.js';";

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('UniverseAgent leftover fire-and-forget catch scan (D678)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_fireReconnect leftover void is double-chain; bare/single-chain gone', () => {
		const source = fs.readFileSync(resolveSource(CONNECTION_REL), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._fireReconnect(profileId)';
		assert.ok(source.includes(ERRORS_IMPORT));
		assert.strictEqual((source.match(/void this\._fireReconnect\(profileId\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('sessionViewHost pullNow leftover is onError then double-chain; single-chain gone', () => {
		const source = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		// 2058aac5e25: the host now forwards onError into pullNow itself.
		const call = 'void sidecar.tree.pullNow(onBound, onError).catch(onError)';
		assert.ok(source.includes(ERRORS_IMPORT));
		assert.strictEqual((source.match(/void sidecar\.tree\.pullNow\(onBound, onError\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('scheduleRefresh pullNow leftover routes to caller onError; bare onBound signature gone', () => {
		const source = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		// 2058aac5e25 deliberately forwards onError into pullNow and drops the trailing
		// double-chain here: the debounce catch reports via the caller's onError only.
		const routed = `void this.pullNow(onBound, onError).catch(error => {
				onError?.(error);
			});`;
		assert.ok(source.includes(ERRORS_IMPORT));
		assert.strictEqual((source.match(/void this\.pullNow\(onBound, onError\)/g) ?? []).length, 1);
		assert.ok(source.includes(routed));
		assert.ok(!source.includes(`void this.pullNow(onBound).catch(error => {`));
		assert.ok(!source.includes(`void this.pullNow(onBound).catch(onUnexpectedError);`));
	});
});

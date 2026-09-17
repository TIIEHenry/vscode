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
const RESIDENCY_REL = 'src/vs/platform/agentHost/node/agentSessionResidency.ts';
const SERVICE_REL = 'src/vs/platform/agentHost/node/agentService.ts';
const ERRORS_IMPORT = "import { onUnexpectedError } from '../../../base/common/errors.js';";
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AgentSessionResidency leftover fire-and-forget catch scan (D683)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('reconcile leftover voids are double-chain; bare/single-chain gone', () => {
		const source = fs.readFileSync(resolveSource(RESIDENCY_REL), 'utf8');
		const call = 'void this.reconcile()';
		assert.ok(source.includes(ERRORS_IMPORT));
		assert.ok(source.includes('reconcile(): Promise<void> {'));
		assert.strictEqual((source.match(/void this\.reconcile\(\)/g) ?? []).length, 5);
		assert.ok(source.includes(`${call}${doubleCatch}`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('_sessionResidency.reconcile leftover voids are double-chain; bare/single-chain gone', () => {
		const source = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const call = 'void this._sessionResidency.reconcile()';
		assert.ok(source.includes(ERRORS_IMPORT));
		assert.strictEqual((source.match(/void this\._sessionResidency\.reconcile\(\)/g) ?? []).length, 5);
		assert.ok(source.includes(`${call}${doubleCatch}`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});

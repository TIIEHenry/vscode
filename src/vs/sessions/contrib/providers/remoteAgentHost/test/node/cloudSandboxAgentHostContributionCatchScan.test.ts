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
const SOURCE_REL = 'src/vs/sessions/contrib/providers/remoteAgentHost/browser/cloudSandboxAgentHostContribution.ts';

function cloudSandboxAgentHostContributionSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/cloudSandboxAgentHostContribution.ts'),
		path.join(thisDir, '../../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `cloudSandboxAgentHostContribution.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('CloudSandboxAgentHostContribution leftover fire-and-forget catch scan (D628)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_discoverAndSeed / _disconnectEnvironment voids double-catch onUnexpectedError (D628)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(cloudSandboxAgentHostContributionSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const discover = 'void this._discoverAndSeed()';
		const disconnect = 'void this._disconnectEnvironment(address)';
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private _discoverAndSeed(): Promise<void>'));
		assert.ok(source.includes('private async _disconnectEnvironment(address: string): Promise<void>'));
		assert.strictEqual((source.match(/void this\._discoverAndSeed\(\)/g) ?? []).length, 3);
		assert.strictEqual((source.match(/void this\._discoverAndSeed\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 3);
		assert.strictEqual((source.match(/void this\._disconnectEnvironment\(address\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._disconnectEnvironment\(address\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
		assert.ok(source.includes(`${discover}${doubleCatch};`));
		assert.ok(source.includes(`${disconnect}${doubleCatch};`));
		assert.ok(!source.includes(`${discover};`));
		assert.ok(!source.includes(`${disconnect};`));
		assert.ok(!source.includes(`${discover}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${disconnect}.catch(onUnexpectedError);`));
		assert.ok(source.includes('this._register(this._agentHostFilterService.registerDiscoveryHandler(() => this._discoverAndSeed()));'));
	});
});

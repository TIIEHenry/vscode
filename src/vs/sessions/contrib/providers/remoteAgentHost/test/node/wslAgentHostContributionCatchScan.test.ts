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
const SOURCE_REL = 'src/vs/sessions/contrib/providers/remoteAgentHost/browser/wslAgentHost.contribution.ts';

function wslAgentHostContributionSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/wslAgentHost.contribution.ts'),
		path.join(thisDir, '../../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `wslAgentHost.contribution.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('WSLAgentHost leftover fire-and-forget catch scan (D627)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_reconnectWSLEntriesIfRunning / _attemptWSLReconnect voids double-catch onUnexpectedError (D627)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(wslAgentHostContributionSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const reconnect = 'void this._reconnectWSLEntriesIfRunning()';
		const attemptEntry = 'void this._attemptWSLReconnect(entry.distro, entry.name, entry.address)';
		const attemptNamed = 'void this._attemptWSLReconnect(distro, name, address)';
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _reconnectWSLEntriesIfRunning(): Promise<void> {'));
		assert.ok(source.includes('private async _attemptWSLReconnect(distro: string, name: string, address: string, options: { userInitiated?: boolean } = {}): Promise<void> {'));
		assert.strictEqual((source.match(/void this\._reconnectWSLEntriesIfRunning\(\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._attemptWSLReconnect\(entry\.distro, entry\.name, entry\.address\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._attemptWSLReconnect\(distro, name, address\)/g) ?? []).length, 1);
		assert.ok(source.includes(`() => ${reconnect}${doubleCatch},`));
		assert.ok(source.includes(`${reconnect}${doubleCatch};`));
		assert.ok(source.includes(`${attemptEntry}${doubleCatch};`));
		assert.ok(source.includes(`${attemptNamed}${doubleCatch};`));
		assert.ok(!source.includes(`${reconnect};`));
		assert.ok(!source.includes(`${attemptEntry};`));
		assert.ok(!source.includes(`${attemptNamed};`));
		assert.ok(!source.includes(`${reconnect}.catch(onUnexpectedError),`));
		assert.ok(!source.includes(`${reconnect}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${attemptEntry}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${attemptNamed}.catch(onUnexpectedError);`));
	});
});

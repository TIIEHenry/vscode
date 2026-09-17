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
const SOURCE_REL = 'src/vs/workbench/contrib/chat/common/chatDebugServiceImpl.ts';

function chatDebugServiceImplSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/common/chatDebugServiceImpl.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatDebugServiceImpl.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatDebugServiceImpl leftover fire-and-forget catch scan (D656)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_invokeProvider and fetcher then() are double-chain; bare / single-chain gone in this file only', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(chatDebugServiceImplSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const invokeCall = 'this._invokeProvider(provider, sessionResource, cts.token)';
		const fetcherThen = `entry.fetcher(CancellationToken.None).then(entries => {
				if (entries.length > 0) {
					this.addAvailableSessionResources(entries);
				}
			})`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\._invokeProvider\(provider, sessionResource, cts\.token\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(source.includes(`${invokeCall}${doubleCatch};`));
		assert.ok(!source.includes(`${invokeCall}.catch(onUnexpectedError);`));
		assert.strictEqual((source.split(fetcherThen).length - 1), 1);
		assert.ok(source.includes(`${fetcherThen}${doubleCatch};`));
		assert.ok(!source.includes(`${fetcherThen};`));
		assert.ok(!source.includes(`${fetcherThen}.catch(onUnexpectedError);`));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.strictEqual((source.match(/\.catch\(/g) ?? []).length, 4);
	});
});

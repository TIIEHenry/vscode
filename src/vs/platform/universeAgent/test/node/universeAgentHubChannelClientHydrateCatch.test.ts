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
const HUB_CHANNEL_CLIENT_PATH = path.join(REPO_ROOT, 'src/vs/platform/universeAgent/common/universeAgentHubChannelClient.ts');

suite('UniverseAgentHubChannelClient fire-and-forget leftover catch', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('constructor hydrate void is double-caught; bare void this.hydrate() gone in this file only', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(HUB_CHANNEL_CLIENT_PATH, 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleCaughtHydrate = `void this.hydrate()${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(source.includes(doubleCaughtHydrate));
		assert.strictEqual((source.match(/void this\.hydrate\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(!source.includes('void this.hydrate();'));
		assert.ok(!source.includes('void this.hydrate().catch(onUnexpectedError);'));
		assert.ok(!source.replace(doubleCaughtHydrate, '').includes('void this.hydrate('));
	});

	test('setActiveHubBaseUrl remote void is double-caught; hydrate double-catch stays (D562)', () => {
		// ProxyChannel.toService always returns async functions even when the service types the member void.
		const source = fs.readFileSync(HUB_CHANNEL_CLIENT_PATH, 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleCaughtSet = `void this.remote.setActiveHubBaseUrl(hubBaseUrl)${doubleCatch};`;
		const doubleCaughtHydrate = `void this.hydrate()${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(source.includes(doubleCaughtSet));
		assert.ok(source.includes(doubleCaughtHydrate));
		assert.strictEqual((source.match(/void this\.remote\.setActiveHubBaseUrl\(hubBaseUrl\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 1);
		assert.ok(!source.includes('void this.remote.setActiveHubBaseUrl(hubBaseUrl);'));
		assert.ok(!source.includes('void this.remote.setActiveHubBaseUrl(hubBaseUrl).catch(onUnexpectedError);'));
		assert.ok(!source.replace(doubleCaughtSet, '').includes('void this.remote.setActiveHubBaseUrl('));
	});
});

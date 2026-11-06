/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { HubProfileResult, IUniverseAgentHubService } from '../../common/hub.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const HUB_REL = 'src/vs/platform/universeAgent/common/hub.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;

// An overloaded method type is not equal to a single signature, so a second declaration fails to compile here.
const addHubDeviceProfileIsSingleSignature: Equals<
	IUniverseAgentHubService['addHubDeviceProfile'],
	(input: { readonly hubDeviceId: string; readonly displayName?: string }) => Promise<HubProfileResult>
> = true;

suite('UniverseAgent hub addHubDeviceProfile signature', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('hub.ts declares addHubDeviceProfile once and drops HubDirectAddressResult', () => {
		const source = fs.readFileSync(resolveSource(HUB_REL), 'utf8');
		assert.deepStrictEqual({
			declarations: source.match(/^\s*addHubDeviceProfile\(/gm)?.length ?? 0,
			alias: source.includes('HubDirectAddressResult'),
			singleSignature: addHubDeviceProfileIsSingleSignature,
		}, {
			declarations: 1,
			alias: false,
			singleSignature: true,
		});
	});
});

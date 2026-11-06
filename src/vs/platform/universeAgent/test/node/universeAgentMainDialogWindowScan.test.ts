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
const MAIN_REL = 'src/vs/platform/universeAgent/electron-main/universeAgentMainService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('UniverseAgent pairing dialog window', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('pairing showMessageBox passes are gone from the electron-main connection host', () => {
		const source = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		assert.deepStrictEqual(
			['showMessageBox', 'IDialogMainService', 'IWindowsMainService'].filter(token => source.includes(token)),
			[],
		);
	});
});

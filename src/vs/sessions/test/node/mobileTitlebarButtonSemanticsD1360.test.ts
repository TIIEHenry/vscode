/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_TITLEBAR_REL = 'src/vs/sessions/browser/parts/mobile/mobileTitlebarPart.ts';

function readMobileTitlebarSource(): string {
	const candidates = [
		path.join(process.cwd(), MOBILE_TITLEBAR_REL),
		path.join(thisDir, '../../../../../', MOBILE_TITLEBAR_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${MOBILE_TITLEBAR_REL} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

suite('Mobile titlebar button semantics (D1360)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('top bar controls are explicit non-submit buttons', () => {
		const source = readMobileTitlebarSource();
		assert.match(source, /\$\('button\.mobile-top-bar-button', \{ type: 'button' \}\)/, 'sidebar toggle must be type=button');
		assert.match(source, /\$\('button\.mobile-top-bar-button\.mobile-new-session-button', \{ type: 'button' \}\)/, 'new-session control must be type=button');
		assert.match(source, /\$\('button\.mobile-top-bar-button\.mobile-account-indicator', \{ type: 'button' \}\)/, 'account control must be type=button');
	});
});

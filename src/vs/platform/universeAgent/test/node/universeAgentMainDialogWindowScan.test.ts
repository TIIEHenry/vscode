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

	test('pairing showMessageBox passes the focused or last active window', () => {
		const source = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		assert.ok(source.includes('@IWindowsMainService windowsMainService: IWindowsMainService'));
		const focusedAt = source.indexOf('windowsMainService.getFocusedWindow()');
		const lastAt = source.indexOf('windowsMainService.getLastActiveWindow()');
		assert.ok(focusedAt >= 0 && lastAt > focusedAt);
		assert.ok(source.includes('!win.isDestroyed()'));

		const rejectAt = source.indexOf('if (!browserWindow)');
		const showAt = source.indexOf('return dialogMainService.showMessageBox({');
		assert.ok(rejectAt >= 0 && showAt > rejectAt);
		assert.ok(source.includes('return Promise.reject(new Error(localize('));
		assert.ok(source.includes('Pairing confirmation dialog did not open because no window is available.'));
		assert.ok(!source.includes('return { response:'));
		assert.ok(!source.includes('response: options.cancelId'));

		const callEnd = source.indexOf(');', showAt);
		assert.ok(callEnd > showAt);
		const call = source.slice(showAt, callEnd);
		assert.ok(call.includes('type: options.type'));
		assert.ok(call.includes('message: options.message'));
		assert.ok(call.includes('detail: options.detail'));
		assert.ok(call.includes('buttons: options.buttons'));
		assert.ok(call.includes('defaultId: options.defaultId'));
		assert.ok(call.includes('cancelId: options.cancelId'));
		assert.ok(call.trimEnd().endsWith('}, browserWindow'));
		assert.ok(!call.includes('undefined'));
	});
});

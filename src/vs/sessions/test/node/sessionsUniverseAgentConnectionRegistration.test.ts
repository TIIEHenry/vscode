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
const DESKTOP_MAIN_REL = 'src/vs/sessions/sessions.desktop.main.ts';
const WEB_MAIN_REL = 'src/vs/sessions/sessions.web.main.ts';
const COMMON_MAIN_REL = 'src/vs/sessions/sessions.common.main.ts';
const CHANGES_VIEW_REL = 'src/vs/sessions/contrib/changes/browser/changesViewService.ts';
const ELECTRON_REGISTRATION = '../platform/universeAgent/electron-browser/universeAgentConnectionService.js';
const BROWSER_REGISTRATION = '../platform/universeAgent/browser/universeAgentConnectionService.js';

function readRepoFile(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

suite('Agents window registers universe agent connection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('desktop entry loads the electron-browser connection client only', () => {
		const source = readRepoFile(DESKTOP_MAIN_REL);
		assert.ok(source.includes(ELECTRON_REGISTRATION));
		assert.ok(!source.includes(BROWSER_REGISTRATION));
	});

	test('web entry loads the browser connection stub only', () => {
		const source = readRepoFile(WEB_MAIN_REL);
		assert.ok(source.includes(BROWSER_REGISTRATION));
		assert.ok(!source.includes('universeAgent/electron-browser/universeAgentConnectionService.js'));
	});

	test('common entry does not register an environment-specific connection', () => {
		const source = readRepoFile(COMMON_MAIN_REL);
		assert.ok(!source.includes('universeAgentConnectionService.js'));
	});

	test('changes view still injects the connection the entry must register', () => {
		const source = readRepoFile(CHANGES_VIEW_REL);
		assert.ok(source.includes('@IUniverseAgentConnection uaConnection: IUniverseAgentConnection'));
	});
});

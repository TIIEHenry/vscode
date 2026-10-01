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
const WEB_MAIN_REL = 'src/vs/sessions/sessions.web.main.ts';
const DESKTOP_MAIN_REL = 'src/vs/sessions/sessions.desktop.main.ts';

function readRepoFile(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

suite('Sessions web main agent feedback wiring', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('web entry loads browser agentFeedback contribution, not NullAgentFeedbackService', () => {
		const source = readRepoFile(WEB_MAIN_REL);
		assert.ok(source.includes("import './contrib/agentFeedback/browser/agentFeedback.contribution.js';"));
		assert.ok(!source.includes('nullAgentFeedbackService.contribution.js'));
		assert.ok(!source.includes('TODO: support agent feedback in web'));
	});

	test('desktop entry still loads browser agentFeedback contribution once', () => {
		const source = readRepoFile(DESKTOP_MAIN_REL);
		const matches = source.match(/agentFeedback\.contribution\.js/g) ?? [];
		assert.strictEqual(matches.length, 1);
		assert.ok(!source.includes('nullAgentFeedbackService.contribution.js'));
	});
});

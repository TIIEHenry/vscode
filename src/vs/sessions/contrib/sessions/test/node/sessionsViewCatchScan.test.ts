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
const VIEW_REL = 'src/vs/sessions/contrib/sessions/browser/views/sessionsView.ts';

function sessionsViewSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), VIEW_REL),
		path.join(thisDir, '../../browser/views/sessionsView.ts'),
		path.join(thisDir, '../../../../../../../', VIEW_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsView.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(text: string): number {
	const matches = text.match(/\.catch\([a-zA-Z0-9_$.]+\)\s*\.catch\([a-zA-Z0-9_$.]+\)/g);
	return matches ? matches.length : 0;
}

suite('SessionsView leftover fire-and-forget catch scan (D630)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onSessionOpen / onChatOpen then(onOpened) single-catch onUnexpectedError (D630)', () => {
		const source = fs.readFileSync(sessionsViewSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const sites = [
			"this.sessionsService.openSessionToSide(session, { preserveFocus, chatResource: mainChat.resource, source: 'sessionsList' })",
			"this.sessionsService.openChat(session, mainChat.resource, { preserveFocus, source: 'sessionsList' })",
			'this.sessionsService.openChatToSide(session, chat.resource, { preserveFocus })',
			'this.sessionsService.openChat(session, chat.resource, { preserveFocus })',
		] as const;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes("onUnexpectedError(new Error(`Unable to open session because '${resource.toString()}' is not available`));"));
		assert.strictEqual(countDoubleChains(source), 0);
		assert.strictEqual((source.match(/\.then\(onOpened\)\.catch\(onUnexpectedError\)/g) ?? []).length, 4);
		assert.strictEqual((source.match(/\.then\(onOpened\)/g) ?? []).length, 4);
		for (const site of sites) {
			assert.strictEqual((source.split(site).length - 1), 1, `${site} should appear once`);
			assert.ok(source.includes(`${site}.then(onOpened)${singleCatch};`), `${site} missing then + single-catch`);
			assert.ok(!source.includes(`${site}.then(onOpened);`), `${site} leftover bare then`);
		}
	});
});

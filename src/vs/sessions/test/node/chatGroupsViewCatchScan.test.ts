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
const CHAT_GROUPS_REL = 'src/vs/sessions/browser/parts/chatGroupsView.ts';

function chatGroupsViewSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), CHAT_GROUPS_REL),
		path.join(thisDir, '../../browser/parts/chatGroupsView.ts'),
		path.join(thisDir, '../../../../../', CHAT_GROUPS_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `chatGroupsView.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ChatGroupsView leftover fire-and-forget catch scan (D631)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('seven leftover Promise call sites double-catch onUnexpectedError (D631)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(chatGroupsViewSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const calls = [
			'this._onChatDrop(groupId, zone, data)',
			'this._sessionsService.openChat(this._session!, resource)',
			'this._splitChatIntoNewGroup(resource, source, source, \'right\')',
			'this.openChatInNewGroup(resource)',
			'this._sessionsService.openChat(session, URI.parse(activeResourceId))',
			'this._sessionsService.openChat(this._session, resource)',
			'this._splitChatIntoNewGroup(URI.parse(resource), source, source, direction)',
		];
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 7);
		for (const call of calls) {
			const doubleCall = `${call}${doubleCatch};`;
			assert.strictEqual((source.split(doubleCall).length - 1), 1, `expected one double-chain ${call}`);
			assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		}
		assert.ok(!source.includes('this._onChatDrop(groupId, zone, data);'));
		assert.ok(!source.includes('this._sessionsService.openChat(this._session!, resource);'));
		assert.ok(!source.includes('this._splitChatIntoNewGroup(resource, source, source, \'right\');'));
		assert.ok(!source.includes('this.openChatInNewGroup(resource);'));
		assert.ok(!source.includes('this._sessionsService.openChat(session, URI.parse(activeResourceId));'));
		assert.ok(!source.includes('\n\t\t\tthis._sessionsService.openChat(this._session, resource);'));
		assert.ok(!source.includes('this._splitChatIntoNewGroup(URI.parse(resource), source, source, direction);'));
		assert.ok(source.includes('\t\t\tonUnexpectedError(e);'));
	});
});

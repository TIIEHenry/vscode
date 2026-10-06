/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { buildSessionGroupsByRepository } from '../../browser/agentsVoiceWidgetBinding.js';
import type { SessionRowData } from '../../browser/components/sessionListComponent.js';

function row(id: string): SessionRowData {
	return {
		resource: URI.parse(`test://session/${id}`),
		label: id,
		isActive: false,
		needsInput: false,
		isIdle: true,
		isSpeaking: false,
		insertions: 0,
		deletions: 0,
	};
}

suite('agentsVoiceWidgetBinding', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('buildSessionGroupsByRepository covers agent and chat rows', () => {
		const agent = row('agent');
		const chat = row('chat');
		const sessionRows = [agent, chat];
		const groups = buildSessionGroupsByRepository(
			1,
			sessionRows,
			() => 'repo-a',
			'Other',
		);
		assert.ok(groups);
		const all = groups!.flatMap(g => g.sessions);
		assert.strictEqual(all.length, 2);
		const other = groups!.find(g => g.label === 'Other');
		assert.ok(other);
		assert.strictEqual(other.sessions.length, 1);
		assert.strictEqual(other.sessions[0].label, 'chat');
	});

	test('buildSessionGroupsByRepository returns undefined for chat-only rows', () => {
		const groups = buildSessionGroupsByRepository(0, [row('chat')], () => undefined, 'Other');
		assert.strictEqual(groups, undefined);
	});

	test('buildSessionGroupsByRepository puts agent without repo and chat in Other', () => {
		const agent = row('agent');
		const chat = row('chat');
		const groups = buildSessionGroupsByRepository(
			1,
			[agent, chat],
			() => undefined,
			'Other',
		);
		assert.ok(groups);
		assert.strictEqual(groups!.length, 1);
		assert.strictEqual(groups![0].label, 'Other');
		assert.strictEqual(groups![0].sessions.length, 2);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { projectProcessFoldSpans, summarizeProcessSteps, summarizeTrajectoryProcessSteps } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';

suite('conversationProcessFoldModel (browser unit)', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('summarizeProcessSteps uses thinking text before payload for the outer step list', () => {
		const turns: ConversationStubTurn[] = [{
			id: 't1',
			kind: 'thinking',
			text: 'Stub: outline sections',
			payload: 'Stub: Consider intro, setup, usage, and license sections.',
		}, {
			id: 'tool1',
			kind: 'tool',
			text: 'Stub: README.md',
			toolName: 'read',
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const summary = summarizeProcessSteps(span);
		assert.ok(summary.includes('Stub: outline sections'));
		assert.ok(!summary.includes('Consider intro'));
	});

	test('summarizeProcessSteps still falls back to payload when text is the THINKING title', () => {
		const body = `${'甲'.repeat(80)}${'乙'.repeat(41)}`;
		const turns: ConversationStubTurn[] = [{
			id: 't1',
			kind: 'thinking',
			text: 'THINKING',
			payload: body,
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const summary = summarizeProcessSteps(span);
		assert.ok(summary.includes('…'));
		assert.ok(!summary.includes('THINKING'));
	});

	function tool(id: string, toolName: string, toolStatus?: ConversationStubTurn['toolStatus']): ConversationStubTurn {
		return {
			id,
			kind: 'tool',
			text: toolName,
			toolName,
			...(toolStatus !== undefined ? { toolStatus } : {}),
		};
	}

	function summarizeTools(tools: readonly ConversationStubTurn[], showLiveChrome = false): string {
		const span = projectProcessFoldSpans(tools)[0];
		assert.ok(span);
		return summarizeProcessSteps(span, { showLiveChrome });
	}

	test('summarizeProcessSteps appends failed and waiting counts and keeps the Stub prefix', () => {
		assert.strictEqual(summarizeTools([tool('a', 'read', 'failed')]), 'Stub · 1 step · read · 1 failed');
		assert.strictEqual(
			summarizeTools([tool('a', 'read', 'failed'), tool('b', 'write', 'failed')], true),
			'2 steps · read, write · 2 failed',
		);
		assert.strictEqual(summarizeTools([tool('a', 'write', 'pending')]), 'Stub · 1 step · write · 1 waiting');
		assert.strictEqual(
			summarizeTools([
				tool('a', 'write', 'pending'),
				tool('b', 'edit', 'pending'),
				tool('c', 'read', 'completed'),
			]),
			'Stub · 3 steps · write, edit, read · 2 waiting',
		);
		assert.strictEqual(
			summarizeTools([tool('a', 'read', 'failed'), tool('b', 'write', 'pending')], true),
			'2 steps · read, write · 1 failed · 1 waiting',
		);
	});

	test('summarizeProcessSteps does not invent failed or waiting counts without a real status', () => {
		assert.strictEqual(summarizeTools([tool('a', 'read', 'running')], true), '1 step · read');
		assert.strictEqual(summarizeTools([tool('a', 'read', 'cancelled')]), 'Stub · 1 step · read');
		assert.strictEqual(summarizeTools([tool('a', 'read', 'completed')]), 'Stub · 1 step · read');
		assert.strictEqual(summarizeTools([tool('a', 'read')]), 'Stub · 1 step · read');
	});

	test('summarizeProcessSteps counts a pending tool nested on a thinking node', () => {
		const summary = summarizeProcessSteps({
			id: 'fold:t1',
			startIndex: 0,
			endIndex: 2,
			turnIds: ['t1', 'tool1'],
			nodes: [{
				kind: 'thinking',
				turn: { id: 't1', kind: 'thinking', text: 'look' },
				tools: [{ id: 'tool1', kind: 'tool', text: 'write', toolName: 'write', toolStatus: 'pending' }],
			}],
		});
		assert.strictEqual(summary, 'Stub · 2 steps · look, write · 1 waiting');
	});

	test('summarizeTrajectoryProcessSteps does not invent failed or waiting counts', () => {
		const summary = summarizeTrajectoryProcessSteps({
			id: 'fold:t1',
			startIndex: 0,
			endIndex: 2,
			recordIds: ['t1', 'tool1'],
			records: [
				{ id: 't1', kind: 'thinking', text: 'look' },
				{ id: 'tool1', kind: 'tool', text: 'read', result: 'failed' },
			],
		});
		assert.strictEqual(summary, 'Stub · 2 steps · look, tool');
		const live = summarizeTrajectoryProcessSteps({
			id: 'fold:tool1',
			startIndex: 0,
			endIndex: 1,
			recordIds: ['tool1'],
			records: [{ id: 'tool1', kind: 'tool', text: 'read', result: 'failed' }],
		}, { showLiveChrome: true });
		assert.strictEqual(live, '1 step · tool');
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { nestThinkingTools, projectProcessFoldSpans, projectTrajectoryProcessFoldSpans, summarizeProcessSteps, summarizeTrajectoryProcessSteps } from '../../browser/conversationProcessFoldModel.js';
import { ConversationTrajectoryRecord } from '../../browser/conversationTrajectoryModel.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

function turn(id: string, kind: ConversationStubTurn['kind'], text = id): ConversationStubTurn {
	return { id, kind, text };
}

suite('ConversationProcessFold', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('projectProcessFoldSpans returns empty array when no continuous thinking or tool runs exist', () => {
		assert.deepStrictEqual(projectProcessFoldSpans([]), []);
		assert.deepStrictEqual(projectProcessFoldSpans([
			turn('u1', 'user'),
			turn('a1', 'assistant'),
			turn('c1', 'confirmation'),
		]), []);
	});

	test('projectProcessFoldSpans does not create empty spans between boundary turns', () => {
		const turns = [
			turn('u1', 'user'),
			turn('t1', 'thinking', 'outline'),
			turn('tool1', 'tool', 'read'),
			turn('a1', 'assistant'),
			turn('c1', 'confirmation'),
		];

		const spans = projectProcessFoldSpans(turns);
		assert.strictEqual(spans.length, 1);
		assert.strictEqual(spans[0]!.startIndex, 1);
		assert.strictEqual(spans[0]!.endIndex, 3);
		assert.strictEqual(spans[0]!.id, 'fold:t1');
	});

	test('projectProcessFoldSpans splits on user, assistant, and confirmation', () => {
		const turns = [
			turn('t1', 'thinking'),
			turn('u1', 'user'),
			turn('tool1', 'tool'),
			turn('a1', 'assistant'),
			turn('t2', 'thinking'),
			turn('c1', 'confirmation'),
			turn('tool2', 'tool'),
		];

		const spans = projectProcessFoldSpans(turns);
		assert.strictEqual(spans.length, 3);
		assert.deepStrictEqual(spans.map(span => [span.startIndex, span.endIndex]), [
			[0, 1],
			[2, 3],
			[6, 7],
		]);
	});

	test('projectProcessFoldSpans nests tools only within each span segment', () => {
		const turns = [
			turn('t1', 'thinking', 'first'),
			turn('tool1', 'tool', 'read'),
			turn('u1', 'user'),
			turn('t2', 'thinking', 'second'),
			turn('tool2', 'tool', 'write'),
		];

		const spans = projectProcessFoldSpans(turns);
		assert.strictEqual(spans.length, 2);

		const firstSpan = spans[0]!;
		assert.strictEqual(firstSpan.nodes.length, 1);
		assert.strictEqual(firstSpan.nodes[0]!.kind, 'thinking');
		if (firstSpan.nodes[0]!.kind === 'thinking') {
			assert.deepStrictEqual(firstSpan.nodes[0]!.tools.map(tool => tool.id), ['tool1']);
		}

		const secondSpan = spans[1]!;
		assert.strictEqual(secondSpan.nodes.length, 1);
		assert.strictEqual(secondSpan.nodes[0]!.kind, 'thinking');
		if (secondSpan.nodes[0]!.kind === 'thinking') {
			assert.deepStrictEqual(secondSpan.nodes[0]!.tools.map(tool => tool.id), ['tool2']);
		}
	});

	test('projectProcessFoldSpans builds one span for untitled-style thinking/tool alternation', () => {
		const turns = [
			turn('u1', 'user'),
			turn('t1', 'thinking', 'Stub: outline sections'),
			turn('tool1', 'tool', 'Stub: README.md'),
			turn('t2', 'thinking', 'Stub: draft'),
			turn('tool2', 'tool', 'Stub: README.md'),
			turn('a1', 'assistant', 'Done'),
			turn('c1', 'confirmation'),
		];

		const spans = projectProcessFoldSpans(turns);
		assert.strictEqual(spans.length, 1);
		assert.strictEqual(spans[0]!.id, 'fold:t1');
		assert.deepStrictEqual(spans[0]!.turnIds, ['t1', 'tool1', 't2', 'tool2']);
		assert.strictEqual(spans[0]!.nodes.length, 2);

		const firstThinking = spans[0]!.nodes[0];
		const secondThinking = spans[0]!.nodes[1];
		assert.strictEqual(firstThinking?.kind, 'thinking');
		assert.strictEqual(secondThinking?.kind, 'thinking');
		if (firstThinking?.kind === 'thinking' && secondThinking?.kind === 'thinking') {
			assert.deepStrictEqual(firstThinking.tools.map(tool => tool.id), ['tool1']);
			assert.deepStrictEqual(secondThinking.tools.map(tool => tool.id), ['tool2']);
		}
	});

	test('nestThinkingTools attaches tools to the preceding thinking turn only', () => {
		const nodes = nestThinkingTools([
			turn('t1', 'thinking'),
			turn('tool1', 'tool'),
			turn('t2', 'thinking'),
			turn('tool2', 'tool'),
		]);

		assert.strictEqual(nodes.length, 2);
		assert.strictEqual(nodes[0]!.kind, 'thinking');
		assert.strictEqual(nodes[1]!.kind, 'thinking');
		if (nodes[0]!.kind === 'thinking' && nodes[1]!.kind === 'thinking') {
			assert.deepStrictEqual(nodes[0]!.tools.map(tool => tool.id), ['tool1']);
			assert.deepStrictEqual(nodes[1]!.tools.map(tool => tool.id), ['tool2']);
		}
	});

	test('nestThinkingTools keeps standalone tool turns at the top level', () => {
		const nodes = nestThinkingTools([
			turn('tool1', 'tool'),
			turn('t1', 'thinking'),
			turn('tool2', 'tool'),
		]);

		assert.strictEqual(nodes.length, 2);
		assert.strictEqual(nodes[0]!.kind, 'tool');
		assert.strictEqual(nodes[1]!.kind, 'thinking');
		if (nodes[1]!.kind === 'thinking') {
			assert.deepStrictEqual(nodes[1]!.tools.map(tool => tool.id), ['tool2']);
		}
	});

	test('projectProcessFoldSpans uses fold:${firstId} including overlay ids', () => {
		const spans = projectProcessFoldSpans([
			turn('overlay:block-1', 'thinking', 'live think'),
			{ id: 'overlay:block-2', kind: 'tool', text: 'read', toolName: 'read', streaming: true, toolStatus: 'running' },
		]);
		assert.strictEqual(spans.length, 1);
		assert.strictEqual(spans[0]!.id, 'fold:overlay:block-1');
		assert.deepStrictEqual(spans[0]!.turnIds, ['overlay:block-1', 'overlay:block-2']);
	});

	test('projectProcessFoldSpans does not rewrite span id via turnId', () => {
		const spans = projectProcessFoldSpans([
			{ id: 't1', kind: 'thinking', text: 'a', turnId: 'turn-9' },
			{ id: 'tool1', kind: 'tool', text: 'b', turnId: 'turn-9', toolName: 'read' },
		]);
		assert.strictEqual(spans.length, 1);
		assert.strictEqual(spans[0]!.id, 'fold:t1');
	});

	test('summarizeProcessSteps includes Stub prefix and step counts', () => {
		const turns = [
			turn('u1', 'user'),
			turn('t1', 'thinking', 'Stub: outline sections'),
			turn('tool1', 'tool', 'Stub: README.md'),
			turn('t2', 'thinking', 'Stub: draft'),
			turn('tool2', 'tool', 'Stub: README.md'),
			turn('a1', 'assistant', 'Done'),
		];
		const spans = projectProcessFoldSpans(turns);
		assert.strictEqual(spans.length, 1);
		const summary = summarizeProcessSteps(spans[0]!);
		assert.ok(summary.startsWith('Stub · 4 steps ·'));
		assert.ok(summary.includes('thinking ×2'));
		assert.ok(summary.includes('tool ×2'));
		assert.ok(!/loading|live|ms\b/i.test(summary));
		const live = summarizeProcessSteps(spans[0]!, { showLiveChrome: true });
		assert.ok(!live.startsWith('Stub'));
		assert.ok(!/loading|live|ms\b/i.test(live));
	});

	function record(id: string, kind: ConversationTrajectoryRecord['kind'], text = id, extra?: Partial<ConversationTrajectoryRecord>): ConversationTrajectoryRecord {
		return { id, kind, text, ...extra };
	}

	test('projectTrajectoryProcessFoldSpans keeps system and context outside fold segments', () => {
		const records = [
			record('s1', 'system', 'Stub environment'),
			record('c1', 'context', 'Stub: workspace context'),
			record('u1', 'user', 'Help'),
			record('t1', 'thinking', 'Stub: outline'),
			record('tool1', 'tool', 'Stub: README.md', { callId: 'tool1', depth: 0 }),
			record('sub1', 'subtool', 'Stub: nested dispatch', { parentCallId: 'tool1', depth: 1 }),
			record('m1', 'message', 'Done'),
		];

		const spans = projectTrajectoryProcessFoldSpans(records);
		assert.strictEqual(spans.length, 1);
		assert.strictEqual(spans[0]!.startIndex, 3);
		assert.strictEqual(spans[0]!.endIndex, 6);
		assert.deepStrictEqual(spans[0]!.recordIds, ['t1', 'tool1', 'sub1']);
	});

	test('summarizeTrajectoryProcessSteps includes Stub prefix for trajectory spans', () => {
		const records = [
			record('t1', 'thinking', 'Stub: outline'),
			record('tool1', 'tool', 'Stub: README.md'),
			record('sub1', 'subtool', 'Stub: nested dispatch'),
		];
		const spans = projectTrajectoryProcessFoldSpans(records);
		assert.strictEqual(spans.length, 1);
		const summary = summarizeTrajectoryProcessSteps(spans[0]!);
		assert.ok(summary.startsWith('Stub · 3 steps ·'));
		assert.ok(summary.includes('thinking'));
		assert.ok(summary.includes('tool'));
		assert.ok(summary.includes('subtool'));
	});
});

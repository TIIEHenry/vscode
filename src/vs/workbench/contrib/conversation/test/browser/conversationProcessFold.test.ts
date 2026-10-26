/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getWindow } from '../../../../../base/browser/dom.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { conversationProcessFoldToolCancel, conversationProcessFoldToolRespond, renderProcessFoldSpan } from '../../browser/conversationProcessFold.js';
import { cancelToolCall, type IConversationLensSessionBindingHost } from '../../browser/conversationLensSessionBinding.js';
import { nestThinkingTools, projectProcessFoldSpans, projectTrajectoryProcessFoldSpans, summarizeProcessSteps, summarizeThinkingTools, summarizeTrajectoryProcessSteps } from '../../browser/conversationProcessFoldModel.js';
import { ConversationTrajectoryRecord } from '../../browser/conversationTrajectoryModel.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';

function turn(id: string, kind: ConversationStubTurn['kind'], text = id): ConversationStubTurn {
	return { id, kind, text };
}

function foldStepNames(summary: string): string[] {
	const marker = 'steps · ';
	const at = summary.indexOf(marker);
	assert.ok(at >= 0, summary);
	return summary.slice(at + marker.length).split(', ').map(part => part.replace(/ ×\d+$/, ''));
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
		assert.strictEqual(spans.length, 4);
		assert.deepStrictEqual(spans.map(span => [span.startIndex, span.endIndex]), [
			[0, 1],
			[2, 3],
			[4, 5],
			[6, 7],
		]);
	});

	test('projectProcessFoldSpans keeps tools as sibling rows inside each span', () => {
		const turns = [
			turn('t1', 'thinking', 'first'),
			turn('tool1', 'tool', 'read'),
			turn('u1', 'user'),
			turn('t2', 'thinking', 'second'),
			turn('tool2', 'tool', 'write'),
		];

		const spans = projectProcessFoldSpans(turns);
		assert.strictEqual(spans.length, 2);

		assert.deepStrictEqual(spans[0]!.nodes.map(node => [node.kind, node.turn.id]), [
			['thinking', 't1'],
			['tool', 'tool1'],
		]);
		assert.deepStrictEqual(spans[1]!.nodes.map(node => [node.kind, node.turn.id]), [
			['thinking', 't2'],
			['tool', 'tool2'],
		]);
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
		assert.deepStrictEqual(spans[0]!.nodes.map(node => [node.kind, node.turn.id]), [
			['thinking', 't1'],
			['tool', 'tool1'],
			['thinking', 't2'],
			['tool', 'tool2'],
		]);
	});

	test('nestThinkingTools keeps each tool as its own row', () => {
		const nodes = nestThinkingTools([
			turn('t1', 'thinking'),
			turn('tool1', 'tool'),
			turn('t2', 'thinking'),
			turn('tool2', 'tool'),
		]);

		assert.deepStrictEqual(nodes.map(node => [node.kind, node.turn.id]), [
			['thinking', 't1'],
			['tool', 'tool1'],
			['thinking', 't2'],
			['tool', 'tool2'],
		]);
		for (const node of nodes) {
			if (node.kind === 'thinking') {
				assert.deepStrictEqual(node.tools, []);
			}
		}
	});

	test('nestThinkingTools keeps a leading tool ahead of the next thinking row', () => {
		const nodes = nestThinkingTools([
			turn('tool1', 'tool'),
			turn('t1', 'thinking'),
			turn('tool2', 'tool'),
		]);

		assert.deepStrictEqual(nodes.map(node => [node.kind, node.turn.id]), [
			['tool', 'tool1'],
			['thinking', 't1'],
			['tool', 'tool2'],
		]);
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

	test('summarizeThinkingTools keeps nested tool names on a collapsed thinking row', () => {
		assert.strictEqual(summarizeThinkingTools('Stub: draft', []), 'Stub: draft');
		assert.strictEqual(summarizeThinkingTools('Stub: draft', [{ toolName: 'write' }]), 'Stub: draft · write');
		assert.strictEqual(summarizeThinkingTools('Stub: outline sections', [{ toolName: 'read' }, { toolName: 'read' }]), 'Stub: outline sections · read ×2');
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
		assert.ok(summary.includes('Stub: outline sections'));
		assert.ok(summary.includes('Stub: draft'));
		assert.ok(!foldStepNames(summary).includes('thinking'));
		assert.ok(summary.includes('tool ×2'));
		assert.ok(!/loading|live|ms\b/i.test(summary));
		const live = summarizeProcessSteps(spans[0]!, { showLiveChrome: true });
		assert.ok(!live.startsWith('Stub'));
		assert.ok(live.includes('Stub: outline sections'));
		assert.ok(live.includes('Stub: draft'));
		assert.ok(!foldStepNames(live).includes('thinking'));
		assert.ok(live.includes('tool ×2'));
		assert.ok(!/loading|live|ms\b/i.test(live));
	});

	test('summarizeProcessSteps uses a one-line thinking summary and keeps the tool name', () => {
		const turns: ConversationStubTurn[] = [
			{ id: 't1', kind: 'thinking', text: '先看目录再读文件' },
			{ id: 'tool1', kind: 'tool', text: 'README.md', toolName: 'read' },
		];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		assert.strictEqual(span.turnIds.length, 2);
		const summary = summarizeProcessSteps(span);
		assert.strictEqual(summary, 'Stub · 2 steps · 先看目录再读文件, read');
		assert.ok(!foldStepNames(summary).includes('thinking'));
		assert.ok(foldStepNames(summary).includes('read'));
	});

	test('summarizeProcessSteps keeps thinking when the thought is blank', () => {
		const turns: ConversationStubTurn[] = [
			{ id: 't1', kind: 'thinking', text: ' \n\t ' },
			{ id: 'tool1', kind: 'tool', text: 'README.md', toolName: 'read' },
		];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		assert.strictEqual(span.turnIds.length, 2);
		const summary = summarizeProcessSteps(span);
		assert.strictEqual(summary, 'Stub · 2 steps · thinking, read');
		assert.ok(foldStepNames(summary).includes('thinking'));
		assert.ok(foldStepNames(summary).includes('read'));
	});

	test('summarizeProcessSteps summarizes reading-line prose and truncates a long thought', () => {
		const tail = '尾部不应进标题';
		const body = `${'甲'.repeat(80)}\n${'乙'.repeat(80)}${tail}`;
		const turns: ConversationStubTurn[] = [
			{ id: 't1', kind: 'thinking', text: 'THINKING', payload: body },
			{ id: 'tool1', kind: 'tool', text: 'README.md', toolName: 'write' },
		];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		assert.strictEqual(span.turnIds.length, 2);
		const summary = summarizeProcessSteps(span);
		assert.ok(summary.startsWith('Stub · 2 steps · '));
		assert.ok(summary.includes('…'));
		assert.ok(!summary.includes(tail));
		assert.ok(!summary.includes('\n'));
		assert.ok(summary.includes('write'));
		assert.ok(!foldStepNames(summary).includes('thinking'));
		assert.ok(!foldStepNames(summary).includes('THINKING'));
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
		assert.ok(summary.includes('Stub: outline'));
		assert.ok(!foldStepNames(summary).includes('thinking'));
		assert.ok(summary.includes('tool'));
		assert.ok(summary.includes('subtool'));
	});

	test('summarizeTrajectoryProcessSteps uses thinking text unless it is THINKING or blank', () => {
		const proseSpan = projectTrajectoryProcessFoldSpans([
			record('t1', 'thinking', 'hmm\nthen this'),
			record('tool1', 'tool', 'grep the repo', { callId: 'tool1' }),
			record('sub1', 'subtool', 'nested'),
		])[0];
		assert.ok(proseSpan);
		assert.strictEqual(proseSpan.records.length, 3);
		const prose = summarizeTrajectoryProcessSteps(proseSpan);
		assert.strictEqual(prose, 'Stub · 3 steps · hmm then this, tool, subtool');
		assert.ok(!foldStepNames(prose).includes('thinking'));
		assert.ok(foldStepNames(prose).includes('tool'));
		assert.ok(foldStepNames(prose).includes('subtool'));

		const literalSpan = projectTrajectoryProcessFoldSpans([
			record('t1', 'thinking', 'THINKING'),
			record('tool1', 'tool', 'grep the repo'),
		])[0];
		assert.ok(literalSpan);
		assert.strictEqual(literalSpan.records.length, 2);
		assert.strictEqual(summarizeTrajectoryProcessSteps(literalSpan), 'Stub · 2 steps · thinking, tool');

		const blankSpan = projectTrajectoryProcessFoldSpans([
			record('t1', 'thinking', '  \n\t '),
			record('tool1', 'tool', 'grep the repo'),
		])[0];
		assert.ok(blankSpan);
		assert.strictEqual(blankSpan.records.length, 2);
		assert.strictEqual(summarizeTrajectoryProcessSteps(blankSpan), 'Stub · 2 steps · thinking, tool');
	});

	test('executing tool row cancel forwards turn identity', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'e-run',
			kind: 'tool',
			text: 'read',
			toolStatus: 'running',
			agentId: 'sub:a',
			toolCallId: 'tc-1',
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const calls: ConversationStubTurn[] = [];
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			onCancelToolCall: turn => { calls.push(turn); },
		}, disposables);
		const button = host.querySelector('.conversation-process-fold-tool-cancel') as HTMLButtonElement | null;
		assert.ok(button);
		assert.strictEqual(button.getAttribute('aria-label'), conversationProcessFoldToolCancel);
		assert.strictEqual(button.getAttribute('data-tool-call-id'), 'tc-1');
		button.click();
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0]?.id, 'e-run');
		assert.strictEqual(calls[0]?.toolCallId, 'tc-1');
		assert.notStrictEqual(calls[0]?.toolCallId, calls[0]?.id);
		assert.strictEqual(calls[0]?.agentId, 'sub:a');
		disposables.dispose();
	});

	test('executing tool row without a tool_call_id does not paint a stop button', () => {
		const turns: ConversationStubTurn[] = [
			{ id: 'e-blank', kind: 'tool', text: 'read', toolStatus: 'running' },
			{ id: 'overlay:turn-1', kind: 'tool', text: 'bash', toolStatus: 'running', toolCallId: '  tc  ' },
		];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			onCancelToolCall: () => { },
		}, disposables);
		assert.strictEqual(host.querySelector('.conversation-process-fold-tool-cancel'), null);
		disposables.dispose();
	});

	test('each tool name on one arm cancels with its own tool_call_id', () => {
		const turns: ConversationStubTurn[] = [
			{ id: 'e-arm', kind: 'tool', text: 'read_file', toolName: 'read_file', toolStatus: 'running', toolCallId: 'tc-read' },
			{ id: 'e-arm:tool:1', kind: 'tool', text: 'grep', toolName: 'grep', toolStatus: 'running', toolCallId: 'tc-grep' },
		];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const calls: ConversationStubTurn[] = [];
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			onCancelToolCall: turn => { calls.push(turn); },
		}, disposables);
		const buttons = [...host.querySelectorAll('.conversation-process-fold-tool-cancel')] as HTMLButtonElement[];
		assert.deepStrictEqual(buttons.map(button => button.getAttribute('data-tool-call-id')), ['tc-read', 'tc-grep']);
		buttons[0]?.click();
		buttons[1]?.click();
		assert.deepStrictEqual(calls.map(turn => turn.id), ['e-arm', 'e-arm:tool:1']);
		assert.deepStrictEqual(calls.map(turn => turn.toolCallId), ['tc-read', 'tc-grep']);
		disposables.dispose();
	});

	test('cancelToolCall sends toolCallId and does not send the row id', () => {
		const sent: { toolCallId: string; agentId?: string }[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				cancelToolCall: (_sessionId: string, options: { toolCallId: string; agentId?: string }) => {
					sent.push(options);
					return true;
				},
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => true,
			},
			showPostFailure: () => { },
		} as unknown as IConversationLensSessionBindingHost;
		cancelToolCall(host, { id: 'e-run', toolCallId: 'tc-1', agentId: 'sub:a' });
		assert.deepStrictEqual(sent, [{ toolCallId: 'tc-1', agentId: 'sub:a' }]);
		cancelToolCall(host, { id: 'overlay:turn-1', agentId: 'sub:a' });
		cancelToolCall(host, { id: 'e-pad', toolCallId: '  tc  ' });
		cancelToolCall(host, { id: 'e-empty', toolCallId: '' });
		assert.deepStrictEqual(sent, [{ toolCallId: 'tc-1', agentId: 'sub:a' }]);
	});

	test('pairing-hold leftover executing cancel stays disabled and does not fire', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'tc-hold',
			kind: 'tool',
			text: 'read',
			toolStatus: 'running',
			agentId: 'sub:a',
			toolCallId: 'tc-hold',
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const calls: ConversationStubTurn[] = [];
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			writesEnabled: false,
			onCancelToolCall: turn => { calls.push(turn); },
		}, disposables);
		const button = host.querySelector('.conversation-process-fold-tool-cancel') as HTMLButtonElement | null;
		assert.ok(button);
		assert.strictEqual(button.disabled, true);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(button.title, 'This session cannot be edited right now.');
		assert.strictEqual(button.getAttribute('aria-label'), 'Cancel Tool. This session cannot be edited right now.');
		assert.ok((host.textContent ?? '').includes('· Running'));
		button.click();
		assert.deepStrictEqual(calls, []);
		disposables.dispose();
	});

	test('pending tool without live chrome does not show a success check or a spinner', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'tool-pending',
			kind: 'tool',
			text: 'Stub: README.md',
			toolName: 'write',
			toolStatus: 'pending',
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: false,
		}, disposables);
		assert.strictEqual(host.querySelector('.codicon-check'), null);
		assert.strictEqual(host.querySelector('.codicon-loading'), null);
		assert.strictEqual(host.querySelector('[data-fold-executing]'), null);
		disposables.dispose();
	});

	test('stub fixture tool row has no cancel control', () => {
		const turns: ConversationStubTurn[] = [{ id: 'tool1', kind: 'tool', text: 'read', toolStatus: 'completed' }];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: false,
			onCancelToolCall: () => { },
		}, disposables);
		assert.strictEqual(host.querySelector('.conversation-process-fold-tool-cancel'), null);
		assert.ok(host.querySelector('.conversation-process-fold-tool-icon .codicon-check'));
		disposables.dispose();
	});

	test('respondable tool row shows Respond and fires onRespondClientTool', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'call-1',
			kind: 'tool',
			text: 'client',
			toolName: 'clientTool',
			respondable: true,
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const calls: ConversationStubTurn[] = [];
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			onRespondClientTool: turn => { calls.push(turn); },
		}, disposables);
		const button = host.querySelector('.conversation-process-fold-tool-respond') as HTMLButtonElement | null;
		assert.ok(button);
		assert.strictEqual(button.getAttribute('aria-label'), conversationProcessFoldToolRespond);
		button.click();
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0]?.id, 'call-1');
		disposables.dispose();
	});

	test('streaming tool row without respondable does not show Respond', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'overlay:tool',
			kind: 'tool',
			text: 'read',
			toolName: 'read',
			streaming: true,
			toolStatus: 'running',
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			onRespondClientTool: () => { },
		}, disposables);
		assert.strictEqual(host.querySelector('.conversation-process-fold-tool-respond'), null);
		disposables.dispose();
	});

	test('respondable tool Respond stays disabled when writesEnabled is false', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'call-hold',
			kind: 'tool',
			text: 'client',
			respondable: true,
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const calls: ConversationStubTurn[] = [];
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			writesEnabled: false,
			onRespondClientTool: turn => { calls.push(turn); },
		}, disposables);
		const button = host.querySelector('.conversation-process-fold-tool-respond') as HTMLButtonElement | null;
		assert.ok(button);
		assert.strictEqual(button.disabled, true);
		assert.strictEqual(button.getAttribute('aria-disabled'), 'true');
		assert.strictEqual(button.getAttribute('aria-label'), 'Respond. This session cannot be edited right now.');
		assert.strictEqual(button.title, 'Respond. This session cannot be edited right now.');
		button.click();
		assert.deepStrictEqual(calls, []);
		disposables.dispose();
	});

	test('respondable tool shows an inline retryable failure and honors in-flight hold', () => {
		const turn: ConversationStubTurn = {
			id: 'call-failure', kind: 'tool', text: 'client', toolName: 'clientTool', respondable: true,
			respondFailure: { retryable: true, error: 'ipc closed' },
		};
		const span = projectProcessFoldSpans([turn])[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			isRespondInFlight: () => false,
			onRespondClientTool: () => { },
		}, disposables);
		const button = host.querySelector('.conversation-process-fold-tool-respond') as HTMLButtonElement | null;
		assert.ok(button);
		assert.strictEqual(button.disabled, false);
		assert.ok(host.textContent?.includes("Couldn't send this response: ipc closed"));
		disposables.dispose();

		const heldHost = document.createElement('div');
		const heldDisposables = new DisposableStore();
		renderProcessFoldSpan(heldHost, projectProcessFoldSpans([{ ...turn, respondFailure: undefined }])[0]!, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			isRespondInFlight: () => true,
			onRespondClientTool: () => { },
		}, heldDisposables);
		const heldButton = heldHost.querySelector('.conversation-process-fold-tool-respond') as HTMLButtonElement | null;
		assert.ok(heldButton);
		assert.strictEqual(heldButton.disabled, true);
		assert.strictEqual(heldButton.getAttribute('aria-busy'), 'true');
		assert.strictEqual(heldHost.querySelector('.conversation-process-fold-tool')?.getAttribute('aria-busy'), 'true');
		heldDisposables.dispose();
	});

	test('terminal client-tool rows do not keep a Respond CTA', () => {
		const turn: ConversationStubTurn = {
			id: 'call-done', kind: 'tool', text: 'client', toolName: 'clientTool', toolStatus: 'completed', respondable: true,
		};
		const span = projectProcessFoldSpans([turn])[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
			onRespondClientTool: () => { },
		}, disposables);
		assert.strictEqual(host.querySelector('.conversation-process-fold-tool-respond'), null);
		disposables.dispose();
	});

	test('reconcile resyncs thinking row when outer fold reopens after collapse state changed', () => {
		const thinking: ConversationStubTurn = { id: 't1', kind: 'thinking', text: 'draft' };
		const span = projectProcessFoldSpans([thinking])[0];
		assert.ok(span);
		const container = document.createElement('div');
		const disposables = new DisposableStore();
		let outerExpanded = true;
		const thinkingExpanded = new Map<string, boolean>([['t1', true]]);
		const handle = renderProcessFoldSpan(container, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => outerExpanded,
			setOuterExpanded: (_spanId, expanded) => { outerExpanded = expanded; },
			isThinkingExpanded: (turnId) => thinkingExpanded.get(turnId) ?? false,
			setThinkingExpanded: (turnId, expanded) => { thinkingExpanded.set(turnId, expanded); },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: false,
		}, disposables);
		const outerHeader = container.querySelector('.conversation-process-fold-header') as HTMLButtonElement;
		assert.ok(outerHeader);
		outerHeader.click();
		assert.strictEqual(outerExpanded, false);
		thinkingExpanded.set('t1', false);
		handle.update(span);
		outerHeader.click();
		assert.strictEqual(outerExpanded, true);
		const body = container.querySelector('.conversation-process-fold-thinking-body') as HTMLElement;
		assert.ok(body);
		assert.strictEqual(body.hidden, false);
		assert.strictEqual(body.classList.contains('conversation-process-fold--collapsed'), true);
		disposables.dispose();
	});

	test('reconcile clears thinking loading chrome when streaming ends on the same turn', () => {
		const thinking = { id: 't1', kind: 'thinking' as const, text: 'draft', streaming: true };
		const span = projectProcessFoldSpans([thinking])[0];
		assert.ok(span);
		const container = document.createElement('div');
		const disposables = new DisposableStore();
		const handle = renderProcessFoldSpan(container, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => true,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
		}, disposables);
		const summary = container.querySelector('.conversation-process-fold-thinking-summary') as HTMLElement;
		assert.ok(summary);
		assert.ok(summary.textContent?.includes('Loading'));
		thinking.streaming = false;
		handle.update(span);
		assert.ok(!summary.textContent?.includes('Loading'));
		disposables.dispose();
	});

	test('a running tool row shows a spinner and not a completion check', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'tool-running',
			kind: 'tool',
			text: 'read_file',
			toolName: 'read_file',
			toolStatus: 'running',
			streaming: true,
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
		}, disposables);
		assert.strictEqual(host.querySelector('.codicon-check'), null);
		assert.ok(host.querySelector('.codicon-loading'));
		assert.strictEqual(summarizeProcessSteps(span, { showLiveChrome: true }), '1 step · read_file');
		disposables.dispose();
	});

	test('a completed tool row shows a check', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'tool-done',
			kind: 'tool',
			text: 'read_file',
			toolName: 'read_file',
			toolStatus: 'completed',
		}];
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
		}, disposables);
		assert.ok(host.querySelector('.conversation-process-fold-tool-icon .codicon-check'));
		assert.strictEqual(host.querySelector('.codicon-loading'), null);
		disposables.dispose();
	});

	function renderHeaderFold(turns: readonly ConversationStubTurn[], showLiveChrome: boolean, expanded: boolean) {
		const span = projectProcessFoldSpans(turns)[0];
		assert.ok(span);
		const disposables = new DisposableStore();
		const host = document.createElement('div');
		const handle = renderProcessFoldSpan(host, span, {
			defaultOuterExpanded: expanded,
			isOuterExpanded: () => expanded,
			setOuterExpanded: () => { },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome,
		}, disposables);
		return { host, disposables, handle };
	}

	function headerOf(host: HTMLElement): HTMLElement {
		const header = host.querySelector('.conversation-process-fold-header');
		assert.ok(header instanceof HTMLElement);
		return header;
	}

	test('collapsed and expanded headers show an error icon when a step failed', () => {
		const turns: ConversationStubTurn[] = [{
			id: 'tool-failed',
			kind: 'tool',
			text: 'read',
			toolName: 'read',
			toolStatus: 'failed',
		}];
		for (const expanded of [false, true]) {
			const { host, disposables } = renderHeaderFold(turns, false, expanded);
			const header = headerOf(host);
			const icon = header.querySelector('.conversation-process-fold-status');
			assert.ok(icon?.classList.contains('codicon-error'));
			assert.ok(icon?.classList.contains('conversation-process-fold-status--error'));
			assert.strictEqual(header.querySelector('.conversation-process-fold-chevron')?.nextElementSibling, icon);
			assert.strictEqual(icon?.nextElementSibling?.classList.contains('conversation-process-fold-summary'), true);
			assert.strictEqual(header.querySelector('.codicon-loading'), null);
			assert.strictEqual(header.querySelector('.codicon-check'), null);
			assert.strictEqual(header.querySelector('.conversation-process-fold-summary')?.textContent, 'Stub · 1 step · read');
			assert.strictEqual(header.querySelector('.conversation-process-fold-statuses')?.textContent, '1 failed');
			const aria = header.getAttribute('aria-label') ?? '';
			assert.ok(aria.includes('1 failed'));
			assert.ok(aria.includes(expanded ? 'expanded' : 'collapsed'));
			disposables.dispose();
		}
	});

	test('header shows a loading icon while a tool is running with live chrome and none without it', () => {
		const running: ConversationStubTurn = {
			id: 'tool-running',
			kind: 'tool',
			text: 'read_file',
			toolName: 'read_file',
			toolStatus: 'running',
		};
		const pending: ConversationStubTurn = {
			id: 'tool-pending',
			kind: 'tool',
			text: 'write',
			toolName: 'write',
			toolStatus: 'pending',
		};
		for (const expanded of [false, true]) {
			const live = renderHeaderFold([running], true, expanded);
			const liveHeader = headerOf(live.host);
			const loading = liveHeader.querySelector('.conversation-process-fold-status');
			assert.ok(loading?.classList.contains('codicon-loading'));
			assert.ok(loading?.classList.contains('ua-motion'));
			assert.ok(loading?.classList.contains('conversation-process-fold-status--loading'));
			assert.strictEqual(liveHeader.querySelector('.codicon-error'), null);
			assert.strictEqual(liveHeader.querySelector('.codicon-check'), null);
			assert.strictEqual(liveHeader.querySelector('.conversation-process-fold-chevron')?.nextElementSibling, loading);
			live.disposables.dispose();
		}
		const quiet = renderHeaderFold([running], false, false);
		assert.strictEqual(headerOf(quiet.host).querySelector('.conversation-process-fold-status'), null);
		assert.strictEqual(quiet.host.querySelector('.codicon-loading'), null);
		quiet.disposables.dispose();

		const waiting = renderHeaderFold([pending], true, false);
		const waitingHeader = headerOf(waiting.host);
		assert.ok(waitingHeader.querySelector('.conversation-process-fold-status.codicon-loading'));
		assert.strictEqual(waitingHeader.querySelector('.conversation-process-fold-summary')?.textContent, '1 step · write');
		assert.strictEqual(waitingHeader.querySelector('.conversation-process-fold-statuses')?.textContent, '1 waiting');
		assert.ok(waitingHeader.getAttribute('aria-label')?.includes('1 waiting'));
		waiting.disposables.dispose();
	});

	test('header has no status icon when every tool completed', () => {
		const { host, disposables } = renderHeaderFold([{
			id: 'tool-done',
			kind: 'tool',
			text: 'read_file',
			toolName: 'read_file',
			toolStatus: 'completed',
		}], true, true);
		const header = headerOf(host);
		assert.strictEqual(header.querySelector('.conversation-process-fold-status'), null);
		assert.strictEqual(header.querySelector('.codicon-check'), null);
		assert.strictEqual(header.querySelector('.codicon-error'), null);
		assert.strictEqual(header.querySelector('.codicon-loading'), null);
		assert.ok(host.querySelector('.conversation-process-fold-tool-icon .codicon-check'));
		assert.strictEqual(header.querySelector('.conversation-process-fold-summary')?.textContent, '1 step · read_file');
		disposables.dispose();
	});

	test('header icon follows span updates and prefers loading over error while a tool is still running', () => {
		const running: ConversationStubTurn = { id: 'run', kind: 'tool', text: 'read', toolName: 'read', toolStatus: 'running' };
		const failed: ConversationStubTurn = { id: 'bad', kind: 'tool', text: 'write', toolName: 'write', toolStatus: 'failed' };
		const { host, disposables, handle } = renderHeaderFold([running, failed], true, false);
		const header = headerOf(host);
		assert.ok(header.querySelector('.conversation-process-fold-status.codicon-loading'));
		assert.strictEqual(header.querySelector('.codicon-error'), null);
		assert.strictEqual(header.querySelector('.conversation-process-fold-summary')?.textContent, '2 steps · read, write');
		assert.strictEqual(header.querySelector('.conversation-process-fold-statuses')?.textContent, '1 failed');

		const failedOnly = projectProcessFoldSpans([failed])[0];
		assert.ok(failedOnly);
		handle.update(failedOnly);
		assert.ok(header.querySelector('.conversation-process-fold-status.codicon-error'));
		assert.strictEqual(header.querySelector('.codicon-loading'), null);
		assert.strictEqual(header.querySelector('.conversation-process-fold-summary')?.textContent, '1 step · write');
		assert.strictEqual(header.querySelector('.conversation-process-fold-statuses')?.textContent, '1 failed');
		assert.ok(header.getAttribute('aria-label')?.includes('1 failed'));
		assert.ok(header.getAttribute('aria-label')?.includes('collapsed'));

		const done = projectProcessFoldSpans([{ ...failed, toolStatus: 'completed' }])[0];
		assert.ok(done);
		handle.update(done);
		assert.strictEqual(header.querySelector('.conversation-process-fold-status'), null);
		assert.strictEqual(header.querySelector('.codicon-check'), null);
		assert.strictEqual(header.querySelector('.conversation-process-fold-summary')?.textContent, '1 step · write');
		disposables.dispose();
	});

	test('cancelled fold headers retain a distinct status across expansion and live modes', () => {
		for (const showLiveChrome of [false, true]) {
			for (const expanded of [false, true]) {
				const { host, disposables } = renderHeaderFold([{
					id: 'cancelled', kind: 'tool', text: 'write', toolName: 'write', toolStatus: 'cancelled',
				}], showLiveChrome, expanded);
				const header = headerOf(host);
				assert.deepStrictEqual({
					icon: header.querySelector('.conversation-process-fold-status')?.classList.contains('codicon-circle-slash'),
					counts: header.querySelector('.conversation-process-fold-statuses')?.textContent,
					spoken: header.getAttribute('aria-label')?.includes('1 cancelled'),
					expanded: header.getAttribute('aria-expanded'),
					completion: header.querySelector('.codicon-check'),
				}, { icon: true, counts: '1 cancelled', spoken: true, expanded: String(expanded), completion: null });
				disposables.dispose();
			}
		}
	});

	test('fold status updates keep executing and failure priority while retaining cancellation counts', () => {
		const running: ConversationStubTurn = { id: 'run', kind: 'tool', text: 'read', toolName: 'read', toolStatus: 'running' };
		const failed: ConversationStubTurn = { id: 'bad', kind: 'tool', text: 'write', toolName: 'write', toolStatus: 'failed' };
		const cancelled: ConversationStubTurn = { id: 'cancel', kind: 'tool', text: 'edit', toolName: 'edit', toolStatus: 'cancelled' };
		const pending: ConversationStubTurn = { id: 'wait', kind: 'tool', text: 'delete', toolName: 'delete', toolStatus: 'pending' };
		const rendered = renderHeaderFold([running, failed, cancelled, pending], true, false);
		const header = headerOf(rendered.host);
		const counts = () => [...header.querySelectorAll('.conversation-process-fold-status-count')].map(element => element.textContent);
		assert.deepStrictEqual({ loading: !!header.querySelector('.codicon-loading'), counts: counts() }, {
			loading: true, counts: ['1 failed', '1 waiting', '1 cancelled'],
		});
		const states: { readonly turns: readonly ConversationStubTurn[]; readonly icon: string | undefined; readonly status: string[] }[] = [
			{ turns: [failed, cancelled], icon: 'codicon-error', status: ['1 failed', '1 cancelled'] },
			{ turns: [cancelled], icon: 'codicon-circle-slash', status: ['1 cancelled'] },
			{ turns: [{ ...cancelled, toolStatus: 'completed' }], icon: undefined, status: [] },
			{ turns: [{ ...cancelled, toolStatus: undefined }], icon: undefined, status: [] },
		];
		for (const state of states) {
			rendered.handle.update(projectProcessFoldSpans(state.turns)[0]);
			const icon = header.querySelector('.conversation-process-fold-status');
			assert.deepStrictEqual({
				headerPreserved: headerOf(rendered.host) === header,
				icon: state.icon ? icon?.classList.contains(state.icon) : icon === null,
				counts: counts(),
				hidden: (header.querySelector('.conversation-process-fold-statuses') as HTMLElement).hidden,
				spokenCancellation: header.getAttribute('aria-label')?.includes('cancelled'),
			}, { headerPreserved: true, icon: true, counts: state.status, hidden: state.status.length === 0, spokenCancellation: state.status.some(text => text.includes('cancelled')) });
		}
		rendered.disposables.dispose();
	});

	test('unknown tools do not acquire completion checks in live or Stub mode', () => {
		for (const showLiveChrome of [false, true]) {
			const { host, disposables } = renderHeaderFold([{
				id: 'unknown', kind: 'tool', text: 'read', toolName: 'read',
			}], showLiveChrome, true);
			assert.deepStrictEqual({
				completed: host.querySelector('.codicon-check'),
				cancelled: host.querySelector('.codicon-circle-slash'),
				status: headerOf(host).querySelector('.conversation-process-fold-statuses')?.textContent,
			}, { completed: null, cancelled: null, status: '' });
			disposables.dispose();
		}
	});

	test('separate status text remains part of the one fold button and its full accessible name', () => {
		const { host, disposables } = renderHeaderFold([{
			id: 'cancelled', kind: 'tool', text: 'write', toolName: 'write', toolStatus: 'cancelled',
		}], true, false);
		const header = headerOf(host);
		const status = header.querySelector<HTMLElement>('.conversation-process-fold-status-count')!;
		status.click();
		assert.deepStrictEqual({
			button: header.tagName,
			headerTabIndex: header.tabIndex,
			statusTabIndex: status.tabIndex,
			expanded: header.getAttribute('aria-expanded'),
			name: header.getAttribute('aria-label'),
		}, {
			button: 'BUTTON', headerTabIndex: 0, statusTabIndex: -1, expanded: 'true',
			name: 'Process steps, 1 step · write · 1 cancelled, expanded',
		});
		disposables.dispose();
	});

	for (const theme of ['vs', 'vs-dark', 'hc-black', 'hc-light']) {
		test(`production fold CSS keeps mixed status counts visible at narrow widths in ${theme}`, async () => {
			const store = new DisposableStore();
			try {
				const stylesheet = document.createElement('link');
				stylesheet.rel = 'stylesheet';
				stylesheet.href = new URL('../../browser/media/conversationLens.css', import.meta.url).href;
				store.add(toDisposable(() => stylesheet.remove()));
				await new Promise<void>((resolve, reject) => {
					stylesheet.onload = () => resolve();
					stylesheet.onerror = () => reject(new Error('Conversation stylesheet failed to load'));
					document.head.appendChild(stylesheet);
				});
				const workbench = document.createElement('div');
				workbench.className = `monaco-workbench ${theme}`;
				workbench.style.fontFamily = 'sans-serif';
				workbench.style.setProperty('--vscode-foreground', theme === 'vs' || theme === 'hc-light' ? '#292929' : '#FFFFFF');
				workbench.style.setProperty('--vscode-descriptionForeground', theme === 'vs' || theme === 'hc-light' ? '#616161' : '#CCCCCC');
				workbench.style.setProperty('--vscode-focusBorder', '#0078D4');
				workbench.style.setProperty('--vscode-contrastBorder', '#0078D4');
				const part = document.createElement('div');
				part.className = 'part conversation';
				workbench.appendChild(part);
				document.body.appendChild(workbench);
				store.add(toDisposable(() => workbench.remove()));
				const longName = 'read_and_validate_a_very_long_workspace_path_'.repeat(6);
				const rendered = renderHeaderFold([
					{ id: 'failed', kind: 'tool', text: longName, toolName: longName, toolStatus: 'failed' },
					{ id: 'waiting', kind: 'tool', text: 'write', toolName: 'write', toolStatus: 'pending' },
					{ id: 'cancelled', kind: 'tool', text: 'edit', toolName: 'edit', toolStatus: 'cancelled' },
				], false, false);
				store.add(rendered.disposables);
				part.appendChild(rendered.host);
				const header = headerOf(rendered.host);
				const statuses = header.querySelector<HTMLElement>('.conversation-process-fold-statuses')!;
				const summary = header.querySelector<HTMLElement>('.conversation-process-fold-summary')!;
				for (const width of [300, 450, 720, 300]) {
					workbench.style.width = `${width}px`;
					const bounds = header.getBoundingClientRect();
					const counts = [...statuses.querySelectorAll<HTMLElement>('.conversation-process-fold-status-count')];
					assert.deepStrictEqual(counts.map(element => element.textContent), ['1 failed', '1 waiting', '1 cancelled']);
					for (const count of counts) {
						const countBounds = count.getBoundingClientRect();
						assert.ok(countBounds.width > 0 && countBounds.left >= bounds.left && countBounds.right <= bounds.right + 1, `${width}: ${count.textContent} stays inside the header`);
						assert.ok(count.scrollWidth <= count.clientWidth + 1 && count.scrollHeight <= count.clientHeight + 1, `${width}: ${count.textContent} is not clipped`);
					}
					assert.ok(header.scrollWidth <= header.clientWidth + 1, `${width}: header does not overflow`);
					assert.ok(statuses.scrollWidth <= statuses.clientWidth + 1, `${width}: status group does not overflow`);
					assert.ok(summary.scrollWidth > summary.clientWidth, `${width}: only the long step names require truncation`);
					assert.strictEqual(getWindow(summary).getComputedStyle(summary).textOverflow, 'ellipsis');
					assert.ok(header.getAttribute('aria-label')?.includes('1 failed · 1 waiting · 1 cancelled'));
				}
			} finally {
				store.dispose();
			}
		});
	}

	test('live streaming thinking stays open and does not store the forced expansion', () => {
		const thinking = { id: 't1', kind: 'thinking' as const, text: 'draft', streaming: true };
		const span = projectProcessFoldSpans([thinking])[0];
		assert.ok(span);
		const container = document.createElement('div');
		const disposables = new DisposableStore();
		let outerExpanded = false;
		const outerSets: boolean[] = [];
		const thinkingExpanded = new Map<string, boolean>();
		const thinkingSets: boolean[] = [];
		const handle = renderProcessFoldSpan(container, span, {
			defaultOuterExpanded: false,
			isOuterExpanded: () => outerExpanded,
			setOuterExpanded: (_spanId, expanded) => { outerExpanded = expanded; outerSets.push(expanded); },
			isThinkingExpanded: (turnId) => thinkingExpanded.get(turnId) ?? false,
			setThinkingExpanded: (turnId, expanded) => { thinkingExpanded.set(turnId, expanded); thinkingSets.push(expanded); },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: true,
		}, disposables);

		const outerHeader = container.querySelector('.conversation-process-fold-header') as HTMLButtonElement;
		const children = container.querySelector('.conversation-process-fold-children') as HTMLElement;
		const thinkingHeader = container.querySelector('.conversation-process-fold-thinking-header') as HTMLButtonElement;
		const body = container.querySelector('.conversation-process-fold-thinking-body') as HTMLElement;
		const tools = container.querySelector('.conversation-process-fold-thinking-tools') as HTMLElement;
		assert.ok(outerHeader);
		assert.ok(children);
		assert.ok(thinkingHeader);
		assert.ok(body);
		assert.ok(tools);
		assert.strictEqual(outerHeader.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(children.hidden, false);
		assert.strictEqual(children.classList.contains('conversation-process-fold--collapsed'), false);
		assert.strictEqual(body.hidden, false);
		assert.strictEqual(body.classList.contains('conversation-process-fold--collapsed'), false);
		assert.strictEqual(tools.hidden, false);
		assert.strictEqual(thinkingHeader.getAttribute('aria-expanded'), 'true');
		assert.strictEqual(thinkingHeader.getAttribute('aria-disabled'), 'true');

		outerHeader.click();
		thinkingHeader.click();
		assert.deepStrictEqual(outerSets, []);
		assert.strictEqual(outerExpanded, false);
		assert.deepStrictEqual(thinkingSets, []);
		assert.strictEqual(thinkingExpanded.has('t1'), false);
		assert.strictEqual(children.classList.contains('conversation-process-fold--collapsed'), false);
		assert.strictEqual(body.classList.contains('conversation-process-fold--collapsed'), false);
		assert.strictEqual(tools.hidden, false);

		thinking.streaming = false;
		handle.update(span);
		assert.deepStrictEqual(thinkingSets, []);
		assert.strictEqual(thinkingExpanded.has('t1'), false);
		assert.strictEqual(outerExpanded, false);
		assert.strictEqual(outerHeader.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(children.classList.contains('conversation-process-fold--collapsed'), true);
		assert.strictEqual(children.hidden, false);
		assert.strictEqual(thinkingHeader.getAttribute('aria-expanded'), 'false');
		assert.strictEqual(thinkingHeader.getAttribute('aria-disabled'), null);
		assert.strictEqual(body.classList.contains('conversation-process-fold--collapsed'), true);
		assert.strictEqual(body.hidden, false);
		assert.strictEqual(tools.hidden, true);
		disposables.dispose();
	});

	test('streaming thinking without live chrome still toggles', () => {
		const thinking = { id: 't1', kind: 'thinking' as const, text: 'draft', streaming: true };
		const span = projectProcessFoldSpans([thinking])[0];
		assert.ok(span);
		const container = document.createElement('div');
		const disposables = new DisposableStore();
		const thinkingExpanded = new Map<string, boolean>();
		renderProcessFoldSpan(container, span, {
			defaultOuterExpanded: true,
			isOuterExpanded: () => true,
			setOuterExpanded: () => { },
			isThinkingExpanded: (turnId) => thinkingExpanded.get(turnId) ?? false,
			setThinkingExpanded: (turnId, expanded) => { thinkingExpanded.set(turnId, expanded); },
			isToolExpanded: () => false,
			setToolExpanded: () => { },
			onLayoutChange: () => { },
			showLiveChrome: false,
		}, disposables);

		const header = container.querySelector('.conversation-process-fold-thinking-header') as HTMLButtonElement;
		const body = container.querySelector('.conversation-process-fold-thinking-body') as HTMLElement;
		assert.ok(header);
		assert.ok(body);
		assert.strictEqual(header.getAttribute('aria-disabled'), null);
		assert.strictEqual(body.classList.contains('conversation-process-fold--collapsed'), true);

		header.click();
		assert.strictEqual(thinkingExpanded.get('t1'), true);
		assert.strictEqual(body.classList.contains('conversation-process-fold--collapsed'), false);
		assert.strictEqual(header.getAttribute('aria-expanded'), 'true');

		header.click();
		assert.strictEqual(thinkingExpanded.get('t1'), false);
		assert.strictEqual(body.classList.contains('conversation-process-fold--collapsed'), true);
		assert.strictEqual(header.getAttribute('aria-expanded'), 'false');
		disposables.dispose();
	});

	test('executing tool row stays open on header click and a settled tool row still toggles', () => {
		const running = {
			id: 'run',
			kind: 'tool' as const,
			text: 'read',
			toolName: 'read',
			payload: '{ "path": "a.ts" }',
			toolStatus: 'running' as 'running' | 'completed',
			streaming: true,
			toolCallId: 'tc-run',
			respondable: true as const,
		};
		const settled: ConversationStubTurn = {
			id: 'done',
			kind: 'tool',
			text: 'write',
			toolName: 'write',
			payload: '{ "path": "b.ts" }',
			toolStatus: 'completed',
		};
		const span = projectProcessFoldSpans([running, settled])[0];
		assert.ok(span);
		const container = document.createElement('div');
		const disposables = new DisposableStore();
		const toolExpanded = new Map<string, boolean>();
		const outerSets: boolean[] = [];
		const cancelled: string[] = [];
		const responded: string[] = [];
		const handle = renderProcessFoldSpan(container, span, {
			defaultOuterExpanded: false,
			isOuterExpanded: () => false,
			setOuterExpanded: (_spanId, expanded) => { outerSets.push(expanded); },
			isThinkingExpanded: () => false,
			setThinkingExpanded: () => { },
			isToolExpanded: (turnId) => toolExpanded.get(turnId) ?? false,
			setToolExpanded: (turnId, expanded) => { toolExpanded.set(turnId, expanded); },
			onCancelToolCall: turn => { cancelled.push(turn.id); },
			onRespondClientTool: turn => { responded.push(turn.id); },
			onLayoutChange: () => { },
			showLiveChrome: true,
		}, disposables);

		const children = container.querySelector('.conversation-process-fold-children') as HTMLElement;
		assert.ok(children);
		assert.strictEqual(children.classList.contains('conversation-process-fold--collapsed'), false);
		(container.querySelector('.conversation-process-fold-header') as HTMLButtonElement).click();
		assert.deepStrictEqual(outerSets, []);
		assert.strictEqual(children.classList.contains('conversation-process-fold--collapsed'), false);

		const runRow = container.querySelector('.conversation-process-fold-tool[data-turn-id="run"]') as HTMLElement;
		const runHeader = runRow.querySelector('.conversation-process-fold-tool-header') as HTMLButtonElement;
		const runBody = runRow.querySelector('.conversation-process-fold-tool-body') as HTMLElement;
		assert.ok(runHeader);
		assert.ok(runBody);
		assert.strictEqual(runBody.hidden, false);
		assert.strictEqual(runBody.classList.contains('conversation-process-fold--collapsed'), false);
		assert.strictEqual(runHeader.getAttribute('aria-expanded'), 'true');
		runHeader.click();
		assert.strictEqual(toolExpanded.has('run'), false);
		assert.strictEqual(runBody.classList.contains('conversation-process-fold--collapsed'), false);

		(runRow.querySelector('.conversation-process-fold-tool-cancel') as HTMLButtonElement).click();
		(runRow.querySelector('.conversation-process-fold-tool-respond') as HTMLButtonElement).click();
		assert.deepStrictEqual(cancelled, ['run']);
		assert.deepStrictEqual(responded, ['run']);
		assert.strictEqual(runBody.classList.contains('conversation-process-fold--collapsed'), false);

		const doneRow = container.querySelector('.conversation-process-fold-tool[data-turn-id="done"]') as HTMLElement;
		const doneHeader = doneRow.querySelector('.conversation-process-fold-tool-header') as HTMLButtonElement;
		const doneBody = doneRow.querySelector('.conversation-process-fold-tool-body') as HTMLElement;
		assert.ok(doneHeader);
		assert.ok(doneBody);
		assert.strictEqual(doneBody.classList.contains('conversation-process-fold--collapsed'), true);
		doneHeader.click();
		assert.strictEqual(toolExpanded.get('done'), true);
		assert.strictEqual(doneBody.classList.contains('conversation-process-fold--collapsed'), false);
		doneHeader.click();
		assert.strictEqual(toolExpanded.get('done'), false);
		assert.strictEqual(doneBody.classList.contains('conversation-process-fold--collapsed'), true);

		running.toolStatus = 'completed';
		running.streaming = false;
		handle.update(span);
		assert.strictEqual(toolExpanded.has('run'), false);
		assert.strictEqual(runBody.classList.contains('conversation-process-fold--collapsed'), true);
		assert.strictEqual(runBody.hidden, false);
		disposables.dispose();
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
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
		const turns: ConversationStubTurn[] = [{ id: 'tool1', kind: 'tool', text: 'read' }];
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
		button.click();
		assert.deepStrictEqual(calls, []);
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
		assert.strictEqual(body.hidden, true);
		disposables.dispose();
	});

	test('reconcile clears thinking loading chrome when streaming ends on the same turn', () => {
		const thinking = { id: 't1', kind: 'thinking', text: 'draft', streaming: true };
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
		assert.strictEqual(summarizeProcessSteps(span, { showLiveChrome: true }), '1 steps · read_file');
		disposables.dispose();
	});
});

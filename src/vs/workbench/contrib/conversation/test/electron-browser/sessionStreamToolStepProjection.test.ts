/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applyViewPatches } from '../../../../../platform/universeAgent/common/sessionView/apply.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/empty-snapshot.js';
import type { SessionId, SessionViewSnapshot, TimelineItemView } from '../../../../../platform/universeAgent/common/sessionView/types.js';
import { clearCorrelatedToolStepsForTests, foldDomainStreamEvent } from '../../../../../platform/universeAgent/node/sessionCore/stream-event-to-view-patch.js';
import { demuxSessionStreamPayload } from '../../../../../platform/universeAgent/node/sessionStreamDemux.js';
import { projectProcessFoldSpans, summarizeProcessSteps } from '../../browser/conversationProcessFoldModel.js';
import { entriesToRenderableTurns, projectSnapshotToEntries } from '../../browser/conversationSessionView.js';
import { projectSnapshotToTrajectory } from '../../browser/conversationTrajectoryModel.js';

function bodyOf(event: unknown): Record<string, unknown> {
	assert.ok(event && typeof event === 'object');
	const body = (event as { body?: unknown }).body;
	assert.ok(body && typeof body === 'object');
	return body as Record<string, unknown>;
}

function toolEnvelope(id: string, seq: number, blocks: readonly object[], turnId?: string): unknown {
	const events = demuxSessionStreamPayload({
		envelope_appended: {
			envelope: {
				id,
				seq,
				role: 'ASSISTANT',
				...(turnId !== undefined ? { turn_id: turnId } : {}),
				blocks,
			},
		},
	});
	assert.strictEqual(events.length, 1);
	return events[0];
}

function applyToolEvents(events: readonly unknown[]): SessionViewSnapshot {
	let snapshot = emptySessionViewSnapshot('sess-tool-step' as SessionId);
	for (const event of events) {
		const folded = foldDomainStreamEvent(event);
		assert.strictEqual(folded.kind, 'patches');
		if (folded.kind !== 'patches') {
			continue;
		}
		snapshot = applyViewPatches(snapshot, folded.patches);
	}
	return snapshot;
}

function toolRows(snapshot: SessionViewSnapshot): TimelineItemView[] {
	return snapshot.timeline.filter(item => item.summary.kind === 'tool');
}

function assertArmEntries(
	entries: readonly { id: string; kind: string; text: string; toolStatus?: string; streaming?: boolean; payload?: string }[],
	status: 'running' | 'completed',
	payload?: string,
): void {
	assert.ok(entries.length >= 1);
	assert.ok(entries.every(entry => entry.id === 'e-arm' || entry.id.startsWith('e-arm:')));
	const tools = entries.filter(entry => entry.kind === 'tool');
	assert.ok(tools.length >= 1);
	assert.ok(tools.every(entry => entry.toolStatus === status));
	if (status === 'running') {
		assert.ok(tools.every(entry => entry.streaming === true));
	} else {
		assert.ok(tools.every(entry => entry.streaming === undefined));
	}
	if (payload !== undefined) {
		const named = tools.find(entry => entry.text === 'read_file');
		assert.strictEqual((named ?? tools[0])?.payload, payload);
	}
	if (entries.some(entry => entry.kind === 'thinking')) {
		assert.deepStrictEqual(entries.map(entry => `${entry.kind}:${entry.text}`), [
			'thinking:hmm',
			'assistant:I will check.',
			'tool:read_file',
			'tool:grep',
		]);
	}
}

suite('sessionStreamDemux tool steps through the conversation projection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a tool call with no result stays running until the same tool_call_id writes the result back', () => {
		clearCorrelatedToolStepsForTests();
		try {
			const call = toolEnvelope('e-run', 4, [{
				block_type: 2,
				tool_call_block: {
					tool_call_id: 'tc-run',
					tool_name: 'read_file',
					arguments_json: '{"path":"a.ts"}',
				},
			}], 'turn-run');
			const callBody = bodyOf(call);
			assert.strictEqual(callBody.status, 'running');
			assert.strictEqual(callBody.toolCallId, 'tc-run');
			assert.ok(!Object.hasOwn(callBody, 'toolCallIds'));

			const running = applyToolEvents([call]);
			assert.strictEqual(toolRows(running).length, 1);
			const runningItem = toolRows(running)[0]!;
			assert.strictEqual(String(runningItem.id), 'e-run');
			assert.strictEqual(runningItem.orderKey, '0000000000000004');
			assert.strictEqual(runningItem.turnId, 'turn-run');
			assert.strictEqual(runningItem.summary.kind === 'tool' && runningItem.summary.status, 'running');
			assert.strictEqual(runningItem.summary.kind === 'tool' && runningItem.summary.argPreview, '{"path":"a.ts"}');

			const runningEntries = projectSnapshotToEntries(running, new Map(), new Map());
			assert.strictEqual(runningEntries.length, 1);
			assert.strictEqual(runningEntries[0]?.kind, 'tool');
			assert.strictEqual(runningEntries[0]?.id, 'e-run');
			assert.strictEqual(runningEntries[0]?.toolName, 'read_file');
			assert.strictEqual(runningEntries[0]?.toolStatus, 'running');
			assert.strictEqual(runningEntries[0]?.toolCallId, 'tc-run');
			assert.notStrictEqual(runningEntries[0]?.toolCallId, runningEntries[0]?.id);
			assert.strictEqual(runningEntries[0]?.streaming, true);
			assert.strictEqual(runningItem.summary.kind === 'tool' && runningItem.summary.toolCallId, 'tc-run');
			assert.ok(runningItem.summary.kind !== 'tool' || !Object.hasOwn(runningItem.summary, 'toolCallIds'));
			const runningTurn = entriesToRenderableTurns(runningEntries)[0];
			assert.strictEqual(runningTurn?.id, 'e-run');
			assert.strictEqual(runningTurn?.toolCallId, 'tc-run');
			const runningSpan = projectProcessFoldSpans(entriesToRenderableTurns(runningEntries))[0];
			assert.ok(runningSpan);
			assert.strictEqual(summarizeProcessSteps(runningSpan, { showLiveChrome: true }), '1 step · read_file');
			assert.strictEqual(projectSnapshotToTrajectory(running, new Map(), new Map()).filter(record => record.kind === 'tool').length, 1);

			const done = toolEnvelope('e-done', 5, [{
				block_type: 3,
				tool_result_block: {
					tool_call_id: 'tc-run',
					tool_name: 'read_file',
					content: 'file body',
					is_error: false,
				},
			}], 'turn-run');
			assert.strictEqual(bodyOf(done).status, 'completed');
			assert.strictEqual(bodyOf(done).toolCallId, 'tc-run');
			assert.strictEqual(bodyOf(done).resultPreview, 'file body');

			const finished = applyToolEvents([call, done]);
			assert.strictEqual(toolRows(finished).length, 1);
			const finishedItem = toolRows(finished)[0]!;
			assert.strictEqual(String(finishedItem.id), 'e-run');
			assert.strictEqual(finishedItem.orderKey, '0000000000000004');
			assert.strictEqual(finishedItem.turnId, 'turn-run');
			assert.strictEqual(finishedItem.summary.kind === 'tool' && finishedItem.summary.status, 'completed');
			assert.strictEqual(finishedItem.summary.kind === 'tool' && finishedItem.summary.resultPreview, 'file body');
			assert.strictEqual(finishedItem.summary.kind === 'tool' && finishedItem.summary.argPreview, '{"path":"a.ts"}');
			assert.strictEqual(finishedItem.summary.kind === 'tool' && finishedItem.summary.toolName, 'read_file');
			assert.strictEqual(finishedItem.summary.kind === 'tool' && finishedItem.summary.toolCallId, 'tc-run');

			const finishedEntries = projectSnapshotToEntries(finished, new Map(), new Map());
			assert.strictEqual(finishedEntries.filter(entry => entry.kind === 'tool').length, 1);
			assert.strictEqual(finishedEntries[0]?.toolStatus, 'completed');
			assert.strictEqual(finishedEntries[0]?.streaming, undefined);
			assert.strictEqual(finishedEntries[0]?.payload, 'file body');
			const finishedSpan = projectProcessFoldSpans(entriesToRenderableTurns(finishedEntries))[0];
			assert.ok(finishedSpan);
			assert.strictEqual(summarizeProcessSteps(finishedSpan, { showLiveChrome: true }), '1 step · read_file');
			const finishedTools = projectSnapshotToTrajectory(finished, new Map(), new Map()).filter(record => record.kind === 'tool');
			assert.strictEqual(finishedTools.length, 1);
			assert.strictEqual(finishedTools[0]?.outputDetail, 'file body');

			const replayed = applyToolEvents([call, done, call]);
			assert.strictEqual(toolRows(replayed).length, 1);
			const replayedRow = toolRows(replayed)[0];
			assert.ok(replayedRow);
			const replayedSummary = replayedRow.summary;
			if (replayedSummary.kind !== 'tool') {
				assert.fail('expected a tool summary');
			}
			assert.strictEqual(replayedSummary.status, 'completed');
			assert.strictEqual(replayedSummary.resultPreview, 'file body');

			const failed = toolEnvelope('e-fail', 6, [{
				block_type: 3,
				tool_result_block: {
					tool_call_id: 'tc-run',
					tool_name: 'read_file',
					content: 'boom',
					is_error: true,
				},
			}]);
			const failedSnapshot = applyToolEvents([call, failed]);
			assert.strictEqual(toolRows(failedSnapshot).length, 1);
			const failedRow = toolRows(failedSnapshot)[0];
			assert.ok(failedRow);
			const failedSummary = failedRow.summary;
			if (failedSummary.kind !== 'tool') {
				assert.fail('expected a tool summary');
			}
			assert.strictEqual(failedSummary.status, 'failed');
			assert.strictEqual(failedSummary.resultPreview, 'boom');
			const failedEntries = projectSnapshotToEntries(failedSnapshot, new Map(), new Map());
			assert.strictEqual(failedEntries.filter(entry => entry.kind === 'tool').length, 1);
			assert.strictEqual(failedEntries[0]?.toolStatus, 'failed');
		} finally {
			clearCorrelatedToolStepsForTests();
		}
	});

	test('a blank tool_call_id does not merge two read_file rows by name', () => {
		clearCorrelatedToolStepsForTests();
		try {
			const call = toolEnvelope('e-blank-call', 1, [{
				block_type: 2,
				tool_call_block: { tool_call_id: '', tool_name: 'read_file' },
			}]);
			const padded = toolEnvelope('e-padded-call', 2, [{
				block_type: 2,
				tool_call_block: { tool_call_id: '  tc  ', tool_name: 'read_file' },
			}]);
			assert.strictEqual(bodyOf(call).status, 'running');
			assert.ok(!Object.hasOwn(bodyOf(call), 'toolCallId'));
			assert.ok(!Object.hasOwn(bodyOf(padded), 'toolCallId'));

			const result = toolEnvelope('e-blank-result', 3, [{
				block_type: 3,
				tool_result_block: { tool_call_id: '', tool_name: 'read_file', content: 'one', is_error: false },
			}]);
			const paddedResult = toolEnvelope('e-padded-result', 4, [{
				block_type: 3,
				tool_result_block: { tool_call_id: '  tc  ', tool_name: 'read_file', content: 'two', is_error: false },
			}]);
			assert.ok(!Object.hasOwn(bodyOf(result), 'toolCallId'));
			assert.strictEqual(bodyOf(result).status, 'completed');

			const snapshot = applyToolEvents([call, padded, result, paddedResult]);
			const rows = toolRows(snapshot);
			assert.deepStrictEqual(rows.map(item => String(item.id)), ['e-blank-call', 'e-padded-call', 'e-blank-result', 'e-padded-result']);
			assert.deepStrictEqual(rows.map(item => item.summary.kind === 'tool' ? item.summary.status : ''), ['running', 'running', 'completed', 'completed']);
			const entries = projectSnapshotToEntries(snapshot, new Map(), new Map());
			assert.ok(entries.filter(entry => entry.kind === 'tool').every(entry => entry.toolCallId === undefined));
			const span = projectProcessFoldSpans(entriesToRenderableTurns(entries))[0];
			assert.ok(span);
			assert.strictEqual(summarizeProcessSteps(span, { showLiveChrome: true }), '4 steps · read_file ×4');
			assert.strictEqual(projectSnapshotToTrajectory(snapshot, new Map(), new Map()).filter(record => record.kind === 'tool').length, 4);
		} finally {
			clearCorrelatedToolStepsForTests();
		}
	});

	test('two read_file calls with different tool_call_ids stay two steps', () => {
		clearCorrelatedToolStepsForTests();
		try {
			const first = toolEnvelope('e-a', 1, [{
				block_type: 2,
				tool_call_block: { tool_call_id: 'tc-a', tool_name: 'read_file', arguments_json: '{"path":"a.ts"}' },
			}]);
			const second = toolEnvelope('e-b', 2, [{
				block_type: 2,
				tool_call_block: { tool_call_id: 'tc-b', tool_name: 'read_file', arguments_json: '{"path":"b.ts"}' },
			}]);
			const firstResult = toolEnvelope('e-a-result', 3, [{
				block_type: 3,
				tool_result_block: { tool_call_id: 'tc-a', tool_name: 'read_file', content: 'alpha', is_error: false },
			}]);
			const secondResult = toolEnvelope('e-b-result', 4, [{
				block_type: 3,
				tool_result_block: { tool_call_id: 'tc-b', tool_name: 'read_file', content: 'beta', is_error: false },
			}]);
			const snapshot = applyToolEvents([first, second, firstResult, secondResult]);
			const rows = toolRows(snapshot);
			assert.strictEqual(rows.length, 2);
			assert.strictEqual(String(rows[0]?.id), 'e-a');
			assert.strictEqual(String(rows[1]?.id), 'e-b');
			assert.strictEqual(rows[0]?.summary.kind === 'tool' && rows[0].summary.status, 'completed');
			assert.strictEqual(rows[1]?.summary.kind === 'tool' && rows[1].summary.status, 'completed');
			assert.strictEqual(rows[0]?.summary.kind === 'tool' && rows[0].summary.resultPreview, 'alpha');
			assert.strictEqual(rows[1]?.summary.kind === 'tool' && rows[1].summary.resultPreview, 'beta');
			assert.strictEqual(rows[0]?.summary.kind === 'tool' && rows[0].summary.argPreview, '{"path":"a.ts"}');
			const span = projectProcessFoldSpans(entriesToRenderableTurns(projectSnapshotToEntries(snapshot, new Map(), new Map())))[0];
			assert.ok(span);
			assert.strictEqual(summarizeProcessSteps(span, { showLiveChrome: true }), '2 steps · read_file ×2');
			assert.strictEqual(projectSnapshotToTrajectory(snapshot, new Map(), new Map()).filter(record => record.kind === 'tool').length, 2);
		} finally {
			clearCorrelatedToolStepsForTests();
		}
	});

	test('a result for one id of a multi-call arm writes back and keeps the arm text', () => {
		clearCorrelatedToolStepsForTests();
		try {
			const call = toolEnvelope('e-arm', 8, [
				{ block_type: 4, thinking_block: { thinking: 'hmm' } },
				{ block_type: 1, text_block: { text: 'I will check.' } },
				{ block_type: 2, tool_call_block: { tool_call_id: 'tc-read', tool_name: 'read_file', arguments_json: '{"path":"a.ts"}' } },
				{ block_type: 2, tool_call_block: { tool_call_id: 'tc-grep', tool_name: 'grep', arguments_json: '{"q":"x"}' } },
			], 'turn-arm');
			const callBody = bodyOf(call);
			assert.strictEqual(callBody.status, 'running');
			assert.strictEqual(callBody.toolCallId, 'tc-read');
			assert.deepStrictEqual(callBody.toolCallIds, ['tc-read', 'tc-grep']);
			assert.deepStrictEqual(callBody.toolNames, ['read_file', 'grep']);
			assert.strictEqual(callBody.assistantText, 'I will check.');
			assert.strictEqual(callBody.thinkingText, 'hmm');

			const running = applyToolEvents([call]);
			assert.strictEqual(toolRows(running).length, 1);
			const runningSummary = toolRows(running)[0]?.summary;
			assert.strictEqual(runningSummary?.kind === 'tool' && runningSummary.toolCallId, 'tc-read');
			assert.deepStrictEqual(runningSummary?.kind === 'tool' ? runningSummary.toolCallIds : undefined, ['tc-read', 'tc-grep']);
			const runningEntries = projectSnapshotToEntries(running, new Map(), new Map());
			assertArmEntries(runningEntries, 'running');
			const readRow = runningEntries.find(entry => entry.toolName === 'read_file');
			const grepRow = runningEntries.find(entry => entry.toolName === 'grep');
			assert.strictEqual(readRow?.id, 'e-arm');
			assert.strictEqual(readRow?.toolCallId, 'tc-read');
			assert.strictEqual(grepRow?.id, 'e-arm:tool:1');
			assert.strictEqual(grepRow?.toolCallId, 'tc-grep');
			assert.notStrictEqual(readRow?.toolCallId, readRow?.id);
			assert.notStrictEqual(grepRow?.toolCallId, grepRow?.id);

			const result = toolEnvelope('e-arm-result', 9, [
				{ block_type: 4, thinking_block: { thinking: 'later' } },
				{ block_type: 1, text_block: { text: 'done' } },
				{ block_type: 3, tool_result_block: { tool_call_id: 'tc-grep', tool_name: 'grep', content: 'hits', is_error: false } },
			], 'turn-arm');
			const finished = applyToolEvents([call, result]);
			assert.strictEqual(toolRows(finished).length, 1);
			const item = toolRows(finished)[0]!;
			assert.strictEqual(String(item.id), 'e-arm');
			assert.strictEqual(item.orderKey, '0000000000000008');
			assert.strictEqual(item.turnId, 'turn-arm');
			assert.strictEqual(item.summary.kind === 'tool' && item.summary.status, 'completed');
			assert.strictEqual(item.summary.kind === 'tool' && item.summary.toolName, 'read_file');
			assert.deepStrictEqual(item.summary.kind === 'tool' ? item.summary.toolNames : undefined, ['read_file', 'grep']);
			assert.deepStrictEqual(item.summary.kind === 'tool' ? item.summary.toolCallIds : undefined, ['tc-read', 'tc-grep']);
			assert.strictEqual(item.summary.kind === 'tool' && item.summary.toolCallId, 'tc-read');
			assert.strictEqual(item.summary.kind === 'tool' && item.summary.assistantText, 'I will check.');
			assert.strictEqual(item.summary.kind === 'tool' && item.summary.thinkingText, 'hmm');
			assert.strictEqual(item.summary.kind === 'tool' && item.summary.resultPreview, 'hits');
			assert.strictEqual(item.summary.kind === 'tool' && item.summary.argPreview, '{"path":"a.ts"}');

			const entries = projectSnapshotToEntries(finished, new Map(), new Map());
			assertArmEntries(entries, 'completed', 'hits');
			const toolSpan = projectProcessFoldSpans(entriesToRenderableTurns(entries)).find(span => span.turnIds.some(id => id === 'e-arm' || id.startsWith('e-arm:tool')));
			assert.ok(toolSpan);
			const folded = summarizeProcessSteps(toolSpan, { showLiveChrome: true });
			const toolEntryCount = entries.filter(entry => entry.kind === 'tool').length;
			if (toolEntryCount >= 2) {
				assert.strictEqual(folded, '2 steps · read_file, grep');
			} else {
				assert.ok(!folded.includes('×'));
				assert.ok(folded.includes('read_file'));
			}
			const trajectoryTools = projectSnapshotToTrajectory(finished, new Map(), new Map()).filter(record => record.kind === 'tool');
			assert.deepStrictEqual(trajectoryTools.map(record => record.text), ['read_file', 'grep']);
			assert.strictEqual(trajectoryTools[0]?.outputDetail, 'hits');
		} finally {
			clearCorrelatedToolStepsForTests();
		}
	});
});

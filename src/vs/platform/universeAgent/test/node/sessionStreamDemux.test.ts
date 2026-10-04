/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { projectProcessFoldSpans, summarizeProcessSteps } from '../../../../workbench/contrib/conversation/browser/conversationProcessFoldModel.js';
import { entriesToRenderableTurns, projectSnapshotToEntries } from '../../../../workbench/contrib/conversation/browser/conversationSessionView.js';
import { projectSnapshotToTrajectory } from '../../../../workbench/contrib/conversation/browser/conversationTrajectoryModel.js';
import { applyViewPatches } from '../../common/sessionView/apply.js';
import { emptySessionViewSnapshot } from '../../common/sessionView/empty-snapshot.js';
import type { SessionId, SessionViewSnapshot, TimelineItemView } from '../../common/sessionView/types.js';
import { clearCorrelatedToolStepsForTests, foldDomainStreamEvent } from '../../node/sessionCore/stream-event-to-view-patch.js';
import { demuxSessionStreamPayload, localFactFromQuestionArm } from '../../node/sessionStreamDemux.js';

function armOf(event: unknown): string | undefined {
	return event && typeof event === 'object' ? (event as { arm?: string }).arm : undefined;
}

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

suite('sessionStreamDemux overlay + seats + L2/L3/L4', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('hello and heartbeat stay foldable', () => {
		const hello = demuxSessionStreamPayload({
			hello: { session_version: 1, head_seq: 3, runtime_epoch: 2, last_mutated_from_seq: 0 },
		});
		assert.deepStrictEqual(hello, [{
			arm: 'hello',
			body: { sessionVersion: 1, headSeq: 3, runtimeEpoch: 2, lastMutatedFromSeq: 0 },
		}]);
		assert.deepStrictEqual(demuxSessionStreamPayload({ heartbeat: {} }), [{ arm: 'heartbeat' }]);
	});

	test('text envelope with nested textBlock has no role on the body', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e1',
					seq: 4,
					role: 'ASSISTANT',
					turn_id: 't1',
					blocks: [{ block_type: 1, text_block: { text: 'hello world' } }],
				},
			},
		});
		assert.strictEqual(events.length, 1);
		assert.strictEqual(armOf(events[0]), 'text');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.id, 'e1');
		assert.strictEqual(body.orderKey, '4');
		assert.strictEqual(body.title, 'Agent');
		assert.strictEqual(body.preview, 'hello world');
		assert.strictEqual(body.turnId, 't1');
		assert.strictEqual(body.role, undefined);
	});

	test('flat text / content blocks still map to text', () => {
		const events = demuxSessionStreamPayload({
			envelopeAppended: {
				envelope: {
					id: 'e2',
					seq: 1,
					role: 'USER',
					blocks: [{ text: 'typed here' }],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'text');
		assert.strictEqual(bodyOf(events[0]).title, 'You');
		assert.strictEqual(bodyOf(events[0]).preview, 'typed here');
	});

	test('tool result wins over text in the same envelope', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e3',
					seq: 8,
					role: 'ASSISTANT',
					blocks: [
						{ blockType: 'THINKING', thinkingBlock: { thinking: 'hmm' } },
						{ blockType: 'TEXT', textBlock: { text: 'ignored' } },
						{ blockType: 'TOOL_RESULT', toolResultBlock: { toolName: 'bash', content: 'ok', isError: false } },
					],
				},
			},
		});
		assert.strictEqual(events.length, 1);
		assert.strictEqual(armOf(events[0]), 'tool');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.toolName, 'bash');
		assert.strictEqual(body.status, 'completed');
		assert.strictEqual(body.resultPreview, 'ok');
		assert.strictEqual(body.assistantText, 'ignored');
		assert.ok(!String(body.assistantText).includes('hmm'));
		assert.strictEqual(body.thinkingText, 'hmm');
		assert.ok(!String(body.thinkingText).includes('ignored'));
		assert.ok(!Object.hasOwn(body, 'toolNames'));

		const blank = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e3-blank',
					seq: 9,
					role: 'ASSISTANT',
					blocks: [
						{ blockType: 'TEXT', textBlock: { text: '   ' } },
						{ blockType: 'TOOL_RESULT', toolResultBlock: { toolName: 'bash', content: 'ok', isError: false } },
					],
				},
			},
		});
		assert.strictEqual(blank.length, 1);
		assert.strictEqual(armOf(blank[0]), 'tool');
		const blankBody = bodyOf(blank[0]);
		assert.strictEqual(blankBody.toolName, 'bash');
		assert.strictEqual(blankBody.status, 'completed');
		assert.strictEqual(blankBody.resultPreview, 'ok');
		assert.ok(!Object.hasOwn(blankBody, 'assistantText'));
		assert.ok(!Object.hasOwn(blankBody, 'thinkingText'));
		assert.ok(!Object.hasOwn(blankBody, 'toolNames'));
	});

	test('tool result parses valid metadata_json into body.metadata', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-meta',
					seq: 10,
					role: 'ASSISTANT',
					blocks: [
						{
							blockType: 'TOOL_RESULT',
							toolResultBlock: {
								toolName: 'file_edit',
								content: 'Applied edits',
								isError: false,
								metadata_json: JSON.stringify({
									diff: '--- a\n+++ b\n+line',
									filediff: { file: 'src/a.ts', additions: 1, deletions: 0 },
								}),
							},
						},
					],
				},
			},
		});
		assert.strictEqual(events.length, 1);
		assert.strictEqual(armOf(events[0]), 'tool');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.toolName, 'file_edit');
		assert.deepStrictEqual(body.metadata, {
			diff: '--- a\n+++ b\n+line',
			filediff: { file: 'src/a.ts', additions: 1, deletions: 0 },
		});
	});

	test('tool result metadata_json absent leaves body.metadata undefined', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-nometa',
					seq: 11,
					role: 'ASSISTANT',
					blocks: [
						{
							blockType: 'TOOL_RESULT',
							toolResultBlock: { toolName: 'bash', content: 'ls' },
						},
					],
				},
			},
		});
		assert.strictEqual(bodyOf(events[0]).metadata, undefined);
	});

	test('tool result metadata_json malformed fails closed to empty object', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-badmeta',
					seq: 12,
					role: 'ASSISTANT',
					blocks: [
						{
							blockType: 'TOOL_RESULT',
							toolResultBlock: { toolName: 'file_edit', metadata_json: '{broken' },
						},
					],
				},
			},
		});
		assert.deepStrictEqual(bodyOf(events[0]).metadata, {});
	});

	test('tool result metadata_json non-object degrades to empty object', () => {
		for (const nonObj of ['"scalar string"', '42', 'true', '[1, 2, 3]']) {
			const events = demuxSessionStreamPayload({
				envelope_appended: {
					envelope: {
						id: 'e-nonobj',
						seq: 13,
						role: 'ASSISTANT',
						blocks: [
							{
								blockType: 'TOOL_RESULT',
								toolResultBlock: { toolName: 'file_edit', metadata_json: nonObj },
							},
						],
					},
				},
			});
			assert.deepStrictEqual(bodyOf(events[0]).metadata, {}, `Expected {} for ${nonObj}`);
		}
	});

	test('tool call maps to tool with arg preview', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e4',
					seq: 9,
					blocks: [{
						block_type: 2,
						tool_call_block: { tool_name: 'read_file', arguments_json: '{"path":"a.ts"}' },
					}],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'tool');
		assert.strictEqual(bodyOf(events[0]).toolName, 'read_file');
		assert.strictEqual(bodyOf(events[0]).status, 'running');
		assert.strictEqual(bodyOf(events[0]).argPreview, '{"path":"a.ts"}');
		assert.ok(!Object.hasOwn(bodyOf(events[0]), 'toolCallId'));
		assert.ok(!Object.hasOwn(bodyOf(events[0]), 'assistantText'));
		assert.ok(!Object.hasOwn(bodyOf(events[0]), 'thinkingText'));
		assert.ok(!Object.hasOwn(bodyOf(events[0]), 'toolNames'));
	});

	test('tool call keeps usable text from the same envelope on one seq', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-both',
					seq: 11,
					role: 'ASSISTANT',
					turn_id: 't1',
					blocks: [
						{ block_type: 4, thinking_block: { thinking: 'hmm' } },
						{ block_type: 1, text_block: { text: 'I will check.' } },
						{ block_type: 2, tool_call_block: { tool_name: 'read_file', arguments_json: '{"path":"a.ts"}' } },
						{ block_type: 1, text_block: { text: 'Then I will read it.' } },
					],
				},
			},
		});
		assert.strictEqual(events.length, 1);
		assert.strictEqual(armOf(events[0]), 'tool');
		assert.strictEqual((events[0] as { seq?: number }).seq, 11);
		const body = bodyOf(events[0]);
		assert.strictEqual(body.toolName, 'read_file');
		assert.strictEqual(body.title, 'read_file');
		assert.strictEqual(body.assistantText, 'I will check.\nThen I will read it.');
		assert.ok(!body.assistantText?.toString().includes('hmm'));
		assert.strictEqual(body.thinkingText, 'hmm');
		assert.ok(!String(body.thinkingText).includes('I will check'));
		assert.ok(!Object.hasOwn(body, 'toolNames'));

		const blank = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-blank',
					seq: 12,
					blocks: [
						{ block_type: 1, text_block: { text: '   ' } },
						{ block_type: 2, tool_call_block: { tool_name: 'ls' } },
					],
				},
			},
		});
		assert.strictEqual(blank.length, 1);
		assert.strictEqual(armOf(blank[0]), 'tool');
		assert.strictEqual(bodyOf(blank[0]).toolName, 'ls');
		assert.ok(!Object.hasOwn(bodyOf(blank[0]), 'assistantText'));
		assert.ok(!Object.hasOwn(bodyOf(blank[0]), 'thinkingText'));
		assert.ok(!Object.hasOwn(bodyOf(blank[0]), 'toolNames'));

		const replay = demuxSessionStreamPayload({
			envelope_range_replaced: {
				from_seq: 2,
				replacement: [{
					id: 'e-both',
					seq: 11,
					role: 'ASSISTANT',
					blocks: [
						{ block_type: 1, text_block: { text: 'I will check.' } },
						{ block_type: 2, tool_call_block: { tool_name: 'read_file' } },
					],
				}],
			},
		});
		const inner = bodyOf(replay[0]).events as unknown[];
		assert.strictEqual(inner.length, 1);
		assert.strictEqual(armOf(inner[0]), 'tool');
		assert.strictEqual(bodyOf(inner[0]).assistantText, 'I will check.');
		assert.strictEqual(bodyOf(inner[0]).title, 'read_file');
		assert.ok(!Object.hasOwn(bodyOf(inner[0]), 'toolNames'));
	});

	test('one envelope keeps every usable tool_call and still lets a tool_result win', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-multi',
					seq: 14,
					role: 'ASSISTANT',
					turn_id: 't1',
					blocks: [
						{ block_type: 4, thinking_block: { thinking: 'hmm' } },
						{ block_type: 1, text_block: { text: 'I will check.' } },
						{ block_type: 2, tool_call_block: { tool_name: 'read_file', arguments_json: '{"path":"a.ts"}' } },
						{ block_type: 2, tool_call_block: { tool_name: '   ' } },
						{ block_type: 2, tool_call_block: { tool_name: 'grep', arguments_json: '{"q":"x"}' } },
						{ block_type: 1, text_block: { text: 'Then I will search.' } },
					],
				},
			},
		});
		assert.strictEqual(events.length, 1);
		assert.strictEqual(armOf(events[0]), 'tool');
		assert.strictEqual((events[0] as { seq?: number }).seq, 14);
		const body = bodyOf(events[0]);
		assert.strictEqual(body.id, 'e-multi');
		assert.strictEqual(body.toolName, 'read_file');
		assert.strictEqual(body.title, 'read_file');
		assert.strictEqual(body.status, 'running');
		assert.deepStrictEqual(body.toolNames, ['read_file', 'grep']);
		assert.strictEqual(body.argPreview, '{"path":"a.ts"}');
		assert.strictEqual(body.assistantText, 'I will check.\nThen I will search.');
		assert.ok(!String(body.assistantText).includes('hmm'));
		assert.strictEqual(body.thinkingText, 'hmm');
		assert.ok(!String(body.thinkingText).includes('I will check'));
		assert.strictEqual(body.turnId, 't1');

		const folded = foldDomainStreamEvent(events[0]);
		assert.strictEqual(folded.kind, 'patches');
		if (folded.kind !== 'patches') {
			return;
		}
		assert.strictEqual(folded.patches.length, 1);
		const patch = folded.patches[0];
		assert.ok(patch);
		assert.strictEqual(patch.op, 'upsertTimelineItem');
		if (patch.op !== 'upsertTimelineItem' || patch.item.summary.kind !== 'tool') {
			assert.fail('expected one tool timeline item');
		}
		assert.strictEqual(String(patch.item.id), 'e-multi');
		assert.strictEqual(patch.item.summary.toolName, 'read_file');
		assert.strictEqual(patch.item.summary.status, 'running');
		assert.deepStrictEqual(patch.item.summary.toolNames, ['read_file', 'grep']);
		assert.strictEqual(patch.item.summary.assistantText, 'I will check.\nThen I will search.');
		assert.ok(!String(patch.item.summary.assistantText).includes('hmm'));
		assert.strictEqual(patch.item.summary.thinkingText, 'hmm');
		assert.ok(!String(patch.item.summary.thinkingText).includes('I will check'));

		const blank = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-multi-blank',
					seq: 15,
					blocks: [
						{ block_type: 1, text_block: { text: '   ' } },
						{ block_type: 2, tool_call_block: { tool_name: 'ls' } },
						{ block_type: 2, tool_call_block: { tool_name: 'grep' } },
					],
				},
			},
		});
		assert.strictEqual(blank.length, 1);
		assert.strictEqual(armOf(blank[0]), 'tool');
		assert.deepStrictEqual(bodyOf(blank[0]).toolNames, ['ls', 'grep']);
		assert.ok(!Object.hasOwn(bodyOf(blank[0]), 'assistantText'));
		assert.ok(!Object.hasOwn(bodyOf(blank[0]), 'thinkingText'));

		const result = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-result',
					seq: 16,
					role: 'ASSISTANT',
					blocks: [
						{ block_type: 4, thinking_block: { thinking: 'hmm' } },
						{ block_type: 1, text_block: { text: 'done' } },
						{ block_type: 2, tool_call_block: { tool_name: 'read_file' } },
						{ block_type: 2, tool_call_block: { tool_name: 'grep' } },
						{ block_type: 3, tool_result_block: { tool_name: 'bash', content: 'ok', is_error: false } },
					],
				},
			},
		});
		assert.strictEqual(result.length, 1);
		assert.strictEqual(armOf(result[0]), 'tool');
		const resultBody = bodyOf(result[0]);
		assert.strictEqual(resultBody.toolName, 'bash');
		assert.strictEqual(resultBody.assistantText, 'done');
		assert.ok(!String(resultBody.assistantText).includes('hmm'));
		assert.strictEqual(resultBody.thinkingText, 'hmm');
		assert.ok(!Object.hasOwn(resultBody, 'toolNames'));
		const resultFold = foldDomainStreamEvent(result[0]);
		assert.strictEqual(resultFold.kind, 'patches');
		if (resultFold.kind !== 'patches') {
			return;
		}
		assert.strictEqual(resultFold.patches.length, 1);
		const resultPatch = resultFold.patches[0];
		assert.ok(resultPatch && resultPatch.op === 'upsertTimelineItem' && resultPatch.item.summary.kind === 'tool');
		if (resultPatch?.op !== 'upsertTimelineItem' || resultPatch.item.summary.kind !== 'tool') {
			return;
		}
		assert.strictEqual(resultPatch.item.summary.toolName, 'bash');
		assert.strictEqual(resultPatch.item.summary.assistantText, 'done');
		assert.strictEqual(resultPatch.item.summary.thinkingText, 'hmm');
		assert.ok(!Object.hasOwn(resultPatch.item.summary, 'toolNames'));
	});

	test('thinking block maps to reasoning', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e5',
					seq: 2,
					blocks: [{ block_type: 4, thinking_block: { thinking: 'considering' } }],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'reasoning');
		assert.strictEqual(bodyOf(events[0]).title, 'THINKING');
		assert.strictEqual(bodyOf(events[0]).collapsedPreview, 'considering');
		assert.strictEqual(bodyOf(events[0]).streaming, false);
		assert.ok(!Object.hasOwn(bodyOf(events[0]), 'thinkingText'));
		assert.strictEqual('turnId' in bodyOf(events[0]), false);

		const withTurn = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e5t',
					seq: 3,
					turn_id: 't1',
					blocks: [{ block_type: 4, thinking_block: { thinking: 'considering' } }],
				},
			},
		});
		assert.strictEqual(armOf(withTurn[0]), 'reasoning');
		assert.strictEqual(bodyOf(withTurn[0]).title, 'THINKING');
		assert.strictEqual(bodyOf(withTurn[0]).turnId, 't1');
	});

	test('thinking-only envelope joins every usable thinking block into collapsedPreview', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-think-only',
					seq: 11,
					turn_id: 't1',
					blocks: [
						{ block_type: 4, thinking_block: { thinking: 'hmm' } },
						{ block_type: 4, thinking_block: { thinking: '   \n\t' } },
						{ block_type: 4, thinking_block: { thinking: 'then this' } },
					],
				},
			},
		});
		assert.strictEqual(events.length, 1);
		assert.strictEqual(armOf(events[0]), 'reasoning');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.title, 'THINKING');
		assert.strictEqual(body.collapsedPreview, 'hmm\nthen this');
		assert.ok(!String(body.collapsedPreview).includes('ignored'));
		assert.ok(!Object.hasOwn(body, 'thinkingText'));
		assert.strictEqual(body.turnId, 't1');
		const folded = foldDomainStreamEvent(events[0]);
		assert.strictEqual(folded.kind, 'patches');
		if (folded.kind !== 'patches') {
			return;
		}
		const patch = folded.patches[0];
		assert.ok(patch && patch.op === 'upsertTimelineItem' && patch.item.summary.kind === 'reasoning');
		if (patch?.op !== 'upsertTimelineItem' || patch.item.summary.kind !== 'reasoning') {
			return;
		}
		assert.strictEqual(patch.item.summary.title, 'THINKING');
		assert.strictEqual(patch.item.summary.collapsedPreview, 'hmm\nthen this');

		const blank = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-think-blank',
					seq: 12,
					blocks: [{ block_type: 4, thinking_block: { thinking: '  ' } }],
				},
			},
		});
		assert.deepStrictEqual(blank, []);
	});

	test('text arm keeps usable thinking beside the text and drops blank thinking', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-text-think',
					seq: 6,
					role: 'ASSISTANT',
					turn_id: 't1',
					blocks: [
						{ block_type: 4, thinking_block: { thinking: 'hmm' } },
						{ block_type: 1, text_block: { text: 'hello' } },
						{ block_type: 4, thinking_block: { thinking: 'then this' } },
					],
				},
			},
		});
		assert.strictEqual(events.length, 1);
		assert.strictEqual(armOf(events[0]), 'text');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.preview, 'hello');
		assert.ok(!String(body.preview).includes('hmm'));
		assert.strictEqual(body.thinkingText, 'hmm\nthen this');
		assert.ok(!String(body.thinkingText).includes('hello'));
		assert.strictEqual(body.turnId, 't1');

		const folded = foldDomainStreamEvent(events[0]);
		assert.strictEqual(folded.kind, 'patches');
		if (folded.kind !== 'patches') {
			return;
		}
		const patch = folded.patches[0];
		assert.ok(patch && patch.op === 'upsertTimelineItem' && patch.item.summary.kind === 'text');
		if (patch?.op !== 'upsertTimelineItem' || patch.item.summary.kind !== 'text') {
			return;
		}
		assert.strictEqual(patch.item.summary.preview, 'hello');
		assert.strictEqual(patch.item.summary.thinkingText, 'hmm\nthen this');

		const blank = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-text-blank-think',
					seq: 7,
					role: 'ASSISTANT',
					blocks: [
						{ block_type: 4, thinking_block: { thinking: '   \n\t' } },
						{ block_type: 1, text_block: { text: 'hello' } },
					],
				},
			},
		});
		assert.strictEqual(armOf(blank[0]), 'text');
		assert.strictEqual(bodyOf(blank[0]).preview, 'hello');
		assert.ok(!Object.hasOwn(bodyOf(blank[0]), 'thinkingText'));

		const toolBlank = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-tool-blank-think',
					seq: 8,
					blocks: [
						{ block_type: 4, thinking_block: { thinking: '  ' } },
						{ block_type: 2, tool_call_block: { tool_name: 'read_file' } },
					],
				},
			},
		});
		assert.strictEqual(armOf(toolBlank[0]), 'tool');
		assert.strictEqual(bodyOf(toolBlank[0]).toolName, 'read_file');
		assert.ok(!Object.hasOwn(bodyOf(toolBlank[0]), 'thinkingText'));
		assert.ok(!Object.hasOwn(bodyOf(toolBlank[0]), 'assistantText'));
		assert.ok(!Object.hasOwn(bodyOf(toolBlank[0]), 'toolNames'));

		const toolOnly = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e-tool-think',
					seq: 9,
					blocks: [
						{ block_type: 4, thinking_block: { thinking: 'hmm' } },
						{ block_type: 2, tool_call_block: { tool_name: 'read_file' } },
					],
				},
			},
		});
		assert.strictEqual(armOf(toolOnly[0]), 'tool');
		assert.strictEqual(bodyOf(toolOnly[0]).toolName, 'read_file');
		assert.strictEqual(bodyOf(toolOnly[0]).thinkingText, 'hmm');
		assert.ok(!Object.hasOwn(bodyOf(toolOnly[0]), 'assistantText'));
		assert.ok(!Object.hasOwn(bodyOf(toolOnly[0]), 'toolNames'));
		const toolFold = foldDomainStreamEvent(toolOnly[0]);
		assert.strictEqual(toolFold.kind, 'patches');
		if (toolFold.kind !== 'patches') {
			return;
		}
		const toolPatch = toolFold.patches[0];
		assert.ok(toolPatch && toolPatch.op === 'upsertTimelineItem' && toolPatch.item.summary.kind === 'tool');
		if (toolPatch?.op !== 'upsertTimelineItem' || toolPatch.item.summary.kind !== 'tool') {
			return;
		}
		assert.strictEqual(toolPatch.item.summary.thinkingText, 'hmm');
		assert.ok(!Object.hasOwn(toolPatch.item.summary, 'assistantText'));
		assert.ok(!Object.hasOwn(toolPatch.item.summary, 'toolNames'));
	});

	test('unknown carrier maps to unknownBlock', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e6',
					seq: 5,
					blocks: [{ block_type: 8, original_type: 'Metadata', raw_json: '{"k":1}' }],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'unknownBlock');
		assert.strictEqual(bodyOf(events[0]).typeName, 'Metadata');
		assert.strictEqual(bodyOf(events[0]).rawContent, '{"k":1}');
	});

	test('pin-era snippet stays a text placeholder', () => {
		const events = demuxSessionStreamPayload({
			envelope_appended: {
				envelope: {
					id: 'e7',
					seq: 6,
					role: 'SYSTEM',
					blocks: [{ block_type: 16, original_type: 'snippet' }],
				},
			},
		});
		assert.strictEqual(armOf(events[0]), 'text');
		assert.strictEqual(bodyOf(events[0]).preview, 'snippet');
	});

	test('permission request uses fold identity fields', () => {
		const events = demuxSessionStreamPayload({
			permission_request: {
				request_id: 'perm-1',
				description: 'Run bash',
				tool_name: 'bash',
				agent_id: 'root',
			},
		});
		assert.strictEqual(armOf(events[0]), 'permission');
		assert.deepStrictEqual(bodyOf(events[0]), {
			id: 'perm-1',
			orderKey: 'perm-1',
			title: 'Run bash',
			permissionKind: 'bash',
			agentId: 'root',
		});
	});

	test('permission camelCase works; blank requestId is dropped', () => {
		assert.deepStrictEqual(demuxSessionStreamPayload({
			permissionRequest: { requestId: '  padded  ', toolName: 'bash', description: 'x' },
		}), []);
		const events = demuxSessionStreamPayload({
			permissionRequest: { requestId: 'p2', toolName: 'edit', description: 'Edit file' },
		});
		assert.strictEqual(bodyOf(events[0]).id, 'p2');
		assert.strictEqual(bodyOf(events[0]).permissionKind, 'edit');
	});

	test('client_tool_call maps requestId to callId', () => {
		const events = demuxSessionStreamPayload({
			session_id: 's1',
			client_tool_call: {
				request_id: 'ctc-1',
				tool_name: 'browser',
				arguments_json: '{}',
				agent_id: 'agent-a',
			},
		});
		assert.strictEqual(armOf(events[0]), 'clientToolCall');
		assert.deepStrictEqual(bodyOf(events[0]), {
			callId: 'ctc-1',
			toolName: 'browser',
			argumentsJson: '{}',
			sessionId: 's1',
			agentId: 'agent-a',
		});
	});

	test('camelCase sessionId still reaches the two seats that carry it', () => {
		const question = demuxSessionStreamPayload({
			sessionId: 's2',
			ask_user_question: { request_id: 'q-sid', items: [{ id: 'i1', question: 'Which?' }] },
		});
		assert.strictEqual(bodyOf(question[0]).sessionId, 's2');
		const clientTool = demuxSessionStreamPayload({
			sessionId: 's2',
			client_tool_call: { request_id: 'ctc-sid', tool_name: 'browser' },
		});
		assert.strictEqual(bodyOf(clientTool[0]).sessionId, 's2');
		const withoutSession = demuxSessionStreamPayload({
			client_tool_call: { request_id: 'ctc-nosid', tool_name: 'browser' },
		});
		assert.ok(!Object.hasOwn(bodyOf(withoutSession[0]), 'sessionId'));
	});

	test('ask_user_question maps items and yields a questionAsked localFact', () => {
		const events = demuxSessionStreamPayload({
			ask_user_question: {
				request_id: 'q-1',
				agent_id: 'root',
				items: [{
					id: 'item-a',
					header: 'Pick',
					question: 'Which?',
					options: [{ label: 'A' }, { label: 'B' }],
					multi_select: true,
					allow_custom: false,
				}],
			},
		});
		assert.strictEqual(armOf(events[0]), 'question');
		const body = bodyOf(events[0]);
		assert.strictEqual(body.id, 'q-1');
		assert.deepStrictEqual(body.questions, [{
			id: 'item-a',
			header: 'Pick',
			question: 'Which?',
			optionsPreview: ['A', 'B'],
			multiSelect: true,
			allowCustom: false,
		}]);
		const fact = localFactFromQuestionArm(events[0]);
		assert.ok(fact);
		assert.strictEqual(fact.kind, 'questionAsked');
		assert.strictEqual(fact.questionId, 'q-1');
		assert.strictEqual(fact.agentId, 'root');
		assert.strictEqual(fact.questions.length, 1);
	});

	test('ask_user_question without items does not invent a localFact', () => {
		const events = demuxSessionStreamPayload({
			askUserQuestion: { requestId: 'q-empty', items: [] },
		});
		assert.strictEqual(armOf(events[0]), 'question');
		assert.strictEqual(localFactFromQuestionArm(events[0]), undefined);
	});

	test('runtime overlay snapshot yields pending plus activeTurn', () => {
		const events = demuxSessionStreamPayload({
			runtime_overlay_snapshot: {
				runtime_epoch: 4,
				active_turn: {
					turn_id: 'turn-9',
					streaming_text: 'hello',
					thinking_text: 'hmm',
					generating_tool_name: 'bash',
				},
				pending: [{
					request_id: 'pend-1',
					kind: 2,
					description: 'Ask',
					questions: [{ id: 'i1', question: 'Go?' }],
				}],
			},
		});
		assert.strictEqual(events.length, 2);
		assert.strictEqual(armOf(events[0]), 'overlayPendingSnapshot');
		assert.strictEqual(bodyOf(events[0]).runtimeEpoch, 4);
		assert.deepStrictEqual((bodyOf(events[0]).pending as unknown[])[0], {
			requestId: 'pend-1',
			kind: 'question',
			description: 'Ask',
			questions: [{ id: 'i1', question: 'Go?', multiSelect: false, allowCustom: false }],
		});
		assert.strictEqual(armOf(events[1]), 'overlayActiveTurn');
		assert.deepStrictEqual(bodyOf(events[1]), {
			turnId: 'turn-9',
			streamingText: 'hello',
			thinkingText: 'hmm',
			generatingToolName: 'bash',
		});
	});

	test('runtime overlay without activeTurn clears overlay', () => {
		const events = demuxSessionStreamPayload({
			runtimeOverlaySnapshot: { runtimeEpoch: 1, pending: [] },
		});
		assert.strictEqual(armOf(events[0]), 'overlayPendingSnapshot');
		assert.deepStrictEqual(events[1], { arm: 'overlayActiveTurnClear', body: {} });
	});

	test('rangeReplaced inner envelopes are classified', () => {
		const events = demuxSessionStreamPayload({
			envelope_range_replaced: {
				from_seq: 2,
				replacement: [{
					id: 'r1',
					seq: 3,
					blocks: [{ block_type: 2, tool_call_block: { tool_name: 'grep' } }],
				}],
			},
		});
		assert.strictEqual(armOf(events[0]), 'rangeReplaced');
		const inner = bodyOf(events[0]).events as unknown[];
		assert.strictEqual(armOf(inner[0]), 'tool');
		assert.strictEqual(bodyOf(inner[0]).toolName, 'grep');
	});

	test('individual L3 deltas stay dropped', () => {
		assert.deepStrictEqual(demuxSessionStreamPayload({
			streaming_delta: { turn_id: 't', text_delta: 'x' },
		}), []);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			thinking_delta: { turn_id: 't', text_delta: 'y' },
		}), []);
	});

	test('ask_user_question yields question arm and questionAsked localFact', () => {
		const events = demuxSessionStreamPayload({
			ask_user_question: {
				request_id: 'q-1',
				agent_id: 'root',
				items: [{
					id: 'i1',
					header: 'Pick',
					question: 'Which?',
					options: [{ label: 'A' }, { label: 'B' }],
					multi_select: true,
				}],
			},
		});
		assert.strictEqual(armOf(events[0]), 'question');
		assert.deepStrictEqual(bodyOf(events[0]).questions, [{
			id: 'i1',
			header: 'Pick',
			question: 'Which?',
			optionsPreview: ['A', 'B'],
			multiSelect: true,
			allowCustom: false,
		}]);
		const fact = localFactFromQuestionArm(events[0]);
		assert.ok(fact);
		assert.strictEqual(fact.kind, 'questionAsked');
		assert.strictEqual(fact.questionId, 'q-1');
		assert.strictEqual(fact.agentId, 'root');
		assert.strictEqual(fact.questions.length, 1);
	});

	test('ask_user_question without items does not invent a localFact', () => {
		const events = demuxSessionStreamPayload({
			askUserQuestion: { requestId: 'q-empty', items: [] },
		});
		assert.strictEqual(armOf(events[0]), 'question');
		assert.strictEqual(localFactFromQuestionArm(events[0]), undefined);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			tool_call_lifecycle: { tool_call_id: 'tc' },
		}), []);
	});

	test('subscriptionHealth and sessionPurged are L1 arms', () => {
		assert.deepStrictEqual(demuxSessionStreamPayload({
			subscription_health: { phase: 2 },
		}), [{ arm: 'subscriptionHealth', body: { phase: 2 } }]);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			subscription_health: { phase: 'LIVE' },
		}), [{ arm: 'subscriptionHealth', body: { phase: 2 } }]);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			subscriptionHealth: { phase: '2' },
		}), [{ arm: 'subscriptionHealth', body: { phase: 2 } }]);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			subscription_health: { phase: 'nope' },
		}), [{ arm: 'subscriptionHealth' }]);
		assert.deepStrictEqual(demuxSessionStreamPayload({
			sessionPurged: {},
		}), [{ arm: 'sessionPurged', body: {} }]);
	});

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
			assert.strictEqual(runningItem.orderKey, '4');
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
			assert.strictEqual(summarizeProcessSteps(runningSpan, { showLiveChrome: true }), '1 steps · read_file');
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
			assert.strictEqual(finishedItem.orderKey, '4');
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
			assert.strictEqual(summarizeProcessSteps(finishedSpan, { showLiveChrome: true }), '1 steps · read_file');
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
			assert.strictEqual(item.orderKey, '8');
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

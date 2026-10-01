/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { StreamScript } from './streamScript.js';

/**
 * Catalog of stream scripts, run by `conversationStreamScripts.test.ts` (one test per script).
 *
 * To add a case: append a script here. Name it after the behavior, not the bug number, and put
 * the bug reference in `title`. Each step is "host sends X → user must now see Y".
 */
export const STREAM_SCRIPTS: readonly StreamScript[] = [
	{
		id: 'streamed-reply',
		title: 'assistant reply streams in chunk by chunk, then commits into one durable row',
		steps: [
			{
				name: 'user asks, assistant block opens (burst before first listener)',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }, { op: 'openOverlay', id: 'b1', at: 2 }] },
				],
				expect: {
					rows: [{ id: 'u1', kind: 'user', text: 'hi' }, { id: 'overlay:b1', kind: 'assistant', streaming: true }],
					paints: 2,
					acks: 2,
				},
			},
			{
				name: 'first chunk',
				send: [{ do: 'patches', ops: [{ op: 'chunk', block: 'b1', n: 1, text: 'he' }] }],
				expect: { rows: [{ id: 'u1' }, { id: 'overlay:b1', text: 'he', lacks: 'hello', streaming: true }] },
			},
			{
				name: 'second chunk extends the same row (no new row)',
				send: [{ do: 'patches', ops: [{ op: 'chunk', block: 'b1', n: 2, text: 'llo' }] }],
				expect: { rows: [{ id: 'u1' }, { id: 'overlay:b1', text: 'hello', streaming: true }] },
			},
			{
				name: 'engine commits the turn',
				send: [{ do: 'patches', ops: [{ op: 'commitOverlay', block: 'b1', as: 'a1', text: 'hello', at: 2 }] }],
				expect: {
					rows: [{ id: 'u1' }, { id: 'a1', kind: 'assistant', text: 'hello', streaming: false }],
					acks: 5,
				},
			},
		],
	},
	{
		id: 'order-follows-order-key',
		title: 'rows sort by orderKey, not by arrival order',
		steps: [
			{
				name: 'assistant row arrives before the user row that precedes it',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'assistant', id: 'a1', text: 'answer', at: 2 }] },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'question', at: 1 }] },
				],
				expect: { rows: [{ id: 'u1' }, { id: 'a1' }] },
			},
		],
	},
	{
		id: 'cancelled-turn',
		title: 'a streaming block removed without a commit leaves no ghost row',
		steps: [
			{
				name: 'stream starts',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }, { op: 'openOverlay', id: 'b1', at: 2 }, { op: 'chunk', block: 'b1', n: 1, text: 'par' }] },
				],
				expect: { rows: [{ id: 'u1' }, { id: 'overlay:b1', text: 'par', streaming: true }] },
			},
			{
				name: 'turn is cancelled',
				send: [{ do: 'patches', ops: [{ op: 'removeOverlay', block: 'b1' }] }],
				expect: { rows: [{ id: 'u1' }] },
			},
		],
	},
	{
		id: 'duplicate-frame',
		title: 'a re-delivered frame is not a gap: no paint, no ack, no resync',
		steps: [
			{
				name: 'first delivery',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }] },
				],
				expect: { rows: [{ id: 'u1' }], paints: 2, acks: 2, resyncs: 0 },
			},
			{
				name: 'same frame again',
				send: [{ do: 'duplicateLast' }],
				expect: { rows: [{ id: 'u1' }], paints: 2, acks: 2, resyncs: 0 },
			},
		],
	},
	{
		id: 'gap-then-recover',
		title: 'a frame after a hole is held back, a resync is requested, and a new baseline recovers',
		steps: [
			{
				name: 'healthy start',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }] },
				],
				expect: { rows: [{ id: 'u1' }], paints: 2, resyncs: 0 },
			},
			{
				name: 'one frame is lost; the next one must not be painted on top of stale state',
				send: [
					{ do: 'gap', skip: 1 },
					{ do: 'patches', ops: [{ op: 'item', role: 'assistant', id: 'a1', text: 'late', at: 2 }] },
				],
				expect: { rows: [{ id: 'u1', text: 'hi' }], paints: 2, resyncs: 1 },
			},
			{
				name: 'host answers the resync with a fresh baseline',
				send: [{
					do: 'baseline',
					items: [
						{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 },
						{ op: 'item', role: 'assistant', id: 'a1', text: 'late', at: 2 },
					],
				}],
				expect: { rows: [{ id: 'u1' }, { id: 'a1', text: 'late' }], paints: 3, resyncs: 1 },
			},
		],
	},
	{
		id: 'baseline-replaces',
		title: 'a later baseline replaces the timeline, it does not merge into it',
		steps: [
			{
				name: 'two rows',
				send: [{
					do: 'baseline',
					items: [
						{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 },
						{ op: 'item', role: 'assistant', id: 'a1', text: 'old', at: 2 },
					],
				}],
				expect: { rows: [{ id: 'u1' }, { id: 'a1', text: 'old' }] },
			},
			{
				name: 'baseline with one different row',
				send: [{ do: 'baseline', items: [{ op: 'item', role: 'user', id: 'u2', text: 'fresh', at: 1 }] }],
				expect: { rows: [{ id: 'u2', text: 'fresh' }] },
			},
			{
				name: 'empty baseline clears the view',
				send: [{ do: 'baseline' }],
				expect: { rows: [] },
			},
		],
	},
	{
		id: 'remove-row',
		title: 'removing a timeline item removes exactly that row',
		steps: [
			{
				name: 'two rows',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }, { op: 'item', role: 'assistant', id: 'a1', text: 'hello', at: 2 }] },
				],
				expect: { rows: [{ id: 'u1' }, { id: 'a1' }] },
			},
			{
				name: 'remove the reply',
				send: [{ do: 'patches', ops: [{ op: 'remove', id: 'a1' }] }],
				expect: { rows: [{ id: 'u1', text: 'hi' }] },
			},
		],
	},
	{
		id: 'dispose-stops-painting',
		title: 'after the lease is disposed nothing paints and the host lease is released',
		steps: [
			{
				name: 'healthy start',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }] },
				],
				expect: { rows: [{ id: 'u1' }], paints: 2, released: false },
			},
			{
				name: 'view goes away, host keeps sending',
				send: [
					{ do: 'disposeLease' },
					{ do: 'patches', ops: [{ op: 'item', role: 'assistant', id: 'a1', text: 'too late', at: 2 }] },
				],
				expect: { rows: [{ id: 'u1' }], paints: 2, released: true },
			},
		],
	},

	// ---- A. permission flow -----------------------------------------------------------------
	{
		id: 'permission-pending-then-allowed',
		title: 'a permission item with a pending action is a pending confirmation; resolving flips it in place without adding a row',
		steps: [
			{
				name: 'user asks, engine asks permission',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{ op: 'item', role: 'user', id: 'u1', text: 'clean up', at: 1 },
							{ op: 'permission', id: 'p1', title: 'Run rm -rf build?', at: 2 },
							{ op: 'pend', id: 'p1', title: 'Run rm -rf build?' },
						],
					},
				],
				expect: { rows: [{ id: 'u1', kind: 'user' }, { id: 'p1', kind: 'confirmation', text: 'Input needed', status: 'pending' }] },
			},
			{
				name: 'user allows: pending action removed, item carries the decision',
				send: [{ do: 'patches', ops: [{ op: 'unpend', id: 'p1' }, { op: 'permission', id: 'p1', title: 'Run rm -rf build?', at: 2, decision: 'allow' }] }],
				expect: { rows: [{ id: 'u1' }, { id: 'p1', kind: 'confirmation', text: 'Run rm -rf build?', lacks: 'Input needed', status: 'allowed' }], paints: 3 },
			},
		],
	},
	{
		id: 'permission-denied-is-skipped',
		title: 'a denied permission becomes a skipped confirmation, still one row',
		steps: [
			{
				name: 'permission pending',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'permission', id: 'p1', title: 'Write file?', at: 1 }, { op: 'pend', id: 'p1', title: 'Write file?' }] },
				],
				expect: { rows: [{ id: 'p1', kind: 'confirmation', status: 'pending' }] },
			},
			{
				name: 'user denies',
				send: [{ do: 'patches', ops: [{ op: 'unpend', id: 'p1' }, { op: 'permission', id: 'p1', title: 'Write file?', at: 1, decision: 'deny' }] }],
				expect: { rows: [{ id: 'p1', kind: 'confirmation', text: 'Write file?', lacks: 'Input needed', status: 'skipped' }] },
			},
		],
	},
	{
		id: 'permission-unpend-alone-is-undecided',
		title: 'withdrawing the pending action without a decision leaves an undecided confirmation (not pending, not dropped)',
		steps: [
			{
				name: 'permission pending',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'permission', id: 'p1', title: 'Write file?', at: 1 }, { op: 'pend', id: 'p1', title: 'Write file?' }] },
				],
				expect: { rows: [{ id: 'p1', status: 'pending' }] },
			},
			{
				name: 'engine withdraws the ask (timeout / cancel)',
				send: [{ do: 'patches', ops: [{ op: 'unpend', id: 'p1' }] }],
				expect: { rows: [{ id: 'p1', kind: 'confirmation', text: 'Write file?', lacks: 'Input needed', status: 'undecided' }] },
			},
		],
	},
	{
		id: 'permission-respond-failed-keeps-row-pending',
		title: 'a failed respond uplink stays pending, shows the error, and keeps Allow/Skip',
		steps: [
			{
				name: 'permission pending',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'permission', id: 'p1', title: 'Run tests?', at: 1 }, { op: 'pend', id: 'p1', title: 'Run tests?' }] },
				],
				expect: { rows: [{ id: 'p1', status: 'pending' }], paints: 2 },
			},
			{
				name: 'respond fails on the host write',
				send: [{ do: 'patches', ops: [{ op: 'respondFailed', id: 'p1', cause: 'hostWriteFailed', retryable: true, error: 'ipc closed' }] }],
				expect: { rows: [{ id: 'p1', kind: 'confirmation', status: 'pending', text: 'AllowSkip', also: 'ipc closed' }], paints: 3, acks: 3, resyncs: 0, rerenders: 1 },
			},
			{
				name: 'retry succeeds',
				send: [{ do: 'patches', ops: [{ op: 'unpend', id: 'p1' }, { op: 'permission', id: 'p1', title: 'Run tests?', at: 1, decision: 'allow' }] }],
				expect: { rows: [{ id: 'p1', status: 'allowed', lacks: 'ipc closed' }], paints: 4 },
			},
		],
	},
	{
		id: 'permission-respond-failed-not-retryable',
		title: 'a non-retryable respond failure shows the error and hides Allow/Skip',
		steps: [
			{
				name: 'permission pending',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'permission', id: 'p1', title: 'Run tests?', at: 1 }, { op: 'pend', id: 'p1', title: 'Run tests?' }] },
				],
				expect: { rows: [{ id: 'p1', status: 'pending', text: 'AllowSkip' }] },
			},
			{
				name: 'respond fails and cannot be retried',
				send: [{ do: 'patches', ops: [{ op: 'respondFailed', id: 'p1', cause: 'commandFailed', retryable: false, error: 'gone' }] }],
				expect: { rows: [{ id: 'p1', status: 'pending', text: 'gone', lacks: 'AllowSkip' }], resyncs: 0 },
			},
		],
	},
	{
		id: 'permission-pending-action-before-item',
		title: 'a pending action alone adds no row; the row appears pending once its item arrives',
		steps: [
			{
				name: 'pending action first',
				send: [{ do: 'baseline' }, { do: 'patches', ops: [{ op: 'pend', id: 'p1', title: 'Run tests?' }] }],
				expect: { rows: [], entries: [], paints: 2 },
			},
			{
				name: 'item arrives',
				send: [{ do: 'patches', ops: [{ op: 'permission', id: 'p1', title: 'Run tests?', at: 1 }] }],
				expect: { rows: [{ id: 'p1', kind: 'confirmation', status: 'pending', text: 'AllowSkip' }] },
			},
		],
	},
	{
		id: 'permission-decision-closes-seat-before-unpend',
		title: 'a decided permission closes the seat even while its pending action is still present',
		steps: [
			{
				name: 'permission pending',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'permission', id: 'p1', title: 'Run tests?', at: 1 }, { op: 'pend', id: 'p1', title: 'Run tests?' }] },
				],
				expect: { rows: [{ id: 'p1', status: 'pending', text: 'AllowSkip' }] },
			},
			{
				name: 'decision lands first, pending action still present',
				send: [{ do: 'patches', ops: [{ op: 'permission', id: 'p1', title: 'Run tests?', at: 1, decision: 'allow' }] }],
				expect: { rows: [{ id: 'p1', status: 'allowed', lacks: 'AllowSkip' }] },
			},
			{
				name: 'pending action removed: settles to the decision',
				send: [{ do: 'patches', ops: [{ op: 'unpend', id: 'p1' }] }],
				expect: { rows: [{ id: 'p1', status: 'allowed', lacks: 'AllowSkip' }] },
			},
		],
	},
	{
		id: 'permission-respond-failed-unknown-request',
		title: 'a failed respond for an unknown request id is a harmless no-op (no row appears, no resync)',
		steps: [
			{
				name: 'one user row, then a stray failure',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }] },
					{ do: 'patches', ops: [{ op: 'respondFailed', id: 'ghost', cause: 'commandFailed', retryable: false, error: 'gone' }] },
				],
				expect: { rows: [{ id: 'u1', text: 'hi' }], paints: 3, resyncs: 0 },
			},
		],
	},

	// ---- B. question flow -------------------------------------------------------------------
	{
		id: 'question-pending-then-answered',
		title: 'an ask-user question is a pending question row with its sub-questions until the answered chrome arrives, in place',
		steps: [
			{
				name: 'engine asks the user',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{ op: 'item', role: 'user', id: 'u1', text: 'pick a db', at: 1 },
							{
								op: 'question', id: 'q1', title: 'Which database?', at: 2, answerKeysValid: true,
								items: [{ id: 'db', title: 'Database', options: ['pg', 'sqlite'] }],
							},
							{ op: 'pend', id: 'q1', title: 'Which database?', as: 'question' },
						],
					},
				],
				expect: {
					rows: [{ id: 'u1' }, {
						id: 'q1', kind: 'question', text: 'Which database?', status: 'pending',
						answerKeysValid: true, questionItems: ['db'], questionRequestId: 'q1',
					}],
				},
			},
			{
				name: 'user answers: pending removed, answered chrome set',
				send: [{
					do: 'patches', ops: [
						{ op: 'unpend', id: 'q1' },
						{
							op: 'question', id: 'q1', title: 'Which database?', at: 2, answerKeysValid: true, answered: true,
							items: [{ id: 'db', title: 'Database', options: ['pg', 'sqlite'] }],
						},
					],
				}],
				expect: { rows: [{ id: 'u1' }, { id: 'q1', kind: 'question', status: 'allowed', questionItems: ['db'], questionRequestId: null }] },
			},
		],
	},
	{
		id: 'question-invalid-answer-keys',
		title: 'answerKeysValid=false (duplicate / blank sub-question ids) never reaches the row as submit-safe',
		steps: [
			{
				name: 'ask with invalid keys',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{
								op: 'question', id: 'q1', title: 'Pick', at: 1, answerKeysValid: false,
								items: [{ id: 'a', title: 'A', options: ['x'] }, { id: 'a', title: 'A again', options: ['y'] }],
							},
							{ op: 'pend', id: 'q1', title: 'Pick', as: 'question' },
						],
					},
				],
				expect: { rows: [{ id: 'q1', kind: 'question', status: 'pending', answerKeysValid: false, questionItems: ['a', 'a'] }] },
			},
		],
	},
	{
		id: 'question-valid-flag-without-options-is-not-submit-safe',
		title: 'a question claiming answerKeysValid=true whose sub-question has no options and no custom answer is not submit-safe',
		steps: [
			{
				name: 'ask claims valid keys but offers nothing to pick',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'question', id: 'q1', title: 'Pick', at: 1, answerKeysValid: true, items: [{ id: 'a', title: 'A' }] }] },
				],
				expect: { rows: [{ id: 'q1', kind: 'question', status: 'pending', answerKeysValid: false, questionItems: ['a'] }] },
			},
		],
	},
	{
		id: 'question-compound-row-id-resolves-pending-request',
		title: 'a compound question row id `<requestId>:<n>` resolves its parent pending request id',
		steps: [
			{
				name: 'two sub-question rows under one pending ask',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{ op: 'question', id: 'ask:0', title: 'First?', at: 1, answerKeysValid: true, items: [{ id: 'k', title: 'K', options: ['y', 'n'] }] },
							{ op: 'question', id: 'ask:1', title: 'Second?', at: 2, answerKeysValid: true, items: [{ id: 'k', title: 'K', options: ['y', 'n'] }] },
							{ op: 'pend', id: 'ask', title: 'ask', as: 'question' },
						],
					},
				],
				expect: { rows: [{ id: 'ask:0', questionRequestId: 'ask' }, { id: 'ask:1', questionRequestId: 'ask' }] },
			},
		],
	},

	// ---- C. tool rows -----------------------------------------------------------------------
	{
		id: 'tool-lifecycle-in-place',
		title: 'a tool row moves pending → running → completed under one row id (no duplicates)',
		steps: [
			{
				name: 'tool is announced',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{ op: 'item', role: 'user', id: 'u1', text: 'run ls', at: 1 },
							{ op: 'tool', id: 't1', title: 'ls', toolName: 'bash', status: 'pending', at: 2 },
						],
					},
				],
				expect: { rows: [{ id: 'u1' }, { id: 'fold:t1' }], entries: [{ id: 'u1' }, { id: 't1', toolStatus: 'pending', streaming: true }] },
			},
			{
				name: 'tool starts running',
				send: [{ do: 'patches', ops: [{ op: 'tool', id: 't1', title: 'ls', toolName: 'bash', status: 'running', at: 2, arg: '-la' }] }],
				expect: { rows: [{ id: 'u1' }, { id: 'fold:t1' }], entries: [{ id: 'u1' }, { id: 't1', toolStatus: 'running', streaming: true }] },
			},
			{
				name: 'tool completes with a result',
				send: [{ do: 'patches', ops: [{ op: 'tool', id: 't1', title: 'ls', toolName: 'bash', status: 'completed', at: 2, arg: '-la', result: 'a.txt' }] }],
				expect: { rows: [{ id: 'u1' }, { id: 'fold:t1' }], entries: [{ id: 'u1' }, { id: 't1', toolStatus: 'completed', streaming: false }], paints: 4 },
			},
		],
	},
	{
		id: 'tool-failed-and-cancelled-are-terminal',
		title: 'failed and cancelled tools stop streaming and keep their terminal status',
		steps: [
			{
				name: 'two running tools',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{ op: 'tool', id: 't1', title: 'build', toolName: 'bash', status: 'running', at: 1 },
							{ op: 'tool', id: 't2', title: 'lint', toolName: 'bash', status: 'running', at: 2 },
						],
					},
				],
				expect: { rows: [{ id: 'fold:t1' }], entries: [{ id: 't1', toolStatus: 'running', streaming: true }, { id: 't2', toolStatus: 'running', streaming: true }] },
			},
			{
				name: 'one fails, one is cancelled',
				send: [{
					do: 'patches', ops: [
						{ op: 'tool', id: 't1', title: 'build', toolName: 'bash', status: 'failed', at: 1 },
						{ op: 'tool', id: 't2', title: 'lint', toolName: 'bash', status: 'cancelled', at: 2 },
					],
				}],
				expect: { rows: [{ id: 'fold:t1' }], entries: [{ id: 't1', toolStatus: 'failed', streaming: false }, { id: 't2', toolStatus: 'cancelled', streaming: false }] },
			},
		],
	},
	{
		id: 'tool-respondable-chrome-follows-the-summary',
		title: 'a client-tool row is respondable only while its summary says so',
		steps: [
			{
				name: 'client tool awaiting a response',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'tool', id: 't1', title: 'pick file', toolName: 'client_pick', status: 'running', at: 1, respondable: true }] },
				],
				expect: { rows: [{ id: 'fold:t1' }], entries: [{ id: 't1', toolStatus: 'running', respondable: true }] },
			},
			{
				name: 'answered: the same row is no longer respondable',
				send: [{ do: 'patches', ops: [{ op: 'tool', id: 't1', title: 'pick file', toolName: 'client_pick', status: 'completed', at: 1 }] }],
				expect: { rows: [{ id: 'fold:t1' }], entries: [{ id: 't1', toolStatus: 'completed', respondable: false }] },
			},
		],
	},

	// ---- D. honest error / unknown rows -----------------------------------------------------
	{
		id: 'error-row-is-kept',
		title: 'retryable and non-retryable errors render as error rows in order and are not dropped',
		steps: [
			{
				name: 'two errors between a question and an answer',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{ op: 'item', role: 'user', id: 'u1', text: 'go', at: 1 },
							{ op: 'error', id: 'e1', title: 'Rate limited', retryable: true, at: 2, code: '429' },
							{ op: 'error', id: 'e2', title: 'Model unavailable', retryable: false, at: 3 },
						],
					},
				],
				expect: {
					rows: [
						{ id: 'u1', kind: 'user' },
						{ id: 'e1', kind: 'error', text: 'Rate limited', retryable: true },
						{ id: 'e2', kind: 'error', text: 'Model unavailable', retryable: false },
					],
				},
			},
			{
				name: 'a later assistant row does not displace them',
				send: [{ do: 'patches', ops: [{ op: 'item', role: 'assistant', id: 'a1', text: 'sorry', at: 4 }] }],
				expect: { rows: [{ id: 'u1' }, { id: 'e1', kind: 'error' }, { id: 'e2', kind: 'error' }, { id: 'a1', kind: 'assistant' }] },
			},
		],
	},
	{
		id: 'unknown-row-is-not-assistant',
		title: 'an unknown upstream block renders as an unknown row carrying its verbatim type name, never as assistant text',
		steps: [
			{
				name: 'unknown block arrives',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{ op: 'item', role: 'assistant', id: 'a1', text: 'known', at: 1 },
							{ op: 'unknown', id: 'x1', typeName: 'HologramBlock', rawContent: '{"v":1}', at: 2 },
						],
					},
				],
				expect: { rows: [{ id: 'a1', kind: 'assistant' }, { id: 'x1', kind: 'unknown', typeName: 'HologramBlock', text: '{"v":1}' }] },
			},
		],
	},

	// ---- E. sync chrome ---------------------------------------------------------------------
	{
		id: 'sync-change-does-not-repaint-rows',
		title: 'a sync-only frame is applied (paint) and moves the replica chrome, but no row is rebuilt or re-rendered',
		steps: [
			{
				name: 'rows on screen, replica idle',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }, { op: 'item', role: 'assistant', id: 'a1', text: 'hello', at: 2 }] },
				],
				expect: { rows: [{ id: 'u1', text: 'hi' }, { id: 'a1', text: 'hello' }], paints: 2, sync: { kind: 'idle' }, syncLabel: 'Session not connected' },
			},
			{
				name: 'sync goes live',
				send: [{ do: 'patches', ops: [{ op: 'sync', kind: 'live' }] }],
				expect: { rows: [{ id: 'u1', text: 'hi' }, { id: 'a1', text: 'hello' }], paints: 3, acks: 3, rerenders: 0, sync: { kind: 'live' }, syncLabel: 'Session live' },
			},
			{
				name: 'sync goes syncing',
				send: [{ do: 'patches', ops: [{ op: 'sync', kind: 'syncing' }] }],
				expect: { rows: [{ id: 'u1' }, { id: 'a1' }], paints: 4, rerenders: 0, sync: { kind: 'syncing' }, syncLabel: 'Session syncing' },
			},
		],
	},
	{
		id: 'sync-degraded-then-live-recovers',
		title: 'degraded keeps the rows and the reason; live clears the reason; rows are never touched',
		steps: [
			{
				name: 'live session with a reply',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'sync', kind: 'live' }, { op: 'item', role: 'assistant', id: 'a1', text: 'hello', at: 1 }] },
				],
				expect: { rows: [{ id: 'a1', text: 'hello' }], sync: { kind: 'live' }, syncLabel: 'Session live' },
			},
			{
				name: 'subscription degrades',
				send: [{ do: 'patches', ops: [{ op: 'sync', kind: 'degraded', reason: 'lagging' }] }],
				expect: { rows: [{ id: 'a1', text: 'hello' }], rerenders: 0, sync: { kind: 'degraded', reason: 'lagging' }, syncLabel: 'Session degraded: lagging' },
			},
			{
				name: 'wire reason is an opaque number: label does not paint it',
				send: [{ do: 'patches', ops: [{ op: 'sync', kind: 'degraded', reason: '3' }] }],
				expect: { rows: [{ id: 'a1' }], rerenders: 0, sync: { kind: 'degraded', reason: '3' }, syncLabel: 'Session degraded' },
			},
			{
				name: 'subscription recovers',
				send: [{ do: 'patches', ops: [{ op: 'sync', kind: 'live' }] }],
				expect: { rows: [{ id: 'a1', text: 'hello' }], rerenders: 0, sync: { kind: 'live' }, syncLabel: 'Session live' },
			},
		],
	},
	{
		id: 'sync-closed-keeps-history-and-can-reopen',
		title: 'a closed session keeps its rows on screen; a fresh live chrome after it is adopted',
		steps: [
			{
				name: 'live session with a reply',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'sync', kind: 'live' }, { op: 'item', role: 'assistant', id: 'a1', text: 'hello', at: 1 }] },
				],
				expect: { rows: [{ id: 'a1' }], sync: { kind: 'live' } },
			},
			{
				name: 'session closed by the host',
				send: [{ do: 'patches', ops: [{ op: 'sync', kind: 'closed', reason: '' }] }],
				expect: { rows: [{ id: 'a1', text: 'hello' }], rerenders: 0, sync: { kind: 'closed', reason: '' }, syncLabel: 'Session disconnected' },
			},
			{
				name: 'closed with a readable reason',
				send: [{ do: 'patches', ops: [{ op: 'sync', kind: 'closed', reason: 'purged by admin' }] }],
				expect: { rows: [{ id: 'a1' }], sync: { kind: 'closed', reason: 'purged by admin' }, syncLabel: 'Session disconnected: purged by admin' },
			},
			{
				name: 'session reopened',
				send: [{ do: 'patches', ops: [{ op: 'sync', kind: 'live' }] }],
				expect: { rows: [{ id: 'a1' }], sync: { kind: 'live' }, syncLabel: 'Session live' },
			},
		],
	},
	{
		id: 'sync-and-row-in-one-frame',
		title: 'a frame carrying both a sync change and a new row paints the row once',
		steps: [
			{
				name: 'one frame: degraded + new reply',
				send: [
					{ do: 'baseline' },
					{ do: 'patches', ops: [{ op: 'sync', kind: 'degraded', reason: 'slow' }, { op: 'item', role: 'assistant', id: 'a1', text: 'still here', at: 1 }] },
				],
				expect: { rows: [{ id: 'a1', text: 'still here' }], paints: 2, sync: { kind: 'degraded', reason: 'slow' } },
			},
		],
	},

	// ---- F. question respond uplink -------------------------------------------------------
	{
		id: 'question-respond-failed-keeps-submit',
		title: 'a failed question respond stays a pending question, shows the error, and keeps Submit',
		steps: [
			{
				name: 'question pending with valid answer keys',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{
								op: 'question', id: 'q1', title: 'Which database?', at: 1, answerKeysValid: true,
								items: [{ id: 'db', title: 'Database', options: ['pg', 'sqlite'], multiSelect: true }],
							},
							{ op: 'pend', id: 'q1', title: 'Which database?', as: 'question' },
						],
					},
				],
				expect: {
					rows: [{
						id: 'q1', kind: 'question', status: 'pending', answerKeysValid: true,
						questionItems: ['db'], questionRequestId: 'q1', text: 'Submit',
					}],
				},
			},
			{
				name: 'respond fails on the host write',
				send: [{ do: 'patches', ops: [{ op: 'respondFailed', id: 'q1', cause: 'hostWriteFailed', retryable: true, error: 'ipc closed' }] }],
				expect: {
					rows: [{
						id: 'q1', kind: 'question', status: 'pending',
						text: 'Couldn\'t send this response: ipc closed', also: 'Submit',
					}],
				},
			},
		],
	},
	{
		id: 'question-respond-failed-not-retryable',
		title: 'a non-retryable question respond failure shows the error and hides Submit',
		steps: [
			{
				name: 'question pending with valid answer keys',
				send: [
					{ do: 'baseline' },
					{
						do: 'patches', ops: [
							{
								op: 'question', id: 'q1', title: 'Which database?', at: 1, answerKeysValid: true,
								items: [{ id: 'db', title: 'Database', options: ['pg', 'sqlite'], multiSelect: true }],
							},
							{ op: 'pend', id: 'q1', title: 'Which database?', as: 'question' },
						],
					},
				],
				expect: { rows: [{ id: 'q1', kind: 'question', status: 'pending', text: 'Submit' }] },
			},
			{
				name: 'respond fails and cannot be retried',
				send: [{ do: 'patches', ops: [{ op: 'respondFailed', id: 'q1', cause: 'commandFailed', retryable: false, error: 'gone' }] }],
				expect: {
					rows: [{
						id: 'q1', kind: 'question', status: 'pending',
						text: 'Couldn\'t send this response: gone', lacks: 'Submit',
					}],
				},
			},
		],
	},
];

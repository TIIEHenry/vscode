/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { AttributionPatch } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { OverlayBlockId, TimelineItemId, ToolSummaryStatus, ViewPatch } from '../../../../../platform/universeAgent/common/sessionView/types.js';
import { formatSyncChromeLabel } from '../../browser/conversationSessionView.js';
import type { StreamHarness } from './streamHarness.js';

/**
 * Declarative stream scripts ("剧本").
 *
 * A script is plain, JSON-serialisable data: what the host sends, and what the user must see
 * afterwards. No code, no DOM, no leases — so a script can be read as a spec, diffed in review,
 * and later generated from a recorded engine session or replayed against a real window by the
 * `test/scenario` runner.
 *
 * ```ts
 * { id: 'streamed-reply', title: '…', steps: [
 *   { name: 'user asks', send: [{ do: 'patches', ops: [{ op: 'item', role: 'user', id: 'u1', text: 'hi', at: 1 }] }],
 *     expect: { rows: [{ id: 'u1', text: 'hi' }] } },
 * ] }
 * ```
 *
 * Add a script per subscription bug: send the frames that reproduced it, expect the rows the
 * user should have seen. The runner (`runStreamScript`) is the only place that knows how.
 */

/** Order position. Compiled to a zero-padded `orderKey`; the UI must sort by it, not by arrival. */
export type At = number;

export type ScriptOp =
	/** Durable timeline row (L2). Upserting an existing id replaces it. */
	| { readonly op: 'item'; readonly role: 'user' | 'assistant'; readonly id: string; readonly text: string; readonly at: At }
	/** Remove a durable row. */
	| { readonly op: 'remove'; readonly id: string }
	/** Open a streaming assistant block (L3). Renders as row `overlay:<id>`. */
	| { readonly op: 'openOverlay'; readonly id: string; readonly at: At }
	/** Append / replace the `n`-th text chunk of a streaming block. */
	| { readonly op: 'chunk'; readonly block: string; readonly n: number; readonly text: string }
	/** Drop a streaming block without a durable replacement (cancelled turn). */
	| { readonly op: 'removeOverlay'; readonly block: string }
	/** The engine commits the turn: streaming block goes away, durable row `as` takes its place. */
	| { readonly op: 'commitOverlay'; readonly block: string; readonly as: string; readonly text: string; readonly at: At }
	/** Session sync chrome. `degraded` / `closed` carry the opaque wire `reason` (may be empty or numeric). */
	| { readonly op: 'sync'; readonly kind: 'idle' | 'syncing' | 'live' }
	| { readonly op: 'sync'; readonly kind: 'degraded' | 'closed'; readonly reason: string }
	/** Durable permission row. `decision` is the local decision chrome; omit while undecided. */
	| { readonly op: 'permission'; readonly id: string; readonly title: string; readonly at: At; readonly decision?: 'allow' | 'deny' }
	/** Durable ask-user row. `answered` is the local answered chrome; omit while open. */
	| {
		readonly op: 'question'; readonly id: string; readonly title: string; readonly at: At;
		readonly items: readonly {
			readonly id: string; readonly title: string; readonly options?: readonly string[];
			/** When set, the seat paints an explicit Submit control (multi-select / custom answer). */
			readonly multiSelect?: boolean; readonly allowCustom?: boolean;
		}[];
		readonly answerKeysValid: boolean;
		readonly answered?: boolean;
	}
	/** Durable tool row. Upserting the same id moves it through pending → running → completed. */
	| {
		readonly op: 'tool'; readonly id: string; readonly title: string; readonly toolName: string; readonly status: ToolSummaryStatus; readonly at: At;
		readonly arg?: string; readonly result?: string; readonly respondable?: boolean;
	}
	/** Durable error row. */
	| { readonly op: 'error'; readonly id: string; readonly title: string; readonly retryable: boolean; readonly at: At; readonly code?: string }
	/** Durable row of an upstream type the view does not know (honest degradation). */
	| { readonly op: 'unknown'; readonly id: string; readonly typeName: string; readonly rawContent: string; readonly at: At }
	/** The engine asks the user (permission / ask-user): pending action keyed by `id`. For a row to be pending, `id` must be the row id (or its `<id>:` prefix for question rows). */
	| { readonly op: 'pend'; readonly id: string; readonly title: string; readonly as?: 'permission' | 'question' }
	/** The pending action is resolved or withdrawn. */
	| { readonly op: 'unpend'; readonly id: string }
	/** A respond uplink failed. The replica only acknowledges it (snapshot unchanged). */
	| { readonly op: 'respondFailed'; readonly id: string; readonly cause: 'hostWriteFailed' | 'commandFailed'; readonly retryable: boolean; readonly error: string };

export type StreamEvent =
	/** Full replace. */
	| { readonly do: 'baseline'; readonly items?: readonly Extract<ScriptOp, { op: 'item' }>[] }
	/** Incremental frame. */
	| { readonly do: 'patches'; readonly ops: readonly ScriptOp[] }
	/** At-least-once transport: the previous frame arrives again. */
	| { readonly do: 'duplicateLast' }
	/** The host dropped `skip` frames: the next frame arrives with a hole before it. */
	| { readonly do: 'gap'; readonly skip: number }
	/** The UI side lets go of the session (view closed / session switched). */
	| { readonly do: 'disposeLease' };

/**
 * Fields of a projected `ConversationTimelineEntry` (`harness.entries()`), independent of the DOM.
 * Several entries can share one DOM root (consecutive tool / thinking rows fold into `fold:<firstId>`).
 */
export interface EntryExpect {
	readonly id: string;
	/** Projected entry's `streaming` flag. */
	readonly streaming?: boolean;
	/** Projected confirmation / question status. */
	readonly status?: 'pending' | 'allowed' | 'skipped' | 'undecided';
	/** Projected tool entry's `toolStatus`. */
	readonly toolStatus?: ToolSummaryStatus;
	/** Whether the projected entry carries the client-tool `respondable` chrome. */
	readonly respondable?: boolean;
	/** Projected error entry's `retryable` (absent entry value is read as `false`). */
	readonly retryable?: boolean;
	/** Projected unknown entry's verbatim `typeName`. */
	readonly typeName?: string;
	/** Projected question entry's `answerKeysValid` (absent entry value is read as `false`). */
	readonly answerKeysValid?: boolean;
	/** Projected question entry's sub-question ids, in order. `[]` means none. */
	readonly questionItems?: readonly string[];
	/** Projected question entry's pending request id; `null` means none was resolved. */
	readonly questionRequestId?: string | null;
}

/** A DOM root. Its `id` is the root id (`fold:<firstId>` for a process fold); entry fields read the entry with the same id. */
export interface RowExpect extends Omit<EntryExpect, 'id'> {
	readonly id: string;
	/** Turn kind rendered for the row (`user`, `assistant`, …). */
	readonly kind?: string;
	/** Row text must contain this. */
	readonly text?: string;
	/** Second substring the row text must contain. */
	readonly also?: string;
	/** Row text must NOT contain this (e.g. a later chunk that has not arrived yet). */
	readonly lacks?: string;
}

export interface StreamExpect {
	/** Exactly these rows, in this DOM order. `[]` means an empty timeline. */
	readonly rows?: readonly RowExpect[];
	/** Exactly these projected entries, in this order (no DOM). Use when rows fold several entries into one root. */
	readonly entries?: readonly EntryExpect[];
	/** Cumulative number of resync requests sent to the host. */
	readonly resyncs?: number;
	/** Cumulative number of frames acknowledged to the host. */
	readonly acks?: number;
	/** Cumulative number of paints (== frames the replica accepted). */
	readonly paints?: number;
	/** Whether the host lease has been released. */
	readonly released?: boolean;
	/** Replica sync chrome (`lease.snapshot.sync`); `reason` is checked only when given. */
	readonly sync?: { readonly kind: 'idle' | 'syncing' | 'live' | 'degraded' | 'closed'; readonly reason?: string };
	/** `formatSyncChromeLabel(lease.snapshot.sync)`, exact; `undefined` is not a valid label for any current kind. */
	readonly syncLabel?: string;
	/** Row re-renders the host performed while applying THIS step's frames (not cumulative). */
	readonly rerenders?: number;
}

export interface StreamStep {
	readonly name: string;
	readonly send?: readonly StreamEvent[];
	readonly expect?: StreamExpect;
}

export interface StreamScript {
	readonly id: string;
	readonly title: string;
	readonly steps: readonly StreamStep[];
}

// ---- compile: script data → host frames ----------------------------------------------------

function orderKey(at: At): string {
	return String(at).padStart(10, '0');
}

interface Compiled {
	readonly patches: ViewPatch[];
	readonly attribution: AttributionPatch[];
}

function compileOps(h: StreamHarness, ops: readonly ScriptOp[]): Compiled {
	const patches: ViewPatch[] = [];
	const attribution: AttributionPatch[] = [];
	const add = (built: { patch: ViewPatch; attribution: AttributionPatch }) => {
		patches.push(built.patch);
		attribution.push(built.attribution);
	};
	for (const op of ops) {
		switch (op.op) {
			case 'item':
				add(op.role === 'user' ? h.view.userItem(op.id, op.text, orderKey(op.at)) : h.view.assistantItem(op.id, op.text, orderKey(op.at)));
				break;
			case 'remove':
				patches.push({ op: 'removeTimelineItem', itemId: op.id as TimelineItemId });
				attribution.push({ op: 'removeAttribution', itemId: op.id });
				break;
			case 'openOverlay':
				add(h.view.openAssistantOverlay(op.id, orderKey(op.at)));
				break;
			case 'chunk':
				patches.push(h.view.textChunk(op.block, op.n, op.text));
				break;
			case 'removeOverlay':
				patches.push({ op: 'removeOverlayBlock', blockId: op.block as OverlayBlockId });
				attribution.push({ op: 'removeAttribution', itemId: `overlay:${op.block}` });
				break;
			case 'commitOverlay':
				patches.push({ op: 'removeOverlayBlock', blockId: op.block as OverlayBlockId });
				attribution.push({ op: 'removeAttribution', itemId: `overlay:${op.block}` });
				add(h.view.assistantItem(op.as, op.text, orderKey(op.at)));
				break;
			case 'sync':
				patches.push(h.view.syncChrome(op.kind === 'degraded' || op.kind === 'closed' ? { kind: op.kind, reason: op.reason } : { kind: op.kind }));
				break;
			case 'permission':
				add(h.view.permissionItem(op.id, op.title, orderKey(op.at), op.decision));
				break;
			case 'question':
				add(h.view.questionItem(op.id, op.title, orderKey(op.at), {
					items: op.items.map(item => ({
						id: item.id,
						title: item.title,
						...(item.options ? { optionsPreview: item.options } : {}),
						...(item.multiSelect ? { multiSelect: true as const } : {}),
						...(item.allowCustom ? { allowCustom: true as const } : {}),
					})),
					answerKeysValid: op.answerKeysValid,
					answered: op.answered,
				}));
				break;
			case 'tool':
				add(h.view.toolItem(op.id, orderKey(op.at), {
					title: op.title, toolName: op.toolName, status: op.status,
					argPreview: op.arg, resultPreview: op.result, respondable: op.respondable,
				}));
				break;
			case 'error':
				add(h.view.errorItem(op.id, op.title, orderKey(op.at), op.retryable, op.code));
				break;
			case 'unknown':
				add(h.view.unknownItem(op.id, op.typeName, op.rawContent, orderKey(op.at)));
				break;
			case 'pend':
				patches.push(h.view.pendingAction(op.id, op.title, op.as));
				break;
			case 'unpend':
				patches.push(h.view.removePendingAction(op.id));
				break;
			case 'respondFailed':
				patches.push(h.view.pendingRespondFailed(op.id, op.cause, op.retryable, op.error));
				break;
		}
	}
	return { patches, attribution };
}

function send(h: StreamHarness, event: StreamEvent): void {
	switch (event.do) {
		case 'baseline': {
			const items = (event.items ?? []).map(item => compileOps(h, [item]));
			h.view.baseline(
				{ timeline: items.flatMap(c => c.patches.flatMap(p => p.op === 'upsertTimelineItem' ? [p.item] : [])) },
				{ attribution: items.flatMap(c => c.attribution) });
			break;
		}
		case 'patches': {
			const { patches, attribution } = compileOps(h, event.ops);
			h.view.patches(patches, { attribution });
			break;
		}
		case 'duplicateLast':
			h.view.duplicateLast();
			break;
		case 'gap':
			h.view.skipFrames(event.skip);
			break;
		case 'disposeLease':
			h.lease.dispose();
			break;
	}
}

// ---- run + assert ---------------------------------------------------------------------------

export async function runStreamScript(h: StreamHarness, script: StreamScript): Promise<void> {
	for (const [index, step] of script.steps.entries()) {
		const where = `[${script.id} › step ${index + 1} "${step.name}"]`;
		const rerendersBefore = h.host.getTestApplyMetrics().rerenderCount;
		for (const event of step.send ?? []) {
			send(h, event);
		}
		await h.settle();
		if (step.expect) {
			assertExpect(h, step.expect, where, h.host.getTestApplyMetrics().rerenderCount - rerendersBefore);
		}
	}
}

function assertExpect(h: StreamHarness, expect: StreamExpect, where: string, rerenders: number): void {
	if (expect.rows) {
		assert.deepStrictEqual(h.rowIds(), expect.rows.map(r => r.id), `${where} rows (DOM order)`);
		for (const row of expect.rows) {
			const element = h.host.getTimelineRowElement(row.id);
			assert.ok(element, `${where} row "${row.id}" missing`);
			const text = h.rowText(row.id) ?? '';
			if (row.kind !== undefined) {
				assert.strictEqual(h.rowKind(row.id), row.kind, `${where} row "${row.id}" kind`);
			}
			if (row.text !== undefined) {
				assert.ok(text.includes(row.text), `${where} row "${row.id}" should contain ${JSON.stringify(row.text)}, got ${JSON.stringify(text)}`);
			}
			if (row.also !== undefined) {
				assert.ok(text.includes(row.also), `${where} row "${row.id}" should contain ${JSON.stringify(row.also)}, got ${JSON.stringify(text)}`);
			}
			if (row.lacks !== undefined) {
				assert.ok(!text.includes(row.lacks), `${where} row "${row.id}" must not contain ${JSON.stringify(row.lacks)}, got ${JSON.stringify(text)}`);
			}
			assertEntryFields(h, row, `${where} row "${row.id}"`);
		}
	}
	if (expect.entries) {
		assert.deepStrictEqual(h.entries().map(e => e.id), expect.entries.map(e => e.id), `${where} entries (projection order)`);
		for (const entry of expect.entries) {
			assertEntryFields(h, entry, `${where} entry "${entry.id}"`);
		}
	}
	if (expect.resyncs !== undefined) {
		assert.strictEqual(h.view.requestResyncCalls.length, expect.resyncs, `${where} resync requests`);
	}
	if (expect.acks !== undefined) {
		assert.strictEqual(h.view.acknowledgeCalls.length, expect.acks, `${where} acks`);
	}
	if (expect.paints !== undefined) {
		assert.strictEqual(h.applied.length, expect.paints, `${where} paints`);
	}
	if (expect.released !== undefined) {
		assert.strictEqual(h.view.releaseLeaseCalls.length > 0, expect.released, `${where} host lease released`);
	}
	if (expect.sync !== undefined) {
		const sync = h.lease.snapshot.sync;
		assert.strictEqual(sync.kind, expect.sync.kind, `${where} sync kind`);
		if (expect.sync.reason !== undefined) {
			assert.strictEqual(sync.kind === 'degraded' || sync.kind === 'closed' ? sync.reason : undefined, expect.sync.reason, `${where} sync reason`);
		}
	}
	if (expect.syncLabel !== undefined) {
		assert.strictEqual(formatSyncChromeLabel(h.lease.snapshot.sync), expect.syncLabel, `${where} sync label`);
	}
	if (expect.rerenders !== undefined) {
		assert.strictEqual(rerenders, expect.rerenders, `${where} row re-renders in this step`);
	}
}

function assertEntryFields(h: StreamHarness, expect: EntryExpect, at: string): void {
	const entry = h.entries().find(e => e.id === expect.id);
	if (Object.keys(expect).some(key => key !== 'id' && key !== 'kind' && key !== 'text' && key !== 'lacks')) {
		assert.ok(entry, `${at} has no projected entry "${expect.id}"`);
	}
	if (expect.streaming !== undefined) {
		assert.strictEqual(entry?.streaming === true, expect.streaming, `${at} streaming`);
	}
	if (expect.status !== undefined) {
		assert.strictEqual(entry?.status, expect.status, `${at} status`);
	}
	if (expect.toolStatus !== undefined) {
		assert.strictEqual(entry?.toolStatus, expect.toolStatus, `${at} toolStatus`);
	}
	if (expect.respondable !== undefined) {
		assert.strictEqual(entry?.respondable === true, expect.respondable, `${at} respondable`);
	}
	if (expect.retryable !== undefined) {
		assert.strictEqual(entry?.retryable === true, expect.retryable, `${at} retryable`);
	}
	if (expect.typeName !== undefined) {
		assert.strictEqual(entry?.typeName, expect.typeName, `${at} typeName`);
	}
	if (expect.answerKeysValid !== undefined) {
		assert.strictEqual(entry?.answerKeysValid === true, expect.answerKeysValid, `${at} answerKeysValid`);
	}
	if (expect.questionItems !== undefined) {
		assert.deepStrictEqual((entry?.questionItems ?? []).map(item => item.id), expect.questionItems, `${at} questionItems`);
	}
	if (expect.questionRequestId !== undefined) {
		assert.strictEqual(entry?.questionRequestId ?? null, expect.questionRequestId, `${at} questionRequestId`);
	}
}

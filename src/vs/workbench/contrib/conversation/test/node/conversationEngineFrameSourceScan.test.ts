/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const FRAME_SOURCE_REL = 'src/vs/workbench/contrib/conversation/browser/conversationEngineFrameSource.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const flushTicks = async (ticks = 5) => {
	for (let i = 0; i < ticks; i++) {
		await Promise.resolve();
	}
};

suite('conversationEngineFrameSource scan and contract (r08-1, r08-2, r08-4)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	// r08-1: getCachedProjection requires hasBaseline gate
	test('getCachedProjection requires hasBaseline gate in source (r08-1)', () => {
		const source = fs.readFileSync(resolveSource(FRAME_SOURCE_REL), 'utf8');

		// 1. Guard check in getCachedProjection
		const getCachedMatch = source.match(/getCachedProjection\s*\([^)]*\)\s*:\s*ConversationSessionViewProjection\s*\|\s*undefined\s*\{[\s\S]*?\n\t\}/);
		assert.ok(getCachedMatch, 'getCachedProjection method must be found in source');
		const getCachedBody = getCachedMatch[0];

		assert.ok(
			getCachedBody.includes('!binding.hasBaseline'),
			'getCachedProjection must check !binding.hasBaseline',
		);
		assert.ok(
			getCachedBody.includes('if (!binding || !binding.exposesCachedProjection() || !binding.hasBaseline)'),
			'getCachedProjection must require !binding || !binding.exposesCachedProjection() || !binding.hasBaseline',
		);
		assert.ok(
			!/if\s*\(!binding\s*\|\|\s*!binding\.exposesCachedProjection\(\)\s*\)\s*\{/.test(getCachedBody),
			'Old getCachedProjection check without hasBaseline must not be present',
		);

		// 2. hasBaseline getter on SharedEngineHostBinding
		assert.ok(
			source.includes('get hasBaseline(): boolean {\n\t\treturn this.hasReceivedBaseline;\n\t}'),
			'hasBaseline getter must reflect hasReceivedBaseline',
		);

		// 3. hasReceivedBaseline only becomes true on baseline frame
		assert.ok(
			source.includes("if (frame.frame.body.kind === 'baseline') {\n\t\t\tthis.hasReceivedBaseline = true;\n\t\t}"),
			'hasReceivedBaseline must be set true only when body.kind === "baseline"',
		);
	});

	test('getCachedProjection baseline gate contract logic', () => {
		function evaluateCachedProjection(binding: { exposesCachedProjection: () => boolean; hasBaseline: boolean } | undefined) {
			if (!binding || !binding.exposesCachedProjection() || !binding.hasBaseline) {
				return undefined;
			}
			return { cached: true };
		}

		assert.strictEqual(evaluateCachedProjection(undefined), undefined);
		assert.strictEqual(evaluateCachedProjection({ exposesCachedProjection: () => false, hasBaseline: false }), undefined);
		assert.strictEqual(evaluateCachedProjection({ exposesCachedProjection: () => false, hasBaseline: true }), undefined);
		// Baseline not yet arrived must return undefined even if binding exposes cache
		assert.strictEqual(evaluateCachedProjection({ exposesCachedProjection: () => true, hasBaseline: false }), undefined);
		// Baseline arrived and exposes cache returns projection
		assert.deepStrictEqual(evaluateCachedProjection({ exposesCachedProjection: () => true, hasBaseline: true }), { cached: true });
	});

	// r08-2: addConsumer separates hasReceivedBaseline from cursor and triggers requestResync
	test('addConsumer separates hasReceivedBaseline from cursor in source (r08-2)', () => {
		const source = fs.readFileSync(resolveSource(FRAME_SOURCE_REL), 'utf8');

		const addConsumerMatch = source.match(/addConsumer\s*\([^)]*\)\s*:\s*void\s*\{[\s\S]*?\n\t\}/);
		assert.ok(addConsumerMatch, 'addConsumer method must be found in source');
		const addConsumerBody = addConsumerMatch[0];

		assert.ok(
			addConsumerBody.includes('if (this.hasReceivedBaseline) {'),
			'addConsumer must check if (this.hasReceivedBaseline) for syncInitialSnapshot',
		);
		assert.ok(
			addConsumerBody.includes('} else if (this.cursor !== null) {'),
			'addConsumer must have else if (this.cursor !== null) branch',
		);
		assert.ok(
			addConsumerBody.includes('this.requestResync();'),
			'addConsumer must call this.requestResync() when cursor is present without baseline',
		);
		assert.ok(
			!source.includes('this.hasReceivedBaseline || this.cursor !== null'),
			'Merged condition (hasReceivedBaseline || cursor !== null) must not be present',
		);
	});

	test('addConsumer baseline vs cursor resync contract logic', () => {
		let initialSnapshotSynced = false;
		let resyncRequested = false;

		function handleNewConsumer(hasReceivedBaseline: boolean, cursor: unknown | null) {
			initialSnapshotSynced = false;
			resyncRequested = false;
			if (hasReceivedBaseline) {
				initialSnapshotSynced = true;
			} else if (cursor !== null) {
				resyncRequested = true;
			}
		}

		// Case 1: Baseline received -> sync initial snapshot, no resync
		handleNewConsumer(true, { generation: 1, frameId: 1, version: 1 });
		assert.strictEqual(initialSnapshotSynced, true);
		assert.strictEqual(resyncRequested, false);

		// Case 2: No baseline, but cursor exists (e.g. non-baseline frame arrived) -> requestResync, no initial snapshot
		handleNewConsumer(false, { generation: 1, frameId: 2, version: 2 });
		assert.strictEqual(initialSnapshotSynced, false);
		assert.strictEqual(resyncRequested, true);

		// Case 3: Neither baseline nor cursor -> wait for first host frame, no resync
		handleNewConsumer(false, null);
		assert.strictEqual(initialSnapshotSynced, false);
		assert.strictEqual(resyncRequested, false);
	});

	// r08-4: requestResync in-flight tracking, coalescing, and failure retry follow-up
	test('requestResync maintains in-flight tracking and retry follow-up in source (r08-4)', () => {
		const source = fs.readFileSync(resolveSource(FRAME_SOURCE_REL), 'utf8');

		// Field declarations
		assert.ok(source.includes('private resyncPending = false;'), 'resyncPending field must exist');
		assert.ok(source.includes('private resyncFollowUp = false;'), 'resyncFollowUp field must exist');
		assert.ok(source.includes('private resyncFollowUpFromFailure = false;'), 'resyncFollowUpFromFailure field must exist');

		// Method body
		const requestResyncMatch = source.match(/requestResync\s*\(\s*\)\s*:\s*void\s*\{[\s\S]*?\n\t\}/);
		assert.ok(requestResyncMatch, 'requestResync method must be found in source');
		const body = requestResyncMatch[0];

		assert.ok(body.includes('if (!this.leaseId) {\n\t\t\treturn;\n\t\t}'), 'Must return if no leaseId');
		assert.ok(body.includes('if (this.resyncPending) {\n\t\t\tthis.resyncFollowUp = true;\n\t\t\treturn;\n\t\t}'), 'Must mark followUp and return when resyncPending');
		assert.ok(body.includes('this.resyncPending = true;'), 'Must set resyncPending = true');
		assert.ok(body.includes('void this.sessionView.requestResync(this.leaseId)'), 'Must call sessionView.requestResync');
		assert.ok(body.includes('if (!this.resyncFollowUpFromFailure) {\n\t\t\t\t\tthis.resyncFollowUp = true;\n\t\t\t\t}'), 'Catch must schedule follow-up only if not already from failure');
		assert.ok(body.includes('this.resyncPending = false;'), 'Finally must clear resyncPending');
		assert.ok(body.includes('if (this.resyncFollowUp) {\n\t\t\t\t\tthis.resyncFollowUp = false;\n\t\t\t\t\tthis.resyncFollowUpFromFailure = true;\n\t\t\t\t\tthis.requestResync();\n\t\t\t\t} else {\n\t\t\t\t\tthis.resyncFollowUpFromFailure = false;\n\t\t\t\t}'), 'Finally must trigger follow-up and toggle resyncFollowUpFromFailure');
	});

	test('requestResync state machine contract: single success, in-flight coalesce, and failure retry without infinite loop', async () => {
		class ResyncStateMachineHarness {
			leaseId = 'lease-1';
			resyncPending = false;
			resyncFollowUp = false;
			resyncFollowUpFromFailure = false;

			readonly calls: string[] = [];
			requestResyncFn: (leaseId: string) => Promise<void> = async () => { };

			requestResync(): void {
				if (!this.leaseId) {
					return;
				}
				if (this.resyncPending) {
					this.resyncFollowUp = true;
					return;
				}
				this.resyncPending = true;
				this.calls.push(this.leaseId);
				void this.requestResyncFn(this.leaseId)
					.catch(() => {
						if (!this.resyncFollowUpFromFailure) {
							this.resyncFollowUp = true;
						}
					})
					.finally(() => {
						this.resyncPending = false;
						if (this.resyncFollowUp) {
							this.resyncFollowUp = false;
							this.resyncFollowUpFromFailure = true;
							this.requestResync();
						} else {
							this.resyncFollowUpFromFailure = false;
						}
					});
			}
		}

		// 1. Without leaseId, no call made
		{
			const harness = new ResyncStateMachineHarness();
			harness.leaseId = '';
			harness.requestResync();
			assert.deepStrictEqual(harness.calls, []);
		}

		// 2. Normal successful call
		{
			const harness = new ResyncStateMachineHarness();
			harness.requestResync();
			assert.strictEqual(harness.resyncPending, true);
			assert.deepStrictEqual(harness.calls, ['lease-1']);
			await flushTicks(3);
			assert.strictEqual(harness.resyncPending, false);
			assert.strictEqual(harness.resyncFollowUp, false);
			assert.deepStrictEqual(harness.calls, ['lease-1']);
		}

		// 3. Concurrent requests during flight are coalesced into exactly one follow-up
		{
			const harness = new ResyncStateMachineHarness();
			let resolveFlight!: () => void;
			harness.requestResyncFn = () => new Promise<void>(resolve => { resolveFlight = resolve; });

			harness.requestResync();
			assert.strictEqual(harness.calls.length, 1);
			assert.strictEqual(harness.resyncPending, true);

			// Second and third concurrent requests arrive while first is in-flight
			harness.requestResync();
			harness.requestResync();
			assert.strictEqual(harness.calls.length, 1, 'In-flight calls must not immediately fire a new request');
			assert.strictEqual(harness.resyncFollowUp, true);

			// Settle first flight
			resolveFlight();
			await flushTicks(4);

			// Follow-up fired exactly once
			assert.strictEqual(harness.calls.length, 2);
		}

		// 4. Failure retries once, then stops if follow-up also fails
		{
			const harness = new ResyncStateMachineHarness();
			harness.requestResyncFn = () => Promise.reject(new Error('resync network error'));

			harness.requestResync();
			assert.strictEqual(harness.calls.length, 1);

			// First reject settles -> triggers follow-up retry
			await flushTicks(4);
			assert.strictEqual(harness.calls.length, 2, 'Must retry once on failure');

			// Follow-up reject settles -> must NOT loop infinitely
			await flushTicks(4);
			assert.strictEqual(harness.calls.length, 2, 'Must not retry infinitely on repeated failure');
			assert.strictEqual(harness.resyncPending, false);
			assert.strictEqual(harness.resyncFollowUp, false);
			assert.strictEqual(harness.resyncFollowUpFromFailure, false);
		}

		// 5. Failure follow-up succeeds and clears failure flag
		{
			const harness = new ResyncStateMachineHarness();
			let attempts = 0;
			harness.requestResyncFn = async () => {
				attempts++;
				if (attempts === 1) {
					throw new Error('first attempt failed');
				}
			};

			harness.requestResync();
			assert.strictEqual(harness.calls.length, 1);

			await flushTicks(4);
			assert.strictEqual(harness.calls.length, 2);
			assert.strictEqual(harness.resyncPending, false);
			assert.strictEqual(harness.resyncFollowUpFromFailure, false);
		}
	});

	// r08-3: subagent overlay reparenting on late-appearing timeline without teardown
	test('subagent overlay reparenting on late-appearing timeline in source (r08-3)', () => {
		const contribSource = fs.readFileSync(resolveSource('src/vs/workbench/contrib/conversation/browser/conversationSessionChat.contribution.ts'), 'utf8');
		const serviceSource = fs.readFileSync(resolveSource('src/vs/workbench/contrib/conversation/browser/conversationSessionChatService.ts'), 'utf8');
		const overlaySource = fs.readFileSync(resolveSource('src/vs/workbench/contrib/conversation/browser/conversationSubAgentOverlay.ts'), 'utf8');

		// 1. Contribution must filter timeline host and not select inside subagent overlay
		assert.ok(
			contribSource.includes('function selectSubAgentOverlayHost'),
			'Contribution must select the editor timeline as the overlay host'
		);
		assert.ok(
			contribSource.includes('probed.closest(`.${conversationSubAgentOverlayClass}`)'),
			'overlay host selection must exclude a timeline inside the subagent overlay'
		);

		// 2. Contribution must reparent on host change rather than unmount
		assert.ok(
			contribSource.includes('this.sessionChatService.reparentSubAgentOverlay(sessionKey, host);'),
			'Contribution must call reparentSubAgentOverlay on host change'
		);
		assert.ok(
			!contribSource.includes('previousHost !== undefined && previousHost !== host'),
			'Old pattern unmounting on host mismatch must not exist'
		);

		// 3. Service must implement reparentSubAgentOverlay
		assert.ok(
			serviceSource.includes('reparentSubAgentOverlay(sessionKey: string, newHost: unknown): void'),
			'Service must have reparentSubAgentOverlay method'
		);
		assert.ok(
			serviceSource.includes('overlay.reparent(newHost);'),
			'reparentSubAgentOverlay must invoke overlay.reparent'
		);

		// 4. Overlay must have reparent method
		assert.ok(
			overlaySource.includes('reparent(parent: HTMLElement): void'),
			'ConversationSubAgentOverlay must have reparent method'
		);
		assert.ok(
			overlaySource.includes('append(parent, this.element);'),
			'Overlay reparent must append this.element to parent'
		);
	});

	test('timeline host selection contract ignores internal overlay timeline (r08-3)', () => {
		interface IFakeNode {
			className: string;
			parent?: IFakeNode;
			children: IFakeNode[];
		}

		function closest(node: IFakeNode, className: string): boolean {
			let curr: IFakeNode | undefined = node;
			while (curr) {
				if (curr.className.split(' ').includes(className)) {
					return true;
				}
				curr = curr.parent;
			}
			return false;
		}

		function findTimelineHostContract(root: IFakeNode): IFakeNode {
			const timelines: IFakeNode[] = [];
			function walk(node: IFakeNode) {
				if (node.className.split(' ').includes('conversation-timeline')) {
					timelines.push(node);
				}
				for (const child of node.children) {
					walk(child);
				}
			}
			walk(root);

			for (const candidate of timelines) {
				if (!closest(candidate, 'conversation-subagent-overlay')) {
					return candidate;
				}
			}
			return root;
		}

		const root: IFakeNode = { className: 'session-window', children: [] };
		// Initially root only
		assert.strictEqual(findTimelineHostContract(root), root);

		// Add overlay with internal timeline
		const overlay: IFakeNode = { className: 'conversation-subagent-overlay', parent: root, children: [] };
		const innerTimeline: IFakeNode = { className: 'conversation-timeline', parent: overlay, children: [] };
		overlay.children.push(innerTimeline);
		root.children.push(overlay);

		// Should still return root, NOT innerTimeline
		assert.strictEqual(findTimelineHostContract(root), root);

		// Add actual editor timeline
		const editorTimeline: IFakeNode = { className: 'conversation-timeline', parent: root, children: [] };
		root.children.push(editorTimeline);

		// Should now select editorTimeline
		assert.strictEqual(findTimelineHostContract(root), editorTimeline);
	});
});

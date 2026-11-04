/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createStreamHarness } from './streamHarness.js';
import { runStreamScript } from './streamScript.js';
import { STREAM_SCRIPTS } from './streamScripts.js';

/**
 * One test per script in `streamScripts.ts`. This file never needs to change when a case is added.
 */
suite('Conversation stream scripts', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('script ids are unique', () => {
		const ids = STREAM_SCRIPTS.map(s => s.id);
		assert.deepStrictEqual(ids, [...new Set(ids)]);
	});

	for (const script of STREAM_SCRIPTS) {
		test(`${script.id}: ${script.title}`, async () => {
			await runStreamScript(createStreamHarness(store), script);
		});
	}

	test('Codex deterministic turn crosses the scripted host bridge and paints tool state', async () => {
		const harness = createStreamHarness(store, 'codex-scripted-session');

		const submit = await harness.lease.post({ kind: 'submitInput', text: 'scenario:tool-lifecycle' });
		assert.deepStrictEqual(submit, { accepted: true, correlation: { id: 'scripted' } });
		assert.deepStrictEqual(harness.view.posted, [{ kind: 'submitInput', text: 'scenario:tool-lifecycle' }]);

		const user = harness.view.userItem('turn-user', 'prompt:tool-lifecycle', '0000000001');
		const tool = harness.view.toolItem('call-001', '0000000002', {
			title: 'workspace.list',
			toolName: 'workspace.list',
			status: 'pending',
		});
		harness.view.patches([user.patch, tool.patch], { attribution: [user.attribution, tool.attribution] });
		await harness.settle();
		assert.deepStrictEqual(harness.applied.map(frame => frame.kind), ['patches']);
		assert.deepStrictEqual(harness.entries().map(entry => [entry.id, entry.toolStatus, entry.streaming]), [
			['turn-user', undefined, undefined],
			['call-001', 'pending', true],
		]);
		assert.deepStrictEqual(harness.rowIds(), ['turn-user', 'fold:call-001']);

		const running = harness.view.toolItem('call-001', '0000000002', {
			title: 'workspace.list',
			toolName: 'workspace.list',
			status: 'running',
			argPreview: 'root',
		});
		harness.view.patches([running.patch], { attribution: [running.attribution] });
		await harness.settle();
		assert.deepStrictEqual(harness.entries().map(entry => [entry.id, entry.toolStatus, entry.streaming]), [
			['turn-user', undefined, undefined],
			['call-001', 'running', true],
		]);

		const completed = harness.view.toolItem('call-001', '0000000002', {
			title: 'workspace.list',
			toolName: 'workspace.list',
			status: 'completed',
			argPreview: 'root',
			resultPreview: 'entry:file-a',
		});
		const assistant = harness.view.assistantItem('turn-assistant', 'result:deterministic', '0000000003');
		harness.view.patches([completed.patch, assistant.patch], { attribution: [completed.attribution, assistant.attribution] });
		await harness.settle();
		assert.deepStrictEqual(harness.entries().map(entry => [entry.id, entry.toolStatus, entry.streaming]), [
			['turn-user', undefined, undefined],
			['call-001', 'completed', undefined],
			['turn-assistant', undefined, undefined],
		]);
		assert.deepStrictEqual(harness.rowIds(), ['turn-user', 'fold:call-001', 'turn-assistant']);
	});

	test('Codex deterministic tool error crosses the scripted host bridge and keeps failed fold order', async () => {
		const harness = createStreamHarness(store, 'codex-scripted-tool-error');

		const submit = await harness.lease.post({ kind: 'submitInput', text: 'scenario:tool-error' });
		assert.deepStrictEqual(submit, { accepted: true, correlation: { id: 'scripted' } });
		assert.deepStrictEqual(harness.view.posted, [{ kind: 'submitInput', text: 'scenario:tool-error' }]);

		const user = harness.view.userItem('error-user', 'prompt:tool-error', '0000000001');
		const pending = harness.view.toolItem('call-error', '0000000002', {
			title: 'workspace.write',
			toolName: 'workspace.write',
			status: 'pending',
		});
		harness.view.patches([user.patch, pending.patch], { attribution: [user.attribution, pending.attribution] });
		await harness.settle();
		assert.deepStrictEqual(harness.applied.map(frame => frame.kind), ['patches']);
		const pendingFrame = harness.applied[0];
		if (pendingFrame?.kind !== 'patches') {
			throw new Error('pending tool frame was not a patches event');
		}
		assert.deepStrictEqual([...pendingFrame.changedIds].sort(), ['call-error', 'error-user']);
		assert.deepStrictEqual(harness.entries().map(entry => [entry.id, entry.toolStatus, entry.streaming]), [
			['error-user', undefined, undefined],
			['call-error', 'pending', true],
		]);
		assert.deepStrictEqual(harness.rowIds(), ['error-user', 'fold:call-error']);

		const failed = harness.view.toolItem('call-error', '0000000002', {
			title: 'workspace.write',
			toolName: 'workspace.write',
			status: 'failed',
			argPreview: 'README.md',
			resultPreview: 'permission denied',
		});
		const assistant = harness.view.assistantItem('error-assistant', 'write failed: permission denied', '0000000003');
		harness.view.patches([failed.patch, assistant.patch], { attribution: [failed.attribution, assistant.attribution] });
		await harness.settle();
		assert.deepStrictEqual(harness.applied.map(frame => frame.kind), ['patches', 'patches']);
		const failedFrame = harness.applied[1];
		if (failedFrame?.kind !== 'patches') {
			throw new Error('failed tool frame was not a patches event');
		}
		assert.deepStrictEqual([...failedFrame.changedIds].sort(), ['call-error', 'error-assistant']);
		assert.deepStrictEqual(harness.entries().map(entry => [entry.id, entry.toolStatus, entry.streaming]), [
			['error-user', undefined, undefined],
			['call-error', 'failed', undefined],
			['error-assistant', undefined, undefined],
		]);
		assert.deepStrictEqual(harness.rowIds(), ['error-user', 'fold:call-error', 'error-assistant']);
	});
});

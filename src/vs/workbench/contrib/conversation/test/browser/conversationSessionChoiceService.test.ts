/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createUnknownConversationEntryCapability } from '../../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import type { UniverseAgentCapabilitySupport, UniverseAgentConnectionSnapshot, UniverseAgentGetPermissionModeResult, UniverseAgentSessionToolPermissionMode } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { applySessionModelIndex, applySessionPermissionIndex, paintSessionChoice, syncSessionConfigSelects, type IConversationLensComposerChromeHost } from '../../browser/conversationLensComposerChrome.js';
import type { IConversationSessionChoiceService } from '../../browser/conversationSessionChoiceService.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { createTestComposerModel } from './conversationComposerModelTestUtils.js';
import { createTestSessionChoiceService } from './conversationSessionChoiceTestUtils.js';

type ModelResponse = { resolvedModelId: string; provider: string; level: number; cost: string; speed: string };

suite('ConversationSessionChoiceService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const sessionId = 'sess-shared';
	const catalogModelIds = ['', 'gpt-a', 'gpt-b', 'gpt-c'];

	function modelView(service: IConversationSessionChoiceService, switchModel: (modelId: string) => Promise<ModelResponse>, setPermissionMode?: (mode: string) => Promise<{ ok: boolean }>) {
		const selects: number[] = [];
		const permissionSelects: number[] = [];
		const view = {
			isDisposed: false,
			composerModel: createTestComposerModel(store),
			sessionChoiceService: service,
			catalogModelIds,
			modelSelectedIndex: 0,
			submitInFlight: false,
			dockTextarea: { value: '' },
			sendButton: { enabled: true },
			gateRow: document.createElement('div'),
			gateLabel: document.createElement('span'),
			permissionSelectBox: { select(index: number) { permissionSelects.push(index); } },
			agentSelectBox: { select() { } },
			modelSelectBox: {
				select(index: number) {
					selects.push(index);
					view.modelSelectedIndex = index;
				},
			},
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
				switchModel: (request: { modelId: string }) => switchModel(request.modelId),
				setPermissionMode: setPermissionMode && ((request: { mode: string }) => setPermissionMode(request.mode)),
			},
			getBoundSessionId: () => sessionId,
		};
		const host = view as unknown as IConversationLensComposerChromeHost;
		store.add(service.onDidChangeSessionChoice(id => paintSessionChoice(host, id)));
		return { view, host, selects, permissionSelects };
	}

	function accepted(modelId: string): Promise<ModelResponse> {
		return Promise.resolve({ resolvedModelId: modelId, provider: '', level: 0, cost: '', speed: '' });
	}

	test('a second view on the same session opens on the accepted model and rolls back to it', async () => {
		const service = createTestSessionChoiceService(store);
		const calls: string[] = [];
		let fail = false;
		const respond = (modelId: string) => {
			calls.push(modelId);
			return fail ? Promise.reject(new Error('model rejected')) : accepted(modelId);
		};
		const first = modelView(service, respond);
		await applySessionModelIndex(first.host, sessionId, 1);
		assert.strictEqual(service.modelProfileIdBySessionId.get(sessionId), 'gpt-a');

		const second = modelView(service, respond);
		assert.strictEqual(second.view.modelSelectedIndex, 0);
		syncSessionConfigSelects(second.host, sessionId);
		assert.strictEqual(second.view.modelSelectedIndex, 1);
		assert.strictEqual(service.modelProfileIdBySessionId.get(sessionId), 'gpt-a');

		fail = true;
		await applySessionModelIndex(second.host, sessionId, 2);
		assert.deepStrictEqual(calls, ['gpt-a', 'gpt-b']);
		assert.strictEqual(second.view.modelSelectedIndex, 1);
		assert.strictEqual(first.view.modelSelectedIndex, 1);
		assert.strictEqual(service.modelProfileIdBySessionId.get(sessionId), 'gpt-a');
	});

	test('a choice from the second view while the first is in flight sends only the latest target and both views settle on it', async () => {
		const service = createTestSessionChoiceService(store);
		const calls: string[] = [];
		let releaseFirst: (() => void) | undefined;
		let firstStarted: (() => void) | undefined;
		const firstEntered = new Promise<void>(resolve => { firstStarted = resolve; });
		const firstHold = new Promise<void>(resolve => { releaseFirst = resolve; });
		const respond = (modelId: string) => {
			calls.push(modelId);
			if (calls.length === 1) {
				firstStarted?.();
				return firstHold.then(() => accepted(modelId));
			}
			return accepted(modelId);
		};
		const first = modelView(service, respond);
		const second = modelView(service, respond);

		const firstApply = applySessionModelIndex(first.host, sessionId, 2);
		await firstEntered;
		const secondApply = applySessionModelIndex(second.host, sessionId, 3);
		releaseFirst!();
		await firstApply;
		await secondApply;

		assert.deepStrictEqual(calls, ['gpt-b', 'gpt-c']);
		assert.strictEqual(service.modelProfileIdBySessionId.get(sessionId), 'gpt-c');
		assert.strictEqual(first.view.modelSelectedIndex, 3);
		assert.strictEqual(second.view.modelSelectedIndex, 3);
	});

	test('a result that lands after its view closed still updates the session and the other view', async () => {
		const service = createTestSessionChoiceService(store);
		let release: (() => void) | undefined;
		let started: (() => void) | undefined;
		const entered = new Promise<void>(resolve => { started = resolve; });
		const hold = new Promise<void>(resolve => { release = resolve; });
		const respond = (modelId: string) => {
			started?.();
			return hold.then(() => accepted(modelId));
		};
		const first = modelView(service, respond);
		const second = modelView(service, respond);

		const apply = applySessionModelIndex(first.host, sessionId, 2);
		await entered;
		first.view.isDisposed = true;
		const firstSelects = first.selects.length;
		release!();
		await apply;

		assert.strictEqual(service.modelProfileIdBySessionId.get(sessionId), 'gpt-b');
		assert.strictEqual(second.view.modelSelectedIndex, 2);
		assert.strictEqual(first.selects.length, firstSelects);
	});

	function linkedService() {
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let snapshot: UniverseAgentConnectionSnapshot = { ...createConversationConnectionTestStub().getConnectionSnapshot(), linkId: 1 };
		const connection = createConversationConnectionTestStub({
			getConnectionSnapshot: () => snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
		});
		const service = createTestSessionChoiceService(store, { connection });
		return {
			service,
			changeLink(linkId: number) {
				snapshot = { ...snapshot, linkId };
				onDidChangeConnection.fire(snapshot);
			},
		};
	}

	test('a permission result from the previous link does not refill the session and a new choice does not join its flight', async () => {
		const { service, changeLink } = linkedService();
		const modes: string[] = [];
		let releaseOld: (() => void) | undefined;
		let oldStarted: (() => void) | undefined;
		const oldEntered = new Promise<void>(resolve => { oldStarted = resolve; });
		const oldHold = new Promise<void>(resolve => { releaseOld = resolve; });
		const view = modelView(service, accepted, mode => {
			modes.push(mode);
			if (modes.length === 1) {
				oldStarted?.();
				return oldHold.then(() => ({ ok: true }));
			}
			return Promise.resolve({ ok: true });
		});

		const oldApply = applySessionPermissionIndex(view.host, sessionId, 2);
		await oldEntered;
		changeLink(2);
		assert.strictEqual(service.sessionConfigBySessionId.size, 0);

		await applySessionPermissionIndex(view.host, sessionId, 1);
		assert.strictEqual(modes.length, 2);
		assert.strictEqual(service.sessionConfigBySessionId.get(sessionId)?.permissionIndex, 1);

		releaseOld!();
		await oldApply;
		assert.strictEqual(modes.length, 2);
		assert.strictEqual(service.sessionConfigBySessionId.get(sessionId)?.permissionIndex, 1);
	});

	test('a model result from the previous link does not refill the session and a new choice does not join its flight', async () => {
		const { service, changeLink } = linkedService();
		const calls: string[] = [];
		let releaseOld: (() => void) | undefined;
		let oldStarted: (() => void) | undefined;
		const oldEntered = new Promise<void>(resolve => { oldStarted = resolve; });
		const oldHold = new Promise<void>(resolve => { releaseOld = resolve; });
		const view = modelView(service, modelId => {
			calls.push(modelId);
			if (calls.length === 1) {
				oldStarted?.();
				return oldHold.then(() => accepted(modelId));
			}
			return accepted(modelId);
		});

		const oldApply = applySessionModelIndex(view.host, sessionId, 1);
		await oldEntered;
		changeLink(2);
		assert.strictEqual(service.modelProfileIdBySessionId.size, 0);

		await applySessionModelIndex(view.host, sessionId, 3);
		assert.deepStrictEqual(calls, ['gpt-a', 'gpt-c']);
		assert.strictEqual(service.modelProfileIdBySessionId.get(sessionId), 'gpt-c');

		releaseOld!();
		await oldApply;
		assert.deepStrictEqual(calls, ['gpt-a', 'gpt-c']);
		assert.strictEqual(service.modelProfileIdBySessionId.get(sessionId), 'gpt-c');
		assert.strictEqual(view.view.modelSelectedIndex, 3);
	});

	test('the choice maps survive a refresh on the same link and clear when the link changes', () => {
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let snapshot: UniverseAgentConnectionSnapshot = { ...createConversationConnectionTestStub().getConnectionSnapshot(), linkId: 1 };
		const connection = createConversationConnectionTestStub({
			getConnectionSnapshot: () => snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
		});
		const service = createTestSessionChoiceService(store, { connection });
		service.sessionConfigBySessionId.set(sessionId, { agentIndex: 1, permissionIndex: 2 });
		service.modelProfileIdBySessionId.set(sessionId, 'gpt-a');

		snapshot = { ...snapshot, pairingPending: true };
		onDidChangeConnection.fire(snapshot);
		snapshot = { ...snapshot, pairingPending: false, agentTreeFetchFailed: true };
		onDidChangeConnection.fire(snapshot);
		assert.deepStrictEqual(service.sessionConfigBySessionId.get(sessionId), { agentIndex: 1, permissionIndex: 2 });
		assert.strictEqual(service.modelProfileIdBySessionId.get(sessionId), 'gpt-a');

		snapshot = { ...snapshot, linkId: 2 };
		onDidChangeConnection.fire(snapshot);
		assert.strictEqual(service.sessionConfigBySessionId.size, 0);
		assert.strictEqual(service.modelProfileIdBySessionId.size, 0);

		service.modelProfileIdBySessionId.set(sessionId, 'gpt-b');
		snapshot = { ...snapshot, linkId: undefined };
		onDidChangeConnection.fire(snapshot);
		assert.strictEqual(service.modelProfileIdBySessionId.size, 0);
	});

	function readBackService(getPermissionMode: (sessionId: string) => Promise<UniverseAgentGetPermissionModeResult>, support: UniverseAgentCapabilitySupport = 'SUPPORTED') {
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		let snapshot: UniverseAgentConnectionSnapshot = {
			...createConversationConnectionTestStub().getConnectionSnapshot(),
			linkId: 1,
			conversationEntryCapability: { ...createUnknownConversationEntryCapability(), getPermissionMode: support },
		};
		const connection = createConversationConnectionTestStub({
			getConnectionSnapshot: () => snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			getPermissionMode: request => getPermissionMode(request.sessionId),
		});
		const service = createTestSessionChoiceService(store, { connection });
		return {
			service,
			changeLink(linkId: number) {
				snapshot = { ...snapshot, linkId };
				onDidChangeConnection.fire(snapshot);
			},
		};
	}

	test('a bound session shows the mode the engine applies and a failed choice rolls back to it', async () => {
		const reads: string[] = [];
		const { service } = readBackService(id => {
			reads.push(id);
			return Promise.resolve({ mode: 'SESSION_TOOL_PERMISSION_MODE_PERMIT' });
		});
		const view = modelView(service, accepted, () => Promise.resolve({ ok: false }));

		await service.readBackPermissionMode(sessionId);
		await service.readBackPermissionMode(sessionId);
		const shownAfterRead = view.permissionSelects.at(-1);
		await applySessionPermissionIndex(view.host, sessionId, 0);

		assert.deepStrictEqual({
			reads,
			shownAfterRead,
			shownAfterFailure: view.permissionSelects.at(-1),
			permissionIndex: service.sessionConfigBySessionId.get(sessionId)?.permissionIndex,
		}, { reads: [sessionId], shownAfterRead: 2, shownAfterFailure: 2, permissionIndex: 2 });
	});

	test('the read needs explicit support, and a failed or unknown read keeps the local choice', async () => {
		for (const support of ['UNKNOWN', 'UNSUPPORTED'] as const) {
			let calls = 0;
			const { service } = readBackService(() => {
				calls++;
				return Promise.resolve({ mode: 'SESSION_TOOL_PERMISSION_MODE_PERMIT' });
			}, support);
			await service.readBackPermissionMode(sessionId);
			assert.deepStrictEqual({ support, calls, size: service.sessionConfigBySessionId.size }, { support, calls: 0, size: 0 });
		}

		const replies: Array<() => Promise<UniverseAgentGetPermissionModeResult>> = [
			() => Promise.reject(new Error('Session not found')),
			() => Promise.resolve({ mode: 'SESSION_TOOL_PERMISSION_MODE_UNSPECIFIED' }),
		];
		let calls = 0;
		const { service } = readBackService(() => replies[calls++]());
		service.sessionConfigBySessionId.set(sessionId, { agentIndex: 0, permissionIndex: 1 });
		await service.readBackPermissionMode(sessionId);
		await service.readBackPermissionMode(sessionId);
		await service.readBackPermissionMode(sessionId);
		assert.deepStrictEqual({ calls, config: service.sessionConfigBySessionId.get(sessionId) }, { calls: 2, config: { agentIndex: 0, permissionIndex: 1 } });
	});

	test('a choice made while the read is out wins over the engine value', async () => {
		let release: (() => void) | undefined;
		const { service } = readBackService(() => new Promise(resolve => {
			release = () => resolve({ mode: 'SESSION_TOOL_PERMISSION_MODE_PERMIT' });
		}));
		const view = modelView(service, accepted, () => Promise.resolve({ ok: true }));

		const read = service.readBackPermissionMode(sessionId);
		await applySessionPermissionIndex(view.host, sessionId, 1);
		release!();
		await read;

		assert.deepStrictEqual({
			permissionIndex: service.sessionConfigBySessionId.get(sessionId)?.permissionIndex,
			confirmedIndex: service.permissionEpoch(sessionId, 0).confirmedIndex,
		}, { permissionIndex: 1, confirmedIndex: 1 });
	});

	test('a read from the previous link writes nothing and the new link reads again once', async () => {
		const answers: Array<(mode: UniverseAgentSessionToolPermissionMode) => void> = [];
		const { service, changeLink } = readBackService(() => new Promise(resolve => answers.push(mode => resolve({ mode }))));

		const oldRead = service.readBackPermissionMode(sessionId);
		changeLink(2);
		const newRead = service.readBackPermissionMode(sessionId);
		answers[1]('SESSION_TOOL_PERMISSION_MODE_AGENT');
		await newRead;
		answers[0]('SESSION_TOOL_PERMISSION_MODE_PERMIT');
		await oldRead;
		await service.readBackPermissionMode(sessionId);

		assert.deepStrictEqual({
			calls: answers.length,
			permissionIndex: service.sessionConfigBySessionId.get(sessionId)?.permissionIndex,
		}, { calls: 2, permissionIndex: 1 });
	});
});

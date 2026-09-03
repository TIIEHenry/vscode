/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ConnectionPhase } from '../../../../../platform/universeAgent/common/connectionHubTypes.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { IStatusbarEntry, IStatusbarService, StatusbarAlignment } from '../../../../services/statusbar/browser/statusbar.js';
import { IWorkbenchLayoutService } from '../../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	ConversationSessionStatusBarContribution,
	registerConversationSessionStatusBar,
} from '../../browser/conversationSessionStatusBar.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID, OPEN_ENGINE_PREFERENCES_COMMAND_ID } from '../../common/uaPreferencesPanes.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('Conversation Session StatusBar', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createConnectionStub(overrides: Partial<IUniverseAgentConnection> = {}): IUniverseAgentConnection {
		return createConversationConnectionTestStub(overrides);
	}

	function mountStatusBar(
		stubService: IConversationRosterService,
		connectionOverrides: Partial<IUniverseAgentConnection> = {},
	): Map<string, IStatusbarEntry> {
		registerConversationSessionStatusBar();

		const entries = new Map<string, IStatusbarEntry>();
		const statusbarService = {
			_serviceBrand: undefined,
			addEntry: (entry: IStatusbarEntry, id: string, _alignment: StatusbarAlignment, _priority?: number) => {
				entries.set(id, entry);
				return {
					update: (next: IStatusbarEntry) => {
						entries.set(id, next);
					},
					dispose: () => { },
				};
			},
		} as unknown as IStatusbarService;

		const layoutService = {
			_serviceBrand: undefined,
			isVisible: () => false,
			onDidChangePartVisibility: () => ({ dispose: () => { } }),
		} as unknown as IWorkbenchLayoutService;

		const environmentService = {
			_serviceBrand: undefined,
			isSessionsWindow: false,
		} as IWorkbenchEnvironmentService;

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, stubService);
		instantiationService.stub(IUniverseAgentConnection, createConnectionStub(connectionOverrides));
		instantiationService.stub(IStatusbarService, statusbarService);
		instantiationService.stub(IWorkbenchLayoutService, layoutService);
		instantiationService.stub(IWorkbenchEnvironmentService, environmentService);

		store.add(instantiationService.createInstance(ConversationSessionStatusBarContribution));
		return entries;
	}

	function getEngineCommandId(entry: IStatusbarEntry | undefined): string | undefined {
		if (!entry?.command) {
			return undefined;
		}
		return typeof entry.command === 'string' ? entry.command : entry.command.id;
	}

	function createRosterStub(isEngineConnected: () => boolean): IConversationRosterService {
		const onDidChangeActiveSession = new Emitter<string>();
		const onDidChangeSession = new Emitter<string>();
		const onDidChangeEngineConnection = new Emitter<boolean>();

		return {
			_serviceBrand: undefined,
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			onDidChangeSession: onDidChangeSession.event,
			onDidChangeEngineConnection: onDidChangeEngineConnection.event,
			getActiveSessionId: () => 'untitled',
			getActiveSession: () => ({ id: 'untitled', title: 'Untitled', turns: [] }),
			isEngineConnected,
		} as unknown as IConversationRosterService;
	}

	test('engine entry exposes openConnectionPreferences when disconnected', () => {
		const entries = mountStatusBar(createRosterStub(() => false));
		const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
		assert.strictEqual(getEngineCommandId(engineEntry), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		assert.strictEqual(engineEntry?.text, 'Engine not connected');
	});

	test('engine entry exposes openEnginePreferences when connected', () => {
		const entries = mountStatusBar(
			createRosterStub(() => true),
			{
				isEngineConnected: () => true,
				getConnectionPhase: () => ({ kind: 'connected', path: 'hubRelay' }),
			},
		);
		const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
		assert.strictEqual(getEngineCommandId(engineEntry), OPEN_ENGINE_PREFERENCES_COMMAND_ID);
		assert.strictEqual(engineEntry?.text, 'Engine · Hub relay');
	});

	test('engine entry command switches when engine connection changes', () => {
		const onDidChangeEngineConnection = new Emitter<boolean>();
		let connected = false;

		const stubService = {
			_serviceBrand: undefined,
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			onDidChangeEngineConnection: onDidChangeEngineConnection.event,
			getActiveSessionId: () => 'untitled',
			getActiveSession: () => ({ id: 'untitled', title: 'Untitled', turns: [] }),
			isEngineConnected: () => connected,
		} as unknown as IConversationRosterService;

		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
		let phase: ConnectionPhase = { kind: 'disconnected' };

		const entries = mountStatusBar(stubService, {
			onDidChangeConnection: onDidChangeConnection.event,
			isEngineConnected: () => connected,
			getConnectionPhase: () => phase,
		});

		assert.strictEqual(getEngineCommandId(entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID)), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);

		connected = true;
		phase = { kind: 'connected', path: 'hubRelay' };
		onDidChangeEngineConnection.fire(true);
		onDidChangeConnection.fire({
			transport: 'ok',
			sessionToken: 'tok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});

		const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
		assert.strictEqual(getEngineCommandId(engineEntry), OPEN_ENGINE_PREFERENCES_COMMAND_ID);
		assert.strictEqual(engineEntry?.text, 'Engine · Hub relay');
	});

	suite('H4b ConnectionPhase status copy', () => {
		const phaseCases: Array<{ readonly phase: ConnectionPhase; readonly expected: string }> = [
			{ phase: { kind: 'disconnected' }, expected: 'Engine not connected' },
			{ phase: { kind: 'connecting', reason: 'initial' }, expected: 'Connecting…' },
			{ phase: { kind: 'connecting', reason: 'transport_lost' }, expected: 'Reconnecting…' },
			{ phase: { kind: 'connected', path: 'hubRelay' }, expected: 'Engine · Hub relay' },
			{ phase: { kind: 'connected', path: 'direct' }, expected: 'Engine · Direct' },
			{ phase: { kind: 'failed', code: 'pin_mismatch', reason: 'pin' }, expected: 'Pin mismatch' },
		];

		for (const { phase, expected } of phaseCases) {
			test(`phase ${phase.kind} shows "${expected}"`, () => {
				const entries = mountStatusBar(createRosterStub(() => false), {
					getConnectionPhase: () => phase,
				});
				const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
				assert.strictEqual(engineEntry?.text, expected);
				assert.strictEqual(getEngineCommandId(engineEntry), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
			});
		}

		test('pairing pending keeps Engine not connected even when phase is connecting', () => {
			const entries = mountStatusBar(createRosterStub(() => false), {
				getConnectionPhase: () => ({ kind: 'connecting', reason: 'initial' }),
				getConnectionSnapshot: () => ({
					transport: 'ok',
					pairingPending: true,
					channelAlive: true,
					sharedFsRootSent: false,
					capabilities: createEmptyTestCapabilitySnapshot(),
				}),
			});
			const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
			assert.strictEqual(engineEntry?.text, 'Engine not connected');
			assert.strictEqual(getEngineCommandId(engineEntry), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		});
	});
});

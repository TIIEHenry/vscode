/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
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

suite('Conversation Session StatusBar', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountStatusBar(stubService: IConversationRosterService): Map<string, IStatusbarEntry> {
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

	test('engine entry exposes openConnectionPreferences when disconnected', () => {
		const onDidChangeActiveSession = new Emitter<string>();
		const onDidChangeSession = new Emitter<string>();
		const onDidChangeEngineConnection = new Emitter<boolean>();

		const stubService = {
			_serviceBrand: undefined,
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			onDidChangeSession: onDidChangeSession.event,
			onDidChangeEngineConnection: onDidChangeEngineConnection.event,
			getActiveSessionId: () => 'untitled',
			getActiveSession: () => ({ id: 'untitled', title: 'Untitled', turns: [] }),
			isEngineConnected: () => false,
		} as unknown as IConversationRosterService;

		const entries = mountStatusBar(stubService);
		const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
		assert.strictEqual(getEngineCommandId(engineEntry), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
		assert.strictEqual(engineEntry?.text, 'Engine not connected');
	});

	test('engine entry exposes openEnginePreferences when connected', () => {
		const onDidChangeActiveSession = new Emitter<string>();
		const onDidChangeSession = new Emitter<string>();
		const onDidChangeEngineConnection = new Emitter<boolean>();

		const stubService = {
			_serviceBrand: undefined,
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			onDidChangeSession: onDidChangeSession.event,
			onDidChangeEngineConnection: onDidChangeEngineConnection.event,
			getActiveSessionId: () => 'untitled',
			getActiveSession: () => ({ id: 'untitled', title: 'Untitled', turns: [] }),
			isEngineConnected: () => true,
		} as unknown as IConversationRosterService;

		const entries = mountStatusBar(stubService);
		const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
		assert.strictEqual(getEngineCommandId(engineEntry), OPEN_ENGINE_PREFERENCES_COMMAND_ID);
		assert.strictEqual(engineEntry?.text, 'Engine connected');
	});

	test('engine entry command switches when engine connection changes', () => {
		const onDidChangeActiveSession = new Emitter<string>();
		const onDidChangeSession = new Emitter<string>();
		const onDidChangeEngineConnection = new Emitter<boolean>();
		let connected = false;

		const stubService = {
			_serviceBrand: undefined,
			onDidChangeActiveSession: onDidChangeActiveSession.event,
			onDidChangeSession: onDidChangeSession.event,
			onDidChangeEngineConnection: onDidChangeEngineConnection.event,
			getActiveSessionId: () => 'untitled',
			getActiveSession: () => ({ id: 'untitled', title: 'Untitled', turns: [] }),
			isEngineConnected: () => connected,
		} as unknown as IConversationRosterService;

		const entries = mountStatusBar(stubService);
		assert.strictEqual(getEngineCommandId(entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID)), OPEN_CONNECTION_PREFERENCES_COMMAND_ID);

		connected = true;
		onDidChangeEngineConnection.fire(true);

		const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
		assert.strictEqual(getEngineCommandId(engineEntry), OPEN_ENGINE_PREFERENCES_COMMAND_ID);
		assert.strictEqual(engineEntry?.text, 'Engine connected');
	});
});

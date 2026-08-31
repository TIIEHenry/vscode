/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
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
import { OPEN_CONNECTION_PREFERENCES_COMMAND_ID } from '../../common/uaPreferencesPanes.js';

suite('Conversation Session StatusBar', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('engine entry exposes openConnectionPreferences command', () => {
		registerConversationSessionStatusBar();

		const entries = new Map<string, IStatusbarEntry>();
		const statusbarService = {
			_serviceBrand: undefined,
			addEntry: (entry: IStatusbarEntry, id: string, _alignment: StatusbarAlignment, _priority?: number) => {
				entries.set(id, entry);
				return { update: () => { }, dispose: () => { } };
			},
		} as IStatusbarService;

		const stubService = {
			_serviceBrand: undefined,
			onDidChangeActiveSession: () => ({ dispose: () => { } }),
			onDidChangeSession: () => ({ dispose: () => { } }),
			getActiveSessionId: () => undefined,
			getActiveSession: () => undefined,
		} as IConversationRosterService;

		const layoutService = {
			_serviceBrand: undefined,
			isVisible: () => false,
			onDidChangePartVisibility: () => ({ dispose: () => { } }),
		} as IWorkbenchLayoutService;

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

		const engineEntry = entries.get(ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID);
		assert.ok(engineEntry?.command);
		const commandId = typeof engineEntry.command === 'string'
			? engineEntry.command
			: engineEntry.command.id;
		assert.strictEqual(commandId, OPEN_CONNECTION_PREFERENCES_COMMAND_ID);
	});
});
